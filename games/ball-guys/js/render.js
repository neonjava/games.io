import { W, H, R, COLORS, LINE } from './sim.js';

const INK = '#1a1a1a';
const PAD = 14; // jar wall thickness drawn outside the play area

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.parts = [];
    this.pops = [];
    this.rings = [];
    this.shake = 0;
    this.top = 78;
    this.bottom = 14;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.cw = innerWidth; this.ch = innerHeight;
    this.cv.width = Math.round(this.cw * dpr); this.cv.height = Math.round(this.ch * dpr);
    this.cv.style.width = this.cw + 'px'; this.cv.style.height = this.ch + 'px';
    this.dpr = dpr;
    const aw = this.cw - 8, ah = this.ch - this.top - this.bottom;
    this.s = Math.max(0.3, Math.min(aw / (W + PAD * 2), ah / (H + PAD * 2), 2.4));
    this.ox = (this.cw - W * this.s) / 2;
    this.oy = this.top + (ah - H * this.s) / 2;
  }

  toWorld(cx, cy) { return [(cx - this.ox) / this.s, (cy - this.oy) / this.s]; }

  events(list) {
    for (const e of list) {
      const [t, x, y, c, pts] = e;
      const col = COLORS[c] || '#fff';
      if (t === 'm' || t === 'c' || t === 'p' || t === 'k') {
        const n = t === 'p' ? 36 : t === 'k' ? 18 : 12;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * 6.283, sp = (t === 'p' ? 260 : 130) * (0.4 + Math.random());
          this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6 + Math.random() * 0.4, age: 0, r: 2 + Math.random() * (t === 'p' ? 6 : 3.5), col });
        }
        this.rings.push({ x, y, r: 6, max: t === 'p' ? 200 : t === 'k' ? 120 : 46, age: 0, life: t === 'p' ? 0.6 : 0.4, col });
      }
      if (pts) this.pops.push({ x, y, txt: '+' + pts, col, age: 0, big: t === 'p' });
      if (t === 'p') this.shake = 14;
      else if (t === 'm' && R[3] > 0) this.shake = Math.max(this.shake, 2);
    }
  }

  frame(v, ui, dt, now) {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.paper(c);
    if (!v) return;
    this.shake = Math.max(0, this.shake - dt * 30);
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    c.save();
    c.translate(this.ox + sx, this.oy + sy);
    c.scale(this.s, this.s);
    this.jar(c, v, now);
    for (const b of v.balls) this.ball(c, b, now);
    if (!v.over) this.hold(c, v, now);
    this.effects(c, dt);
    c.restore();
  }

  paper(c) {
    c.fillStyle = '#ecece9'; c.fillRect(0, 0, this.cw, this.ch);
    c.strokeStyle = '#d4d4d0'; c.lineWidth = 1;
    c.beginPath();
    for (let x = 0; x < this.cw; x += 26) { c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, this.ch); }
    for (let y = 0; y < this.ch; y += 26) { c.moveTo(0, y + 0.5); c.lineTo(this.cw, y + 0.5); }
    c.stroke();
  }

  jar(c, v, now) {
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.fillRect(0, 0, W, H);
    // hatched wall band
    c.save();
    c.beginPath();
    c.rect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    c.rect(0, 0, W, H);
    c.clip('evenodd');
    c.fillStyle = '#fff'; c.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    c.strokeStyle = INK; c.lineWidth = 2.2;
    c.beginPath();
    for (let k = -H - PAD * 2; k < W + H + PAD * 2; k += 7) { c.moveTo(k, -PAD); c.lineTo(k - H - PAD * 2, H + PAD); }
    c.stroke();
    c.restore();
    c.strokeStyle = INK; c.lineWidth = 4; c.lineJoin = 'round';
    c.strokeRect(0, 0, W, H);
    c.strokeRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
    c.save();
    c.strokeStyle = v.overT > 0 && Math.floor(now / 150) % 2 ? '#d1281e' : 'rgba(26,26,26,0.45)';
    c.lineWidth = 3; c.setLineDash([10, 8]);
    c.beginPath(); c.moveTo(0, LINE); c.lineTo(W, LINE); c.stroke();
    c.restore();
  }

  hold(c, v, now) {
    const { c: col, l } = v.cur, ready = v.cd <= 0;
    const x = v.dropX, y = 52;
    c.save();
    c.strokeStyle = COLORS[col]; c.globalAlpha = ready ? 0.9 : 0.3; c.lineWidth = 3;
    c.setLineDash([4, 8]);
    c.beginPath(); c.moveTo(x, y + R[l]); c.lineTo(x, H); c.stroke();
    c.restore();
    c.save(); c.globalAlpha = ready ? 1 : 0.4;
    this.ball(c, { id: 7, x, y, vx: 0, vy: 0, l, c: col, sq: 0, sa: 0 }, now);
    c.restore();
    // next ball
    c.fillStyle = INK; c.font = '700 15px "Patrick Hand", "Comic Sans MS", cursive'; c.textAlign = 'center';
    c.fillText('NEXT', W - 34, 20);
    this.ball(c, { id: 11, x: W - 34, y: 50, vx: 0, vy: 0, l: v.next.l, c: v.next.c, sq: 0, sa: 0 }, now);
  }

  effects(c, dt) {
    for (const p of this.parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; }
    this.parts = this.parts.filter((p) => p.age < p.life);
    for (const p of this.parts) {
      c.globalAlpha = 1 - p.age / p.life; c.fillStyle = p.col; c.strokeStyle = INK; c.lineWidth = 1.5;
      c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.283); c.fill(); c.stroke();
    }
    c.globalAlpha = 1;
    for (const r of this.rings) r.age += dt;
    this.rings = this.rings.filter((r) => r.age < r.life);
    for (const r of this.rings) {
      const k = r.age / r.life;
      c.globalAlpha = 1 - k; c.strokeStyle = r.col; c.lineWidth = 6 * (1 - k) + 1;
      c.beginPath(); c.arc(r.x, r.y, 6 + (r.max - 6) * k, 0, 6.283); c.stroke();
      c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke();
    }
    c.globalAlpha = 1;
    for (const p of this.pops) p.age += dt;
    this.pops = this.pops.filter((p) => p.age < 1);
    c.textAlign = 'center';
    for (const p of this.pops) {
      const k = p.age;
      c.globalAlpha = 1 - k * k;
      c.font = `700 ${p.big ? 30 : 18}px "Patrick Hand", "Comic Sans MS", cursive`;
      c.lineWidth = 4; c.strokeStyle = INK; c.strokeText(p.txt, p.x, p.y - 20 - k * 40);
      c.fillStyle = p.col; c.fillText(p.txt, p.x, p.y - 20 - k * 40);
    }
    c.globalAlpha = 1;
  }

  ball(c, b, now) {
    const r = R[b.l], col = COLORS[b.c];
    const sp = Math.hypot(b.vx, b.vy);
    const q = b.sq * Math.cos(now / 1000 * 26 + b.id) * 0.9 + b.sq * 0.1;
    c.save();
    c.translate(b.x, b.y);
    if (b.sq > 0.02) { c.rotate(b.sa); c.scale(1 - 0.3 * q, 1 + 0.24 * q); c.rotate(-b.sa); }
    else { const k = Math.min(0.14, sp / 5000); c.rotate(Math.atan2(b.vy, b.vx)); c.scale(1 + k, 1 - k * 0.7); }
    c.fillStyle = col; c.strokeStyle = INK; c.lineWidth = Math.max(2.6, r * 0.11);
    c.beginPath(); c.arc(0, 0, r - 1, 0, 6.283); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.beginPath(); c.ellipse(-r * 0.35, -r * 0.45, r * 0.22, r * 0.12, -0.6, 0, 6.283); c.fill();
    c.restore();
    this.face(c, b, now, sp);
  }

  face(c, b, now, sp) {
    const r = R[b.l], mood = b.id % 3;
    const ex = r * 0.3, ey = -r * 0.12, er = r * 0.23;
    let lx = b.vx * 0.004, ly = b.vy * 0.004 + 0.5;
    const ll = Math.hypot(lx, ly) || 1; lx = (lx / ll) * er * 0.38; ly = (ly / ll) * er * 0.38;
    const blink = Math.sin(now / 1000 * 1.3 + b.id * 2.1) > 0.97;
    c.save();
    c.translate(b.x, b.y);
    c.lineWidth = Math.max(1.6, r * 0.075); c.strokeStyle = INK; c.lineCap = 'round';
    for (const sgn of [-1, 1]) {
      const x = ex * sgn;
      if (blink || (mood === 1 && sp < 120)) {
        c.beginPath(); c.moveTo(x - er * 0.8, ey); c.lineTo(x + er * 0.8, ey); c.stroke();
        continue;
      }
      c.fillStyle = '#fff';
      c.beginPath(); c.ellipse(x, ey, er * 0.82, er, 0, 0, 6.283); c.fill(); c.stroke();
      c.fillStyle = INK;
      const up = mood === 2 && sp < 200 ? -er * 0.3 : 0;
      c.beginPath(); c.arc(x + lx, ey + ly + up, er * 0.42, 0, 6.283); c.fill();
    }
    c.beginPath();
    if (sp > 420) c.ellipse(0, r * 0.38, r * 0.09, r * 0.13, 0, 0, 6.283);
    else c.arc(0, r * 0.2, r * 0.17, 0.25, Math.PI - 0.25);
    c.stroke();
    c.restore();
  }
}
