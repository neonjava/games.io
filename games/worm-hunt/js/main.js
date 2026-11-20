import { LocalSession, openRoom } from './net.js';
import { Renderer } from './render.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const renderer = new Renderer(canvas);

let session = null;
let aim = 0;
let boosting = false;
let last = 0;
let hudAt = 0;
let hintTimer = 0;

const store = {
  get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
};

// ---------- menu ----------
const cleanCode = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
const randomCode = () => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
};

function menuMsg(text) { $('menuMsg').textContent = text || ''; }

function showMenu(msg) {
  $('menu').hidden = false;
  $('hud').hidden = true;
  $('results').hidden = true;
  $('nameDlg').hidden = true;
  $('soloBtn').disabled = false;
  $('roomBtn').disabled = false;
  menuMsg(msg);
}

let afterName = null;
function askName(cb) {
  afterName = cb;
  $('nameInput').value = store.get('wormhunt-name');
  $('nameDlg').hidden = false;
  setTimeout(() => $('nameInput').focus(), 50);
}

$('nameForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('nameInput').value.trim().slice(0, 12) || 'Player';
  store.set('wormhunt-name', name);
  $('nameDlg').hidden = true;
  const cb = afterName;
  afterName = null;
  if (cb) cb(name);
});
$('nameCancel').addEventListener('click', () => {
  $('nameDlg').hidden = true;
  afterName = null;
});

$('soloBtn').addEventListener('click', () => {
  askName((name) => enter(new LocalSession(name)));
});

function joinCode(code) {
  askName(async (name) => {
    $('soloBtn').disabled = true;
    $('roomBtn').disabled = true;
    menuMsg('Connecting to room ' + code + '...');
    try {
      enter(await openRoom(code, name));
    } catch (err) {
      showMenu(err && err.message ? err.message : 'Could not open the room');
    }
  });
}

$('roomBtn').addEventListener('click', () => {
  joinCode(cleanCode($('codeInput').value) || randomCode());
});
$('codeInput').addEventListener('input', (e) => {
  e.target.value = cleanCode(e.target.value);
});

// ---------- game ----------
function enter(s) {
  session = s;
  $('menu').hidden = true;
  $('hud').hidden = false;
  $('results').hidden = true;
  s.onClose = () => leave('The host left the room');
  const chip = $('roomchip');
  if (s.code) {
    chip.hidden = false;
    chip.textContent = 'Room ' + s.code;
    history.replaceState(null, '', '#room=' + s.code);
  } else {
    chip.hidden = true;
    history.replaceState(null, '', location.pathname + location.search);
  }
  const hint = $('hint');
  hint.classList.remove('gone');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => hint.classList.add('gone'), 4500);
}

function leave(msg) {
  if (session) session.close();
  session = null;
  boosting = false;
  history.replaceState(null, '', location.pathname + location.search);
  showMenu(msg);
}

$('quit').addEventListener('click', () => leave(''));

// ---------- input ----------
// Touch: wherever the finger lands becomes the centre; drag from there to steer.
// Mouse: steer towards the pointer relative to the middle of the screen.
let origin = null;
const stick = $('stick');
function setAim(e) {
  if (e.pointerType === 'mouse' || !origin) {
    aim = Math.atan2(e.clientY - window.innerHeight / 2, e.clientX - window.innerWidth / 2);
    return;
  }
  const dx = e.clientX - origin.x, dy = e.clientY - origin.y;
  if (dx * dx + dy * dy > 64) aim = Math.atan2(dy, dx);
  const len = Math.min(40, Math.hypot(dx, dy));
  const a = Math.atan2(dy, dx);
  stick.firstElementChild.style.transform = 'translate(' + Math.cos(a) * len + 'px,' + Math.sin(a) * len + 'px)';
}
canvas.addEventListener('pointerdown', (e) => {
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  if (e.pointerType !== 'mouse') {
    origin = { x: e.clientX, y: e.clientY };
    stick.style.left = origin.x + 'px';
    stick.style.top = origin.y + 'px';
    stick.firstElementChild.style.transform = 'translate(0,0)';
    stick.hidden = false;
  }
  setAim(e);
});
canvas.addEventListener('pointermove', setAim);
const endTouch = () => { origin = null; stick.hidden = true; };
canvas.addEventListener('pointerup', endTouch);
canvas.addEventListener('pointercancel', endTouch);

const boostBtn = $('boost');
const setBoost = (on) => { boosting = on; boostBtn.classList.toggle('on', on); };
boostBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); setBoost(true); });
['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => boostBtn.addEventListener(t, () => setBoost(false)));
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.key === 'Shift') { if (session) e.preventDefault(); setBoost(true); }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.key === 'Shift') setBoost(false);
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- HUD ----------
const ordinal = (n) => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
const fmtTime = (t) => {
  const s = Math.max(0, Math.ceil(t));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};

function row(cls, rk, name, score) {
  const d = document.createElement('div');
  d.className = 'row' + cls;
  const a = document.createElement('span'); a.className = 'rk'; a.textContent = rk;
  const b = document.createElement('span'); b.className = 'nm'; b.textContent = name;
  const c = document.createElement('span'); c.textContent = score;
  d.append(a, b, c);
  return d;
}

function updateHud(v) {
  const you = v.snakes.find((s) => s.id === v.you);
  const ranked = v.snakes.slice().sort((a, b) => b.score - a.score || b.ko - a.ko || a.id - b.id);

  $('timer').textContent = v.ph === 'over' ? 'Done' : fmtTime(v.tl);
  if (you) {
    $('score').textContent = you.score;
    $('ko').textContent = 'KO ' + you.ko;
  }
  const chip = $('roomchip');
  if (session && session.code) chip.textContent = 'Room ' + session.code + ' · ' + v.players + ' online';

  const board = $('board');
  board.replaceChildren();
  ranked.slice(0, 3).forEach((s, i) => board.append(row(s.id === v.you ? ' me' : '', ordinal(i + 1), s.name, s.score)));
  const myRank = ranked.findIndex((s) => s.id === v.you);
  if (myRank >= 3) board.append(row(' me', ordinal(myRank + 1), you.name, you.score));

  const toast = $('toast');
  if (you && !you.alive && v.ph === 'play') {
    toast.hidden = false;
    toast.textContent = you.kb ? 'Cut off by ' + you.kb : 'You were cut off';
  } else {
    toast.hidden = true;
  }

  const results = $('results');
  if (v.ph === 'over' && v.res) {
    if (results.hidden) {
      const list = $('resultList');
      list.replaceChildren();
      v.res.forEach((r, i) => {
        const li = document.createElement('li');
        if (r.id === v.you) li.className = 'me';
        const a = document.createElement('span'); a.className = 'rk'; a.textContent = ordinal(i + 1);
        const b = document.createElement('span'); b.className = 'nm'; b.textContent = r.name;
        const c = document.createElement('span'); c.textContent = r.score;
        const d = document.createElement('span'); d.className = 'ko'; d.textContent = 'KO ' + r.ko;
        li.append(a, b, c, d);
        list.append(li);
      });
      results.hidden = false;
    }
    $('nextRound').textContent = 'Next round in ' + Math.max(0, Math.ceil(v.ol)) + 's';
  } else if (!results.hidden) {
    results.hidden = true;
  }
}

// ---------- loop ----------
function frame(t) {
  requestAnimationFrame(frame);
  if (!session) return;
  const dt = Math.min(0.1, (t - last) / 1000 || 0);
  last = t;
  session.setInput(aim, boosting);
  session.update(dt);
  const v = session.view();
  if (!v) return;
  renderer.draw(v);
  if (t - hudAt > 150) {
    hudAt = t;
    updateHud(v);
  }
}
requestAnimationFrame((t) => { last = t; frame(t); });

// idle backdrop behind the menu: a quiet local match
// (kept simple: menu shows a blank arena until a game starts)

// invite links like #room=ABCDE
const m = /room=([A-Za-z0-9]+)/.exec(location.hash);
if (m) {
  const code = cleanCode(m[1]);
  $('codeInput').value = code;
  if (code) joinCode(code);
}
