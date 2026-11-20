import { ALL_IDS, BY_ID, craft, feedback } from './data.js';

export const MAX_GUESSES = 10;
const K = { bag: 'craftle-bag', last: 'craftle-last', cur: 'craftle-current', stats: 'craftle-stats', daily: 'craftle-daily-', hc: 'craftle-hc' };

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
export { store, K };

function shuffle(a, rnd = Math.random) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Random mode: a shuffled bag is emptied one item at a time, so nothing repeats
// until every recipe has been played. When it refills the last item is kept off the front.
export function nextRandomId() {
  let bag = store.get(K.bag, []).filter((id) => BY_ID[id]);
  if (!bag.length) {
    bag = shuffle(ALL_IDS);
    const last = store.get(K.last, null);
    if (last && bag[0] === last) bag.push(bag.shift());
  }
  const id = bag.shift();
  store.set(K.bag, bag);
  store.set(K.last, id);
  return id;
}

export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function dailyId(key = todayKey()) {
  const day = Math.floor(Date.UTC(...key.split('-').map((n, i) => (i === 1 ? n - 1 : +n))) / 86400000);
  const order = shuffle(ALL_IDS, seeded(20260101));
  return order[((day % order.length) + order.length) % order.length];
}

export function newGame(mode, targetId) {
  return { mode, target: targetId, guesses: [], done: false, won: false, day: mode === 'daily' ? todayKey() : null };
}

// returns {ok:false,msg} or {ok:true,guess}
export function submit(game, grid) {
  if (game.done) return { ok: false, msg: 'Game is over' };
  const r = craft(grid);
  if (!r) return { ok: false, msg: 'That is not a valid recipe' };
  if (game.guesses.some((g) => JSON.stringify(g.grid) === JSON.stringify(grid))) return { ok: false, msg: 'Already guessed that' };
  const target = BY_ID[game.target];
  const guess = { grid: grid.slice(), result: r.id, n: r.n, feedback: feedback(target, grid) };
  game.guesses.push(guess);
  if (r.id === game.target) { game.done = true; game.won = true; }
  else if (game.guesses.length >= MAX_GUESSES) game.done = true;
  return { ok: true, guess };
}

export function hints(game) {
  const t = BY_ID[game.target], n = game.guesses.length, out = [];
  if (n >= 4) out.push(`Category: ${t.cat}`);
  if (n >= 7) {
    const ids = new Set((t.shaped ? t.cells.flat() : t.list).filter(Boolean));
    out.push(`${t.shaped ? 'Shaped' : 'Shapeless'} recipe, ${ids.size} different ingredient${ids.size > 1 ? 's' : ''}`);
  }
  return out;
}

export function loadStats() { return store.get(K.stats, { played: 0, won: 0, streak: 0, best: 0, dist: Array(MAX_GUESSES).fill(0) }); }
export function recordResult(game) {
  const s = loadStats();
  s.played++;
  if (game.won) { s.won++; s.streak++; s.best = Math.max(s.best, s.streak); s.dist[game.guesses.length - 1]++; }
  else s.streak = 0;
  store.set(K.stats, s);
  return s;
}

export function saveGame(g) { store.set(g.mode === 'daily' ? K.daily + g.day : K.cur, g); }
export function loadGame(mode) {
  const g = store.get(mode === 'daily' ? K.daily + todayKey() : K.cur, null);
  return g && BY_ID[g.target] ? g : null;
}
export function clearCurrent() { try { localStorage.removeItem(K.cur); } catch {} }
