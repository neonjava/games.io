// Game simulation. Runs on the room host (or locally for solo play).
// No DOM or network code in here.

export const WORLD = 2400;
export const MAX_SNAKES = 10;
export const ROUND_SECONDS = 120;
export const OVER_SECONDS = 8;
export const START_SCORE = 3;
export const STEP = 1 / 60;

const GEM_TARGET = 240;
const SPEED = 150;
const BOOST_SPEED = 260;
const BOOST_MIN_SCORE = 6;
const BOT_NAMES = [
  'Sunny', 'Sprout', 'Pixel', 'Mango', 'Zigzag', 'Noodle', 'Biscuit',
  'Pebble', 'Cosmo', 'Waffle', 'Ziggy', 'Peanut', 'Maple', 'Olive',
];

export const SKINS = [
  ['#e5484d', '#f08a8d'], ['#f5a524', '#f8c56a'], ['#e8c500', '#f3de66'],
  ['#2fb457', '#7ad493'], ['#12a594', '#6cd0c4'], ['#2f7de1', '#8ab6f0'],
  ['#7c5cd6', '#b5a2ea'], ['#d6409f', '#ea8ec9'], ['#6b7785', '#a6aeb8'],
  ['#a9743a', '#cfa570'],
];
export const GEM_COLORS = [
  '#e5484d', '#f5a524', '#e8c500', '#2fb457', '#12a594', '#2f7de1', '#7c5cd6', '#d6409f',
];

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const radiusFor = (score) => 12 + Math.min(8, score * 0.06);
const segsFor = (score) => Math.min(150, 8 + Math.floor(score * 0.9));
export const levelFor = (score) => 1 + [10, 25, 50, 100, 200].filter((t) => score >= t).length;

function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function cleanName(name) {
  const n = String(name == null ? '' : name).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 12);
  return n || 'Player';
}

function makeSnake(id, name, color) {
  return {
    id, name, ai: true, owner: null, color,
    x: 0, y: 0, angle: 0, want: 0, boost: false,
    score: START_SCORE, ko: 0, alive: false, respawn: 0, inv: 0,
    p: [], r: 9, kb: '', think: 0, boostAcc: 0, huntT: 0, prey: 0, wander: 0,
  };
}

export class Room {
  constructor() {
    this.snakes = [];
    this.gems = new Map();
    this.gemId = 1;
    this.adds = [];
    this.dels = [];
    this.tracking = false;
    this.byOwner = new Map();
    this.phase = 'play';
    this.timeLeft = ROUND_SECONDS;
    this.overLeft = 0;
    this.round = 1;
    this.results = [];
    for (let i = 0; i < MAX_SNAKES; i++) {
      const s = makeSnake(i + 1, this.botName(), i % SKINS.length);
      this.snakes.push(s);
      this.spawn(s);
    }
    this.fillGems();
  }

  botName() {
    const used = new Set(this.snakes.map((s) => s.name));
    const free = BOT_NAMES.filter((n) => !used.has(n));
    if (free.length) return free[Math.floor(Math.random() * free.length)];
    return 'Worm' + Math.floor(Math.random() * 90 + 10);
  }

  // ---- gems ----
  addGem(x, y, c, v) {
    const g = { id: this.gemId++, x: Math.round(x), y: Math.round(y), c, v };
    this.gems.set(g.id, g);
    if (this.tracking) this.adds.push([g.id, g.x, g.y, g.c, g.v]);
    return g;
  }

  removeGem(id) {
    this.gems.delete(id);
    if (this.tracking) this.dels.push(id);
  }

  fillGems() {
    while (this.gems.size < GEM_TARGET) {
      this.addGem(rand(30, WORLD - 30), rand(30, WORLD - 30), Math.floor(Math.random() * GEM_COLORS.length), 1);
    }
  }

  gemList() {
    return Array.from(this.gems.values(), (g) => [g.id, g.x, g.y, g.c, g.v]);
  }

  flush() {
    this.adds = [];
    this.dels = [];
  }

  // ---- snakes ----
  spawn(s) {
    let x = 0, y = 0;
    for (let tries = 0; tries < 12; tries++) {
      x = rand(250, WORLD - 250);
      y = rand(250, WORLD - 250);
      let ok = true;
      for (const o of this.snakes) {
        if (o !== s && o.alive && (o.x - x) ** 2 + (o.y - y) ** 2 < 300 * 300) { ok = false; break; }
      }
      if (ok) break;
    }
    s.x = x; s.y = y;
    s.angle = rand(0, Math.PI * 2);
    s.want = s.angle;
    s.alive = true;
    s.inv = 2;
    s.boost = false;
    s.kb = '';
    s.score = Math.max(START_SCORE, s.score);
    s.r = radiusFor(s.score);
    const n = segsFor(s.score);
    const gap = Math.max(6, s.r * 0.8);
    s.p = [];
    for (let i = 0; i < n; i++) {
      s.p.push(x - Math.cos(s.angle) * gap * i, y - Math.sin(s.angle) * gap * i);
    }
  }

  dropBody(s, extra) {
    const n = s.p.length / 2;
    if (!n) return;
    const count = Math.min(50, Math.max(3, Math.ceil(s.score / 2)));
    const total = Math.max(count, Math.floor(s.score * 0.8)) + (extra || 0);
    const v = Math.max(1, Math.round(total / count));
    for (let k = 0; k < count; k++) {
      const i = Math.min(n - 1, Math.floor((k / count) * n));
      const gx = clamp(s.p[2 * i] + rand(-8, 8), 20, WORLD - 20);
      const gy = clamp(s.p[2 * i + 1] + rand(-8, 8), 20, WORLD - 20);
      this.addGem(gx, gy, s.color % GEM_COLORS.length, v);
    }
  }

  kill(s, by) {
    s.alive = false;
    s.kb = by && by !== s ? by.name : '';
    if (by && by !== s) by.ko += 1;
    s.respawn = s.ai ? 1.8 : 2.5;
    s.boost = false;
    this.dropBody(s);
  }

  // ---- players ----
  playerCount() {
    return this.snakes.filter((s) => !s.ai).length;
  }

  // Turns an AI snake into the given player. Returns snake id, or -1 if the room is full.
  addPlayer(owner, name) {
    const existing = this.byOwner.get(owner);
    if (existing) return existing.id;
    let pick = null;
    for (const s of this.snakes) {
      if (s.ai && (!pick || s.score < pick.score)) pick = s;
    }
    if (!pick) return -1;
    if (pick.alive) this.dropBody(pick);
    pick.ai = false;
    pick.owner = owner;
    pick.name = cleanName(name);
    pick.ko = 0;
    pick.score = START_SCORE;
    this.spawn(pick);
    this.byOwner.set(owner, pick);
    return pick.id;
  }

  // A leaving player's snake goes back to being an AI worm.
  removePlayer(owner) {
    const s = this.byOwner.get(owner);
    if (!s) return;
    this.byOwner.delete(owner);
    s.ai = true;
    s.owner = null;
    s.boost = false;
    s.name = this.botName();
  }

  setInput(owner, angle, boost) {
    const s = this.byOwner.get(owner);
    if (!s) return;
    if (Number.isFinite(angle)) s.want = angle;
    s.boost = !!boost;
  }

  ranking() {
    return this.snakes.slice().sort((a, b) => b.score - a.score || b.ko - a.ko || a.id - b.id);
  }

  // ---- rounds ----
  endRound() {
    this.phase = 'over';
    this.overLeft = OVER_SECONDS;
    this.results = this.ranking().slice(0, 5).map((s) => ({
      id: s.id, name: s.name, score: s.score, ko: s.ko, ai: s.ai,
    }));
  }

  newRound() {
    this.round += 1;
    this.phase = 'play';
    this.timeLeft = ROUND_SECONDS;
    for (const id of Array.from(this.gems.keys())) this.removeGem(id);
    for (const s of this.snakes) {
      s.score = START_SCORE;
      s.ko = 0;
      this.spawn(s);
    }
    this.fillGems();
  }

  // ---- stepping ----
  step(dt) {
    if (this.phase === 'over') {
      this.overLeft -= dt;
      if (this.overLeft <= 0) this.newRound();
      return;
    }
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.endRound();
      return;
    }
    for (const s of this.snakes) {
      if (!s.alive) {
        s.respawn -= dt;
        if (s.respawn <= 0) {
          s.score = START_SCORE;
          this.spawn(s);
        }
        continue;
      }
      s.inv = Math.max(0, s.inv - dt);
      if (s.ai) {
        s.think -= dt;
        if (s.think <= 0) {
          const interval = 0.1 + Math.random() * 0.05;
          s.think = interval;
          this.aiThink(s, interval);
        }
      }
      this.move(s, dt);
    }
    this.collide();
    this.eat();
    this.fillGems();
  }

  move(s, dt) {
    const maxTurn = (s.ai ? 4.2 : 9) * dt;
    s.angle += clamp(angDiff(s.want, s.angle), -maxTurn, maxTurn);

    let speed = SPEED;
    if (s.boost && s.score > BOOST_MIN_SCORE) {
      speed = BOOST_SPEED;
      s.boostAcc += dt;
      if (s.boostAcc > 0.3) {
        s.boostAcc = 0;
        s.score -= 1;
        const n = s.p.length / 2;
        this.addGem(s.p[2 * (n - 1)], s.p[2 * (n - 1) + 1], s.color % GEM_COLORS.length, 1);
      }
    } else {
      s.boostAcc = 0;
    }

    s.r = radiusFor(s.score);
    s.x = clamp(s.x + Math.cos(s.angle) * speed * dt, s.r, WORLD - s.r);
    s.y = clamp(s.y + Math.sin(s.angle) * speed * dt, s.r, WORLD - s.r);

    const p = s.p;
    const n = segsFor(s.score);
    while (p.length / 2 < n) p.push(p[p.length - 2], p[p.length - 1]);
    if (p.length / 2 > n) p.length = n * 2;
    p[0] = s.x;
    p[1] = s.y;
    const gap = Math.max(6, s.r * 0.8);
    for (let i = 1; i < n; i++) {
      const dx = p[2 * i - 2] - p[2 * i];
      const dy = p[2 * i - 1] - p[2 * i + 1];
      const d = Math.hypot(dx, dy);
      if (d > gap) {
        const k = (d - gap) / d;
        p[2 * i] += dx * k;
        p[2 * i + 1] += dy * k;
      }
    }
  }

  collide() {
    for (const a of this.snakes) {
      if (!a.alive || a.inv > 0) continue;
      for (const b of this.snakes) {
        if (b === a || !b.alive || b.inv > 0) continue;
        const thr = (a.r + b.r) * 0.75;
        const thr2 = thr * thr;
        const hx = a.x - b.x, hy = a.y - b.y;
        if (hx * hx + hy * hy < thr2 && a.score < b.score) {
          this.kill(a, b);
          break;
        }
        const p = b.p;
        let hit = false;
        for (let j = 2; j < p.length; j += 2) {
          const dx = a.x - p[j], dy = a.y - p[j + 1];
          if (dx * dx + dy * dy < thr2) { hit = true; break; }
        }
        if (hit) {
          this.kill(a, b);
          break;
        }
      }
    }
  }

  eat() {
    for (const s of this.snakes) {
      if (!s.alive) continue;
      const reach = s.r + 12;
      const reach2 = reach * reach;
      for (const g of this.gems.values()) {
        const dx = g.x - s.x, dy = g.y - s.y;
        if (dx * dx + dy * dy < reach2) {
          s.score += g.v;
          this.removeGem(g.id);
        }
      }
    }
  }

  // ---- AI ----
  danger(s, x, y) {
    if (x < 40 || x > WORLD - 40 || y < 40 || y > WORLD - 40) return true;
    for (const o of this.snakes) {
      if (o === s || !o.alive || o.inv > 0) continue;
      const thr = s.r + o.r + 10;
      const thr2 = thr * thr;
      const p = o.p;
      for (let j = 0; j < p.length; j += 2) {
        const dx = x - p[j], dy = y - p[j + 1];
        if (dx * dx + dy * dy < thr2) return true;
      }
    }
    return false;
  }

  aiThink(s, dt) {
    s.wander = clamp(s.wander + (Math.random() - 0.5) * 0.8, -1, 1);
    let want = s.angle + s.wander * 0.6;

    // nearest gem, bigger gems look closer
    let tx = null, ty = null, best = Infinity;
    for (const g of this.gems.values()) {
      const dx = g.x - s.x, dy = g.y - s.y;
      const d = (dx * dx + dy * dy) / g.v;
      if (d < best) { best = d; tx = g.x; ty = g.y; }
    }

    // hunting: aim ahead of a nearby worm's head to cut it off
    s.huntT -= dt;
    let hunting = false;
    if (s.huntT <= 0) {
      s.huntT = 1.5 + Math.random() * 1.5;
      s.prey = 0;
      if (Math.random() < 0.55 && s.score >= 8) {
        let bd = 380 * 380;
        for (const o of this.snakes) {
          if (o === s || !o.alive || o.inv > 0) continue;
          const d = (o.x - s.x) ** 2 + (o.y - s.y) ** 2;
          if (d < bd) { bd = d; s.prey = o.id; }
        }
      }
    }
    let preyDist = Infinity;
    if (s.prey) {
      const o = this.snakes[s.prey - 1];
      if (o && o.alive && o.inv <= 0) {
        const d = Math.hypot(o.x - s.x, o.y - s.y);
        preyDist = d;
        tx = o.x + Math.cos(o.angle) * (d * 0.5 + 60);
        ty = o.y + Math.sin(o.angle) * (d * 0.5 + 60);
        hunting = true;
      } else {
        s.prey = 0;
      }
    }
    if (tx !== null) want = Math.atan2(ty - s.y, tx - s.x);

    // stay away from the walls
    const m = 170;
    if (s.x < m || s.x > WORLD - m || s.y < m || s.y > WORLD - m) {
      want = Math.atan2(WORLD / 2 - s.y, WORLD / 2 - s.x);
    }

    // dodge other worms' bodies
    const look = 55 + s.r * 2;
    const offsets = [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.4];
    let chosen = want;
    for (const off of offsets) {
      const a = want + off;
      const x1 = s.x + Math.cos(a) * look, y1 = s.y + Math.sin(a) * look;
      const x2 = s.x + Math.cos(a) * look * 2, y2 = s.y + Math.sin(a) * look * 2;
      if (!this.danger(s, x1, y1) && !this.danger(s, x2, y2)) { chosen = a; break; }
    }
    s.want = chosen;
    s.boost = hunting && preyDist < 220 && s.score > 12 && chosen === want;
  }

  // ---- views ----
  view() {
    return {
      ph: this.phase,
      tl: this.timeLeft,
      ol: this.overLeft,
      rd: this.round,
      snakes: this.snakes.map((s) => ({
        id: s.id, name: s.name, score: s.score, ko: s.ko, alive: s.alive, ai: s.ai,
        inv: s.inv > 0, color: s.color, r: s.r, p: s.p, kb: s.kb, lvl: levelFor(s.score),
      })),
      gems: this.gems,
      res: this.phase === 'over' ? this.results : null,
    };
  }

  snapshot() {
    return {
      t: 's',
      ph: this.phase,
      tl: Math.round(this.timeLeft * 10) / 10,
      ol: Math.round(this.overLeft * 10) / 10,
      rd: this.round,
      sn: this.snakes.map((s) => [
        s.id, s.name, s.score, s.ko,
        (s.alive ? 1 : 0) | (s.ai ? 2 : 0) | (s.inv > 0 ? 4 : 0),
        s.color, Math.round(s.r * 10) / 10,
        s.alive ? s.p.map(Math.round) : [],
        s.kb,
      ]),
      ga: this.adds,
      gd: this.dels,
      res: this.phase === 'over' ? this.results : undefined,
    };
  }
}
