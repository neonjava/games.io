import { Game, STEP, W } from './sim.js';
import { Renderer } from './render.js';

const $ = (id) => document.getElementById(id);
const renderer = new Renderer($('game'));
const game = new Game();
let playing = false, acc = 0, last = 0, view = null, hudAt = 0, hintTimer = 0, comboTimer = 0;

const store = {
  get(k) { try { return Number(localStorage.getItem(k)) || 0; } catch (e) { return 0; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* ignore */ } },
};
let best = store.get('ballguys-best');
const showBest = () => { $('menuBest').textContent = best ? 'Best score: ' + best : ''; $('best').textContent = 'Best ' + best; };
showBest();

function start() {
  game.reset();
  playing = true; view = null; acc = 0;
  $('menu').hidden = true; $('results').hidden = true; $('hud').hidden = false;
  const hint = $('hint'); hint.classList.remove('gone');
  clearTimeout(hintTimer); hintTimer = setTimeout(() => hint.classList.add('gone'), 6000);
  showBest();
}
function toMenu() { playing = false; view = null; $('hud').hidden = true; $('results').hidden = true; $('menu').hidden = false; showBest(); }
$('soloBtn').onclick = start;
$('again').onclick = start;
$('toMenu').onclick = toMenu;
$('quit').onclick = toMenu;

function aimFrom(e) {
  const [x] = renderer.toWorld(e.clientX, e.clientY);
  game.setAim(x / W);
}
const cv = $('game');
cv.addEventListener('pointerdown', (e) => {
  if (!playing) return;
  aimFrom(e);
  if (e.pointerType === 'mouse') game.drop(); else cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', (e) => { if (playing) aimFrom(e); });
cv.addEventListener('pointerup', (e) => { if (playing && e.pointerType !== 'mouse') { aimFrom(e); game.drop(); } });
addEventListener('keydown', (e) => {
  if (!playing) return;
  if (e.key === 'ArrowLeft' || e.key === 'a') game.setAim(game.u - 0.04);
  else if (e.key === 'ArrowRight' || e.key === 'd') game.setAim(game.u + 0.04);
  else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); game.drop(); }
});

function endGame() {
  playing = false;
  if (game.score > best) { best = game.score; store.set('ballguys-best', best); $('finalBest').textContent = 'New best score!'; }
  else $('finalBest').textContent = 'Best: ' + best;
  $('finalScore').textContent = game.score;
  setTimeout(() => { $('results').hidden = false; $('hud').hidden = true; }, 900);
}

function loop(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
  last = ts;
  if (playing) {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 6) { game.step(STEP); acc -= STEP; n++; }
    if (acc > STEP) acc = 0;
    view = game.view();
    renderer.events(view.ev);
    for (const e of view.ev) {
      if (e[0] === 'o') endGame();
      if ((e[0] === 'm' && e[5] > 1) || e[0] === 'p') {
        const c = $('combo'); c.hidden = false; c.textContent = e[0] === 'p' ? 'POP! x' + (e[5] || 1) : 'Combo x' + e[5];
        clearTimeout(comboTimer); comboTimer = setTimeout(() => (c.hidden = true), 900);
      }
    }
    if (ts - hudAt > 100) { hudAt = ts; $('score').textContent = view.score; }
  }
  renderer.frame(view, null, dt, ts);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
renderer.frame(null, null, 0, 0);
