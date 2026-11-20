import { WORLD, SKINS, GEM_COLORS } from './sim.js';

const DOT_GAP = 140;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
    this.cx = WORLD / 2;
    this.cy = WORLD / 2;
    this.scale = 1;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  draw(view) {
    const { ctx, w, h, dpr } = this;
    const you = view.snakes.find((s) => s.id === view.you);
    if (you && you.alive && you.p.length) {
      this.cx = you.p[0];
      this.cy = you.p[1];
    }
    const grow = you ? Math.min(0.3, you.score / 700) : 0;
    const scale = (Math.min(w, h) / (w < h ? 380 : 480)) * (1 - grow);
    this.scale = scale;
    const cx = this.cx, cy = this.cy;

    // outside the arena
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#c9c9c9';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (w / 2 - cx * scale), dpr * (h / 2 - cy * scale));
    const vx0 = cx - w / 2 / scale, vx1 = cx + w / 2 / scale;
    const vy0 = cy - h / 2 / scale, vy1 = cy + h / 2 / scale;

    // arena
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(0, 0, WORLD, WORLD);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, WORLD, WORLD);

    // dot grid
    ctx.fillStyle = '#d6d6d6';
    const gx0 = Math.max(0, Math.floor(vx0 / DOT_GAP)) * DOT_GAP;
    const gy0 = Math.max(0, Math.floor(vy0 / DOT_GAP)) * DOT_GAP;
    for (let gx = gx0; gx <= Math.min(WORLD, vx1); gx += DOT_GAP) {
      for (let gy = gy0; gy <= Math.min(WORLD, vy1); gy += DOT_GAP) {
        ctx.beginPath();
        ctx.arc(gx, gy, 5, 0, 6.2832);
        ctx.fill();
      }
    }

    // gems
    for (const g of view.gems.values()) {
      if (g.x < vx0 - 20 || g.x > vx1 + 20 || g.y < vy0 - 20 || g.y > vy1 + 20) continue;
      const r = 8 + Math.min(7, (g.v - 1) * 1.5);
      ctx.beginPath();
      ctx.arc(g.x, g.y, r, 0, 6.2832);
      ctx.fillStyle = GEM_COLORS[g.c % GEM_COLORS.length];
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    }

    // worms
    const labels = [];
    for (const s of view.snakes) {
      if (!s.alive || !s.p.length) continue;
      this.drawSnake(s, vx0, vx1, vy0, vy1);
      labels.push(s);
    }

    // labels in screen space
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.5;
    for (const s of labels) {
      const sx = w / 2 + (s.p[0] - cx) * scale;
      const sy = h / 2 + (s.p[1] - cy) * scale - s.r * scale - 8;
      if (sx < -80 || sx > w + 80 || sy < -40 || sy > h + 40) continue;
      ctx.strokeStyle = '#111';
      ctx.fillStyle = '#fff';
      ctx.strokeText(s.name, sx, sy);
      ctx.fillText(s.name, sx, sy);
      ctx.strokeText('Lv' + s.lvl, sx, sy - 16);
      ctx.fillText('Lv' + s.lvl, sx, sy - 16);
    }

    // arrow towards the leader when off screen
    const leader = view.snakes.reduce((m, s) => (s.alive && (!m || s.score > m.score) ? s : m), null);
    if (leader && leader.id !== view.you && you && you.alive) {
      const dx = (leader.p[0] - cx) * scale, dy = (leader.p[1] - cy) * scale;
      const hx = w / 2 - 36, hy = h / 2 - 90;
      if (Math.abs(dx) > hx + 30 || Math.abs(dy) > hy + 30) {
        const k = Math.min(hx / Math.abs(dx || 1e-6), hy / Math.abs(dy || 1e-6));
        const ax = w / 2 + dx * k, ay = h / 2 + dy * k;
        const ang = Math.atan2(dy, dx);
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-12, -12);
        ctx.lineTo(-12, 12);
        ctx.closePath();
        ctx.fillStyle = '#111';
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#111';
        ctx.fillText('#1', ax, ay - 20);
      }
    }
  }

  drawSnake(s, vx0, vx1, vy0, vy1) {
    const ctx = this.ctx;
    const p = s.p;
    const n = p.length / 2;
    const r = s.r;
    const skin = SKINS[s.color % SKINS.length];
    if (s.inv) ctx.globalAlpha = Math.floor(performance.now() / 120) % 2 ? 0.45 : 0.85;

    // outline pass, then fill pass
    ctx.fillStyle = '#222';
    for (let i = n - 1; i >= 0; i--) {
      const x = p[2 * i], y = p[2 * i + 1];
      if (x < vx0 - r || x > vx1 + r || y < vy0 - r || y > vy1 + r) continue;
      ctx.beginPath();
      ctx.arc(x, y, r + 2, 0, 6.2832);
      ctx.fill();
    }
    for (let i = n - 1; i >= 0; i--) {
      const x = p[2 * i], y = p[2 * i + 1];
      if (x < vx0 - r || x > vx1 + r || y < vy0 - r || y > vy1 + r) continue;
      ctx.fillStyle = i % 6 < 3 ? skin[0] : skin[1];
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 6.2832);
      ctx.fill();
    }

    // eyes
    const j = Math.min(2, n - 1);
    const ang = Math.atan2(p[1] - p[2 * j + 1], p[0] - p[2 * j]);
    const fx = Math.cos(ang), fy = Math.sin(ang);
    for (const side of [-1, 1]) {
      const ex = p[0] + fx * r * 0.35 - fy * side * r * 0.5;
      const ey = p[1] + fy * r * 0.35 + fx * side * r * 0.5;
      ctx.beginPath();
      ctx.arc(ex, ey, r * 0.38, 0, 6.2832);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex + fx * r * 0.12, ey + fy * r * 0.12, r * 0.2, 0, 6.2832);
      ctx.fillStyle = '#111';
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
