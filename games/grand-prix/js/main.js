import { buildTrack } from './track.js';
import { Race, LAPS, MAX_SPEED } from './sim.js';
import { Renderer } from './render.js';

const $ = (id) => document.getElementById(id);
const track = buildTrack();
const race = new Race(track);
const renderer = new Renderer($('game'), track);

let steer = 0;       // -1..1 from touch
let keySteer = 0;
let brakeTouch = false;
let brakeKey = false;
let last = 0;
let hudAt = 0;
let bannerTimer = 0;
let hintTimer = 0;

// RPM bar
const rpm = $('rpm');
for (let i = 0; i < 12; i++) { const s = document.createElement('i'); if (i >= 9) s.className = 'hot'; rpm.append(s); }
const rpmCells = Array.from(rpm.children);

// ---- input: wherever you touch is the centre, drag left or right to steer ----
const canvas = $('game');
let originX = null;
canvas.addEventListener('pointerdown', (e) => {
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  originX = e.clientX;
  steer = 0;
});
canvas.addEventListener('pointermove', (e) => {
  if (originX === null) return;
  steer = Math.max(-1, Math.min(1, (e.clientX - originX) / 70));
});
const endSteer = () => { originX = null; steer = 0; };
canvas.addEventListener('pointerup', endSteer);
canvas.addEventListener('pointercancel', endSteer);

const brake = $('brake');
brake.style.pointerEvents = 'auto';
brake.addEventListener('pointerdown', (e) => { e.preventDefault(); brakeTouch = true; brake.classList.add('on'); });
['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => brake.addEventListener(t, () => { brakeTouch = false; brake.classList.remove('on'); }));

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keySteer = -1;
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') keySteer = 1;
  else if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'Space') brakeKey = true;
  else return;
  e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  if ((e.code === 'ArrowLeft' || e.code === 'KeyA') && keySteer < 0) keySteer = 0;
  else if ((e.code === 'ArrowRight' || e.code === 'KeyD') && keySteer > 0) keySteer = 0;
  else if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'Space') brakeKey = false;
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

// ---- flow ----
function startRace() {
  race.begin();
  $('menu').hidden = true;
  $('result').hidden = true;
  $('hud').hidden = false;
  $('banner').hidden = true;
  const hint = $('hint');
  hint.classList.remove('gone');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => hint.classList.add('gone'), 5000);
}
$('startBtn').addEventListener('click', startRace);
$('again').addEventListener('click', startRace);

function banner(text) {
  const b = $('banner');
  b.textContent = text;
  b.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { b.hidden = true; }, 1500);
}

function fmt(t) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return m + ':' + s.toFixed(3).padStart(6, '0');
}

function handleEvents() {
  for (const ev of race.events) {
    if (ev.type === 'overtake') banner('P' + ev.rank + ' OVERTAKE');
    else if (ev.type === 'contact') banner('CONTACT');
    else if (ev.type === 'lap') banner('LAP ' + ev.lap);
    else if (ev.type === 'go') { $('count').textContent = 'GO'; setTimeout(() => { $('count').hidden = true; }, 600); }
    else if (ev.type === 'finish') {
      const r = race.result;
      $('resPos').textContent = 'P' + r.pos;
      $('resMsg').textContent = r.pos === 1 ? 'Victory. Beautiful drive.' : r.pos <= 3 ? 'On the podium. Beautiful drive.' : 'Points are close. Go again.';
      $('resTime').textContent = fmt(r.time);
      $('resBest').textContent = fmt(r.best);
      setTimeout(() => { if (race.state === 'done') $('result').hidden = false; }, 1200);
    }
  }
  race.events.length = 0;
}

function updateHud() {
  const p = race.player;
  $('pos').textContent = race.rank;
  $('time').textContent = fmt(race.state === 'race' || race.state === 'done' ? race.time : 0);
  $('lap').textContent = race.lap();
  $('barFill').style.width = (race.lapProgress() * 100).toFixed(1) + '%';
  const sp = p.speed / MAX_SPEED;
  const gear = Math.max(1, Math.min(8, 1 + Math.floor(sp * 8.4)));
  $('gear').lastElementChild.textContent = gear;
  $('speed').firstElementChild.textContent = race.kmh();
  const within = Math.max(0, Math.min(1, sp * 8.4 - (gear - 1)));
  const lit = Math.round(within * 12);
  rpmCells.forEach((c, i) => c.classList.toggle('on', i < lit));
  $('slip').classList.toggle('off', race.slip < 0.5);
  const cnt = $('count');
  if (race.state === 'count') {
    cnt.hidden = false;
    cnt.textContent = Math.max(1, Math.ceil(race.count - 0.2));
  }
}

function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t - last) / 1000 || 0);
  last = t;
  if (race.state !== 'ready') {
    const s = keySteer || steer;
    renderer.lean = s;
    race.step(dt, { steer: s, brake: brakeTouch || brakeKey });
    handleEvents();
  }
  renderer.draw(race, dt);
  if (race.state !== 'ready' && t - hudAt > 60) {
    hudAt = t;
    updateHud();
  }
}
requestAnimationFrame((t) => { last = t; frame(t); });
