import { SEG } from './track.js';
import { PLAYER_Z, CAR_COLORS_PAINT } from './sim.js';
import { buildSprites, CAR_W, CAR_H, CAR_BODY_W, CAR_GROUND } from './sprites.js';

const ROAD_W = 2000;
const CAM_DEPTH = 0.84;
const DRAW = 240;
const lerp = (a, b, t) => a + (b - a) * t;
const HAZE = '#cfe1ee';

const GRASS = ['#5f8f3b', '#598937', '#659542'];
const WALL_H = 260;

function makeProj() {
  return { wx: 0, wy: 0, wz: 0, cx: 0, cy: 0, cz: 0, sx: 0, sy: 0, sw: 0, sc: 0 };
}

export class Renderer {
  constructor(canvas, track) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.track = track;
    this.sky = 0;
    this.cloudX = 0;
    this.braking = false;
    this.lean = 0;
    for (const s of track.segs) { s.p1 = makeProj(); s.p2 = makeProj(); s.looped = false; s.fog = 0; }
    this.sprites = buildSprites(CAR_COLORS_PAINT);
    this.vis = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
  }

  project(p, camX, camY, camZ) {
    p.cx = p.wx - camX;
    p.cy = p.wy - camY;
    p.cz = p.wz - camZ;
    p.sc = CAM_DEPTH / p.cz;
    p.sx = this.W / 2 + p.sc * p.cx * this.kx;
    p.sy = this.horizon - p.sc * p.cy * this.ky;
    p.sw = p.sc * ROAD_W * this.kx;
  }

  poly(x1, y1, x2, y2, x3, y3, x4, y4, color) {
    const c = this.ctx;
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.lineTo(x4, y4);
    c.closePath();
    c.fill();
  }

  // a flat strip on the ground between two lateral offsets (in road half-widths)
  strip(p1, p2, y1, y2, a, b, color) {
    this.poly(
      p1.sx + p1.sw * a, y1, p1.sx + p1.sw * b, y1,
      p2.sx + p2.sw * b, y2, p2.sx + p2.sw * a, y2, color,
    );
  }

  draw(race, dt) {
    const { ctx, W, H, track } = this;
    const segs = track.segs;
    const N = segs.length;
    const trackLen = track.length;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const base = Math.min(W, H * 0.62);
    this.horizon = H * 0.28;
    this.kx = base * 0.38;
    this.ky = this.kx * 1.1;
    const camH = ((0.76 * H - this.horizon) * PLAYER_Z) / (CAM_DEPTH * this.ky);

    const player = race.player;
    const mod = (v) => ((v % trackLen) + trackLen) % trackLen;
    const pos = mod(player.p - PLAYER_Z);
    const baseSeg = segs[Math.floor(pos / SEG) % N];
    const basePercent = (pos % SEG) / SEG;
    const pz = mod(player.p);
    const playerSeg = segs[Math.floor(pz / SEG) % N];
    const playerPercent = (pz % SEG) / SEG;
    const playerY = lerp(playerSeg.y0, playerSeg.y1, playerPercent);
    const camX = player.x * ROAD_W;
    const camY = playerY + camH;

    const d = dt || 0.016;
    this.sky += baseSeg.curve * (player.speed / 12000) * d * 0.02;
    this.cloudX += d * 4;

    this.drawSky();

    // ground and haze band behind everything
    const gg = ctx.createLinearGradient(0, this.horizon, 0, this.horizon + H * 0.2);
    gg.addColorStop(0, HAZE);
    gg.addColorStop(1, GRASS[0]);
    ctx.fillStyle = gg;
    ctx.fillRect(0, this.horizon, W, H - this.horizon);
    ctx.fillStyle = GRASS[0];
    ctx.fillRect(0, this.horizon + H * 0.2, W, H);

    // pass 1: project and decide what is visible (near to far)
    const vis = this.vis;
    vis.length = 0;
    let maxy = H;
    let x = 0;
    let dx = -(baseSeg.curve * basePercent);
    for (let n = 0; n < DRAW; n++) {
      const seg = segs[(baseSeg.index + n) % N];
      seg.looped = seg.index < baseSeg.index;
      const p1 = seg.p1, p2 = seg.p2;
      p1.wx = 0; p1.wy = seg.y0; p1.wz = seg.index * SEG;
      p2.wx = 0; p2.wy = seg.y1; p2.wz = (seg.index + 1) * SEG;
      const cz = pos - (seg.looped ? trackLen : 0);
      this.project(p1, camX - x, camY, cz);
      this.project(p2, camX - x - dx, camY, cz);
      x += dx;
      dx += seg.curve;
      if (p1.cz <= CAM_DEPTH || p2.sy >= p1.sy || p2.sy >= maxy) continue;
      seg.fog = Math.min(0.94, Math.pow(n / DRAW, 1.6) * 1.1);
      seg.n = n;
      vis.push(seg);
      maxy = p1.sy;
    }

    // cars into their segments
    for (const s of segs) if (s.cars.length) s.cars.length = 0;
    for (const c of race.cars) {
      if (c.player) continue;
      segs[Math.floor(mod(c.p) / SEG) % N].cars.push(c);
    }

    // pass 2: paint far to near so hills, walls and scenery overlap correctly
    for (let i = vis.length - 1; i >= 0; i--) {
      const seg = vis[i];
      this.drawSegment(seg);
      for (const t of seg.trees) this.drawScenery(seg, t);
      for (const c of seg.cars) this.drawOther(seg, c, mod);
    }

    // player car on top
    const psc = lerp(playerSeg.p1.sc, playerSeg.p2.sc, playerPercent);
    const psy = lerp(playerSeg.p1.sy, playerSeg.p2.sy, playerPercent);
    const bodyW = psc * ROAD_W * 0.32 * this.kx;
    const bounce = Math.abs(player.x) > 1.12 ? (Math.random() - 0.5) * 2.4 : 0;
    const spr = this.braking ? this.sprites.cars[0].brake : this.sprites.cars[0].normal;
    ctx.save();
    ctx.translate(W / 2, psy + bounce);
    ctx.rotate(this.lean * 0.05);
    this.blit(spr, 0, 0, bodyW);
    ctx.restore();
  }

  // draws a car sprite with the ground contact point at (x, y)
  blit(spr, x, y, bodyW, alpha) {
    const w = bodyW * (CAR_W / CAR_BODY_W);
    const h = w * (CAR_H / CAR_W);
    if (w < 1.5) return;
    const ctx = this.ctx;
    if (alpha != null) ctx.globalAlpha = alpha;
    ctx.drawImage(spr, x - w / 2, y - h * (CAR_GROUND / CAR_H), w, h);
    if (alpha != null) ctx.globalAlpha = 1;
  }

  drawOther(seg, car, mod) {
    const p1 = seg.p1, p2 = seg.p2;
    const pct = (mod(car.p) % SEG) / SEG;
    const sc = lerp(p1.sc, p2.sc, pct);
    const sx = lerp(p1.sx, p2.sx, pct) + sc * car.x * ROAD_W * this.kx;
    const sy = lerp(p1.sy, p2.sy, pct);
    const w = sc * ROAD_W * 0.32 * this.kx;
    if (sx < -w || sx > this.W + w) return;
    this.blit(this.sprites.cars[car.id].normal, sx, sy, w, 1 - seg.fog * 0.8);
  }

  drawSegment(seg) {
    const { ctx, W, H } = this;
    const p1 = seg.p1, p2 = seg.p2;
    const px = 1 / this.dpr;
    const y1 = Math.round(p1.sy * this.dpr) * px + px, y2 = Math.round(p2.sy * this.dpr) * px;
    if (y1 <= y2 + px) return;
    const i = seg.index;

    // grass
    ctx.fillStyle = GRASS[Math.floor(i / 4) % 3];
    ctx.fillRect(0, y2, W, y1 - y2);

    // tarmac run-off, kerbs, edge lines
    const runoff = Math.floor(i / 5) % 2 ? '#7b8084' : '#757a7e';
    this.strip(p1, p2, y1, y2, -1.78, -1.12, runoff);
    this.strip(p1, p2, y1, y2, 1.12, 1.78, runoff);
    const kerb = i % 6 < 3 ? '#d8402e' : '#f3f1ea';
    this.strip(p1, p2, y1, y2, -1.12, -1.0, kerb);
    this.strip(p1, p2, y1, y2, 1.0, 1.12, kerb);

    // asphalt
    const asphalt = Math.floor(i / 2) % 2 ? '#3a3d40' : '#373a3d';
    this.strip(p1, p2, y1, y2, -1, 1, asphalt);
    // rubbered-in racing line and edge lines
    this.strip(p1, p2, y1, y2, -0.62, -0.18, 'rgba(0,0,0,0.13)');
    this.strip(p1, p2, y1, y2, 0.18, 0.62, 'rgba(0,0,0,0.13)');
    this.strip(p1, p2, y1, y2, -0.97, -0.93, 'rgba(240,240,235,0.85)');
    this.strip(p1, p2, y1, y2, 0.93, 0.97, 'rgba(240,240,235,0.85)');
    // grid and finish line chequer
    if (i < 2) {
      for (let k = 0; k < 14; k++) {
        const a = -0.9 + k * (1.8 / 14), b = a + 1.8 / 14;
        this.strip(p1, p2, y1, y2, a, b, (k + i) % 2 ? '#f3f1ea' : '#111');
      }
    } else if (i > 150 - 1 && i < 152) {
      // nothing, reserved for pit markings
    }

    // barrier on both sides
    const hw1 = p1.sc * WALL_H * this.ky, hw2 = p2.sc * WALL_H * this.ky;
    for (const side of [-1, 1]) {
      const xb1 = p1.sx + p1.sw * 1.8 * side, xb2 = p2.sx + p2.sw * 1.8 * side;
      const post = i % 4 === 0;
      // body
      this.poly(xb1, y1, xb1, y1 - hw1, xb2, y2 - hw2, xb2, y2, post ? '#9aa0a5' : '#b9bfc4');
      // upper rail highlight
      this.poly(xb1, y1 - hw1 * 0.72, xb1, y1 - hw1 * 0.98, xb2, y2 - hw2 * 0.98, xb2, y2 - hw2 * 0.72, '#e9ecee');
      // lower rail shadow
      this.poly(xb1, y1 - hw1 * 0.1, xb1, y1 - hw1 * 0.34, xb2, y2 - hw2 * 0.34, xb2, y2 - hw2 * 0.1, '#7f858a');
      // dark gap under the barrier
      this.poly(xb1, y1, xb1, y1 - hw1 * 0.1, xb2, y2 - hw2 * 0.1, xb2, y2, '#4b4f53');
    }

    // distance haze
    if (seg.fog > 0.01) {
      ctx.globalAlpha = seg.fog;
      ctx.fillStyle = HAZE;
      ctx.fillRect(0, y2, W, y1 - y2 + 1);
      ctx.globalAlpha = 1;
    }
  }

  drawScenery(seg, t) {
    const p1 = seg.p1;
    const sc = p1.sc;
    const spr = this.sprites.trees[t.kind][t.v];
    const w = sc * spr.w * t.s * this.kx;
    if (w < 2) return;
    const h = w * spr.aspect;
    const sx = p1.sx + sc * t.off * ROAD_W * this.kx;
    const sy = p1.sy;
    if (sx + w / 2 < 0 || sx - w / 2 > this.W) return;
    const ctx = this.ctx;
    ctx.globalAlpha = 1 - seg.fog * 0.85;
    if (t.flip) {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(-1, 1);
      ctx.drawImage(spr.cv, -w / 2, -h + 1, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(spr.cv, sx - w / 2, sy - h + 1, w, h);
    }
    ctx.globalAlpha = 1;
  }

  drawSky() {
    const { ctx, W, H } = this;
    const hz = this.horizon;
    const g = ctx.createLinearGradient(0, 0, 0, hz);
    g.addColorStop(0, '#4d8ccf');
    g.addColorStop(0.65, '#9cc4e6');
    g.addColorStop(1, HAZE);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, hz + 1);
    // sun glow
    const sg = ctx.createRadialGradient(W * 0.72, hz * 0.7, 4, W * 0.72, hz * 0.7, hz * 0.9);
    sg.addColorStop(0, 'rgba(255,248,225,0.95)');
    sg.addColorStop(0.18, 'rgba(255,244,215,0.5)');
    sg.addColorStop(1, 'rgba(255,244,215,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, hz + 1);
    // clouds
    const clouds = this.sprites.clouds;
    const span = W * 1.6;
    for (let i = 0; i < 4; i++) {
      const cv = clouds[i % clouds.length];
      const cw = W * (0.34 + (i % 2) * 0.14);
      const x = ((i * 0.43 * span - this.cloudX - this.sky * W * 1.5) % span + span) % span - cw * 0.4;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(cv, x, hz * (0.12 + (i % 3) * 0.17), cw, cw * (cv.height / cv.width));
    }
    ctx.globalAlpha = 1;
    // ridges with parallax
    const scale = H / 780;
    const layers = [[this.sprites.ridgeFar, 1.6, 0.55], [this.sprites.ridgeNear, 3.2, 0.5], [this.sprites.hills, 6, 0.55]];
    for (const [cv, par, sz] of layers) {
      const tw = cv.width * scale * 1.1;
      const th = cv.height * scale * 1.1 * sz * 1.4;
      let off = ((this.sky * par * W) % tw + tw) % tw;
      for (let x = -off; x < W; x += tw) ctx.drawImage(cv, x, hz - th + 2, tw + 1, th);
    }
  }
}
