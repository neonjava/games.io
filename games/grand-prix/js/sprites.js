// Pre-rendered sprites: supercars, trees, billboards, grandstands, scenery.
// Everything is drawn once on offscreen canvases and then scaled during the race.

const TAU = Math.PI * 2;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const shade = (a, t) => (t >= 0 ? mix(a, [255, 255, 255], t) : mix(a, [0, 0, 0], -t));
const css = (a, al) => 'rgba(' + a[0] + ',' + a[1] + ',' + a[2] + ',' + (al == null ? 1 : al) + ')';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// ---------------------------------------------------------------- supercars
export const CAR_W = 480;
export const CAR_H = 270;
export const CAR_BODY_W = 440;
export const CAR_GROUND = 256;

const MODELS = {
  wedge: { cabinTop: 196, inset: 34, deck: 160, wing: 'high', lights: 'bar', exhaust: 2 },
  gt: { cabinTop: 214, inset: 22, deck: 166, wing: 'duck', lights: 'twin', exhaust: 2 },
  hyper: { cabinTop: 190, inset: 40, deck: 156, wing: 'big', lights: 'bar', exhaust: 4 },
  coupe: { cabinTop: 206, inset: 28, deck: 164, wing: 'lip', lights: 'twin', exhaust: 2 },
};
export const MODEL_NAMES = Object.keys(MODELS);

export function makeCar(model, paint, braking) {
  const M = MODELS[model];
  const cv = canvas(CAR_W, CAR_H);
  const c = cv.getContext('2d');
  const yg = CAR_GROUND, cx = CAR_W / 2;
  const base = hex(paint);
  const hi = shade(base, 0.42), mid = shade(base, 0.08), lo = shade(base, -0.38), dk = shade(base, -0.65);

  // ground shadow
  c.save();
  c.setTransform(1, 0, 0, 0.09, 0, 0);
  const sg = c.createRadialGradient(cx, (yg + 2) / 0.09, 20, cx, (yg + 2) / 0.09, 236);
  sg.addColorStop(0, 'rgba(0,0,0,0.6)');
  sg.addColorStop(0.7, 'rgba(0,0,0,0.3)');
  sg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = sg;
  c.beginPath(); c.arc(cx, (yg + 2) / 0.09, 236, 0, TAU); c.fill();
  c.restore();

  // rear tyres
  for (const x of [22, 388]) {
    const g = c.createLinearGradient(x, 0, x + 70, 0);
    g.addColorStop(0, '#060707'); g.addColorStop(0.5, '#2b2e32'); g.addColorStop(1, '#060707');
    c.fillStyle = g;
    rr(c, x, yg - 98, 70, 98, 17); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.07)'; c.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const yy = yg - 88 + i * 16;
      c.beginPath(); c.moveTo(x + 8, yy); c.lineTo(x + 62, yy); c.stroke();
    }
    c.fillStyle = 'rgba(255,255,255,0.08)';
    rr(c, x + 6, yg - 94, 8, 80, 4); c.fill();
  }

  // diffuser
  const dg = c.createLinearGradient(0, yg - 80, 0, yg);
  dg.addColorStop(0, '#202326'); dg.addColorStop(1, '#08090a');
  c.fillStyle = dg;
  c.beginPath(); c.moveTo(92, yg - 80); c.lineTo(388, yg - 80); c.lineTo(374, yg - 5); c.lineTo(106, yg - 5); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.09)'; c.lineWidth = 2;
  for (let x = 120; x <= 360; x += 20) {
    c.beginPath(); c.moveTo(x, yg - 72); c.lineTo(x + (x - cx) * 0.06, yg - 8); c.stroke();
  }
  c.fillStyle = '#2f3438';
  c.fillRect(110, yg - 9, 260, 4);

  // exhausts
  const ex = M.exhaust === 4 ? [[150, 40, 12], [190, 40, 12], [290, 40, 12], [330, 40, 12]] : [[170, 44, 19], [310, 44, 19]];
  for (const [x, h, r] of ex) {
    const eg = c.createRadialGradient(x - r * 0.3, yg - h - r * 0.3, 1, x, yg - h, r);
    eg.addColorStop(0, '#f2f4f5'); eg.addColorStop(0.6, '#8a9096'); eg.addColorStop(1, '#4a4f54');
    c.fillStyle = eg;
    c.beginPath(); c.arc(x, yg - h, r, 0, TAU); c.fill();
    const ig = c.createRadialGradient(x, yg - h, 1, x, yg - h, r * 0.78);
    ig.addColorStop(0, '#000'); ig.addColorStop(1, '#2a2c2e');
    c.fillStyle = ig;
    c.beginPath(); c.arc(x, yg - h, r * 0.78, 0, TAU); c.fill();
  }

  // body: rear haunches and deck
  const body = new Path2D();
  body.moveTo(54, yg - 58);
  body.bezierCurveTo(28, yg - 78, 22, yg - 120, 44, yg - 142);
  body.bezierCurveTo(92, yg - 160, 150, yg - 168, 240, yg - 168);
  body.bezierCurveTo(330, yg - 168, 388, yg - 160, 436, yg - 142);
  body.bezierCurveTo(458, yg - 120, 452, yg - 78, 426, yg - 58);
  body.lineTo(380, yg - 52);
  body.lineTo(100, yg - 52);
  body.closePath();

  const bg = c.createLinearGradient(0, yg - 172, 0, yg - 50);
  bg.addColorStop(0, css(hi)); bg.addColorStop(0.28, css(mid)); bg.addColorStop(0.62, css(base)); bg.addColorStop(1, css(lo));
  c.fillStyle = bg;
  c.fill(body);
  c.save();
  c.clip(body);
  const sg2 = c.createLinearGradient(0, 0, CAR_W, 0);
  sg2.addColorStop(0, 'rgba(0,0,0,0.5)'); sg2.addColorStop(0.2, 'rgba(0,0,0,0.05)');
  sg2.addColorStop(0.5, 'rgba(255,255,255,0.06)'); sg2.addColorStop(0.8, 'rgba(0,0,0,0.05)'); sg2.addColorStop(1, 'rgba(0,0,0,0.5)');
  c.fillStyle = sg2;
  c.fillRect(0, 0, CAR_W, CAR_H);
  // shoulder crease and lower shadow
  c.strokeStyle = css(shade(base, 0.55), 0.55); c.lineWidth = 3;
  c.beginPath(); c.moveTo(48, yg - 138); c.bezierCurveTo(100, yg - 156, 170, yg - 162, 240, yg - 162); c.bezierCurveTo(310, yg - 162, 380, yg - 156, 432, yg - 138); c.stroke();
  c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 6;
  c.beginPath(); c.moveTo(70, yg - 66); c.lineTo(410, yg - 66); c.stroke();
  c.restore();

  // cabin
  const top = yg - M.cabinTop, bot = yg - M.deck + 6, ins = M.inset;
  const cabin = new Path2D();
  cabin.moveTo(112, bot);
  cabin.quadraticCurveTo(116 + ins * 0.4, top + 24, 124 + ins * 1.3, top + 6);
  cabin.quadraticCurveTo(132 + ins * 1.4, top - 2, 150 + ins * 1.4, top);
  cabin.lineTo(330 - ins * 1.4, top);
  cabin.quadraticCurveTo(348 - ins * 1.4, top - 2, 356 - ins * 1.3, top + 6);
  cabin.quadraticCurveTo(364 - ins * 0.4, top + 24, 368, bot);
  cabin.closePath();
  const cg = c.createLinearGradient(0, top, 0, bot);
  cg.addColorStop(0, css(hi)); cg.addColorStop(0.5, css(base)); cg.addColorStop(1, css(lo));
  c.fillStyle = cg;
  c.fill(cabin);
  // rear window
  const wTop = top + 11, wBot = bot - 2, wi = ins * 1.2;
  const win = new Path2D();
  win.moveTo(130, wBot);
  win.lineTo(142 + wi, wTop + 4);
  win.quadraticCurveTo(146 + wi, wTop, 156 + wi, wTop);
  win.lineTo(324 - wi, wTop);
  win.quadraticCurveTo(334 - wi, wTop, 338 - wi, wTop + 4);
  win.lineTo(350, wBot);
  win.closePath();
  const wg = c.createLinearGradient(0, wTop, 0, wBot);
  wg.addColorStop(0, '#0a1118'); wg.addColorStop(0.55, '#1b2a36'); wg.addColorStop(1, '#0c1319');
  c.fillStyle = wg;
  c.fill(win);
  c.save();
  c.clip(win);
  c.fillStyle = 'rgba(255,255,255,0.13)';
  c.beginPath(); c.moveTo(150, wBot); c.lineTo(205, wBot); c.lineTo(262, wTop); c.lineTo(207, wTop); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.07)';
  c.beginPath(); c.moveTo(232, wBot); c.lineTo(252, wBot); c.lineTo(306, wTop); c.lineTo(286, wTop); c.closePath(); c.fill();
  c.restore();
  // roof edge light
  c.strokeStyle = css(shade(base, 0.7), 0.6); c.lineWidth = 2;
  c.beginPath(); c.moveTo(150 + ins * 1.4, top + 1); c.lineTo(330 - ins * 1.4, top + 1); c.stroke();

  // tail lights
  const glow = braking ? 26 : 12;
  const redA = braking ? '#ff5a4a' : '#e0242b';
  const redB = braking ? '#ff1c1c' : '#8a0b12';
  c.save();
  c.shadowColor = braking ? '#ff2020' : '#ff3030';
  c.shadowBlur = glow;
  if (M.lights === 'bar') {
    for (const [x0, x1] of [[60, 222], [258, 420]]) {
      const lg = c.createLinearGradient(0, yg - 132, 0, yg - 116);
      lg.addColorStop(0, redA); lg.addColorStop(1, redB);
      c.fillStyle = lg;
      c.beginPath();
      c.moveTo(x0 + (x0 < 240 ? 4 : 0), yg - 130);
      c.lineTo(x1 - (x0 < 240 ? 0 : 4), yg - 130);
      c.lineTo(x1 - (x0 < 240 ? 0 : 10), yg - 114);
      c.lineTo(x0 + (x0 < 240 ? 10 : 0), yg - 114);
      c.closePath();
      c.fill();
    }
  } else {
    for (const x of [112, 368]) {
      const g1 = c.createRadialGradient(x, yg - 120, 2, x, yg - 120, 28);
      g1.addColorStop(0, braking ? '#ffe0d8' : '#ff6a5c'); g1.addColorStop(0.45, redA); g1.addColorStop(1, redB);
      c.fillStyle = g1;
      c.beginPath(); c.arc(x, yg - 120, 27, 0, TAU); c.fill();
    }
  }
  c.restore();
  if (M.lights === 'twin') {
    c.strokeStyle = '#150406'; c.lineWidth = 3;
    for (const x of [112, 368]) { c.beginPath(); c.arc(x, yg - 120, 28, 0, TAU); c.stroke(); c.beginPath(); c.arc(x, yg - 120, 15, 0, TAU); c.stroke(); }
  } else {
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(72, yg - 126, 140, 2); c.fillRect(268, yg - 126, 140, 2);
  }
  if (braking) {
    const hg = c.createRadialGradient(cx, yg - 122, 10, cx, yg - 122, 230);
    hg.addColorStop(0, 'rgba(255,40,30,0.0)'); hg.addColorStop(0.5, 'rgba(255,40,30,0.12)'); hg.addColorStop(1, 'rgba(255,40,30,0)');
    c.fillStyle = hg;
    c.fillRect(0, yg - 190, CAR_W, 150);
  }

  // plate
  c.fillStyle = '#e9e9e1';
  rr(c, 208, yg - 100, 64, 22, 3); c.fill();
  c.strokeStyle = '#4b4e50'; c.lineWidth = 2; rr(c, 208, yg - 100, 64, 22, 3); c.stroke();
  c.fillStyle = '#222'; c.fillRect(216, yg - 92, 48, 5);

  // wing / deck details
  if (M.wing === 'high' || M.wing === 'big') {
    const wy = M.wing === 'big' ? yg - 236 : yg - 224;
    const wh = M.wing === 'big' ? 26 : 20;
    c.fillStyle = '#15171a';
    c.beginPath(); c.moveTo(166, yg - 166); c.lineTo(182, yg - 166); c.lineTo(178, wy + wh); c.lineTo(170, wy + wh); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(298, yg - 166); c.lineTo(314, yg - 166); c.lineTo(310, wy + wh); c.lineTo(302, wy + wh); c.closePath(); c.fill();
    const wg2 = c.createLinearGradient(0, wy, 0, wy + wh);
    wg2.addColorStop(0, '#3a3e43'); wg2.addColorStop(0.15, '#1b1d20'); wg2.addColorStop(1, '#060607');
    c.fillStyle = wg2;
    rr(c, 32, wy, 416, wh, 6); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(44, wy + 2, 392, 2);
    for (const x of [26, 440]) {
      const eg = c.createLinearGradient(x, 0, x + 14, 0);
      eg.addColorStop(0, css(hi)); eg.addColorStop(1, css(lo));
      c.fillStyle = eg;
      rr(c, x, wy - 10, 14, wh + 36, 3); c.fill();
    }
  } else if (M.wing === 'duck') {
    c.fillStyle = css(hi);
    c.beginPath(); c.moveTo(120, yg - 163); c.quadraticCurveTo(240, yg - 184, 360, yg - 163); c.quadraticCurveTo(240, yg - 172, 120, yg - 163); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(124, yg - 165); c.quadraticCurveTo(240, yg - 184, 356, yg - 165); c.stroke();
  } else {
    c.strokeStyle = css(shade(base, 0.6), 0.7); c.lineWidth = 3;
    c.beginPath(); c.moveTo(110, yg - 163); c.quadraticCurveTo(240, yg - 176, 370, yg - 163); c.stroke();
  }

  // overall gloss
  c.save();
  c.clip(body);
  const gl = c.createRadialGradient(150, yg - 150, 4, 150, yg - 150, 230);
  gl.addColorStop(0, 'rgba(255,255,255,0.22)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gl;
  c.fillRect(0, 0, CAR_W, CAR_H);
  c.restore();
  return cv;
}

// ---------------------------------------------------------------- trees
function blob(c, x, y, r, light, mid, dark) {
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, light); g.addColorStop(0.55, mid); g.addColorStop(1, dark);
  c.fillStyle = g;
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
}

function trunk(c, x, yBase, yTop, wBase, wTop, a, b) {
  const g = c.createLinearGradient(x - wBase / 2, 0, x + wBase / 2, 0);
  g.addColorStop(0, a); g.addColorStop(0.55, b); g.addColorStop(1, '#2b1d12');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(x - wBase / 2, yBase); c.lineTo(x - wTop / 2, yTop); c.lineTo(x + wTop / 2, yTop); c.lineTo(x + wBase / 2, yBase);
  c.closePath(); c.fill();
}

function makePine(seed) {
  const r = rng(seed);
  const cv = canvas(256, 384), c = cv.getContext('2d');
  trunk(c, 128, 384, 300, 22, 14, '#7a5a3c', '#5a3f28');
  const tiers = 7;
  for (let i = 0; i < tiers; i++) {
    const top = 12 + i * 42;
    const base = top + 104;
    const hw = 34 + i * 15 + r() * 6;
    const pts = [];
    const steps = 9;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      pts.push([128 - hw + t * hw * 2, base + (k % 2 ? 0 : 12) + r() * 4]);
    }
    const dark = ['#1e4b2b', '#245832', '#1a4226'][i % 3];
    const light = ['#4a9552', '#3f8a4a', '#52a05a'][i % 3];
    // left (lit) half
    c.fillStyle = light;
    c.beginPath(); c.moveTo(128, top);
    for (let k = 0; k <= steps / 2 + 0.5; k++) c.lineTo(pts[k][0], pts[k][1]);
    c.lineTo(128, base - 6); c.closePath(); c.fill();
    // right (shaded) half
    c.fillStyle = dark;
    c.beginPath(); c.moveTo(128, top); c.lineTo(128, base - 6);
    for (let k = Math.ceil(steps / 2); k <= steps; k++) c.lineTo(pts[k][0], pts[k][1]);
    c.closePath(); c.fill();
    // needles
    c.lineWidth = 2;
    for (let n = 0; n < 40; n++) {
      const yy = top + 18 + r() * (base - top - 18);
      const half = (yy - top) / (base - top) * hw;
      const xx = 128 + (r() * 2 - 1) * half * 0.9;
      c.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.18)';
      c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + (r() * 2 - 1) * 8, yy + 7 + r() * 6); c.stroke();
    }
    // lower shadow under each tier
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.beginPath(); c.moveTo(128 - hw * 0.9, base - 2); for (let k = 1; k < steps; k++) c.lineTo(pts[k][0], pts[k][1] + 2); c.lineTo(128 + hw * 0.9, base - 2); c.lineTo(128, base - 14); c.closePath(); c.fill();
  }
  return { cv, aspect: 1.5, w: 1500 };
}

function makeOak(seed) {
  const r = rng(seed);
  const cv = canvas(256, 384), c = cv.getContext('2d');
  trunk(c, 128, 384, 210, 34, 20, '#8a6a48', '#634529');
  c.strokeStyle = '#4e3622'; c.lineCap = 'round';
  c.lineWidth = 12; c.beginPath(); c.moveTo(128, 250); c.lineTo(86, 180); c.stroke();
  c.lineWidth = 10; c.beginPath(); c.moveTo(128, 240); c.lineTo(176, 170); c.stroke();
  const blobs = [];
  for (let i = 0; i < 38; i++) {
    const a = r() * TAU, d = Math.sqrt(r());
    blobs.push([128 + Math.cos(a) * d * 96, 138 + Math.sin(a) * d * 82, 26 + r() * 30]);
  }
  blobs.sort((p, q) => p[1] - q[1]);
  for (const [x, y, rad] of blobs) blob(c, x + 6, y + 8, rad, '#2c6532', '#1f4d29', '#143a1e');
  for (const [x, y, rad] of blobs) blob(c, x, y, rad * 0.92, '#6fb04c', '#3f8a3c', '#26602d');
  for (const [x, y, rad] of blobs.slice(12)) blob(c, x - 8, y - 12, rad * 0.5, '#b4de78', '#78b648', 'rgba(60,130,50,0)');
  return { cv, aspect: 1.5, w: 2000 };
}

function makeCypress(seed) {
  const r = rng(seed);
  const cv = canvas(256, 384), c = cv.getContext('2d');
  trunk(c, 128, 384, 330, 14, 10, '#6e5035', '#4e3825');
  const g = c.createLinearGradient(70, 0, 186, 0);
  g.addColorStop(0, '#2f6a3a'); g.addColorStop(0.4, '#447f43'); g.addColorStop(1, '#173a22');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(128, 4);
  c.bezierCurveTo(176, 70, 190, 200, 170, 336);
  c.lineTo(86, 336);
  c.bezierCurveTo(66, 200, 80, 70, 128, 4);
  c.closePath(); c.fill();
  c.save(); c.clip();
  c.lineWidth = 3;
  for (let i = 0; i < 90; i++) {
    const x = 80 + r() * 96, y = 10 + r() * 330;
    c.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.2)';
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 6, y + 14 + r() * 16); c.stroke();
  }
  c.restore();
  return { cv, aspect: 1.5, w: 900 };
}

function makePalm(seed) {
  const r = rng(seed);
  const cv = canvas(256, 384), c = cv.getContext('2d');
  // curved trunk
  const pts = [[118, 384], [122, 300], [132, 220], [146, 150], [150, 96]];
  for (let i = 0; i < pts.length - 1; i++) {
    const w0 = 22 - i * 3.5, w1 = 22 - (i + 1) * 3.5;
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const g = c.createLinearGradient(x0 - w0 / 2, 0, x0 + w0 / 2, 0);
    g.addColorStop(0, '#9a7a56'); g.addColorStop(0.6, '#725336'); g.addColorStop(1, '#4a3322');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(x0 - w0 / 2, y0); c.lineTo(x1 - w1 / 2, y1); c.lineTo(x1 + w1 / 2, y1); c.lineTo(x0 + w0 / 2, y0); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 2;
    for (let k = 0; k < 4; k++) { const t = (k + 0.5) / 4; const yy = y0 + (y1 - y0) * t; const xx = x0 + (x1 - x0) * t; c.beginPath(); c.moveTo(xx - w0 * 0.45, yy); c.lineTo(xx + w0 * 0.45, yy + 3); c.stroke(); }
  }
  const cx = 150, cy = 92;
  const fronds = 11;
  for (let i = 0; i < fronds; i++) {
    const ang = (i / fronds) * TAU + r() * 0.3;
    const len = 92 + r() * 30;
    const dx = Math.cos(ang), dy = Math.sin(ang) * 0.55;
    const tx = cx + dx * len, ty = cy + dy * len + 30;
    const mx = cx + dx * len * 0.55, my = cy + dy * len * 0.55 - 26;
    const nx = -dy, ny = dx;
    const grad = c.createLinearGradient(cx, cy, tx, ty);
    grad.addColorStop(0, '#2d6b34'); grad.addColorStop(1, '#6fb14d');
    c.fillStyle = grad;
    c.beginPath();
    c.moveTo(cx, cy);
    c.quadraticCurveTo(mx + nx * 14, my + ny * 8, tx, ty);
    c.quadraticCurveTo(mx - nx * 14, my - ny * 8, cx, cy);
    c.fill();
    c.strokeStyle = 'rgba(30,70,30,0.7)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(cx, cy); c.quadraticCurveTo(mx, my, tx, ty); c.stroke();
    c.strokeStyle = 'rgba(20,50,25,0.35)'; c.lineWidth = 1.5;
    for (let k = 1; k < 7; k++) {
      const t = k / 7;
      const px = (1 - t) * (1 - t) * cx + 2 * (1 - t) * t * mx + t * t * tx;
      const py = (1 - t) * (1 - t) * cy + 2 * (1 - t) * t * my + t * t * ty;
      c.beginPath(); c.moveTo(px, py); c.lineTo(px + nx * 12 * (1 - t * 0.5), py + ny * 8 + 8); c.stroke();
      c.beginPath(); c.moveTo(px, py); c.lineTo(px - nx * 12 * (1 - t * 0.5), py - ny * 8 + 8); c.stroke();
    }
  }
  blob(c, cx, cy + 4, 11, '#8a6a3c', '#5e4326', '#3a2916');
  return { cv, aspect: 1.5, w: 1500 };
}

function makeBush(seed) {
  const r = rng(seed);
  const cv = canvas(160, 100), c = cv.getContext('2d');
  const items = [];
  for (let i = 0; i < 9; i++) items.push([30 + r() * 100, 56 + r() * 18, 18 + r() * 14]);
  for (const [x, y, rad] of items) blob(c, x + 3, y + 4, rad, '#2b6330', '#1f4d29', '#143a1e');
  for (const [x, y, rad] of items) blob(c, x, y, rad * 0.9, '#78b852', '#43893c', '#2a6230');
  return { cv, aspect: 0.62, w: 800 };
}

// ---------------------------------------------------------------- billboard
function makeBoard(text, seed) {
  const cv = canvas(320, 140), c = cv.getContext('2d');
  c.fillStyle = '#7b7f82';
  c.fillRect(50, 90, 12, 50); c.fillRect(258, 90, 12, 50);
  c.fillStyle = '#2b2d2f';
  rr(c, 6, 6, 308, 90, 6); c.fill();
  c.fillStyle = '#fff';
  rr(c, 12, 12, 296, 78, 4); c.fill();
  c.fillStyle = '#111';
  c.font = '900 44px system-ui, Arial, sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, 160, 46);
  c.fillStyle = '#d6402a';
  c.fillRect(12, 74, 296, 8);
  c.fillStyle = '#111';
  for (let x = 12 + (seed % 2) * 20; x < 308; x += 40) c.fillRect(x, 74, 20, 8);
  return { cv, aspect: 140 / 320, w: 1700 };
}

// ---------------------------------------------------------------- grandstand
function makeStand(seed) {
  const r = rng(seed);
  const cv = canvas(512, 230), c = cv.getContext('2d');
  c.fillStyle = '#5b6066'; c.fillRect(12, 40, 488, 180);
  const rows = 6;
  const palette = ['#d6402a', '#f2c200', '#e9ebee', '#2f6fd0', '#2d9a58', '#e8855a', '#9a6cd0', '#222'];
  for (let i = 0; i < rows; i++) {
    const y = 56 + i * 26;
    c.fillStyle = i % 2 ? '#8b9096' : '#979ca2';
    c.fillRect(16, y + 14, 480, 12);
    for (let x = 22; x < 494; x += 11) {
      if (r() < 0.12) continue;
      const col = palette[Math.floor(r() * palette.length)];
      c.fillStyle = col;
      c.fillRect(x, y + 4, 8, 12);
      c.fillStyle = '#e8c9a8';
      c.beginPath(); c.arc(x + 4, y + 1, 3.6, 0, TAU); c.fill();
    }
  }
  // roof
  const rg = c.createLinearGradient(0, 8, 0, 40);
  rg.addColorStop(0, '#f1f3f4'); rg.addColorStop(1, '#b9bec2');
  c.fillStyle = rg;
  c.beginPath(); c.moveTo(0, 36); c.lineTo(20, 8); c.lineTo(492, 8); c.lineTo(512, 36); c.closePath(); c.fill();
  c.fillStyle = '#777c81';
  for (const x of [20, 150, 255, 360, 484]) c.fillRect(x, 36, 8, 184);
  // front boards
  c.fillStyle = '#fff'; c.fillRect(12, 208, 488, 18);
  c.fillStyle = '#d6402a'; for (let x = 12; x < 500; x += 64) c.fillRect(x, 208, 32, 18);
  return { cv, aspect: 230 / 512, w: 5200 };
}

// ---------------------------------------------------------------- sky and distance
function makeRidge(seed, color, haze, hgt, bumps) {
  const w = 1024, h = 200;
  const r = rng(seed);
  const cv = canvas(w, h), c = cv.getContext('2d');
  const f = [];
  for (let i = 0; i < bumps; i++) f.push([1 + Math.floor(r() * 9), r() * TAU, 0.4 + r() * 0.6]);
  const hAt = (x) => {
    let v = 0, s = 0;
    for (const [k, p, a] of f) { v += Math.sin((x / w) * TAU * k + p) * a / k; s += a / k; }
    return (v / s) * 0.5 + 0.5;
  };
  const g = c.createLinearGradient(0, h - hgt, 0, h);
  g.addColorStop(0, color); g.addColorStop(1, haze);
  c.fillStyle = g;
  c.beginPath(); c.moveTo(0, h);
  for (let x = 0; x <= w; x += 4) c.lineTo(x, h - 12 - hAt(x) * (hgt - 14) - Math.sin(x * 0.7) * 1.5);
  c.lineTo(w, h); c.closePath(); c.fill();
  return cv;
}

function makeCloud(seed) {
  const r = rng(seed);
  const cv = canvas(320, 110), c = cv.getContext('2d');
  for (let i = 0; i < 12; i++) {
    const x = 60 + r() * 200, y = 70 - r() * 18, rad = 18 + r() * 16;
    const g = c.createRadialGradient(x - rad * 0.2, y - rad * 0.35, rad * 0.1, x, y, rad);
    g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.7, 'rgba(244,248,252,0.85)'); g.addColorStop(1, 'rgba(225,235,245,0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, rad, 0, TAU); c.fill();
  }
  return cv;
}

export function buildSprites(paints) {
  const cars = {};
  const models = MODEL_NAMES;
  paints.forEach((p, i) => {
    const model = models[i % models.length];
    cars[i] = { model, paint: p, normal: makeCar(model, p, false), brake: i === 0 ? makeCar(model, p, true) : null };
  });
  const trees = {
    pine: [makePine(11), makePine(23), makePine(35)],
    oak: [makeOak(3), makeOak(8), makeOak(21)],
    cypress: [makeCypress(5), makeCypress(9)],
    palm: [makePalm(2), makePalm(17)],
    bush: [makeBush(4), makeBush(12), makeBush(29)],
    board: [makeBoard('NEONJAVA', 0), makeBoard('IO GAMES', 1), makeBoard('NEONJAVA.IN', 0)],
    stand: [makeStand(6)],
  };
  return {
    cars,
    trees,
    ridgeFar: makeRidge(31, '#9fb0c6', '#cfe0ee', 130, 6),
    ridgeNear: makeRidge(77, '#6f879f', '#b4c8d8', 100, 8),
    hills: makeRidge(140, '#5d8a55', '#9cbf93', 56, 10),
    clouds: [makeCloud(1), makeCloud(2), makeCloud(3)],
  };
}
