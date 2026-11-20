import { SEG } from './track.js';
import { PLAYER_Z } from './sim.js';

const ROAD_W = 2000;
const CAM_H = 1000;
const CAM_DEPTH = 0.84;
const DRAW = 230;
const lerp = (a, b, t) => a + (b - a) * t;

const COL = {
  skyTop: '#b9b8b2', skyBottom: '#e7e1cd',
  grassA: '#c4cf95', grassB: '#bbc78c',
  rumbleA: '#d9503a', rumbleB: '#f1efe8',
  runoff: '#5fbfa3',
  roadA: '#343a3d', roadB: '#30363a',
  line: '#f1efe8',
};

function makeProj() {
  return { wx: 0, wy: 0, wz: 0, cx: 0, cy: 0, cz: 0, sx: 0, sy: 0, sw: 0, sc: 0 };
}

export class Renderer {
  constructor(canvas, track) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.track = track;
    this.sky = 0;
    for (const s of track.segs) { s.p1 = makeProj(); s.p2 = makeProj(); s.clip = 0; s.looped = false; }
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

  draw(race, dt) {
    const { ctx, W, H, track } = this;
    const segs = track.segs;
    const N = segs.length;
    const trackLen = track.length;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.horizon = H * 0.28;
    this.kx = W * 0.38;
    this.ky = H * 0.5;

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
    const camY = playerY + CAM_H;

    this.sky += baseSeg.curve * (player.speed / 12000) * (dt || 0.016) * 0.012;

    this.drawSky();

    // ground base
    ctx.fillStyle = COL.grassA;
    ctx.fillRect(0, this.horizon, W, H - this.horizon);

    let maxy = H;
    let x = 0;
    let dx = -(baseSeg.curve * basePercent);

    for (let n = 0; n < DRAW; n++) {
      const seg = segs[(baseSeg.index + n) % N];
      seg.looped = seg.index < baseSeg.index;
      const p1 = seg.p1, p2 = seg.p2;
      p1.wx = 0; p1.wy = seg.y0; p1.wz = seg.index * SEG;
      p2.wx = 0; p2.wy = seg.y1; p2.wz = (seg.index + 1) * SEG;
      this.project(p1, camX - x, camY, pos - (seg.looped ? trackLen : 0));
      this.project(p2, camX - x - dx, camY, pos - (seg.looped ? trackLen : 0));
      x += dx;
      dx += seg.curve;
      seg.clip = maxy;
      if (p1.cz <= CAM_DEPTH || p2.sy >= p1.sy || p2.sy >= maxy) continue;

      const band = Math.floor(seg.index / 3) % 2;
      const y1 = Math.round(p1.sy), y2 = Math.round(p2.sy);
      if (y1 <= y2) { maxy = p1.sy; continue; }
      ctx.fillStyle = band ? COL.grassA : COL.grassB;
      ctx.fillRect(0, y2, W, y1 - y2);

      const r1 = p1.sw * 0.12, r2 = p2.sw * 0.12;
      const g1 = p1.sw * 0.3, g2 = p2.sw * 0.3;
      // run-off strip
      this.poly(p1.sx - p1.sw - r1 - g1, y1, p1.sx - p1.sw - r1, y1, p2.sx - p2.sw - r2, y2, p2.sx - p2.sw - r2 - g2, y2, COL.runoff);
      this.poly(p1.sx + p1.sw + r1 + g1, y1, p1.sx + p1.sw + r1, y1, p2.sx + p2.sw + r2, y2, p2.sx + p2.sw + r2 + g2, y2, COL.runoff);
      // rumble strips
      const rc = seg.index % 6 < 3 ? COL.rumbleA : COL.rumbleB;
      this.poly(p1.sx - p1.sw - r1, y1, p1.sx - p1.sw, y1, p2.sx - p2.sw, y2, p2.sx - p2.sw - r2, y2, rc);
      this.poly(p1.sx + p1.sw + r1, y1, p1.sx + p1.sw, y1, p2.sx + p2.sw, y2, p2.sx + p2.sw + r2, y2, rc);
      // road
      const start = seg.index < 2;
      this.poly(p1.sx - p1.sw, y1, p1.sx + p1.sw, y1, p2.sx + p2.sw, y2, p2.sx - p2.sw, y2, start ? COL.line : (band ? COL.roadA : COL.roadB));
      maxy = y1;
    }

    // haze at the horizon
    const hz = ctx.createLinearGradient(0, this.horizon, 0, this.horizon + H * 0.14);
    hz.addColorStop(0, 'rgba(231,225,205,0.9)');
    hz.addColorStop(1, 'rgba(231,225,205,0)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, this.horizon, W, H * 0.14);

    // cars into their segments
    for (const s of segs) if (s.cars.length) s.cars.length = 0;
    for (const c of race.cars) {
      if (c.player) continue;
      segs[Math.floor(mod(c.p) / SEG) % N].cars.push(c);
    }

    // sprites, far to near
    for (let n = DRAW - 1; n > 0; n--) {
      const seg = segs[(baseSeg.index + n) % N];
      const p1 = seg.p1, p2 = seg.p2;
      if (p1.cz <= CAM_DEPTH) continue;
      for (const t of seg.trees) this.drawScenery(seg, t);
      for (const c of seg.cars) {
        const pct = (mod(c.p) % SEG) / SEG;
        const sc = lerp(p1.sc, p2.sc, pct);
        const sx = lerp(p1.sx, p2.sx, pct) + sc * c.x * ROAD_W * this.kx;
        const sy = lerp(p1.sy, p2.sy, pct);
        const w = sc * ROAD_W * 0.32 * this.kx;
        this.clipped(seg, sy, () => this.drawCar(sx, sy, w, c.color, 0));
      }
    }

    // player car
    const psc = lerp(playerSeg.p1.sc, playerSeg.p2.sc, playerPercent);
    const psy = lerp(playerSeg.p1.sy, playerSeg.p2.sy, playerPercent);
    const pw = psc * ROAD_W * 0.32 * this.kx;
    const bounce = Math.abs(player.x) > 1.12 ? (Math.random() - 0.5) * 3 : 0;
    this.drawCar(W / 2, psy + bounce, pw, player.color, this.lean || 0);
  }

  clipped(seg, y, fn) {
    const { ctx, W } = this;
    if (y > seg.clip) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, seg.clip);
      ctx.clip();
      fn();
      ctx.restore();
    } else fn();
  }

  drawSky() {
    const { ctx, W } = this;
    const g = ctx.createLinearGradient(0, 0, 0, this.horizon);
    g.addColorStop(0, COL.skyTop);
    g.addColorStop(1, COL.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, this.horizon + 1);
    // low-poly pyramids that slide with the bends
    const hz = this.horizon;
    const span = W * 2.6;
    const peaks = [[0.05, 150, 110], [0.32, 90, 70], [0.55, 200, 150], [0.8, 110, 80], [1.0, 170, 120], [1.25, 80, 60], [1.5, 140, 100]];
    for (const [f, w, h] of peaks) {
      let px = ((f * span - this.sky * span) % span + span) % span - W * 0.3;
      ctx.fillStyle = '#8a73c4';
      ctx.beginPath(); ctx.moveTo(px - w / 2, hz); ctx.lineTo(px, hz - h); ctx.lineTo(px, hz); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6a539f';
      ctx.beginPath(); ctx.moveTo(px, hz - h); ctx.lineTo(px + w / 2, hz); ctx.lineTo(px, hz); ctx.closePath(); ctx.fill();
    }
  }

  drawScenery(seg, t) {
    const p1 = seg.p1;
    const sc = p1.sc;
    const sx = p1.sx + sc * t.off * ROAD_W * this.kx;
    const sy = p1.sy;
    if (sx < -200 || sx > this.W + 200) return;
    const ctx = this.ctx;
    if (t.kind === 'post') {
      const h = sc * 520 * this.ky, w = Math.max(1, sc * 70 * this.kx);
      this.clipped(seg, sy, () => {
        ctx.fillStyle = '#8f9690'; ctx.fillRect(sx - w / 2, sy - h, w, h);
        ctx.fillStyle = '#e9e6dc'; ctx.fillRect(sx - w, sy - h, w * 2, h * 0.14);
      });
      return;
    }
    const s = t.s;
    const h = sc * 1500 * s * this.ky;
    const w = sc * 900 * s * this.kx;
    this.clipped(seg, sy, () => {
      ctx.fillStyle = '#6b4f35';
      ctx.fillRect(sx - w * 0.07, sy - h * 0.32, w * 0.14, h * 0.32);
      ctx.fillStyle = '#3f8f5a';
      ctx.beginPath(); ctx.moveTo(sx, sy - h); ctx.lineTo(sx - w * 0.5, sy - h * 0.28); ctx.lineTo(sx + w * 0.5, sy - h * 0.28); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2f7449';
      ctx.beginPath(); ctx.moveTo(sx, sy - h); ctx.lineTo(sx + w * 0.5, sy - h * 0.28); ctx.lineTo(sx, sy - h * 0.28); ctx.closePath(); ctx.fill();
    });
  }

  // Low-poly open-wheel car seen from behind. w = overall width in pixels.
  drawCar(cx, by, w, color, lean) {
    if (w < 2) return;
    const c = this.ctx;
    const h = w * 0.62;
    c.save();
    c.translate(cx, by);
    if (lean) c.rotate(lean * 0.06);
    // shadow
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.beginPath(); c.ellipse(0, 0, w * 0.5, h * 0.12, 0, 0, 6.2832); c.fill();
    // rear tyres
    c.fillStyle = '#1b1e20';
    c.fillRect(-w * 0.5, -h * 0.52, w * 0.19, h * 0.52);
    c.fillRect(w * 0.31, -h * 0.52, w * 0.19, h * 0.52);
    // sidepods
    c.fillStyle = color;
    c.fillRect(-w * 0.31, -h * 0.58, w * 0.62, h * 0.4);
    // darker lower edge
    c.fillStyle = 'rgba(0,0,0,0.28)';
    c.fillRect(-w * 0.31, -h * 0.26, w * 0.62, h * 0.08);
    // engine cover
    c.fillStyle = color;
    c.beginPath(); c.moveTo(-w * 0.12, -h * 0.9); c.lineTo(w * 0.12, -h * 0.9); c.lineTo(w * 0.2, -h * 0.5); c.lineTo(-w * 0.2, -h * 0.5); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.beginPath(); c.moveTo(-w * 0.12, -h * 0.9); c.lineTo(-w * 0.02, -h * 0.9); c.lineTo(-w * 0.04, -h * 0.5); c.lineTo(-w * 0.2, -h * 0.5); c.closePath(); c.fill();
    // helmet
    c.fillStyle = '#f0d24c';
    c.beginPath(); c.arc(0, -h * 0.95, w * 0.075, 0, 6.2832); c.fill();
    // rear wing
    c.fillStyle = color;
    c.fillRect(-w * 0.42, -h * 0.34, w * 0.84, h * 0.16);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(-w * 0.42, -h * 0.34, w * 0.05, h * 0.3);
    c.fillRect(w * 0.37, -h * 0.34, w * 0.05, h * 0.3);
    // diffuser
    c.fillStyle = '#1b1e20';
    c.fillRect(-w * 0.16, -h * 0.18, w * 0.32, h * 0.18);
    c.restore();
  }
}
