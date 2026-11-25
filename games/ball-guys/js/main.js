import { LocalSession, openRoom } from './net.js';
import { Renderer } from './render.js';
import { COLORS, COLOR_NAMES, aimU } from './sim.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const renderer = new Renderer(canvas);
const ARROWS = ['↓', '→', '↑', '←'];

let session = null, view = null, aim = 0.5, last = 0, hudAt = 0, hintTimer = 0;

const store = {
  get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
};

// ---------- menu ----------
const cleanCode = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
const randomCode = () => { const c = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let o = ''; for (let i = 0; i < 5; i++) o += c[Math.floor(Math.random() * c.length)]; return o; };
const menuMsg = (t) => { $('menuMsg').textContent = t || ''; };

function showMenu(msg) {
  $('menu').hidden = false; $('hud').hidden = true; $('results').hidden = true; $('nameDlg').hidden = true;
  $('soloBtn').disabled = false; $('roomBtn').disabled = false;
  menuMsg(msg);
}

let afterName = null;
function askName(cb) {
  afterName = cb;
  $('nameInput').value = store.get('ballguys-name');
  $('nameDlg').hidden = false;
  setTimeout(() => $('nameInput').focus(), 50);
}
$('nameForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('nameInput').value.trim().slice(0, 12) || 'Player';
  store.set('ballguys-name', name);
  $('nameDlg').hidden = true;
  const cb = afterName; afterName = null;
  if (cb) cb(name);
});
$('nameCancel').addEventListener('click', () => { $('nameDlg').hidden = true; afterName = null; });
$('soloBtn').addEventListener('click', () => askName((name) => enter(new LocalSession(name))));

function joinCode(code) {
  askName(async (name) => {
    $('soloBtn').disabled = true; $('roomBtn').disabled = true;
    menuMsg('Connecting to room ' + code + '...');
    try { enter(await openRoom(code, name)); } catch (err) { showMenu(err && err.message ? err.message : 'Could not open the room'); }
  });
}
$('roomBtn').addEventListener('click', () => joinCode(cleanCode($('codeInput').value) || randomCode()));
$('codeInput').addEventListener('input', (e) => { e.target.value = cleanCode(e.target.value); });

function enter(s) {
  session = s; view = null; aim = 0.5;
  $('menu').hidden = true; $('hud').hidden = false; $('results').hidden = true;
  s.onClose = () => leave('The host left the room');
  const chip = $('roomchip');
  if (s.code) { chip.hidden = false; chip.textContent = 'Room ' + s.code; history.replaceState(null, '', '#room=' + s.code); }
  else { chip.hidden = true; history.replaceState(null, '', location.pathname + location.search); }
  const hint = $('hint'); hint.classList.remove('gone');
  clearTimeout(hintTimer); hintTimer = setTimeout(() => hint.classList.add('gone'), 7000);
}
function leave(msg) {
  if (session) session.close();
  session = null; view = null;
  history.replaceState(null, '', location.pathname + location.search);
  showMenu(msg);
}
$('quit').addEventListener('click', () => leave(''));

// ---------- input ----------
// Mouse: move to aim, click to drop. Touch: touch or drag to aim, lift to drop.
function setAimFromPointer(e) {
  if (!session) return;
  const [x, y] = renderer.toWorld(e.clientX, e.clientY);
  aim = aimU(view ? view.gd : 0, x, y);
  session.setAim(aim);
}
function doDrop() { if (session && view && view.ph === 'play') session.drop(); }
canvas.addEventListener('pointerdown', (e) => {
  setAimFromPointer(e);
  if (e.pointerType === 'mouse') doDrop();
  else canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', setAimFromPointer);
canvas.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') { setAimFromPointer(e); doDrop(); } });
addEventListener('keydown', (e) => {
  if (!session || e.target.tagName === 'INPUT') return;
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'ArrowUp' || k === 'w') { aim = Math.max(0, aim - 0.04); session.setAim(aim); }
  else if (k === 'ArrowRight' || k === 'd' || k === 'ArrowDown' || k === 's') { aim = Math.min(1, aim + 0.04); session.setAim(aim); }
  else if (k === ' ' || k === 'Enter') { e.preventDefault(); doDrop(); }
  else if (k === 'm' || k === 'Shift') session.magnet();
});
$('magnet').addEventListener('click', () => { if (session) session.magnet(); });

// ---------- hud ----------
const fmt = (t) => { t = Math.max(0, Math.ceil(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
let lastPh = 'play';
function hud(v) {
  $('timer').textContent = fmt(v.tl);
  const g = $('grav');
  if (v.gn >= 0 && v.gw > 0) { g.className = 'pill warn'; g.textContent = `Shift ${ARROWS[v.gd]} → ${ARROWS[v.gn]} ${v.gw.toFixed(1)}`; }
  else { g.className = 'pill'; g.textContent = 'Gravity ' + ARROWS[v.gd]; }
  const sorted = v.players.slice().sort((a, b) => b.score - a.score);
  $('chips').innerHTML = sorted.map((p) =>
    `<div class="chip${p.idx === v.you ? ' me' : ''}"><i style="background:${COLORS[p.idx]}"></i><b>${esc(p.name)} ${p.score}</b><small>${p.balls}</small></div>`).join('');
  const me = v.players[v.you];
  if (me) {
    const m = $('magnet');
    $('magFill').style.transform = `scaleX(${me.mcd > 0 ? 1 - me.mcd / 9 : 1})`;
    m.classList.toggle('ready', me.mcd <= 0);
  }
  if (v.ph === 'over') {
    $('results').hidden = false;
    if (lastPh !== 'over') {
      $('resultList').innerHTML = (v.res || []).map((r, i) =>
        `<li class="${r.idx === v.you ? 'me' : ''}"><span>${i + 1}.</span><i style="background:${COLORS[r.idx]}"></i><span>${esc(r.name)}${r.ai ? '' : ''}</span><b>${r.score}</b></li>`).join('');
    }
    $('nextRound').textContent = `Next round in ${Math.ceil(v.ol)}...`;
  } else $('results').hidden = true;
  lastPh = v.ph;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
void COLOR_NAMES;

// ---------- loop ----------
function loop(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
  last = ts;
  if (session) {
    session.update(dt);
    const v = session.view();
    if (v) {
      view = v;
      renderer.events(v.ev || []);
      if (ts - hudAt > 120) { hudAt = ts; hud(v); }
    }
  }
  renderer.frame(session ? view : null, session ? { you: view ? view.you : 0, u: aim, now: ts } : null, dt, ts);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
renderer.frame(null, null, 0, 0);

const m = /room=([A-Za-z0-9]+)/.exec(location.hash);
if (m) { $('codeInput').value = cleanCode(m[1]); }
