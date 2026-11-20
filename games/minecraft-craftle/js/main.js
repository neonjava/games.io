import { INGREDIENTS, RECIPES, BY_ID, NAMES, craft } from './data.js';
import { icon } from './icons.js';
import * as G from './game.js';

const $ = (s) => document.querySelector(s);
const NAME = (id) => NAMES[id] || id;
let game = null, grid = Array(9).fill(null), sel = null;

// ---- dirt background
(function bg() {
  const t = document.createElement('canvas'); t.width = t.height = 16;
  const c = t.getContext('2d');
  const base = [[96, 66, 40], [84, 57, 34], [110, 76, 46], [70, 48, 28], [124, 90, 56]];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const h = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
    const b = base[h < .4 ? 0 : h < .65 ? 1 : h < .82 ? 2 : h < .94 ? 3 : 4];
    c.fillStyle = `rgb(${b[0] * .55},${b[1] * .55},${b[2] * .55})`; c.fillRect(x, y, 1, 1);
  }
  const cv = $('#bg'), cx = cv.getContext('2d');
  const draw = () => {
    cv.width = Math.ceil(innerWidth / 4); cv.height = Math.ceil(innerHeight / 4);
    cx.imageSmoothingEnabled = false;
    cx.fillStyle = cx.createPattern(t, 'repeat'); cx.fillRect(0, 0, cv.width, cv.height);
  };
  draw(); addEventListener('resize', draw);
})();

// ---- ui helpers
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const itemImg = (id) => `<img src="${icon(id)}" alt="${NAME(id)}" draggable="false">`;
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 1800); }
function modal(html) { $('#mBody').innerHTML = html; $('#modal').hidden = false; }
$('#mClose').onclick = () => ($('#modal').hidden = true);
$('#modal').addEventListener('pointerdown', (e) => { if (e.target.id === 'modal') $('#modal').hidden = true; });

// ---- palette & grid
const pal = $('#pal');
for (const [id] of INGREDIENTS) {
  const s = el('div', 'slot', itemImg(id)); s.dataset.id = id; s.title = NAME(id);
  pal.appendChild(s);
}
const gridEl = $('#grid');
for (let i = 0; i < 9; i++) { const s = el('div', 'slot'); s.dataset.i = i; gridEl.appendChild(s); }

function setSel(id) {
  sel = id;
  pal.querySelectorAll('.slot').forEach((s) => s.classList.toggle('sel', s.dataset.id === id));
  $('#sel').textContent = id ? `Selected: ${NAME(id)}` : 'Select an ingredient, then tap a slot';
}
function place(i, id) { grid[i] = id; renderGrid(); }
function renderGrid() {
  gridEl.querySelectorAll('.slot').forEach((s, i) => { s.innerHTML = grid[i] ? itemImg(grid[i]) : ''; });
  const r = craft(grid), out = $('#out');
  out.innerHTML = r ? itemImg(r.id) + (r.n > 1 ? `<span class="n">${r.n}</span>` : '') : '';
  out.title = r ? NAME(r.id) : '';
  $('#bGuess').disabled = !r || (game && game.done);
}

pal.addEventListener('click', (e) => { const s = e.target.closest('.slot'); if (s && !drag.moved) setSel(s.dataset.id); });
gridEl.addEventListener('click', (e) => {
  const s = e.target.closest('.slot'); if (!s || drag.moved || (game && game.done)) return;
  const i = +s.dataset.i;
  if (sel && grid[i] !== sel) place(i, sel); else if (grid[i]) place(i, null);
});
$('#bClear').onclick = () => { grid = Array(9).fill(null); renderGrid(); };
$('#out').onclick = () => doGuess();
$('#bGuess').onclick = () => doGuess();
addEventListener('keydown', (e) => { if (e.key === 'Enter' && $('#modal').hidden) doGuess(); });

// ---- drag & drop (pointer based; taps still work through click)
const drag = { id: null, from: null, moved: false, x: 0, y: 0 };
const ghost = $('#ghost');
function startDrag(e, id, from) {
  drag.id = id; drag.from = from; drag.moved = false; drag.x = e.clientX; drag.y = e.clientY;
}
document.addEventListener('pointerdown', (e) => {
  const p = e.target.closest('#pal .slot'), g = e.target.closest('#grid .slot');
  if (p) startDrag(e, p.dataset.id, null);
  else if (g && grid[+g.dataset.i]) startDrag(e, grid[+g.dataset.i], +g.dataset.i);
});
document.addEventListener('pointermove', (e) => {
  if (!drag.id) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
  drag.moved = true; ghost.hidden = false; ghost.innerHTML = itemImg(drag.id);
  ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
});
document.addEventListener('pointerup', (e) => {
  if (!drag.id) return;
  if (drag.moved && !(game && game.done)) {
    const t = document.elementFromPoint(e.clientX, e.clientY)?.closest('#grid .slot');
    if (t) { const i = +t.dataset.i; if (drag.from != null && drag.from !== i) grid[drag.from] = null; place(i, drag.id); }
    else if (drag.from != null) place(drag.from, null);
  }
  ghost.hidden = true; const m = drag.moved; drag.id = null;
  if (m) setTimeout(() => (drag.moved = false), 0);
});
document.addEventListener('pointercancel', () => { ghost.hidden = true; drag.id = null; drag.moved = false; });

// ---- game flow
function renderHistory() {
  const h = $('#history'); h.innerHTML = '';
  for (const g of game.guesses) {
    const c = el('div', 'card'), m = el('div', 'mini');
    g.grid.forEach((id, i) => { const s = el('div', 'slot' + (id ? ' ' + g.feedback[i] : ''), id ? itemImg(id) : ''); m.appendChild(s); });
    c.append(m, el('div', 'sm'), el('div', 'slot res', itemImg(g.result)));
    c.title = NAME(g.result);
    h.appendChild(c);
  }
  $('#count').textContent = `Guess ${Math.min(game.guesses.length + 1, G.MAX_GUESSES)}/${G.MAX_GUESSES}`;
  $('#hint').textContent = G.hints(game).join('  |  ');
  $('#modeName').textContent = game.mode === 'daily' ? 'Daily' : 'Random';
}

function start(mode, fresh) {
  let g = !fresh && G.loadGame(mode);
  if (!g) {
    if (mode === 'daily') g = G.newGame('daily', G.dailyId());
    else { g = G.newGame('random', G.nextRandomId()); }
    G.saveGame(g);
  }
  game = g; grid = Array(9).fill(null); setSel(null);
  renderHistory(); renderGrid();
  $('#craft').style.display = ''; $('#row').style.display = '';
  if (game.done) endModal();
}

function doGuess() {
  if (!game) return;
  if (game.done) { endModal(); return; }
  const r = G.submit(game, grid);
  if (!r.ok) { toast(r.msg); return; }
  grid = Array(9).fill(null);
  renderHistory(); renderGrid();
  if (game.done) {
    const stats = G.recordResult(game);
    if (game.mode === 'random') G.clearCurrent();
    G.saveGame(game);
    if (game.mode === 'random') G.clearCurrent();
    setTimeout(() => endModal(stats), 450);
  } else G.saveGame(game);
}

function recipeHTML(id) {
  const t = BY_ID[id];
  const cells = Array(9).fill(null);
  if (t.shaped) for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) cells[y * 3 + x] = t.cells[y][x];
  else t.list.forEach((x, i) => (cells[i] = x));
  const mini = cells.map((c) => `<div class="slot" style="cursor:default;width:34px;height:34px">${c ? `<img src="${icon(c)}" style="width:26px;height:26px;image-rendering:pixelated">` : ''}</div>`).join('');
  return `<div style="display:flex;align-items:center;justify-content:center;gap:10px;margin:8px 0"><div style="display:grid;grid-template-columns:repeat(3,34px)">${mini}</div><div id="arrow" style="width:26px;height:20px"></div><div class="slot big" style="cursor:default">${itemImg(id)}${t.n > 1 ? `<span class="n">${t.n}</span>` : ''}</div></div>`;
}
function statsHTML(s) {
  const mx = Math.max(1, ...s.dist);
  return `<div class="stats"><div><b>${s.played}</b>Played</div><div><b>${s.played ? Math.round((100 * s.won) / s.played) : 0}%</b>Win</div><div><b>${s.streak}</b>Streak</div><div><b>${s.best}</b>Best</div></div>` +
    s.dist.map((n, i) => `<div class="bar"><span style="width:20px">${i + 1}</span><i style="width:${Math.max(8, (n / mx) * 100)}%">${n}</i></div>`).join('');
}
function endModal() {
  const won = game.won;
  modal(`<h2>${won ? 'You crafted it!' : 'Out of guesses'}</h2><p style="text-align:center">${won ? `${NAME(game.target)} in ${game.guesses.length} guess${game.guesses.length > 1 ? 'es' : ''}.` : `The answer was ${NAME(game.target)}.`}</p>${recipeHTML(game.target)}${statsHTML(G.loadStats())}` +
    `<div style="display:flex;gap:8px;justify-content:center">${game.mode === 'random' ? '<button class="mc go" id="again">Play Again</button>' : '<button class="mc" id="toRandom">Random Mode</button>'}</div>`);
  const a = $('#again'); if (a) a.onclick = () => { $('#modal').hidden = true; start('random', true); };
  const r = $('#toRandom'); if (r) r.onclick = () => { $('#modal').hidden = true; start('random'); };
}

$('#bDaily').onclick = () => start('daily');
$('#bRandom').onclick = () => start('random');
$('#bStats').onclick = () => modal(`<h2>Statistics</h2>${statsHTML(G.loadStats())}`);
$('#bHelp').onclick = () => modal(`<h2>How To Play</h2>
<p>Guess the crafting recipe in ${G.MAX_GUESSES} tries. Fill the 3x3 grid with any valid recipe, then press Guess or tap the result slot.</p>
<p>After each guess the slots are coloured against the secret recipe:</p>
<div class="legend"><div class="slot green"></div> right ingredient, right place</div>
<div class="legend"><div class="slot yellow"></div> right ingredient, wrong place</div>
<div class="legend"><div class="slot none"></div> not in the recipe</div>
<p>Shapeless recipes only show green for ingredients that are part of the recipe. A category hint unlocks after 4 guesses and more after 7.</p>
<p>Random mode never repeats an item until you have seen all ${RECIPES.length}. Daily mode has one item per day.</p>`);
function hc(on) { document.body.classList.toggle('hc', on); $('#bHC').textContent = `High Contrast: ${on ? 'On' : 'Off'}`; G.store.set(G.K.hc, on); }
$('#bHC').onclick = () => hc(!document.body.classList.contains('hc'));
hc(!!G.store.get(G.K.hc, false));

start('random');
