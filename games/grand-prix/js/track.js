// Closed circuit built from segments. Each segment has a curve value and start/end heights.

export const SEG = 200;

const easeInOut = (a, b, t) => a + (b - a) * (-Math.cos(t * Math.PI) / 2 + 0.5);
const easeIn = (a, b, t) => a + (b - a) * t * t;

export function buildTrack() {
  const segs = [];
  let lastY = 0;

  function section(enter, hold, leave, curve, dy) {
    const total = enter + hold + leave;
    const startY = lastY;
    const endY = startY + dy;
    for (let n = 0; n < total; n++) {
      let c;
      if (n < enter) c = easeIn(0, curve, n / enter);
      else if (n < enter + hold) c = curve;
      else c = easeInOut(curve, 0, (n - enter - hold) / leave);
      segs.push({ curve: c, y0: easeInOut(startY, endY, n / total), y1: 0 });
    }
    lastY = endY;
  }

  section(0, 40, 0, 0, 0);
  section(30, 40, 30, 4, 0);
  section(20, 20, 20, 0, 1800);
  section(25, 30, 25, -3, 0);
  section(20, 20, 20, 0, -1800);
  section(25, 40, 25, 6, 0);
  section(0, 50, 0, 0, 0);
  section(20, 20, 20, -4, 0);
  section(20, 20, 20, 4, 0);
  section(15, 15, 15, 0, 1000);
  section(15, 15, 15, 0, -1000);
  section(40, 70, 40, 3, 0);
  section(25, 30, 25, -5, 0);
  section(30, 50, 30, 2.5, 0);
  section(0, 150, 0, 0, 0);

  const n = segs.length;
  for (let i = 0; i < n; i++) {
    segs[i].index = i;
    segs[i].y1 = segs[(i + 1) % n].y0;
    segs[i].trees = [];
    segs[i].cars = [];
  }

  // roadside scenery
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const kinds = ['pine', 'pine', 'oak', 'oak', 'cypress', 'palm', 'palm'];
  const count = { pine: 3, oak: 3, cypress: 2, palm: 2, bush: 3 };
  const put = (i, o) => segs[i % n].trees.push(o);
  for (let i = 4; i < n; i += 4) {
    for (const side of [-1, 1]) {
      if (rnd() < 0.18) continue;
      const kind = kinds[Math.floor(rnd() * kinds.length)];
      put(i, { off: side * (2.5 + rnd() * 3.6), kind, v: Math.floor(rnd() * count[kind]), s: 0.8 + rnd() * 0.5, flip: rnd() < 0.5 });
    }
    // low bushes right behind the barrier
    if (rnd() < 0.55) {
      const side = rnd() < 0.5 ? -1 : 1;
      put(i + 1, { off: side * (2.0 + rnd() * 0.5), kind: 'bush', v: Math.floor(rnd() * 3), s: 0.7 + rnd() * 0.5, flip: rnd() < 0.5 });
    }
  }
  // sponsor boards behind the barrier
  for (let i = 12; i < n; i += 37) {
    const side = Math.floor(i / 37) % 2 ? -1 : 1;
    put(i, { off: side * 2.05, kind: 'board', v: Math.floor(i / 37) % 3, s: 1, flip: false });
  }
  // grandstands along the finishing straight and one mid-lap
  for (const i of [n - 120, n - 60, 12, 500]) {
    put(i, { off: i % 2 ? -3.6 : 3.6, kind: 'stand', v: 0, s: 1, flip: false });
  }

  const length = n * SEG;
  return {
    segs,
    length,
    segAt(p) {
      const z = ((p % length) + length) % length;
      return segs[Math.floor(z / SEG) % n];
    },
  };
}
