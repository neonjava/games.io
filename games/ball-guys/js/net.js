// Sessions: solo (local), room host, room client. Rooms are peer-to-peer
// (WebRTC through PeerJS), so there is no game server. The first player to
// open a room code becomes its host and runs the physics.

import { Room, STEP } from './sim.js';

const PREFIX = 'neonjava-ballguys-';
const SEND_EVERY = 1 / 15;
const INTERP_MS = 130;

export class LocalSession {
  constructor(name) {
    this.room = new Room();
    this.code = null;
    this.acc = 0;
    this.onClose = null;
    this.u = 0.5; this.dropN = 0; this.magN = 0;
    this.you = this.room.addPlayer('local', name);
  }

  push() { this.room.setInput(this.you, this.u, this.dropN, this.magN); }
  setAim(u) { this.u = u; this.push(); }
  drop() { this.dropN++; this.push(); }
  magnet() { this.magN++; this.push(); }

  update(dt) {
    this.acc += dt;
    let n = 0;
    while (this.acc >= STEP && n < 6) { this.room.step(STEP); this.acc -= STEP; n++; }
    if (this.acc > STEP) this.acc = 0;
  }

  view() {
    const v = this.room.view();
    v.you = this.you;
    v.humans = this.room.playerCount();
    v.ev = this.room.localEv.splice(0);
    return v;
  }

  close() {}
}

export class HostSession extends LocalSession {
  constructor(name, code, peer) {
    super(name);
    this.code = code;
    this.peer = peer;
    this.conns = new Map(); // peer id -> {conn, slot}
    this.sendAcc = 0;
    peer.on('connection', (conn) => {
      conn.on('data', (msg) => this.onData(conn, msg));
      conn.on('close', () => this.drop2(conn.peer));
      conn.on('error', () => this.drop2(conn.peer));
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { /* ignore */ } });
    peer.on('error', (e) => console.warn('peer error', e && e.type));
  }

  onData(conn, msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'join') {
      if (this.conns.has(conn.peer)) return;
      const slot = this.room.addPlayer(conn.peer, msg.name);
      if (slot < 0) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); return; }
      this.conns.set(conn.peer, { conn, slot });
      this.room.tracking = true;
      conn.send({ t: 'w', id: slot });
    } else if (msg.t === 'in') {
      const c = this.conns.get(conn.peer);
      if (c) this.room.setInput(c.slot, Number(msg.u), Number(msg.d), Number(msg.m));
    }
  }

  drop2(peerId) {
    if (!this.conns.has(peerId)) return;
    this.conns.delete(peerId);
    this.room.removePlayer(peerId);
    if (!this.conns.size) { this.room.tracking = false; this.room.ev = []; }
  }

  update(dt) {
    super.update(dt);
    this.sendAcc += dt;
    if (this.sendAcc >= SEND_EVERY) {
      this.sendAcc = 0;
      if (this.conns.size) {
        const snap = this.room.snapshot();
        for (const c of this.conns.values()) { try { c.conn.send(snap); } catch (e) { /* ignore */ } }
      }
      this.room.flush();
    }
  }

  close() { try { this.peer.destroy(); } catch (e) { /* ignore */ } }
}

export class ClientSession {
  constructor(peer, conn, welcome, code) {
    this.peer = peer; this.conn = conn; this.code = code;
    this.you = welcome.id;
    this.snaps = [];
    this.evq = [];
    this.u = 0.5; this.dropN = 0; this.magN = 0;
    this.inAcc = 0;
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

  onData(m) {
    if (!m || m.t !== 's' || !Array.isArray(m.b)) return;
    const balls = m.b.map((a) => ({ id: a[0], x: a[1], y: a[2], vx: a[3] * 4, vy: a[4] * 4, l: a[5], c: a[6] }));
    const map = new Map(balls.map((b) => [b.id, b]));
    const players = m.pl.map((a) => ({ idx: a[0], name: String(a[1]), score: a[2], ai: !!a[3], cd: a[4], mcd: a[5], balls: a[6] }));
    for (const e of m.ev || []) this.evq.push(e);
    this.snaps.push({ t: performance.now(), ph: m.ph ? 'over' : 'play', tl: m.tl, ol: m.ol, gd: m.gd, gn: m.gn, gw: m.gw, players, balls, map, res: m.res || null });
    if (this.snaps.length > 6) this.snaps.shift();
  }

  send() { try { this.conn.send({ t: 'in', u: this.u, d: this.dropN, m: this.magN }); } catch (e) { /* ignore */ } }
  setAim(u) { this.u = u; }
  drop() { this.dropN++; this.send(); }
  magnet() { this.magN++; this.send(); }

  update(dt) {
    this.inAcc += dt;
    if (this.inAcc >= 0.06 && !this.closed) { this.inAcc = 0; this.send(); }
  }

  view() {
    const S = this.snaps;
    if (!S.length) return null;
    const now = performance.now() - INTERP_MS;
    let i = -1;
    for (let k = S.length - 1; k >= 0; k--) if (S[k].t <= now) { i = k; break; }
    const a = i < 0 ? S[0] : S[i];
    const b = i < 0 ? S[0] : S[Math.min(S.length - 1, i + 1)];
    const k = b.t > a.t ? Math.min(1, Math.max(0, (now - a.t) / (b.t - a.t))) : 1;
    const balls = b.balls.map((o) => {
      const p = a.map.get(o.id);
      if (!p || a === b || Math.abs(p.x - o.x) + Math.abs(p.y - o.y) > 120) return o;
      return { id: o.id, x: p.x + (o.x - p.x) * k, y: p.y + (o.y - p.y) * k, vx: o.vx, vy: o.vy, l: o.l, c: o.c };
    });
    const last = S[S.length - 1];
    return {
      ph: last.ph, tl: last.tl, ol: last.ol, gd: last.gd, gn: last.gn, gw: last.gw,
      players: last.players, balls, res: last.res, you: this.you,
      humans: last.players.filter((p) => !p.ai).length, ev: this.evq.splice(0),
    };
  }

  close() { this.closed = true; try { this.peer.destroy(); } catch (e) { /* ignore */ } }
}

export function openRoom(code, name) {
  return new Promise((resolve, reject) => {
    if (typeof Peer === 'undefined') { reject(new Error('Could not load the networking library')); return; }
    const hostId = PREFIX + code;
    let retried = false;

    function tryHost() {
      let opened = false;
      const peer = new Peer(hostId);
      peer.on('open', () => { opened = true; resolve(new HostSession(name, code, peer)); });
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
          if (msg.t === 'w') { settled = true; clearTimeout(timer); resolve(new ClientSession(peer, conn, msg, code)); }
          else if (msg.t === 'full') fail('That room is full');
        });
        conn.on('close', () => fail('Disconnected'));
      });
    }

    tryHost();
  });
}
