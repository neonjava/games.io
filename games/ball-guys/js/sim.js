// Claude Ball Guys - solo jar. Sticky, squishy balls; same colour + size merge.

export const W = 300;
export const H = 480;
export const LINE = 112; // balls resting above this line for too long end the game
export const STEP = 1 / 60;
const SUB = 4;
export const R = [0, 20, 27, 35, 45, 57, 72]; // radius by level (1..6)
export const MAXL = 6;
export const COLORS = ['#e8453c', '#f7df3c', '#b45fd6', '#f08a2c', '#fafafa', '#4aa8e8'];
const G = 1150;
const rnd = Math.random;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Game {
  constructor() { this.nid = 1; this.localEv = []; this.reset(); }

  reset() {
    this.balls = [];
    this.score = 0;
    this.over = false;
    this.overT = 0;
    this.combo = 0;
    this.comboT = 0;
    this.u = 0.5;
    this.cd = 0.3;
    this.cur = this.pickBall();
    this.next = this.pickBall();
    this.t = 0;
  }

  // more colours show up as the score grows
  pickBall() {
    const pool = [0, 1, 2, 5];
    if (this.score > 700) pool.push(3);
    if (this.score > 1800) pool.push(4);
    const r = rnd();
    return { c: pool[(rnd() * pool.length) | 0], l: r < 0.55 ? 1 : r < 0.85 ? 2 : 3 };
  }

  emit(e) { this.localEv.push(e); }

  setAim(u) { this.u = clamp(u, 0, 1); }

  dropX(l) { return R[l] + 4 + this.u * (W - 2 * R[l] - 8); }

  drop() {
    if (this.over || this.cd > 0) return false;
    const { c, l } = this.cur;
    const b = { id: this.nid++, x: this.dropX(l), y: 52, vx: 0, vy: 60, l, c, age: 0, sq: 0, sa: 0, dead: false };
    this.balls.push(b);
    this.cur = this.next;
    this.next = this.pickBall();
    this.cd = 0.55;
    return true;
  }

  step(dt) {
    if (this.over) return;
    this.t += dt;
    this.cd = Math.max(0, this.cd - dt);
    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;
    const h = dt / SUB;
    for (let i = 0; i < SUB; i++) this.physics(h);
    let danger = false;
    for (const b of this.balls) {
      b.age += dt;
      b.sq *= Math.exp(-5 * dt);
      if (b.age > 1.6 && b.y - R[b.l] < LINE && Math.hypot(b.vx, b.vy) < 170) danger = true;
    }
    this.overT = danger ? this.overT + dt : Math.max(0, this.overT - dt * 2);
    if (this.overT > 2.5) { this.over = true; this.emit(['o', 0, 0, 0, 0]); }
  }

  physics(h) {
    let bs = this.balls;
    const damp = Math.exp(-0.25 * h);
    for (const b of bs) {
      b.vy += G * h;
      b.vx *= damp; b.vy *= damp;
      if (b.vx * b.vx + b.vy * b.vy < 3600) { b.vx *= 0.96; b.vy *= 0.96; } // settle
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 1400) { b.vx *= 1400 / sp; b.vy *= 1400 / sp; }
      b.x += b.vx * h; b.y += b.vy * h;
      this.walls(b);
    }
    let merged = false;
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i];
      if (a.dead) continue;
      for (let j = i + 1; j < bs.length; j++) {
        const b = bs[j];
        if (b.dead) continue;
        const ra = R[a.l], rb = R[b.l], rs = ra + rb;
        const dx = b.x - a.x;
        if (dx > rs + 3 || dx < -rs - 3) continue;
        const dy = b.y - a.y;
        if (dy > rs + 3 || dy < -rs - 3) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 >= (rs + 3) * (rs + 3)) continue;
        const d = Math.sqrt(d2) || 0.001;
        const nx = dx / d, ny = dy / d;
        if (d < rs && a.c === b.c && a.l === b.l) { this.merge(a, b); merged = true; break; }
        const ma = ra * ra, mb = rb * rb, im = ma + mb;
        const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny; // >0 separating
        if (d < rs) {
          const over = rs - d;
          a.x -= nx * over * 0.7 * (mb / im); a.y -= ny * over * 0.7 * (mb / im);
          b.x += nx * over * 0.7 * (ma / im); b.y += ny * over * 0.7 * (ma / im);
        }
        // tangential cling (sticky)
        const tx = -ny, ty = nx;
        const rt = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty;
        const jt = rt * 0.12 * 2 / (1 / ma + 1 / mb) * 0.5;
        a.vx += (jt * tx) / ma; a.vy += (jt * ty) / ma;
        b.vx -= (jt * tx) / mb; b.vy -= (jt * ty) / mb;
        if (rv < 0) {
          const impact = -rv;
          const e = impact > 120 ? 0.42 : 0; // squishy bounce
          const jn = (-(1 + e) * rv) / (1 / ma + 1 / mb);
          a.vx -= (jn * nx) / ma; a.vy -= (jn * ny) / ma;
          b.vx += (jn * nx) / mb; b.vy += (jn * ny) / mb;
          const q = Math.min(1, impact / 450);
          if (q > a.sq) { a.sq = q; a.sa = Math.atan2(ny, nx); }
          if (q > b.sq) { b.sq = q; b.sa = Math.atan2(ny, nx); }
        } else if (rv > 0 && d < rs + 3) {
          // glue: pull back a share of the separating speed
          const jg = (rv * 0.35) / (1 / ma + 1 / mb);
          a.vx += (jg * nx) / ma; a.vy += (jg * ny) / ma;
          b.vx -= (jg * nx) / mb; b.vy -= (jg * ny) / mb;
        }
      }
    }
    if (merged) this.balls = bs = this.balls.filter((b) => !b.dead);
    for (const b of bs) this.walls(b);
  }

  walls(b) {
    const r = R[b.l];
    const hit = (q, a) => { if (q > b.sq) { b.sq = q; b.sa = a; } };
    if (b.x < r) { b.x = r; if (b.vx < 0) { hit(Math.min(1, -b.vx / 450), Math.PI); b.vx *= -0.2; b.vy *= 0.97; } }
    if (b.x > W - r) { b.x = W - r; if (b.vx > 0) { hit(Math.min(1, b.vx / 450), 0); b.vx *= -0.2; b.vy *= 0.97; } }
    if (b.y > H - r) { b.y = H - r; if (b.vy > 0) { hit(Math.min(1, b.vy / 450), Math.PI / 2); b.vy *= -0.2; b.vx *= 0.97; } }
  }

  merge(a, b) {
    a.dead = b.dead = true;
    const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
    this.combo++; this.comboT = 1.1;
    const mult = Math.min(5, this.combo);
    if (a.l >= MAXL) {
      for (const o of this.balls) {
        if (o.dead) continue;
        const dx = o.x - x, dy = o.y - y, d = Math.hypot(dx, dy) || 1;
        if (d < 260) { const f = 650 * (1 - d / 260); o.vx += (dx / d) * f; o.vy += (dy / d) * f; }
      }
      const pts = 300 * mult;
      this.score += pts;
      this.emit(['p', x, y, a.c, pts, mult]);
      return;
    }
    const l = a.l + 1;
    const n = { id: this.nid++, x, y, vx: (a.vx + b.vx) / 2, vy: (a.vy + b.vy) / 2, l, c: a.c, age: 1.6, sq: 0.9, sa: 0, dead: false };
    this.balls.push(n);
    for (const o of this.balls) {
      if (o.dead || o === n) continue;
      const dx = o.x - x, dy = o.y - y, d = Math.hypot(dx, dy) || 1;
      if (d < R[l] + R[o.l] + 16) { o.vx += (dx / d) * 110; o.vy += (dy / d) * 110; }
    }
    const pts = 10 * l * mult;
    this.score += pts;
    this.emit(['m', x, y, a.c, pts, mult]);
  }

  view() {
    return {
      score: this.score, over: this.over, overT: this.overT, combo: this.combo, cd: this.cd,
      cur: this.cur, next: this.next, u: this.u, dropX: this.dropX(this.cur.l),
      balls: this.balls.map((b) => ({ id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy, l: b.l, c: b.c, sq: b.sq, sa: b.sa })),
      ev: this.localEv.splice(0),
    };
  }
}
