// Claude Ball Guys - shared jar simulation (runs on the host / solo player).
// Circles with soft impacts, merging, colour stealing, gravity shifts and magnets.

export const W = 360;
export const H = 520;
export const STEP = 1 / 60;
const SUB = 3;
export const R = [0, 15, 21, 28, 36, 46, 58]; // radius by level (1..6)
export const MAXL = 6;
export const ROUND_SECONDS = 100;
export const OVER_SECONDS = 8;
export const COLORS = ['#e8453c', '#f7df3c', '#b45fd6', '#f08a2c', '#fafafa', '#4aa8e8'];
export const COLOR_NAMES = ['Red', 'Yellow', 'Purple', 'Orange', 'White', 'Blue'];
export const GV = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // down, right, up, left
const G = 900;
const MAX_BALLS = 84;
const DROP_CD = 0.75;
const MAGNET_CD = 9;
const BOTS = ['Blobby', 'Squish', 'Wobble', 'Bonk', 'Gloop', 'Zorp'];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = Math.random;

// where a new ball appears for a given gravity direction and aim (0..1)
export function spawnPoint(dir, u, r) {
  u = clamp(u, 0, 1);
  const ax = r + 6 + u * (W - 2 * r - 12);
  const ay = r + 6 + u * (H - 2 * r - 12);
  if (dir === 0) return [ax, r + 4];
  if (dir === 2) return [ax, H - r - 4];
  if (dir === 1) return [r + 4, ay];
  return [W - r - 4, ay];
}
// pointer position in jar units -> aim (0..1) for the current gravity
export function aimU(dir, x, y) {
  return clamp(dir % 2 === 0 ? x / W : y / H, 0, 1);
}

export class Room {
  constructor() {
    this.slots = Array.from({ length: 6 }, (_, i) => ({
      idx: i, name: BOTS[i], ai: true, key: null, score: 0, cd: 0, mcd: 0, u: 0.5,
      dropN: 0, magN: 0, seenDrop: 0, seenMag: 0, think: 1 + rnd() * 1.5, skill: 0.5 + rnd() * 0.5,
    }));
    this.nid = 1;
    this.ev = [];
    this.localEv = [];
    this.tracking = false;
    this.reset();
  }

  emit(e) {
    this.localEv.push(e);
    if (this.tracking) this.ev.push(e);
  }

  reset() {
    this.balls = [];
    this.dir = 0;
    this.pending = -1;
    this.gt = 12 + rnd() * 5;
    this.phase = 'play';
    this.timeLeft = ROUND_SECONDS;
    this.overLeft = 0;
    this.result = null;
    for (const s of this.slots) { s.score = 0; s.cd = 0.5; s.mcd = 3; s.think = 1 + rnd() * 1.5; }
    for (let i = 0; i < 6; i++) {
      for (let k = 0; k < 2; k++) this.addBall(40 + rnd() * (W - 80), H - 80 - rnd() * 140, 1, i, 0, 0);
    }
  }

  addBall(x, y, l, c, vx, vy) {
    const b = { id: this.nid++, x, y, vx, vy, l, c, age: 0, cv: 0, dead: false };
    this.balls.push(b);
    return b;
  }

  playerCount() { return this.slots.filter((s) => !s.ai).length; }

  addPlayer(key, name) {
    let slot = this.slots.filter((s) => s.ai).sort((a, b) => a.score - b.score)[0];
    if (!slot) return -1;
    slot.ai = false; slot.key = key;
    slot.name = String(name || 'Player').slice(0, 12);
    slot.dropN = slot.seenDrop = slot.magN = slot.seenMag = 0;
    return slot.idx;
  }

  removePlayer(key) {
    const s = this.slots.find((x) => x.key === key);
    if (!s) return;
    s.ai = true; s.key = null; s.name = BOTS[s.idx];
  }

  setInput(idx, u, dropN, magN) {
    const s = this.slots[idx];
    if (!s || s.ai) return;
    if (Number.isFinite(u)) s.u = clamp(u, 0, 1);
    if (Number.isFinite(dropN)) s.dropN = dropN;
    if (Number.isFinite(magN)) s.magN = magN;
  }

  drop(s) {
    if (this.phase !== 'play' || s.cd > 0) return false;
    const l = rnd() < 0.7 ? 1 : rnd() < 0.83 ? 2 : 3;
    const [x, y] = spawnPoint(this.dir, s.u, R[l]);
    const g = GV[this.dir];
    this.addBall(x, y, l, s.idx, g[0] * 160, g[1] * 160).cv = 1.5;
    s.cd = DROP_CD;
    return true;
  }

  magnet(s) {
    if (this.phase !== 'play' || s.mcd > 0) return false;
    const own = this.balls.filter((b) => b.c === s.idx);
    if (!own.length) return false;
    let cx = 0, cy = 0, m = 0;
    for (const b of own) { const w = b.l; cx += b.x * w; cy += b.y * w; m += w; }
    cx /= m; cy /= m;
    for (const b of this.balls) {
      const dx = cx - b.x, dy = cy - b.y, d = Math.hypot(dx, dy) || 1;
      if (b.c === s.idx) {
        const f = Math.min(520, 120 + d * 2.2);
        b.vx += (dx / d) * f; b.vy += (dy / d) * f;
      } else if (d < 230) {
        const f = 620 * (1 - d / 230);
        b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      }
    }
    s.mcd = MAGNET_CD;
    this.emit(['k', cx, cy, s.idx, 0]);
    return true;
  }

  pop(x, y, c) {
    for (const b of this.balls) {
      const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy) || 1;
      if (d < 240) { const f = 700 * (1 - d / 240); b.vx += (dx / d) * f; b.vy += (dy / d) * f; }
    }
    this.slots[c].score += 200;
    this.emit(['p', x, y, c, 200]);
  }

  think(s, dt) {
    s.think -= dt;
    if (s.think > 0 || this.phase !== 'play') return;
    s.think = (1.4 - 0.5 * s.skill) + rnd() * 1.0;
    const own = this.balls.filter((b) => b.c === s.idx && b.l <= 3);
    let u = rnd();
    if (own.length && rnd() < 0.4 + 0.5 * s.skill) {
      const t = own[(rnd() * own.length) | 0];
      u = aimU(this.dir, t.x, t.y) + (rnd() - 0.5) * 0.08;
    }
    s.u = clamp(u, 0, 1);
    this.drop(s);
    if (s.mcd <= 0 && this.balls.filter((b) => b.c === s.idx).length >= 4 && rnd() < 0.25) this.magnet(s);
  }

  step(dt) {
    if (this.phase === 'over') {
      this.overLeft -= dt;
      if (this.overLeft <= 0) this.reset();
      return;
    }
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this.finish(); return; }

    for (const s of this.slots) {
      s.cd = Math.max(0, s.cd - dt);
      s.mcd = Math.max(0, s.mcd - dt);
      if (s.ai) this.think(s, dt);
      else {
        if (s.dropN !== s.seenDrop) { s.seenDrop = s.dropN; this.drop(s); }
        if (s.magN !== s.seenMag) { s.seenMag = s.magN; this.magnet(s); }
      }
    }

    // gravity shifts
    this.gt -= dt;
    if (this.pending < 0 && this.gt <= 2 && this.timeLeft > 6) {
      const opts = [0, 1, 2, 3].filter((d) => d !== this.dir);
      this.pending = opts[(rnd() * opts.length) | 0];
    }
    if (this.gt <= 0 && this.pending >= 0) {
      this.dir = this.pending; this.pending = -1; this.gt = 11 + rnd() * 6;
      for (const b of this.balls) { b.vx += (rnd() - 0.5) * 90; b.vy += (rnd() - 0.5) * 90; }
      this.emit(['g', 0, 0, this.dir, 0]);
    }

    const h = dt / SUB;
    for (let i = 0; i < SUB; i++) this.physics(h);
    for (const b of this.balls) { b.age += dt; b.cv = Math.max(0, b.cv - dt); }

    // too many balls: the oldest smallest one vanishes
    while (this.balls.length > MAX_BALLS) {
      let w = this.balls[0];
      for (const b of this.balls) if (b.l < w.l || (b.l === w.l && b.age > w.age)) w = b;
      this.balls.splice(this.balls.indexOf(w), 1);
      this.emit(['x', w.x, w.y, w.c, 0]);
    }
  }

  physics(h) {
    const g = GV[this.dir], gx = g[0] * G, gy = g[1] * G;
    const bs = this.balls, damp = Math.exp(-0.18 * h);
    for (const b of bs) {
      b.vx = (b.vx + gx * h) * damp; b.vy = (b.vy + gy * h) * damp;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 1500) { b.vx *= 1500 / sp; b.vy *= 1500 / sp; }
      b.x += b.vx * h; b.y += b.vy * h;
      const r = R[b.l];
      if (b.x < r) { b.x = r; if (b.vx < 0) { b.vx *= -0.28; b.vy *= 0.985; } }
      if (b.x > W - r) { b.x = W - r; if (b.vx > 0) { b.vx *= -0.28; b.vy *= 0.985; } }
      if (b.y < r) { b.y = r; if (b.vy < 0) { b.vy *= -0.28; b.vx *= 0.985; } }
      if (b.y > H - r) { b.y = H - r; if (b.vy > 0) { b.vy *= -0.28; b.vx *= 0.985; } }
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
        if (dx > rs || dx < -rs) continue;
        const dy = b.y - a.y;
        if (dy > rs || dy < -rs) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rs * rs) continue;
        const d = Math.sqrt(d2) || 0.001;
        const nx = dx / d, ny = dy / d;
        if (a.c === b.c && a.l === b.l) {
          this.merge(a, b);
          merged = true;
          break;
        }
        const ma = ra * ra, mb = rb * rb, im = ma + mb;
        const over = rs - d;
        a.x -= nx * over * 0.8 * (mb / im); a.y -= ny * over * 0.8 * (mb / im);
        b.x += nx * over * 0.8 * (ma / im); b.y += ny * over * 0.8 * (ma / im);
        const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rv < 0) {
          const impact = -rv;
          const e = impact > 70 ? 0.3 : 0;
          const jn = (-(1 + e) * rv) / (1 / ma + 1 / mb);
          a.vx -= (jn * nx) / ma; a.vy -= (jn * ny) / ma;
          b.vx += (jn * nx) / mb; b.vy += (jn * ny) / mb;
          // heavy ball hitting a small ball of another colour paints it
          if (a.c !== b.c && impact > 290) this.paint(a, b, impact);
        }
      }
    }
    if (merged) this.balls = this.balls.filter((b) => !b.dead);
    for (const b of this.balls) {
      const r = R[b.l];
      b.x = clamp(b.x, r, W - r); b.y = clamp(b.y, r, H - r);
    }
  }

  paint(a, b, impact) {
    let big = a, small = b;
    if (R[b.l] > R[a.l]) { big = b; small = a; }
    if (big.l < small.l + 1 || small.cv > 0) return;
    small.c = big.c; small.cv = 0.7;
    const pts = 4 * small.l;
    this.slots[big.c].score += pts;
    this.emit(['c', small.x, small.y, big.c, pts]);
    void impact;
  }

  merge(a, b) {
    a.dead = b.dead = true;
    const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
    if (a.l >= MAXL) { this.pop(x, y, a.c); return; }
    const l = a.l + 1;
    const n = this.addBall(x, y, l, a.c, (a.vx + b.vx) / 2, (a.vy + b.vy) / 2);
    n.age = 0;
    const pts = 10 * l;
    this.slots[a.c].score += pts;
    for (const o of this.balls) {
      if (o.dead || o === n) continue;
      const dx = o.x - x, dy = o.y - y, d = Math.hypot(dx, dy) || 1;
      if (d < R[l] + R[o.l] + 14) { o.vx += (dx / d) * 90; o.vy += (dy / d) * 90; }
    }
    this.emit(['m', x, y, a.c, pts]);
  }

  finish() {
    this.phase = 'over';
    this.overLeft = OVER_SECONDS;
    const counts = this.counts();
    this.result = this.slots
      .map((s) => ({ idx: s.idx, name: s.name, score: s.score, ai: s.ai, balls: counts[s.idx] }))
      .sort((a, b) => b.score - a.score);
  }

  counts() {
    const c = [0, 0, 0, 0, 0, 0];
    for (const b of this.balls) c[b.c]++;
    return c;
  }

  view() {
    const counts = this.counts();
    return {
      ph: this.phase, tl: this.timeLeft, ol: this.overLeft, gd: this.dir,
      gn: this.pending, gw: this.pending >= 0 ? Math.max(0, this.gt) : 0,
      players: this.slots.map((s) => ({ idx: s.idx, name: s.name, score: s.score, ai: s.ai, cd: s.cd, mcd: s.mcd, balls: counts[s.idx] })),
      balls: this.balls.map((b) => ({ id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy, l: b.l, c: b.c })),
      res: this.result,
    };
  }

  snapshot() {
    const counts = this.counts();
    return {
      t: 's', ph: this.phase === 'play' ? 0 : 1, tl: Math.round(this.timeLeft * 10) / 10, ol: Math.round(this.overLeft * 10) / 10,
      gd: this.dir, gn: this.pending, gw: this.pending >= 0 ? Math.round(Math.max(0, this.gt) * 10) / 10 : 0,
      pl: this.slots.map((s) => [s.idx, s.name, s.score, s.ai ? 1 : 0, Math.round(s.cd * 10) / 10, Math.round(s.mcd * 10) / 10, counts[s.idx]]),
      b: this.balls.map((b) => [b.id, Math.round(b.x * 10) / 10, Math.round(b.y * 10) / 10, Math.round(b.vx / 4), Math.round(b.vy / 4), b.l, b.c]),
      ev: this.ev,
      res: this.result,
    };
  }

  flush() { this.ev = []; }
}
