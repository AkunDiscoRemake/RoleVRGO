import * as THREE from 'three';
import { CatAvatar, FUR_COLORS, EYE_COLORS, HATS } from './cat.js';
import { MAPS } from './maps.js';
import { net } from './net.js';
import { S } from './state.js';
import { play, meow } from './assets.js';
import { emit, clamp } from './util.js';
import { HAND_R } from './config.js';

// ☢ Infecção Nuclear: pega-pega. Quem é pego vira Infectado (visual assustador, +5% de velocidade)
// e passa a caçar. Para infectar, é preciso encostar a PATA em um não-infectado.
// Modos: com bots (sala só sua) ou multiplayer real (todos da sala no mapa). No multiplayer o
// "anfitrião" (menor id) controla as rodadas e confirma as infecções; se ele sair, o próximo assume.
const ROUND = 150000, COUNT = 6000, ENDWAIT = 8000, GRACE = 3000, BOTN = 5;
const BOT_NAMES = ['Rabisco', 'Pimenta', 'Tufo', 'Faísca', 'Nuvem', 'Bolota', 'Trovão', 'Pipoca'];
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _n = new THREE.Vector3();

export const infect = {
  G: null, active: false, mode: null, st: { ph: 'wait', end: 0, inf: [], pl: [], rd: 0, win: '', grace: 0 }, bots: [], label: '', myInf: false, tagT: {}, sendT: 0, myTags: 0, myTagAt: {}, _prev: null,
  init(G) { this.G = G; },
  now() { return net.online ? net.now() : Date.now(); },
  me() { return net.id || 'me'; },
  // ---------- entrar/sair do mapa ----------
  enter() { this.active = true; this.mode = null; this.reset(); emit('nukeChoose'); },
  leave() { if (!this.active) return; this.active = false; this.mode = null; this.clearBots(); this.reset(); this.setMine(false); this.label = ''; this.G.modeLabel = ''; MAPS.nuke.netKey = undefined; },
  reset() { this.st = { ph: 'wait', end: 0, inf: [], pl: [], rd: 0, win: '', grace: 0 }; this._prev = null; this.myTags = 0; },
  choose(mode) {
    const G = this.G; if (!this.active) return; this.mode = mode === 'bots' ? 'bots' : 'mp'; this.reset(); this.clearBots();
    MAPS.nuke.netKey = this.mode === 'bots' ? 'nuke_solo_' + this.me().slice(0, 8) : undefined; // bots: canal só seu
    if (net.online) { net.join(G.room, MAPS.nuke.netKey || 'nuke', G.roomPublic); G.pushMeta(); }
    if (this.mode === 'bots') this.spawnBots(BOTN);
    S.toast(this.mode === 'bots' ? '🤖 Modo com bots: ' + BOTN + ' bots entraram' : '👥 Multiplayer: esperando pelo menos 2 jogadores', '#9cf09c');
  },
  // ---------- participantes ----------
  ids() { const out = [this.me()]; if (this.mode === 'bots') for (const b of this.bots) out.push(b.id); else if (this.mode === 'mp') this.G.remotes.forEach((r, id) => { if (r.has) out.push(id); }); return out; },
  host() { if (this.mode === 'bots') return this.me(); let h = this.me(); this.G.remotes.forEach((r, id) => { if (id < h) h = id; }); return h; },
  isHost() { return this.host() === this.me(); },
  isInf(id) { return this.st.inf.indexOf(id) >= 0; },
  nameOf(id) { if (id === this.me()) return S.name; const b = this.bots.find((x) => x.id === id); if (b) return b.name; const r = this.G.remotes.get(id); return r ? r.meta.name : 'Gato'; },
  // posição do corpo de um participante (remoto, bot ou você)
  bodyOf(id, out) { if (id === this.me()) return out.copy(this.G.player.pos); const b = this.bots.find((x) => x.id === id); if (b) return out.set(b.x, b.y, b.z); const r = this.G.remotes.get(id); if (r && r.has) return out.copy(r.av.root.position); return null; },
  // ---------- rede ----------
  send(k, d) { if (this.mode === 'mp' && net.online) net.send('nk', Object.assign({ k }, d)); },
  onNet(e) {
    if (!this.active || this.mode !== 'mp' || !e) return;
    if (e.k === 'st' && e.s && typeof e.s === 'object') { if (e.f !== this.host() && !(e.f < this.me())) return; const s = e.s, arr = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string').slice(0, 64) : []);
      this.st = { ph: ['wait', 'count', 'play', 'end'].indexOf(s.ph) >= 0 ? s.ph : 'wait', end: Number(s.end) || 0, inf: arr(s.inf), pl: arr(s.pl), rd: s.rd | 0, win: s.win === 'inf' || s.win === 'surv' ? s.win : '', grace: Number(s.grace) || 0 }; }
    else if (e.k === 'tag' && this.isHost() && typeof e.v === 'string' && typeof e.a === 'string') this.applyTag(e.v, e.a);
  },
  broadcast() { this.send('st', { s: this.st }); this.sendT = 1; },
  // ---------- regras (só o anfitrião) ----------
  hostTick(dt) {
    const st = this.st, now = this.now(), ids = this.ids(), n = ids.length; let ch = false;
    st.inf = st.inf.filter((id) => ids.indexOf(id) >= 0);
    if (st.ph === 'wait') { if (n >= 2) { st.ph = 'count'; st.end = now + COUNT; ch = true; } }
    else if (st.ph === 'count') { if (n < 2) { st.ph = 'wait'; ch = true; } else if (now >= st.end) { const pz = ids[Math.floor(Math.random() * n)]; st.ph = 'play'; st.end = now + ROUND; st.inf = [pz]; st.pl = ids.slice(); st.rd++; st.win = ''; st.grace = now + GRACE; ch = true; } }
    else if (st.ph === 'play') {
      for (const id of ids) if (st.pl.indexOf(id) < 0) { st.pl.push(id); if (!this.isInf(id)) st.inf.push(id); ch = true; } // quem chega no meio já entra infectado
      const surv = ids.filter((id) => !this.isInf(id)).length;
      if (n < 2) { st.ph = 'wait'; st.inf = []; ch = true; }
      else if (!surv || !st.inf.length) { st.ph = 'end'; st.win = surv ? 'surv' : 'inf'; st.end = now + ENDWAIT; ch = true; }
      else if (now >= st.end) { st.ph = 'end'; st.win = 'surv'; st.end = now + ENDWAIT; ch = true; }
    } else if (st.ph === 'end' && now >= st.end) { st.ph = n >= 2 ? 'count' : 'wait'; st.end = now + COUNT; st.inf = []; ch = true; }
    this.sendT -= dt; if (ch || this.sendT <= 0) this.broadcast();
  },
  applyTag(v, a) {
    const st = this.st; if (st.ph !== 'play' || this.now() < st.grace || !this.isInf(a) || this.isInf(v) || this.ids().indexOf(v) < 0) return false;
    // confere a distância (evita trapaça grosseira): até 3,5 m entre os dois
    if (this.bodyOf(v, _a) && this.bodyOf(a, _b) && _a.distanceTo(_b) > 3.5) return false;
    st.inf.push(v); this.broadcast(); return true;
  },
  tag(v, a) { const k = v + '|' + a, t = this.now(); if (a === this.me()) this.myTagAt[v] = t; if (this.tagT[k] && t - this.tagT[k] < 1200) return; this.tagT[k] = t; if (this.isHost()) this.applyTag(v, a); else this.send('tag', { v, a }); },
  // ---------- por quadro ----------
  update(dt) {
    if (!this.active || !this.mode || !this.G.world) return;
    const G = this.G, P = G.player, st = this.st, now = this.now(), me = this.me();
    if (this.isHost()) this.hostTick(dt);
    this._events();
    this.setMine(this.isInf(me));
    // visual de todos (remotos e bots)
    if (this.mode === 'mp') G.remotes.forEach((r, id) => { const want = st.ph === 'play' || st.ph === 'end' ? this.isInf(id) : false; if (!!r.av.look.inf !== want) r.av.setLook(Object.assign({}, r.meta.look, { inf: want ? 1 : 0 })); });
    for (const b of this.bots) { const want = (st.ph === 'play' || st.ph === 'end') && this.isInf(b.id); if (!!b.av.look.inf !== want) b.av.setLook(Object.assign({}, b.look, { inf: want ? 1 : 0 })); }
    // patadas
    if (st.ph === 'play' && now >= st.grace) {
      const ids = this.ids();
      if (this.myInf) { for (const id of ids) { if (id === me || this.isInf(id) || !this.bodyOf(id, _a)) continue; for (const h of P.hands) { if (this._hitBody(h.pos, _a, 0.5)) { this.tag(id, me); break; } } } }
      else {
        if (this.mode === 'mp') G.remotes.forEach((r, id) => { if (!r.has || !this.isInf(id)) return; const p = r.av.root.position; for (let k = 0; k < 2; k++) { _b.set(p.x + r.h[k * 3], p.y + r.h[k * 3 + 1], p.z + r.h[k * 3 + 2]); if (this._hitBody(_b, P.pos, 0.42)) { this.tag(me, id); return; } } });
        for (const b of this.bots) if (this.isInf(b.id) && Math.hypot(b.x - P.pos.x, b.z - P.pos.z) < 0.85 && Math.abs(b.y - P.pos.y) < 1.3) this.tag(me, b.id);
      }
    }
    this._bots(dt);
    // texto no topo da visão
    const s = Math.max(0, Math.ceil((st.end - now) / 1000)), ids = this.ids(), ni = ids.filter((id) => this.isInf(id)).length;
    this.label = st.ph === 'wait' ? '☢ Esperando jogadores (' + ids.length + '/2)' : st.ph === 'count' ? '☢ Rodada começa em ' + s + 's' : st.ph === 'play' ? (this.myInf ? '☣ INFECTADO' : '🏃 FUJA!') + '  ·  ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + '  ·  ☣ ' + ni + '  🐱 ' + (ids.length - ni) : st.win === 'inf' ? '☣ Os infectados venceram!' : '🐱 Os sobreviventes venceram!';
    G.modeLabel = this.label;
  },
  _hitBody(hand, body, r) { const y = clamp(hand.y, body.y + 0.15, body.y + 1.15); const dx = hand.x - body.x, dy = hand.y - y, dz = hand.z - body.z; return dx * dx + dy * dy + dz * dz < r * r; },
  // reações locais às mudanças de estado (banner, som, recompensas)
  _events() {
    const st = this.st, pv = this._prev, me = this.me(), G = this.G;
    if (!pv || pv.rd !== st.rd && st.ph === 'play') { if (st.ph === 'play' && (!pv || pv.rd !== st.rd)) { this.myTags = 0; if (this.isInf(me)) { emit('banner', '☣ VOCÊ É O PACIENTE ZERO! Pegue todo mundo!', 5); } else emit('banner', '☢ Rodada ' + st.rd + ': fuja do infectado!', 4); play('event', 0.8); } }
    if (pv && st.ph === 'play') for (const id of st.inf) if (pv.inf.indexOf(id) < 0 && pv.rd === st.rd) {
      const p = this.bodyOf(id, _a); if (p) { G.fx.burst(p.x, p.y + 0.8, p.z, 0x8aff30, 30, 4, 2); G.fx.ring(p.x, p.y + 0.05, p.z, 0x8aff30, 2.2, true, null, 0.8); }
      if (id === me) { emit('banner', '☣ VOCÊ FOI INFECTADO! Agora pegue os outros!', 4); play('thud', 0.9); meow(0.9, 0.6); G.player.pulse(1, 200); }
      else { S.toast('☣ ' + this.nameOf(id) + ' foi infectado!', '#b8ff60'); play('punch', 0.5); if (this.myTagAt[id] && this.now() - this.myTagAt[id] < 4000) { this.myTags++; S.addXp(8); S.addCoins(5); S.stat('infTags'); } }
    }
    if (pv && pv.ph === 'play' && st.ph === 'end') { const surv = !this.isInf(me);
      if (st.win === 'surv' && surv) { emit('banner', '🏆 Você sobreviveu! +40 XP, +30 moedas', 5); S.addXp(40); S.addCoins(30); S.stat('infSurvive'); play('quest', 0.8); }
      else if (st.win === 'inf' && !surv) { emit('banner', '☣ Infecção total! +20 XP, +10 moedas', 5); S.addXp(20); S.addCoins(10); play('quest', 0.6); }
      else emit('banner', st.win === 'inf' ? '☣ Os infectados venceram!' : '🐱 Os sobreviventes venceram!', 4);
      S.stat('infRounds'); G._confetti && G._confetti(20); }
    this._prev = { ph: st.ph, rd: st.rd, inf: st.inf.slice() };
  },
  setMine(v) { if (this.myInf === v) return; this.myInf = v; const G = this.G; if (G.selfCat) G.selfCat.setLook(v ? Object.assign({}, S.look, { inf: 1 }) : S.look); G.infFur = v ? '#7d9a5a' : null; },
  // ---------- bots ----------
  spawnBots(n) {
    const G = this.G;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, x = Math.cos(a) * 18, z = Math.sin(a) * 18, look = { fur: FUR_COLORS[(i * 5 + 3) % FUR_COLORS.length], fur2: '#f5f1e8', pattern: i % 6, eyes: EYE_COLORS[i % EYE_COLORS.length], hat: [1, 6, 4, 9, 3, 8][i % 6] % HATS.length, acc: [0, 1, 3, 5, 6][i % 5], outfit: [1, 4, 5, 9, 7][i % 5] };
      const name = '🤖 ' + BOT_NAMES[(i + Math.floor(Math.random() * 8)) % BOT_NAMES.length], av = new CatAvatar(look, name, { tagColor: '#c8ffb0' });
      const y = G.world.floorAt(x, 30, z); av.root.position.set(x, y, z); G.scene.add(av.root);
      this.bots.push({ id: 'bot' + i, name, look, av, x, y, z, vy: 0, dx: 0, dz: 1, t: Math.random() * 2, sp: 3.7 + Math.random() * 0.6, lx: x, lz: z, stuckT: 0, jumpT: 0 }); }
  },
  clearBots() { for (const b of this.bots) b.av.dispose(); this.bots.length = 0; },
  _bots(dt) {
    if (!this.bots.length) return; const G = this.G, w = G.world, P = G.player, half = w.half - 7, st = this.st, inPlay = st.ph === 'play';
    for (const b of this.bots) {
      const inf = inPlay && this.isInf(b.id); b.t -= dt;
      if (b.t <= 0) { b.t = 0.25 + Math.random() * 0.15;
        let tx = 0, tz = 0, best = 1e9; const targets = [];
        if (inPlay) { if (inf) { if (!this.myInf) targets.push(P.pos); for (const o of this.bots) if (o !== b && !this.isInf(o.id)) targets.push(_n.set(o.x, o.y, o.z).clone()); }
          else { if (this.myInf) targets.push(P.pos); for (const o of this.bots) if (o !== b && this.isInf(o.id)) targets.push(_n.set(o.x, o.y, o.z).clone()); } }
        for (const p of targets) { const d = Math.hypot(p.x - b.x, p.z - b.z); if (d < best) { best = d; tx = p.x - b.x; tz = p.z - b.z; } }
        if (inf && best < 1e9 && now() >= st.grace) { const l = Math.hypot(tx, tz) || 1; b.dx = tx / l; b.dz = tz / l; b.chase = true; }
        else if (!inf && inPlay && best < 15) { const l = Math.hypot(tx, tz) || 1; const side = Math.sin(b.x * 0.3 + b.z * 0.2) > 0 ? 1 : -1; b.dx = -tx / l + tz / l * 0.45 * side; b.dz = -tz / l - tx / l * 0.45 * side; b.chase = true; }
        else { b.chase = false; if (Math.random() < 0.08 || (!b.dx && !b.dz)) { const a = Math.random() * Math.PI * 2; b.dx = Math.cos(a); b.dz = Math.sin(a); } }
        if (Math.abs(b.x) > half - 4) b.dx -= Math.sign(b.x) * 0.9; if (Math.abs(b.z) > half - 4) b.dz -= Math.sign(b.z) * 0.9;
        const l = Math.hypot(b.dx, b.dz) || 1; b.dx /= l; b.dz /= l;
        // travou? muda de direção e pula
        if (Math.hypot(b.x - b.lx, b.z - b.lz) < 0.25 && b.chase !== undefined) { b.stuckT += 0.3; if (b.stuckT > 0.8) { const a = Math.random() * Math.PI * 2; b.dx = Math.cos(a); b.dz = Math.sin(a); b.stuckT = 0; if (b.vy === 0) b.vy = 5.2; } } else b.stuckT = 0; b.lx = b.x; b.lz = b.z;
      }
      const sp = (inPlay || st.ph === 'count' ? b.sp : b.sp * 0.4) * (inf ? 1.05 : 1) * (b.y < w.waterY ? 0.55 : 1) * (inPlay && inf && now() < st.grace ? 0 : 1);
      b.x += b.dx * sp * dt; b.z += b.dz * sp * dt;
      _a.set(b.x, b.y + 0.5, b.z); w.collide(_a, 0.42, _n); b.x = clamp(_a.x, -half, half); b.z = clamp(_a.z, -half, half);
      const fl = w.floorAt(b.x, b.y + 0.75, b.z); if (fl > b.y && fl - b.y < 0.8 && b.vy <= 0) { b.y = fl; b.vy = 0; } else { b.vy -= 18 * dt; b.y += b.vy * dt; if (b.y <= fl) { b.y = fl; b.vy = 0; } }
      if (b.y < -20) { b.x = 0; b.z = 30; b.y = w.floorAt(0, 30, 30); }
      const av = b.av; av.root.position.set(b.x, b.y, b.z); const want = Math.atan2(-b.dx, -b.dz); av.root.rotation.y += Math.atan2(Math.sin(want - av.root.rotation.y), Math.cos(want - av.root.rotation.y)) * Math.min(1, dt * 10);
      av.speed = sp; av.grounded = b.vy === 0; const far = Math.hypot(b.x - P.pos.x, b.z - P.pos.z) > 40; b.near = !far; av.update(dt, far);
      // bot infectado pega outros bots
      if (inf && now() >= st.grace) for (const o of this.bots) if (o !== b && !this.isInf(o.id) && Math.hypot(o.x - b.x, o.z - b.z) < 0.85 && Math.abs(o.y - b.y) < 1.3) this.tag(o.id, b.id);
    }
    function now() { return net.online ? net.now() : Date.now(); }
  },
  hands(hp) { for (const b of this.bots) { if (!b.near) continue; b.av.procHands(_a, _b); const c = b.av.look.inf ? '#7d9a5a' : b.av.look.fur; hp.hand(_a.x, _a.y, _a.z, HAND_R * b.av.scale, c); hp.hand(_b.x, _b.y, _b.z, HAND_R * b.av.scale, c); hp.blob(b.x, b.y, b.z, 0.34); } }
};
