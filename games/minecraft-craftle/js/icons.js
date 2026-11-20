// Item icons, drawn in code as 16x16 pixel art in a blocky Minecraft style.
// Every icon is rendered once on a canvas and cached as a data URL.

const hexRgb = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgbHex = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const shade = (c, t) => {
  const a = hexRgb(c);
  return rgbHex(t >= 0 ? a.map((v) => v + (255 - v) * t) : a.map((v) => v * (1 + t)));
};
const hash = (x, y, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

class Px {
  constructor() { this.d = new Array(256).fill(null); }
  set(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < 16 && y >= 0 && y < 16) this.d[y * 16 + x] = c; }
  get(x, y) { return x >= 0 && x < 16 && y >= 0 && y < 16 ? this.d[y * 16 + x] : null; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  line(x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
  }
  disc(cx, cy, r, c) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.set(x, y, c);
  }
  poly(pts, c) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let inside = false;
      const px = x + 0.5, py = y + 0.5;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) this.set(x, y, c);
    }
  }
  map(rows, pal, ox = 0, oy = 0) {
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const ch = r[x]; if (ch !== '.' && ch !== ' ') this.set(x + ox, y + oy, pal[ch]); } });
  }
  // light on top/left edges, dark on bottom/right edges of every pixel of colour `c`
  bevel(c, light, dark) {
    const snap = this.d.slice();
    const at = (x, y) => (x >= 0 && x < 16 && y >= 0 && y < 16 ? snap[y * 16 + x] : null);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (snap[y * 16 + x] !== c) continue;
      if (!at(x, y - 1) || !at(x - 1, y)) this.set(x, y, light);
      else if (!at(x, y + 1) || !at(x + 1, y)) this.set(x, y, dark);
    }
  }
  outline(col) {
    const snap = this.d.slice();
    const at = (x, y) => (x >= 0 && x < 16 && y >= 0 && y < 16 ? snap[y * 16 + x] : null);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (snap[y * 16 + x]) continue;
      if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) this.set(x, y, col);
    }
  }
  toCanvas() {
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    const c = cv.getContext('2d');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const col = this.d[y * 16 + x];
      if (col) { c.fillStyle = col; c.fillRect(x, y, 1, 1); }
    }
    return cv;
  }
}

// ------------------------------------------------------------------ materials
const MAT = {
  wooden: { m: '#b8945f', l: '#d3b078', d: '#8a6a3d' },
  stone: { m: '#8b8b8b', l: '#b0b0b0', d: '#5d5d5d' },
  iron: { m: '#d6d6d6', l: '#ffffff', d: '#8c8c8c' },
  golden: { m: '#f5d93e', l: '#fff6a3', d: '#c4961a' },
  diamond: { m: '#3fd6c6', l: '#b8fff4', d: '#15968a' },
  leather: { m: '#a85f2e', l: '#cc8450', d: '#6b3a18' },
  copper: { m: '#c9693f', l: '#ee9a70', d: '#7e3c22' },
  redstone: { m: '#c81818', l: '#ff5a46', d: '#740909' },
  lapis: { m: '#2b50c8', l: '#6a8cff', d: '#152e7c' },
  emerald: { m: '#18c34c', l: '#7dffa6', d: '#0a7a2c' },
  amethyst: { m: '#9a6cd8', l: '#d0adff', d: '#5c3a9a' },
  quartz: { m: '#ece6dc', l: '#ffffff', d: '#b9b0a4' },
  coal: { m: '#2f2f2f', l: '#5a5a5a', d: '#111111' },
  stickc: { m: '#8b6a38', l: '#b08a50', d: '#5e431f' },
};
const OUT = '#1b1410';

// ------------------------------------------------------------------ flat items
const FLAT = {};

function ingot(P, c) {
  P.map([
    '................', '................', '................', '................',
    '.......LLLLLLL..', '......LLLLLLLm..', '.....LLLLLLLmmd.', '....LLLLLLLmmdd.',
    '....mmmmmmmmdd..', '....mmmmmmmdd...', '....ddddddddd...',
  ], { L: c.l, m: c.m, d: c.d });
  P.outline(OUT);
}
function gem(P, c) {
  P.map([
    '................', '................', '.....LLLLLL.....', '....LLmmmmmm....', '...LLmmmmmmmd...', '...LmmmmmmmmD...',
    '...mmmmmmmmdD...', '....mmmmmmdD....', '.....mmmmdD.....', '......mmdD......', '.......dD.......',
  ], { L: c.l, m: c.m, d: c.d, D: c.d });
  P.set(5, 4, '#fff'); P.set(6, 4, c.l);
  P.outline(OUT);
}
function nugget(P, c) {
  P.disc(8, 8.5, 3, c.m);
  P.bevel(c.m, c.l, c.d);
  P.outline(OUT);
}
function pile(P, c, seed) {
  for (let y = 5; y < 14; y++) for (let x = 2; x < 14; x++) {
    const dx = (x - 8) / 6, dy = (y - 10) / 4.2;
    if (dx * dx + dy * dy < 1 && hash(x, y, seed) > 0.12) P.set(x, y, hash(x, y, seed + 3) > 0.6 ? c.l : hash(x, y, seed + 5) > 0.5 ? c.m : c.d);
  }
  P.outline(OUT);
}

for (const k of ['iron', 'golden', 'copper']) FLAT[k === 'golden' ? 'gold_ingot' : k + '_ingot'] = (P) => ingot(P, MAT[k]);
for (const k of ['diamond', 'emerald']) FLAT[k] = (P) => gem(P, MAT[k]);
FLAT.iron_nugget = (P) => nugget(P, MAT.iron);
FLAT.gold_nugget = (P) => nugget(P, MAT.golden);
FLAT.redstone = (P) => pile(P, MAT.redstone, 1);
FLAT.gunpowder = (P) => pile(P, { l: '#9a9a9a', m: '#6b6b6b', d: '#3e3e3e' }, 7);
FLAT.coal = (P) => {
  P.poly([[4, 4], [10, 3], [13, 6], [13, 11], [9, 13], [4, 12], [3, 8]], MAT.coal.m);
  P.bevel(MAT.coal.m, MAT.coal.l, MAT.coal.d);
  P.set(6, 6, '#777'); P.set(9, 5, '#666'); P.set(10, 9, '#555');
  P.outline(OUT);
};
FLAT.lapis = (P) => {
  for (const [x, y, r] of [[6, 8, 3], [10, 6, 2.6], [9, 10.5, 2.8]]) P.disc(x, y, r, MAT.lapis.m);
  P.bevel(MAT.lapis.m, MAT.lapis.l, MAT.lapis.d);
  P.outline(OUT);
};
FLAT.quartz = (P) => {
  P.poly([[6, 12], [4, 7], [7, 3], [11, 4], [12, 9], [10, 13]], MAT.quartz.m);
  P.bevel(MAT.quartz.m, MAT.quartz.l, MAT.quartz.d);
  P.line(7, 5, 7, 11, '#d6cfc4');
  P.outline(OUT);
};
FLAT.amethyst = (P) => {
  P.poly([[7, 14], [5, 9], [8, 2], [11, 9], [9, 14]], MAT.amethyst.m);
  P.bevel(MAT.amethyst.m, MAT.amethyst.l, MAT.amethyst.d);
  P.line(8, 4, 8, 12, '#b48ae8');
  P.outline(OUT);
};
FLAT.stick = (P) => {
  P.line(3, 13, 12, 4, MAT.stickc.m);
  P.line(4, 13, 13, 4, MAT.stickc.d);
  P.line(3, 12, 11, 4, MAT.stickc.l);
  P.outline(OUT);
};
FLAT.string = (P) => {
  const c = '#e8e8e8';
  P.line(3, 12, 6, 6, c); P.line(6, 6, 9, 10, c); P.line(9, 10, 12, 4, c);
  P.line(4, 12, 7, 6, '#b8b8b8'); P.set(12, 3, c);
  P.outline('#4a4a4a');
};
FLAT.leather = (P) => {
  P.poly([[3, 4], [13, 3], [14, 8], [12, 13], [4, 12], [2, 8]], MAT.leather.m);
  P.bevel(MAT.leather.m, MAT.leather.l, MAT.leather.d);
  for (let i = 0; i < 8; i++) P.set(4 + ((i * 5) % 8), 5 + ((i * 3) % 6), MAT.leather.d);
  P.outline(OUT);
};
FLAT.flint = (P) => {
  P.poly([[4, 13], [3, 8], [7, 3], [12, 6], [13, 11], [9, 13]], '#5f6266');
  P.bevel('#5f6266', '#8c9094', '#2c2e30');
  P.set(7, 6, '#a4a8ac'); P.set(8, 6, '#a4a8ac');
  P.outline(OUT);
};
FLAT.feather = (P) => {
  P.poly([[3, 13], [4, 9], [7, 5], [12, 2], [13, 3], [12, 8], [8, 11], [4, 13]], '#f2f2f2');
  P.bevel('#f2f2f2', '#ffffff', '#bdbdbd');
  P.line(3, 13, 12, 3, '#9a9a9a');
  P.outline('#4b4b4b');
};
FLAT.sugar_cane = (P) => {
  for (const [x, y0] of [[4, 3], [8, 1], [11, 4]]) {
    for (let y = y0; y < 15; y++) { P.set(x, y, y % 4 === 0 ? '#6fa83e' : '#8bd04c'); P.set(x + 1, y, '#5b9232'); }
  }
  P.outline('#2c4a14');
};
FLAT.paper = (P) => {
  P.rect(3, 3, 10, 10, '#f4f4f4');
  P.bevel('#f4f4f4', '#ffffff', '#c8c8c8');
  for (let y = 5; y < 12; y += 2) P.rect(5, y, 6, 1, '#cfcfcf');
  P.outline('#585858');
};
FLAT.book = (P) => {
  P.rect(3, 3, 10, 11, '#7a4a22');
  P.rect(4, 4, 8, 9, '#a8662e');
  P.rect(11, 4, 2, 9, '#efe6cf');
  P.rect(5, 6, 4, 1, '#e4c26a'); P.rect(5, 8, 4, 1, '#e4c26a');
  P.outline(OUT);
};
FLAT.wheat = (P) => {
  P.line(8, 14, 8, 6, '#9d8a32');
  for (let i = 0; i < 4; i++) { P.set(7, 3 + i * 2, '#e2c14c'); P.set(9, 4 + i * 2, '#e2c14c'); P.set(8, 2 + i * 2, '#f0d765'); }
  P.line(8, 14, 5, 11, '#7e8f2e'); P.line(8, 14, 11, 11, '#7e8f2e');
  P.outline('#4a3f14');
};
FLAT.slime_ball = (P) => {
  P.disc(8, 8, 5, '#6fcf55');
  P.bevel('#6fcf55', '#b6f59f', '#3d8f33');
  P.rect(6, 7, 1, 1, '#2e6e26'); P.rect(9, 7, 1, 1, '#2e6e26'); P.rect(7, 10, 2, 1, '#2e6e26');
  P.outline('#244f1d');
};
FLAT.brick = (P) => {
  P.rect(3, 5, 10, 7, '#a24b3a');
  P.bevel('#a24b3a', '#c9705c', '#6e2f23');
  P.rect(5, 7, 3, 1, '#7d392b'); P.rect(9, 9, 3, 1, '#7d392b');
  P.outline(OUT);
};
FLAT.honeycomb = (P) => {
  const c = '#e9a21a';
  for (const [x, y] of [[5, 6], [9, 6], [7, 9], [11, 9], [3, 9], [7, 3], [9, 12], [5, 12]]) {
    P.rect(x, y, 3, 2, c);
  }
  P.bevel(c, '#ffd36b', '#a96a0c');
  P.outline(OUT);
};
function torch(P, flame, glow) {
  P.rect(7, 7, 2, 7, '#7a5a2e'); P.rect(7, 7, 1, 7, '#9a7640');
  P.rect(7, 4, 2, 3, flame); P.set(7, 3, glow); P.set(8, 3, glow);
  P.set(7, 4, '#fff7c2');
  P.outline(OUT);
}
FLAT.torch = (P) => torch(P, '#ffb81f', '#ffe27a');
FLAT.redstone_torch = (P) => torch(P, '#ff3b2a', '#ff9a8a');

// -------- tools (head colours come from the material)
function tool(kind, mat) {
  return (P) => {
    const c = MAT[mat], h = MAT.stickc;
    const handle = (x0, y0, x1, y1) => { P.line(x0, y0, x1, y1, h.m); P.line(x0 + 1, y0, x1 + 1, y1, h.d); };
    if (kind === 'pickaxe') {
      handle(2, 14, 9, 7);
      for (let t = 0; t <= 1; t += 0.02) {
        const x = (1 - t) * (1 - t) * 2 + 2 * (1 - t) * t * 14 + t * t * 10;
        const y = (1 - t) * (1 - t) * 6 + 2 * (1 - t) * t * 1 + t * t * 13;
        P.set(x, y, c.m); P.set(x + 1, y, c.m); P.set(x, y + 1, c.m);
      }
      P.bevel(c.m, c.l, c.d);
    } else if (kind === 'axe') {
      handle(2, 14, 9, 7);
      P.poly([[5, 2], [10, 1], [14, 4], [12, 8], [9, 9], [8, 6], [5, 5]], c.m);
      P.bevel(c.m, c.l, c.d);
    } else if (kind === 'shovel') {
      handle(2, 14, 10, 6);
      P.poly([[9, 1], [13, 2], [14, 6], [11, 9], [8, 8], [7, 4]], c.m);
      P.bevel(c.m, c.l, c.d);
    } else if (kind === 'hoe') {
      handle(2, 14, 10, 6);
      P.poly([[6, 2], [13, 1], [14, 3], [10, 5], [10, 8], [7, 8], [7, 4]], c.m);
      P.bevel(c.m, c.l, c.d);
    } else {
      P.line(12, 2, 5, 9, c.m); P.line(13, 3, 6, 10, c.d); P.line(11, 2, 4, 9, c.l); P.line(12, 3, 5, 10, c.m);
      P.line(13, 1, 13, 1, c.l);
      P.line(3, 8, 8, 13, h.d); P.line(3, 9, 7, 13, h.m);
      P.line(5, 11, 2, 14, h.m); P.line(6, 11, 3, 14, h.d);
    }
    P.outline(OUT);
  };
}
for (const m of ['wooden', 'stone', 'iron', 'golden', 'diamond']) {
  for (const k of ['pickaxe', 'axe', 'shovel', 'hoe', 'sword']) FLAT[m + '_' + k] = tool(k, m);
}

// -------- armor
function armorIcon(piece, mat) {
  return (P) => {
    const c = MAT[mat];
    const rows = {
      helmet: ['................', '................', '................', '.....mmmmmm.....', '....mmmmmmmm....', '...mmmmmmmmmm...', '...mmmmmmmmmm...', '...mmmmmmmmmm...', '...mmm....mmm...', '...mmm....mmm...'],
      chestplate: ['................', '..mmmm....mmmm..', '.mmmmm....mmmmm.', '.mmmmmm..mmmmmm.', '.mmmmmmmmmmmmmm.', '..mmmmmmmmmmmm..', '...mmmmmmmmmm...', '...mmmmmmmmmm...', '...mmmmmmmmmm...', '...mmmmmmmmmm...', '...mmmmmmmmmm...', '...mmmmmmmmmm...'],
      leggings: ['................', '................', '...mmmmmmmmmm...', '...mmmmmmmmmm...', '...mmmmmmmmmm...', '...mmmmmmmmmm...', '...mmmm..mmmm...', '...mmmm..mmmm...', '...mmmm..mmmm...', '...mmmm..mmmm...', '...mmmm..mmmm...', '...mmmm..mmmm...', '...mmm....mmm...'],
      boots: ['................', '................', '................', '................', '..mmm.....mmm...', '..mmm.....mmm...', '..mmm.....mmm...', '..mmm.....mmm...', '.mmmm....mmmm...', '.mmmmmm..mmmmmm.', '.mmmmmm..mmmmmm.'],
    }[piece];
    P.map(rows, { m: c.m }, 0, piece === 'helmet' ? 1 : 0);
    P.bevel(c.m, c.l, c.d);
    if (piece === 'helmet') P.rect(5, 9, 6, 1, c.d);
    if (piece === 'chestplate') { P.set(7, 4, c.d); P.set(8, 4, c.d); }
    P.outline(OUT);
  };
}
for (const m of ['leather', 'iron', 'golden', 'diamond']) {
  for (const p of ['helmet', 'chestplate', 'leggings', 'boots']) FLAT[m + '_' + p] = armorIcon(p, m);
}

// -------- misc flat items
FLAT.bow = (P) => {
  for (let t = 0; t <= 1; t += 0.03) { const x = 4 + 8 * t * (1 - t) * 4 * 0.9 + 0; P.set(4 + (1 - Math.abs(2 * t - 1)) * 6 * 0.2 + t * 8, 2 + t * 12, '#8b6a38'); }
  P.line(4, 2, 12, 14, '#8b6a38'); P.line(5, 2, 13, 14, '#6d5028');
  P.line(4, 2, 4, 14, '#e8e8e8'); P.line(4, 14, 12, 14, '#e8e8e8');
  P.outline(OUT);
};
FLAT.fishing_rod = (P) => {
  P.line(2, 14, 12, 4, '#8b6a38'); P.line(3, 14, 13, 4, '#6d5028');
  P.line(13, 3, 14, 12, '#e8e8e8'); P.rect(13, 12, 2, 2, '#c43a2a');
  P.outline(OUT);
};
FLAT.arrow = (P) => {
  P.line(3, 13, 11, 5, '#8b6a38');
  P.poly([[10, 1], [14, 2], [15, 6], [11, 5]], '#8b8e92');
  P.bevel('#8b8e92', '#c4c7ca', '#55585b');
  P.poly([[2, 11], [5, 11], [4, 14], [1, 14]], '#efefef');
  P.outline(OUT);
};
FLAT.shield = (P) => {
  P.poly([[3, 2], [13, 2], [13, 9], [8, 14], [3, 9]], '#a47a42');
  P.bevel('#a47a42', '#c9a068', '#6b4a22');
  P.rect(4, 3, 8, 1, '#d6d6d6'); P.line(8, 3, 8, 12, '#d6d6d6');
  P.outline(OUT);
};
FLAT.shears = (P) => {
  P.line(5, 3, 11, 12, MAT.iron.m); P.line(11, 3, 5, 12, MAT.iron.l);
  P.rect(3, 12, 3, 3, '#3a3a3a'); P.rect(10, 12, 3, 3, '#3a3a3a');
  P.outline(OUT);
};
FLAT.bucket = (P) => {
  P.poly([[3, 4], [13, 4], [11, 13], [5, 13]], MAT.iron.m);
  P.bevel(MAT.iron.m, MAT.iron.l, MAT.iron.d);
  P.rect(4, 3, 8, 1, MAT.iron.d); P.line(3, 4, 8, 1, '#777'); P.line(13, 4, 8, 1, '#777');
  P.outline(OUT);
};
FLAT.flint_and_steel = (P) => {
  P.rect(3, 8, 7, 5, MAT.iron.m); P.bevel(MAT.iron.m, MAT.iron.l, MAT.iron.d);
  P.poly([[8, 4], [13, 6], [12, 11], [8, 9]], '#5f6266'); P.bevel('#5f6266', '#8c9094', '#2c2e30');
  P.outline(OUT);
};
function dial(P, face, hand) {
  P.disc(8, 8, 6, '#c9a057'); P.disc(8, 8, 4.4, face);
  P.bevel('#c9a057', '#e8c47a', '#8a6a2a');
  hand(P);
  P.outline(OUT);
}
FLAT.compass = (P) => dial(P, '#cfd0d2', (Q) => { Q.line(8, 8, 6, 4, '#d33'); Q.line(8, 8, 10, 12, '#555'); });
FLAT.clock = (P) => dial(P, '#f0d86a', (Q) => { Q.line(8, 8, 8, 4, '#4a3a10'); Q.line(8, 8, 11, 8, '#4a3a10'); });
FLAT.spyglass = (P) => {
  P.line(3, 13, 12, 4, MAT.copper.m); P.line(4, 13, 13, 4, MAT.copper.d); P.line(3, 12, 11, 4, MAT.copper.l);
  P.disc(12, 4, 2.2, MAT.amethyst.m); P.bevel(MAT.amethyst.m, MAT.amethyst.l, MAT.amethyst.d);
  P.outline(OUT);
};
FLAT.lead = (P) => {
  for (let i = 0; i < 4; i++) { P.rect(3 + i * 2, 11 - i * 2, 3, 3, '#c9a373'); }
  P.disc(12, 4, 2, '#6fcf55'); P.outline(OUT);
};
FLAT.bowl = (P) => {
  P.poly([[2, 6], [14, 6], [12, 12], [4, 12]], '#8b6a38');
  P.bevel('#8b6a38', '#b08a50', '#5e431f');
  P.rect(3, 6, 10, 1, '#5e431f');
  P.outline(OUT);
};
FLAT.glass_bottle = (P) => {
  P.poly([[6, 3], [10, 3], [10, 6], [12, 8], [12, 13], [4, 13], [4, 8], [6, 6]], '#cde9f2');
  P.bevel('#cde9f2', '#ffffff', '#8fb3c0');
  P.rect(6, 2, 4, 1, '#9b7a47');
  P.outline('#41636f');
};
FLAT.boat = (P) => {
  P.poly([[1, 6], [15, 6], [13, 13], [3, 13]], '#a47a42');
  P.bevel('#a47a42', '#c9a068', '#6b4a22');
  P.rect(3, 7, 10, 3, '#8a6a3d');
  P.outline(OUT);
};
FLAT.oak_door = (P) => {
  P.rect(4, 1, 8, 14, '#a47a42'); P.bevel('#a47a42', '#c9a068', '#6b4a22');
  P.rect(5, 3, 2, 4, '#7d5c30'); P.rect(9, 3, 2, 4, '#7d5c30'); P.rect(5, 9, 2, 4, '#7d5c30'); P.rect(9, 9, 2, 4, '#7d5c30');
  P.set(10, 8, '#ddd');
  P.outline(OUT);
};
FLAT.iron_door = (P) => {
  P.rect(4, 1, 8, 14, MAT.iron.m); P.bevel(MAT.iron.m, MAT.iron.l, MAT.iron.d);
  P.rect(5, 3, 6, 4, '#bdbdbd'); P.rect(5, 9, 6, 4, '#bdbdbd'); P.set(10, 8, '#555');
  P.outline(OUT);
};
FLAT.oak_sign = (P) => {
  P.rect(2, 2, 12, 7, '#a47a42'); P.bevel('#a47a42', '#c9a068', '#6b4a22');
  P.rect(7, 9, 2, 5, '#6d5028');
  P.rect(4, 4, 8, 1, '#4a3a22'); P.rect(4, 6, 6, 1, '#4a3a22');
  P.outline(OUT);
};
FLAT.ladder = (P) => {
  P.rect(3, 1, 2, 14, '#8b6a38'); P.rect(11, 1, 2, 14, '#8b6a38');
  for (const y of [3, 7, 11]) P.rect(5, y, 6, 2, '#a47a42');
  P.outline(OUT);
};
FLAT.rail = (P) => {
  P.rect(3, 1, 2, 14, '#c0c0c0'); P.rect(11, 1, 2, 14, '#c0c0c0');
  for (const y of [2, 6, 10, 14]) P.rect(4, y, 8, 2, '#8b6a38');
  P.outline(OUT);
};
FLAT.powered_rail = (P) => {
  P.rect(3, 1, 2, 14, '#d6b43a'); P.rect(11, 1, 2, 14, '#d6b43a');
  for (const y of [2, 6, 10, 14]) P.rect(4, y, 8, 2, '#8b6a38');
  P.rect(7, 4, 2, 8, '#c81818');
  P.outline(OUT);
};
FLAT.minecart = (P) => {
  P.poly([[1, 5], [15, 5], [13, 12], [3, 12]], MAT.iron.m); P.bevel(MAT.iron.m, MAT.iron.l, MAT.iron.d);
  P.rect(3, 6, 10, 4, '#555');
  P.rect(3, 13, 3, 2, '#333'); P.rect(10, 13, 3, 2, '#333');
  P.outline(OUT);
};
FLAT.iron_bars = (P) => {
  for (const x of [3, 6, 9, 12]) P.rect(x, 1, 1, 14, MAT.iron.m);
  P.rect(2, 4, 12, 1, MAT.iron.d); P.rect(2, 11, 12, 1, MAT.iron.d);
  P.outline(OUT);
};
FLAT.chain = (P) => {
  for (const [x, y] of [[7, 1], [7, 6], [7, 11]]) { P.rect(x - 1, y, 4, 5, MAT.iron.m); P.rect(x, y + 1, 2, 3, null); }
  P.outline(OUT);
};
FLAT.bread = (P) => {
  P.poly([[2, 8], [4, 5], [12, 5], [14, 8], [13, 12], [3, 12]], '#c98a3a');
  P.bevel('#c98a3a', '#e8b366', '#8e5a1e');
  P.rect(5, 7, 1, 2, '#8e5a1e'); P.rect(8, 6, 1, 2, '#8e5a1e'); P.rect(11, 7, 1, 2, '#8e5a1e');
  P.outline(OUT);
};
FLAT.flower_pot = (P) => {
  P.poly([[4, 8], [12, 8], [11, 14], [5, 14]], '#a24b3a'); P.bevel('#a24b3a', '#c9705c', '#6e2f23');
  P.rect(3, 6, 10, 2, '#b85a46');
  P.outline(OUT);
};
FLAT.candle = (P) => {
  P.rect(6, 6, 4, 8, '#eadfc8'); P.bevel('#eadfc8', '#fff', '#b9ac90');
  P.rect(7, 4, 2, 2, '#ffb81f'); P.set(7, 3, '#ffe27a'); P.set(8, 5, '#fff7c2');
  P.outline(OUT);
};
FLAT.lantern = (P) => {
  P.rect(4, 4, 8, 9, '#ffcf4a'); P.rect(5, 6, 6, 5, '#fff2a8');
  P.rect(3, 3, 10, 2, '#4a4a4a'); P.rect(3, 12, 10, 2, '#4a4a4a'); P.rect(7, 1, 2, 2, '#4a4a4a');
  P.rect(4, 5, 1, 7, '#4a4a4a'); P.rect(11, 5, 1, 7, '#4a4a4a');
  P.outline(OUT);
};
FLAT.painting = (P) => {
  P.rect(1, 2, 14, 12, '#8b6a38');
  P.rect(2, 3, 12, 10, '#7fb6e8'); P.rect(2, 9, 12, 4, '#5f9e3a'); P.rect(9, 5, 3, 3, '#f5d93e');
  P.outline(OUT);
};
FLAT.item_frame = (P) => {
  P.rect(2, 2, 12, 12, '#a47a42'); P.rect(4, 4, 8, 8, '#6e4a26');
  P.bevel('#a47a42', '#c9a068', '#6b4a22');
  P.outline(OUT);
};
FLAT.white_carpet = (P) => {
  P.poly([[1, 9], [8, 6], [15, 9], [8, 12]], '#f2f2f2'); P.bevel('#f2f2f2', '#ffffff', '#c4c4c4');
  P.outline('#585858');
};
FLAT.bed = (P) => {
  P.rect(1, 6, 14, 6, '#f2f2f2'); P.rect(1, 9, 14, 3, '#c43a2a'); P.rect(1, 6, 4, 3, '#fff');
  P.rect(1, 12, 2, 2, '#6b4a22'); P.rect(13, 12, 2, 2, '#6b4a22');
  P.outline(OUT);
};
FLAT.glass_pane = (P) => {
  P.rect(5, 1, 6, 14, '#d4ecf5'); P.bevel('#d4ecf5', '#ffffff', '#96b6c2');
  P.rect(7, 3, 1, 5, '#fff');
  P.outline('#41636f');
};
FLAT.lever = (P) => {
  P.rect(3, 10, 10, 4, '#8b8b8b'); P.bevel('#8b8b8b', '#b0b0b0', '#5d5d5d');
  P.line(8, 10, 11, 3, '#8b6a38'); P.line(9, 10, 12, 3, '#6d5028');
  P.outline(OUT);
};
FLAT.tripwire_hook = (P) => {
  P.rect(5, 2, 4, 3, '#a47a42'); P.rect(6, 5, 2, 9, '#8b6a38');
  P.rect(8, 4, 3, 2, MAT.iron.m); P.set(10, 6, '#ddd');
  P.outline(OUT);
};
FLAT.repeater = (P) => {
  P.rect(1, 9, 14, 5, '#8b8b8b'); P.bevel('#8b8b8b', '#b0b0b0', '#5d5d5d');
  P.rect(3, 5, 2, 4, '#7a1010'); P.rect(11, 5, 2, 4, '#c81818'); P.rect(3, 4, 2, 1, '#ff5a46'); P.rect(11, 4, 2, 1, '#ff5a46');
  P.rect(6, 10, 4, 2, '#c81818');
  P.outline(OUT);
};
FLAT.comparator = (P) => {
  P.rect(1, 9, 14, 5, '#8b8b8b'); P.bevel('#8b8b8b', '#b0b0b0', '#5d5d5d');
  P.rect(7, 4, 2, 5, '#c81818'); P.rect(3, 6, 2, 3, '#7a1010'); P.rect(11, 6, 2, 3, '#7a1010');
  P.rect(6, 10, 4, 2, '#ece6dc');
  P.outline(OUT);
};
for (const m of [['oak_button', '#a47a42', '#c9a068', '#6b4a22'], ['stone_button', '#8b8b8b', '#b0b0b0', '#5d5d5d']]) {
  FLAT[m[0]] = (P) => { P.rect(5, 6, 6, 5, m[1]); P.bevel(m[1], m[2], m[3]); P.outline(OUT); };
}

// ------------------------------------------------------------------ iso blocks
// Cuboids in a unit cube: x towards the right-front, y towards the left-front, z up.
const TEX = {};
const pick = (base, v) => shade(base, v);

TEX.planks = (base = '#b8945f') => (u, v) => {
  const row = v >> 1;
  const seam = v % 2 === 1;
  const off = [3, 6, 1, 5][row % 4];
  let c = row % 2 ? pick(base, -0.05) : base;
  c = pick(c, (hash(u, v, row) - 0.5) * 0.12);
  if (seam) c = pick(c, -0.18);
  if (u === off && !seam) c = pick(c, -0.2);
  return c;
};
TEX.cobble = (base = '#7f7f7f') => (u, v) => {
  const a = hash(u >> 1, v >> 1, 3), b = hash(u, v, 9);
  let c = a > 0.66 ? pick(base, 0.18) : a > 0.33 ? base : pick(base, -0.16);
  if ((u + v) % 4 === 0 && b > 0.4) c = pick(c, -0.2);
  return pick(c, (b - 0.5) * 0.1);
};
TEX.stone = (base = '#8b8b8b') => (u, v) => pick(base, (hash(u, v, 4) - 0.5) * 0.18);
TEX.noise = (base, amp = 0.12, seed = 1) => (u, v) => pick(base, (hash(u, v, seed) - 0.5) * amp);
TEX.solid = (base) => (u, v) => {
  let c = base;
  if (u === 0 || v === 0) c = pick(base, 0.25);
  if (u === 7 || v === 7) c = pick(base, -0.22);
  return c;
};
TEX.bricks = (brick = '#a24b3a', mortar = '#b9aaa0') => (u, v) => {
  const row = v >> 1;
  const seam = v % 2 === 1;
  const off = row % 2 ? 2 : 6;
  if (seam && v % 4 === 3) return mortar;
  if (!seam && (u === off % 8 || u === (off + 4) % 8)) return mortar;
  return pick(brick, (hash(u, v, row) - 0.5) * 0.14);
};
TEX.logSide = (u, v) => pick(u % 2 ? '#6b5230' : '#5a4427', (hash(u, v, 2) - 0.5) * 0.14);
TEX.logTop = (u, v) => {
  const d = Math.max(Math.abs(u - 3.5), Math.abs(v - 3.5));
  if (d > 3) return '#5a4427';
  return d % 2 < 1 ? '#b8945f' : '#9d7b48';
};
TEX.glass = (u, v) => {
  if (u === 0 || v === 0 || u === 7 || v === 7) return '#bfe3f0';
  if (u + v === 5 || u + v === 6) return '#ffffff';
  return null;
};
TEX.sand = TEX.noise('#dbcf9b', 0.14, 11);
TEX.wool = TEX.noise('#ecece8', 0.1, 5);
TEX.obsidian = (u, v) => pick('#1f1a2e', (hash(u, v, 8) - 0.5) * 0.4 + (hash(u >> 1, v >> 1, 2) > 0.8 ? 0.2 : 0));

function cuboid(P, box, tops, lefts, rights, light = [1, 0.82, 0.64]) {
  const [x0, y0, z0, x1, y1, z1] = box;
  const f = (fn, k, u, v) => {
    const c = fn(Math.min(7, Math.max(0, Math.floor(u * 8))), Math.min(7, Math.max(0, Math.floor(v * 8))));
    return c ? (k === 1 ? c : shade(c, k - 1)) : null;
  };
  for (let py = 0; py < 16; py++) {
    for (let px = 0; px < 16; px++) {
      const X = px + 0.5, Y = py + 0.5;
      const a = (X - 8) / 7;
      // top face
      let b = (Y - 8.2 + 7 * z1) / 3.5;
      let x = (a + b) / 2, y = (b - a) / 2;
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) {
        const col = f(tops, light[0], (x - x0) / (x1 - x0), (y - y0) / (y1 - y0));
        if (col) P.set(px, py, col);
        continue;
      }
      // left face (y = y1)
      x = a + y1;
      let z = (8.2 + 3.5 * (x + y1) - Y) / 7;
      if (x >= x0 && x <= x1 && z >= z0 && z <= z1) {
        const col = f(lefts, light[1], (x - x0) / (x1 - x0), 1 - (z - z0) / (z1 - z0));
        if (col) P.set(px, py, col);
        continue;
      }
      // right face (x = x1)
      y = x1 - a;
      z = (8.2 + 3.5 * (x1 + y) - Y) / 7;
      if (y >= y0 && y <= y1 && z >= z0 && z <= z1) {
        const col = f(rights, light[2], (y1 - y) / (y1 - y0), 1 - (z - z0) / (z1 - z0));
        if (col) P.set(px, py, col);
      }
    }
  }
}
const cube = (t, l, r) => (P) => cuboid(P, [0, 0, 0, 1, 1, 1], t, l || t, r || l || t);

const BLOCK = {};
const planksT = TEX.planks();
BLOCK.planks = cube(planksT);
BLOCK.cobblestone = cube(TEX.cobble());
BLOCK.stone = cube(TEX.stone());
BLOCK.glass = (P) => { cuboid(P, [0, 0, 0, 1, 1, 1], TEX.glass, TEX.glass, TEX.glass); P.outline('#5a7f8c'); };
BLOCK.wool = cube(TEX.wool);
BLOCK.log = cube(TEX.logTop, TEX.logSide, TEX.logSide);
BLOCK.sand = cube(TEX.sand);
BLOCK.obsidian = cube(TEX.obsidian);
BLOCK.slab = (P) => cuboid(P, [0, 0, 0, 1, 1, 0.5], planksT, planksT, planksT);
BLOCK.oak_slab = BLOCK.slab;
BLOCK.cobblestone_slab = (P) => cuboid(P, [0, 0, 0, 1, 1, 0.5], TEX.cobble(), TEX.cobble(), TEX.cobble());
BLOCK.stone_slab = (P) => cuboid(P, [0, 0, 0, 1, 1, 0.5], TEX.stone(), TEX.stone(), TEX.stone());
BLOCK.quartz_slab = (P) => cuboid(P, [0, 0, 0, 1, 1, 0.5], TEX.noise('#ece6dc', 0.05), TEX.noise('#ece6dc', 0.05), TEX.noise('#ece6dc', 0.05));
const stairs = (tx) => (P) => {
  cuboid(P, [0, 0, 0, 1, 1, 0.5], tx, tx, tx);
  cuboid(P, [0, 0, 0.5, 0.5, 1, 1], tx, tx, tx);
};
BLOCK.oak_stairs = stairs(planksT);
BLOCK.cobblestone_stairs = stairs(TEX.cobble());
BLOCK.stone_stairs = stairs(TEX.stone());
BLOCK.stone_bricks = cube(TEX.bricks('#8d8d8d', '#6e6e6e'));
BLOCK.bricks = cube(TEX.bricks());
BLOCK.sandstone = cube(TEX.noise('#dbcf9b', 0.1, 3), (u, v) => (v === 0 ? '#c9bd88' : v > 5 ? '#c2b57c' : pick('#dbcf9b', (hash(u, v, 5) - 0.5) * 0.1)));
BLOCK.quartz_block = cube(TEX.noise('#ece6dc', 0.05), (u, v) => (u === 0 || v === 0 ? '#fffaf0' : pick('#ece6dc', (hash(u, v, 5) - 0.5) * 0.06)));
BLOCK.quartz_pillar = cube(TEX.noise('#ece6dc', 0.05), (u, v) => (u === 2 || u === 5 ? '#d3ccc2' : '#ece6dc'));
BLOCK.amethyst_block = cube(TEX.noise('#8f62cf', 0.3, 6));
BLOCK.honeycomb_block = cube((u, v) => ((u + (v % 2) * 2) % 4 < 2 ? '#e9a21a' : '#c4800a'));
BLOCK.slime_block = (P) => { cuboid(P, [0, 0, 0, 1, 1, 1], TEX.noise('#78cc58', 0.2, 2), TEX.noise('#78cc58', 0.2, 2), TEX.noise('#78cc58', 0.2, 2)); };
BLOCK.hay_bale = cube((u, v) => (v === 0 || v === 7 ? '#8e6a14' : u % 2 ? '#d8b43a' : '#c49a22'), (u, v) => (u === 0 ? '#8e6a14' : v % 2 ? '#d8b43a' : '#c49a22'));
BLOCK.white_carpet = FLAT.white_carpet;
for (const [id, c] of [['iron_block', '#d8d8d8'], ['gold_block', '#f6dd4b'], ['diamond_block', '#4fe3d0'], ['redstone_block', '#c41717'], ['coal_block', '#1e1e1e'], ['emerald_block', '#1fc650'], ['lapis_block', '#2b50c8'], ['copper_block', '#c9693f']]) {
  BLOCK[id] = cube(TEX.solid(c));
}
BLOCK.crafting_table = (P) => cuboid(P, [0, 0, 0, 1, 1, 1],
  (u, v) => (u === 3 || u === 4 || v === 3 || v === 4 ? '#6d5028' : '#a47a42'),
  (u, v) => (v > 1 && v < 4 && u > 1 && u < 6 ? '#3e2f1a' : planksT(u, v)),
  (u, v) => (v > 1 && v < 5 && u > 2 && u < 6 ? '#3e2f1a' : planksT(u, v)));
BLOCK.chest = (P) => {
  const wood = TEX.planks('#a47a42');
  cuboid(P, [0.06, 0.06, 0, 0.94, 0.94, 0.88], wood, (u, v) => (v === 2 ? '#3e2f1a' : u === 3 || u === 4 ? (v >= 2 && v <= 3 ? '#d9d9d9' : wood(u, v)) : wood(u, v)), wood);
};
BLOCK.barrel = cube((u, v) => ((u === 3 || u === 4) && (v === 3 || v === 4) ? '#2b1f10' : planksT(u, v)), (u, v) => (v === 1 || v === 6 ? '#8a8a8a' : planksT(u, v)), (u, v) => (v === 1 || v === 6 ? '#8a8a8a' : planksT(u, v)));
BLOCK.furnace = cube(TEX.cobble('#8a8a8a'), (u, v) => (u > 1 && u < 6 && v > 3 && v < 7 ? '#1d1d1d' : u > 1 && u < 6 && v > 1 && v < 3 ? '#555' : TEX.cobble('#8a8a8a')(u, v)), TEX.cobble('#8a8a8a'));
BLOCK.smithing_table = cube((u, v) => (u === 0 || v === 0 || u === 7 || v === 7 ? '#2b2b2b' : '#4a4a4a'), (u, v) => (v < 3 ? '#2d2d2d' : planksT(u, v)), (u, v) => (v < 3 ? '#2d2d2d' : planksT(u, v)));
BLOCK.fletching_table = cube((u, v) => (u % 4 < 2 ? '#c9a068' : '#e9d3a8'), (u, v) => (v < 3 ? '#e9d3a8' : planksT(u, v)), (u, v) => (v < 3 ? '#c9a068' : planksT(u, v)));
BLOCK.cartography_table = cube((u, v) => (u > 1 && u < 6 && v > 1 && v < 6 ? '#e9e2c8' : '#6d5028'), (u, v) => (v < 3 ? '#8d6b3a' : planksT(u, v)), (u, v) => (v < 3 ? '#8d6b3a' : planksT(u, v)));
BLOCK.loom = cube((u, v) => (u % 2 ? '#e8e8e8' : '#c9c9c9'), (u, v) => (u % 2 ? '#c43a2a' : planksT(u, v)), planksT);
BLOCK.stonecutter = (P) => {
  cuboid(P, [0, 0, 0, 1, 1, 0.65], TEX.stone('#8b8b8b'), TEX.stone('#8b8b8b'), TEX.stone('#8b8b8b'));
  P.rect(5, 4, 6, 2, '#d6d6d6');
};
BLOCK.lectern = (P) => {
  cuboid(P, [0, 0, 0, 1, 1, 0.3], planksT, planksT, planksT);
  cuboid(P, [0.3, 0.3, 0.3, 0.7, 0.7, 0.8], planksT, planksT, planksT);
  cuboid(P, [0, 0, 0.8, 1, 1, 0.95], (u, v) => (u > 1 && u < 6 ? '#efe6cf' : '#a47a42'), planksT, planksT);
};
BLOCK.composter = (P) => {
  const w = TEX.planks('#a47a42');
  cuboid(P, [0, 0, 0, 1, 1, 0.85], (u, v) => (u > 0 && u < 7 && v > 0 && v < 7 ? '#5a4427' : w(u, v)), (u, v) => (u % 2 ? w(u, v) : pick('#a47a42', -0.2)), (u, v) => (u % 2 ? w(u, v) : pick('#a47a42', -0.2)));
};
BLOCK.campfire = (P) => {
  cuboid(P, [0, 0, 0, 1, 1, 0.3], TEX.logTop, TEX.logSide, TEX.logSide);
  P.rect(5, 3, 6, 5, '#ff8a1f'); P.rect(6, 2, 4, 3, '#ffd24a'); P.rect(7, 1, 2, 2, '#fff2a8');
};
BLOCK.cauldron = (P) => {
  cuboid(P, [0.05, 0.05, 0, 0.95, 0.95, 0.9], (u, v) => (u > 1 && u < 6 && v > 1 && v < 6 ? '#2a2a2a' : '#4a4a4a'), TEX.noise('#4a4a4a', 0.1), TEX.noise('#4a4a4a', 0.1));
};
BLOCK.enchanting_table = (P) => {
  cuboid(P, [0, 0, 0, 1, 1, 0.75], (u, v) => (u === 3 || u === 4 || v === 3 || v === 4 ? '#c81818' : '#8c1414'), TEX.obsidian, TEX.obsidian);
  P.rect(5, 3, 6, 2, '#2fd1c4'); P.rect(6, 4, 4, 1, '#c81818');
};
BLOCK.bookshelf = cube(planksT, (u, v) => (v === 3 || v === 4 ? planksT(u, v) : pick(['#8b2f2f', '#2f5f8b', '#2f8b4a', '#8b6a2f'][(u >> 1) % 4], (hash(u, v, 2) - 0.5) * 0.2)), (u, v) => (v === 3 || v === 4 ? planksT(u, v) : pick(['#2f5f8b', '#8b2f2f', '#8b6a2f', '#2f8b4a'][(u >> 1) % 4], (hash(u, v, 3) - 0.5) * 0.2)));
BLOCK.beehive = cube((u, v) => (u % 4 < 2 ? '#c9a068' : '#b8945f'), (u, v) => (v > 4 ? '#e9a21a' : planksT(u, v)), (u, v) => (v > 4 ? '#e9a21a' : planksT(u, v)));
BLOCK.jukebox = cube(planksT, (u, v) => (u > 2 && u < 5 && v > 2 && v < 5 ? '#2b1f10' : planksT(u, v)), planksT);
BLOCK.note_block = cube(planksT, (u, v) => (u === 3 && v > 1 && v < 6 ? '#2b1f10' : u === 4 && v > 1 && v < 3 ? '#2b1f10' : planksT(u, v)), planksT);
BLOCK.piston = (P) => {
  cuboid(P, [0, 0, 0, 1, 1, 0.75], TEX.cobble(), TEX.cobble(), TEX.cobble());
  cuboid(P, [0, 0, 0.75, 1, 1, 1], planksT, planksT, planksT);
};
BLOCK.dropper = cube(TEX.cobble(), (u, v) => (u > 2 && u < 5 && v > 2 && v < 5 ? '#222' : TEX.cobble()(u, v)), TEX.cobble());
BLOCK.observer = cube(TEX.cobble('#707070'), (u, v) => ((u === 2 || u === 5) && v === 3 ? '#222' : v === 6 && u > 1 && u < 6 ? '#c81818' : TEX.cobble('#707070')(u, v)), TEX.cobble('#707070'));
BLOCK.tnt = cube((u, v) => (u === 0 || v === 0 ? '#e8e8e8' : '#d83a2a'), (u, v) => (v > 2 && v < 5 ? '#f0f0f0' : '#d83a2a'), (u, v) => (v > 2 && v < 5 ? '#f0f0f0' : '#b82a1c'));
BLOCK.daylight_detector = (P) => {
  cuboid(P, [0, 0, 0, 1, 1, 0.4], (u, v) => (u > 0 && u < 7 && v > 0 && v < 7 ? '#c9b690' : '#9d7b48'), planksT, planksT);
};
BLOCK.oak_pressure_plate = (P) => cuboid(P, [0.08, 0.08, 0, 0.92, 0.92, 0.12], planksT, planksT, planksT);
BLOCK.stone_pressure_plate = (P) => cuboid(P, [0.08, 0.08, 0, 0.92, 0.92, 0.12], TEX.stone(), TEX.stone(), TEX.stone());
BLOCK.oak_trapdoor = (P) => cuboid(P, [0, 0, 0, 1, 1, 0.18], (u, v) => (u % 3 === 0 ? '#6d5028' : planksT(u, v)), planksT, planksT);
BLOCK.iron_trapdoor = (P) => cuboid(P, [0, 0, 0, 1, 1, 0.18], (u, v) => (u > 1 && u < 6 && v > 1 && v < 6 ? '#bdbdbd' : '#d6d6d6'), TEX.solid('#d6d6d6'), TEX.solid('#d6d6d6'));
BLOCK.oak_fence = (P) => {
  cuboid(P, [0.38, 0.38, 0, 0.62, 0.62, 1], planksT, planksT, planksT);
  cuboid(P, [0.42, 0.62, 0.55, 0.58, 1, 0.75], planksT, planksT, planksT);
  cuboid(P, [0.62, 0.42, 0.55, 1, 0.58, 0.75], planksT, planksT, planksT);
};
BLOCK.oak_fence_gate = (P) => {
  cuboid(P, [0.35, 0, 0.1, 0.65, 0.2, 0.95], planksT, planksT, planksT);
  cuboid(P, [0.35, 0.8, 0.1, 0.65, 1, 0.95], planksT, planksT, planksT);
  cuboid(P, [0.45, 0.2, 0.35, 0.55, 0.8, 0.8], planksT, planksT, planksT);
};
BLOCK.cobblestone_wall = (P) => {
  cuboid(P, [0.3, 0.3, 0, 0.7, 0.7, 1], TEX.cobble(), TEX.cobble(), TEX.cobble());
  cuboid(P, [0.35, 0.7, 0, 0.65, 1, 0.8], TEX.cobble(), TEX.cobble(), TEX.cobble());
  cuboid(P, [0.7, 0.35, 0, 1, 0.65, 0.8], TEX.cobble(), TEX.cobble(), TEX.cobble());
};
BLOCK.lightning_rod = (P) => {
  cuboid(P, [0.4, 0.4, 0, 0.6, 0.6, 0.75], TEX.solid('#c9693f'), TEX.solid('#c9693f'), TEX.solid('#c9693f'));
  cuboid(P, [0.3, 0.3, 0.75, 0.7, 0.7, 1], TEX.solid('#ee9a70'), TEX.solid('#c9693f'), TEX.solid('#c9693f'));
};

// ------------------------------------------------------------------ registry
const cache = {};
export function icon(id) {
  if (cache[id]) return cache[id];
  const P = new Px();
  const fn = BLOCK[id] || FLAT[id];
  if (fn) fn(P);
  else { P.rect(3, 3, 10, 10, '#b03030'); P.rect(7, 5, 2, 4, '#fff'); P.rect(7, 10, 2, 2, '#fff'); }
  const cv = P.toCanvas();
  cache[id] = cv.toDataURL();
  return cache[id];
}
export const hasIcon = (id) => !!(BLOCK[id] || FLAT[id]);
