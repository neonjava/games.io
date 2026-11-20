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
  section(20, 20, 20, 0, 1200);
  section(25, 30, 25, -3, 0);
  section(20, 20, 20, 0, -1200);
  section(25, 40, 25, 6, 0);
  section(0, 50, 0, 0, 0);
  section(20, 20, 20, -4, 0);
  section(20, 20, 20, 4, 0);
  section(15, 15, 15, 0, 700);
  section(15, 15, 15, 0, -700);
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
  for (let i = 4; i < n; i += 6) {
    const side = rnd() < 0.5 ? -1 : 1;
    segs[i].trees.push({ off: side * (2.3 + rnd() * 3.2), kind: 'tree', s: 0.8 + rnd() * 0.6 });
    if (rnd() < 0.5) segs[i + 2 < n ? i + 2 : i].trees.push({ off: -side * (2.6 + rnd() * 3.5), kind: 'tree', s: 0.8 + rnd() * 0.6 });
  }
  for (let i = 0; i < n; i += 5) {
    segs[i].trees.push({ off: -1.75, kind: 'post' });
    segs[i].trees.push({ off: 1.75, kind: 'post' });
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
