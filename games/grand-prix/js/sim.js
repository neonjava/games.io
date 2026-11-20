// Race simulation. No DOM in here.
import { SEG } from './track.js';

export const MAX_SPEED = 12000; // world units per second, shown as 320 km/h
export const LAPS = 3;
export const PLAYER_Z = 840;
export const CAR_COLORS = ['#d4181f', '#f2c200', '#1f4fbf', '#e9ebee', '#f26a1b', '#1d7a46', '#a9afb5', '#3b4148'];
export const CAR_COLORS_PAINT = CAR_COLORS;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Race {
  constructor(track) {
    this.track = track;
    this.L = track.length;
    this.reset();
  }

  reset() {
    this.state = 'ready'; // ready, count, race, done
    this.count = 3;
    this.time = 0;
    this.events = [];
    this.finishedCount = 0;
    this.result = null;
    this.best = 0;
    this.lapStart = 0;
    this.lapsDone = 0;
    this.slip = 0;
    this.contactCd = 0;
    this.lastRank = 8;
    this.cars = [];
    for (let k = 0; k < 8; k++) {
      const player = k === 0;
      const slot = player ? 7 : k - 1;
      this.cars.push({
        id: k,
        player,
        color: CAR_COLORS[k],
        p: -(slot + 1) * 450,
        x: slot % 2 ? 0.35 : -0.35,
        tx: 0,
        lane: slot % 2 ? 0.35 : -0.35,
        speed: 0,
        pace: player ? 1 : 0.993 - slot * 0.011 + Math.random() * 0.012,
        laneTimer: Math.random(),
        finished: 0,
      });
    }
    this.player = this.cars[0];
    this.rank = 8;
  }

  begin() {
    this.reset();
    this.state = 'count';
    this.count = 3.2;
  }

  ranking() {
    return this.cars.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.finished - b.finished;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.p - a.p;
    });
  }

  step(dt, input) {
    if (this.state === 'ready') return;
    if (this.state === 'count') {
      this.count -= dt;
      if (this.count <= 0) {
        this.state = 'race';
        this.time = 0;
        this.events.push({ type: 'go' });
      }
      return;
    }
    this.time += dt;
    this.contactCd = Math.max(0, this.contactCd - dt);
    this.stepPlayer(dt, input);
    for (const c of this.cars) if (!c.player) this.stepAI(c, dt);
    this.contact();
    this.laps();

    const order = this.ranking();
    this.rank = order.indexOf(this.player) + 1;
    if (this.state === 'race' && this.rank < this.lastRank && this.lastRank <= 8 && this.time > 1) {
      this.events.push({ type: 'overtake', rank: this.rank });
    }
    this.lastRank = this.rank;
  }

  stepPlayer(dt, input) {
    const c = this.player;
    const seg = this.track.segAt(c.p);
    const done = this.state === 'done';
    const sp = c.speed / MAX_SPEED;

    // slipstream: car close ahead in a similar line
    let slipTarget = 0;
    for (const o of this.cars) {
      const dp = o.p - c.p;
      if (o !== c && dp > 0 && dp < 2800 && Math.abs(o.x - c.x) < 0.36) { slipTarget = 1; break; }
    }
    this.slip += (slipTarget - this.slip) * Math.min(1, dt * 4);

    let steer = done ? 0 : clamp(input.steer || 0, -1, 1);
    const authority = 0.9 + 2.3 * sp;
    c.x += steer * authority * dt * (sp > 0.02 ? 1 : 0.3);
    c.x -= 2 * sp * sp * seg.curve * 0.2 * dt;
    if (done) c.x += (0 - c.x) * Math.min(1, dt * 1.5);
    if (Math.abs(c.x) > 1.58) {
      // scraping the barrier
      c.x = clamp(c.x, -1.62, 1.62);
      c.speed *= 1 - Math.min(1, dt * 1.6);
    }

    const off = Math.abs(c.x) > 1.12; // kerbs and run-off
    let limit = MAX_SPEED * (1 + this.slip * 0.06);
    if (off) limit = MAX_SPEED * 0.55;
    if (done) limit = MAX_SPEED * 0.35;
    if (input.brake && !done) {
      c.speed -= MAX_SPEED / 2.2 * dt;
    } else if (c.speed < limit) {
      c.speed += MAX_SPEED / 6.5 * dt;
    }
    if (c.speed > limit) c.speed -= MAX_SPEED / 2 * dt;
    c.speed = clamp(c.speed, 0, MAX_SPEED * 1.07);
    c.p += c.speed * dt;
  }

  stepAI(c, dt) {
    const seg = this.track.segAt(c.p);
    const pl = this.player;
    let target = MAX_SPEED * c.pace * (1 - 0.055 * Math.abs(seg.curve));

    // keep the race close
    const gap = c.p - pl.p;
    if (gap > 7000) target *= 0.965;
    else if (gap < -9000) target *= 1.03;

    // find the nearest car ahead
    let ahead = null;
    let adp = Infinity;
    for (const o of this.cars) {
      if (o === c) continue;
      const dp = o.p - c.p;
      if (dp > 0 && dp < adp) { adp = dp; ahead = o; }
    }
    c.laneTimer -= dt;
    if (ahead && adp < 1700 && Math.abs(ahead.x - c.x) < 0.36) {
      if (c.laneTimer <= 0) {
        let s = c.x - ahead.x >= 0 ? 1 : -1;
        if (Math.abs(c.x + 0.45 * s) > 0.8) s = -s;
        c.tx = clamp(c.x + 0.45 * s, -0.8, 0.8);
        c.laneTimer = 1.3;
      }
      if (adp < 520 && Math.abs(ahead.x - c.x) < 0.26) target = Math.min(target, ahead.speed * 0.995);
      else if (adp < 2500) target *= 1.04; // slipstream
    } else if (c.laneTimer <= 0) {
      c.tx = c.lane;
      c.laneTimer = 1;
    }
    c.x += (c.tx - c.x) * Math.min(1, dt * 2.5);

    c.speed += (target - c.speed) * Math.min(1, dt * 1.3);
    c.p += c.speed * dt;
  }

  contact() {
    const pl = this.player;
    if (this.state !== 'race') return;
    for (const o of this.cars) {
      if (o === pl) continue;
      if (Math.abs(o.p - pl.p) < 380 && Math.abs(o.x - pl.x) < 0.3) {
        if (this.contactCd <= 0) {
          this.contactCd = 1.2;
          this.events.push({ type: 'contact' });
        }
        pl.speed = Math.min(pl.speed, Math.max(o.speed * 0.92, 0)) ;
        pl.x += (pl.x >= o.x ? 1 : -1) * 0.08;
        o.speed *= 0.99;
      }
    }
  }

  laps() {
    for (const c of this.cars) {
      if (!c.finished && c.p >= LAPS * this.L) {
        c.finished = ++this.finishedCount;
      }
    }
    const pl = this.player;
    const done = Math.floor(Math.max(0, pl.p) / this.L);
    if (done > this.lapsDone && this.state === 'race') {
      const lap = this.time - this.lapStart;
      if (!this.best || lap < this.best) this.best = lap;
      this.lapStart = this.time;
      this.lapsDone = done;
      if (done >= LAPS) {
        this.state = 'done';
        this.result = { pos: pl.finished || this.finishedCount, time: this.time, best: this.best };
        this.events.push({ type: 'finish' });
      } else {
        this.events.push({ type: 'lap', lap: done + 1 });
      }
    }
  }

  lap() {
    return clamp(Math.floor(Math.max(0, this.player.p) / this.L) + 1, 1, LAPS);
  }

  lapProgress() {
    const p = Math.max(0, this.player.p);
    return (p % this.L) / this.L;
  }

  kmh() {
    return Math.round((this.player.speed / MAX_SPEED) * 320);
  }
}

export { SEG };
