// Sessions: solo (local), room host, room client.
// Rooms are peer-to-peer (WebRTC through PeerJS), so there is no game server.
// The first player to open a room code becomes its host and runs the simulation.

import { Room, STEP, levelFor } from './sim.js';

const PREFIX = 'neonjava-worm-';
const SEND_EVERY = 0.05; // 20 snapshots per second
const INTERP_MS = 110;

export class LocalSession {
  constructor(name) {
    this.room = new Room();
    this.code = null;
    this.acc = 0;
    this.onClose = null;
    this.you = this.room.addPlayer('local', name);
  }

  setInput(angle, boost) {
    this.room.setInput('local', angle, boost);
  }

  update(dt) {
    this.acc += dt;
    let n = 0;
    while (this.acc >= STEP && n < 6) {
      this.room.step(STEP);
      this.acc -= STEP;
      n++;
    }
    if (this.acc > STEP) this.acc = 0;
  }

  view() {
    const v = this.room.view();
    v.you = this.you;
    v.players = this.room.playerCount();
    return v;
  }

  close() {}
}

export class HostSession extends LocalSession {
  constructor(name, code, peer) {
    super(name);
    this.code = code;
    this.peer = peer;
    this.conns = new Map();
    this.sendAcc = 0;

    peer.on('connection', (conn) => {
      conn.on('data', (msg) => this.onData(conn, msg));
      conn.on('close', () => this.drop(conn.peer));
      conn.on('error', () => this.drop(conn.peer));
    });
    peer.on('disconnected', () => {
      try { peer.reconnect(); } catch (e) { /* ignore */ }
    });
    peer.on('error', (e) => console.warn('peer error', e && e.type));
  }

  onData(conn, msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'join') {
      if (this.conns.has(conn.peer)) return;
      const id = this.room.addPlayer(conn.peer, msg.name);
      if (id < 0) {
        conn.send({ t: 'full' });
        setTimeout(() => conn.close(), 300);
        return;
      }
      this.conns.set(conn.peer, conn);
      this.room.tracking = true;
      conn.send({ t: 'w', id, gems: this.room.gemList() });
    } else if (msg.t === 'in') {
      if (this.conns.has(conn.peer)) this.room.setInput(conn.peer, Number(msg.a), !!msg.b);
    }
  }

  drop(peerId) {
    if (!this.conns.has(peerId)) return;
    this.conns.delete(peerId);
    this.room.removePlayer(peerId);
  }

  update(dt) {
    super.update(dt);
    this.sendAcc += dt;
    if (this.sendAcc >= SEND_EVERY) {
      this.sendAcc = 0;
      if (this.conns.size) {
        const snap = this.room.snapshot();
        for (const c of this.conns.values()) {
          try { c.send(snap); } catch (e) { /* ignore */ }
        }
      }
      this.room.flush();
    }
  }

  close() {
    try { this.peer.destroy(); } catch (e) { /* ignore */ }
  }
}

export class ClientSession {
  constructor(peer, conn, welcome, code) {
    this.peer = peer;
    this.conn = conn;
    this.code = code;
    this.you = welcome.id;
    this.gems = new Map();
    for (const g of welcome.gems) this.gems.set(g[0], { id: g[0], x: g[1], y: g[2], c: g[3], v: g[4] });
    this.snaps = [];
    this.inAcc = 0;
    this.angle = 0;
    this.boost = false;
    this.onClose = null;
    this.closed = false;
    conn.on('data', (m) => this.onData(m));
    conn.on('close', () => this.lost());
    conn.on('error', () => this.lost());
  }

  lost() {
    if (this.closed) return;
    this.closed = true;
    if (this.onClose) this.onClose();
  }

  onData(msg) {
    if (!msg || msg.t !== 's' || !Array.isArray(msg.sn)) return;
    for (const g of msg.ga || []) this.gems.set(g[0], { id: g[0], x: g[1], y: g[2], c: g[3], v: g[4] });
    for (const id of msg.gd || []) this.gems.delete(id);
    const snakes = msg.sn.map((a) => ({
      id: a[0], name: String(a[1]), score: a[2], ko: a[3],
      alive: !!(a[4] & 1), ai: !!(a[4] & 2), inv: !!(a[4] & 4),
      color: a[5], r: a[6], p: a[7], kb: String(a[8] || ''), lvl: levelFor(a[2]),
    }));
    const map = new Map(snakes.map((s) => [s.id, s]));
    this.snaps.push({ t: performance.now(), ph: msg.ph, tl: msg.tl, ol: msg.ol, rd: msg.rd, snakes, map, res: msg.res || null });
    if (this.snaps.length > 6) this.snaps.shift();
  }

  setInput(angle, boost) {
    this.angle = angle;
    this.boost = boost;
  }

  update(dt) {
    this.inAcc += dt;
    if (this.inAcc >= SEND_EVERY && !this.closed) {
      this.inAcc = 0;
      try { this.conn.send({ t: 'in', a: this.angle, b: this.boost }); } catch (e) { /* ignore */ }
    }
  }

  view() {
    const S = this.snaps;
    if (!S.length) return null;
    const now = performance.now() - INTERP_MS;
    let i = -1;
    for (let k = S.length - 1; k >= 0; k--) {
      if (S[k].t <= now) { i = k; break; }
    }
    const a = i < 0 ? S[0] : S[i];
    const b = i < 0 ? S[0] : S[Math.min(S.length - 1, i + 1)];
    const k = b.t > a.t ? Math.min(1, Math.max(0, (now - a.t) / (b.t - a.t))) : 1;

    const snakes = b.snakes.map((sb) => {
      const sa = a.map.get(sb.id);
      if (!sa || a === b || !sa.alive || !sb.alive || !sa.p.length || !sb.p.length) return sb;
      if (Math.abs(sa.p[0] - sb.p[0]) + Math.abs(sa.p[1] - sb.p[1]) > 200) return sb;
      const out = new Array(sb.p.length);
      for (let j = 0; j < out.length; j++) {
        out[j] = j < sa.p.length ? sa.p[j] + (sb.p[j] - sa.p[j]) * k : sb.p[j];
      }
      return Object.assign({}, sb, { p: out });
    });

    const last = S[S.length - 1];
    return {
      ph: last.ph, tl: last.tl, ol: last.ol, rd: last.rd, snakes, gems: this.gems,
      res: last.res, you: this.you,
      players: last.snakes.filter((s) => !s.ai).length,
    };
  }

  close() {
    this.closed = true;
    try { this.peer.destroy(); } catch (e) { /* ignore */ }
  }
}

// Opens a room by code. If nobody has the code yet we become the host,
// otherwise we join the existing host as a client.
export function openRoom(code, name) {
  return new Promise((resolve, reject) => {
    if (typeof Peer === 'undefined') {
      reject(new Error('Could not load the networking library'));
      return;
    }
    const hostId = PREFIX + code;
    let retried = false;

    function tryHost() {
      let opened = false;
      const peer = new Peer(hostId);
      peer.on('open', () => {
        opened = true;
        resolve(new HostSession(name, code, peer));
      });
      peer.on('error', (err) => {
        if (opened) return;
        peer.destroy();
        if (err && err.type === 'unavailable-id') tryClient();
        else reject(new Error('Could not reach the room service'));
      });
    }

    function tryClient() {
      const peer = new Peer();
      let settled = false;
      const fail = (msg, canRetry) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        peer.destroy();
        if (canRetry && !retried) { retried = true; tryHost(); } else reject(new Error(msg));
      };
      const timer = setTimeout(() => fail('Could not reach the room'), 10000);
      peer.on('error', (err) => {
        if (err && err.type === 'peer-unavailable') fail('Room closed', true);
        else fail('Could not reach the room');
      });
      peer.on('open', () => {
        const conn = peer.connect(hostId, { reliable: true });
        conn.on('open', () => conn.send({ t: 'join', name }));
        conn.on('data', (msg) => {
          if (settled || !msg) return;
          if (msg.t === 'w') {
            settled = true;
            clearTimeout(timer);
            resolve(new ClientSession(peer, conn, msg, code));
          } else if (msg.t === 'full') {
            fail('That room is full');
          }
        });
        conn.on('close', () => fail('Disconnected'));
      });
    }

    tryHost();
  });
}
