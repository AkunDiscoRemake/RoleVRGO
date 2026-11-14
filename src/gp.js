import * as THREE from 'three';
import { MAPS, MAP_ORDER, MAP_ICONS, PORTAL_COLORS } from './maps.js';
import { CatAvatar, FUR_COLORS } from './cat.js';
import { mounts, MOUNT_BY, buildRig } from './mounts.js';
import { net } from './net.js';
import { S } from './state.js';
import { emit, clamp } from './util.js';
import { play, chime, whoosh, boing } from './assets.js';
import { WALK_SPEED } from './config.js';

// 🏁 Grande Prêmio Arco-Íris: circuito sinuoso com 3 modos. Contra bot (5 dificuldades), contra jogadores
// reais (largada sincronizada pelo anfitrião = menor id) e treino. A velocidade do bot é calculada a partir da
// velocidade máxima do PRÓPRIO jogador (montaria, PC ou VR): até o Extremo o bot é mais lento que você; o
// Impossível é um pouco mais rápido e só perde para quem usa os turbos (o bot não usa).
const PI = Math.PI, H = PI / 2, LAPS = 2, NG = 8;
const T = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const C = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
function mix(c, a, b, t) { c[0] = a[0] + (b[0] - a[0]) * t; c[1] = a[1] + (b[1] - a[1]) * t; c[2] = a[2] + (b[2] - a[2]) * t; }
export const DIFFS = [
  { n: 'Fácil', i: '🟢', k: 0.55, mount: 'gatao', coins: 20 }, { n: 'Normal', i: '🔵', k: 0.72, mount: 'skate', coins: 40 }, { n: 'Difícil', i: '🟠', k: 0.86, mount: 'tigre', coins: 70 },
  { n: 'Extremo', i: '🔴', k: 0.96, mount: 'pantera', coins: 110 }, { n: 'Impossível', i: '💀', k: 1.04, mount: 'dragao', coins: 180 }
];
// ---------- pista (Catmull-Rom fechada) ----------
const CP = [[0, 42], [36, 44], [58, 26], [52, 2], [26, -6], [14, -30], [-14, -46], [-44, -36], [-58, -8], [-44, 14], [-22, 22], [-16, 40]];
const N = 720, PX = new Float32Array(N), PZ = new Float32Array(N), CUM = new Float32Array(N + 1);
(function build() { const n = CP.length; for (let i = 0; i < N; i++) { const u = i / N * n, k = Math.floor(u), t = u - k, p0 = CP[(k - 1 + n) % n], p1 = CP[k % n], p2 = CP[(k + 1) % n], p3 = CP[(k + 2) % n], t2 = t * t, t3 = t2 * t;
  for (let d = 0; d < 2; d++) { const v = 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3); if (d) PZ[i] = v; else PX[i] = v; } }
  for (let i = 0; i < N; i++) { const j = (i + 1) % N; CUM[i + 1] = CUM[i] + Math.hypot(PX[j] - PX[i], PZ[j] - PZ[i]); } })();
const L = CUM[N];
export function pt(s) { s = ((s % L) + L) % L; let lo = 0, hi = N; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (CUM[m] <= s) lo = m; else hi = m; } const j = (lo + 1) % N, f = (s - CUM[lo]) / (CUM[lo + 1] - CUM[lo] || 1); return [PX[lo] + (PX[j] - PX[lo]) * f, PZ[lo] + (PZ[j] - PZ[lo]) * f]; }
export function dirAt(s) { const a = pt(s), b = pt(s + 0.6), l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; }
function nearest(x, z, step) { let best = 0, bd = 1e9; for (let i = 0; i < N; i += step || 1) { const d = (PX[i] - x) * (PX[i] - x) + (PZ[i] - z) * (PZ[i] - z); if (d < bd) { bd = d; best = i; } } return { i: best, s: CUM[best], d: Math.sqrt(bd) }; }
const GATES = Array.from({ length: NG }, (_, k) => k * L / NG), PADS = [0.08, 0.3, 0.55, 0.8].map((f) => f * L);
const mmss = (t) => { const m = Math.floor(t / 60), s2 = t - m * 60; return m + ':' + (s2 < 10 ? '0' : '') + s2.toFixed(1).replace('.', ','); };
const ORD = ['1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º'];

MAPS.gp = {
  name: 'Grande Prêmio Arco-Íris', size: 180, surface: 'grass', sky: [0x8fd8ff, 0xffc0a0, 0x0b1230], fog: 1.2, spawn: [0, 54, PI], gp: true,
  build(w, E, r) {
    w.heightFn = (x, z) => { const d = Math.max(Math.abs(x), Math.abs(z)); return d > 80 ? Math.min(10, (d - 80) * (d - 80) * 0.08) : 0; };
    const asp = C(0x34343e), g1 = C(0x7fd05a), g2 = C(0x6cbf4c), RB = [0xff4a4a, 0xffa040, 0xffe050, 0x5adf6a, 0x4aa8ff, 0xa060ff].map(C), wht = C(0xf4f4f4);
    w.buildGround(120, (x, z, h, c) => { const n = nearest(x, z, 3); if (n.d < 5.4) { mix(c, asp, asp, 0); const sg = ((n.s % L) + L) % L; if (sg < 1.4 || sg > L - 1.4) mix(c, c, (Math.floor(x * 1.6) + Math.floor(z * 1.6)) & 1 ? wht : C(0x111111), 1); } else if (n.d < 6.4) mix(c, c, RB[Math.floor(n.s / 2.5) % 6], 1); else mix(c, g1, g2, (Math.floor((x + z) / 6) & 1) * 0.5); });
    // cercas (abertura perto da entrada)
    for (let s = 0; s < L; s += 3.6) { const [x, z] = pt(s), [dx, dz] = dirAt(s), ry = Math.atan2(-dz, dx); for (const sd of [-1, 1]) { const qx = x - dz * 7.6 * sd, qz = z + dx * 7.6 * sd; if (nearest(qx, qz, 4).d < 6.8) continue; if (Math.hypot(qx - 0, qz - 50) < 6) continue; w.put('nature/fence_simple', qx, qz, { s: 3.6, ry, col: 'box', tint: sd > 0 ? [1.5, 1.5, 1.5] : [1.3, 0.7, 1.4] }); } }
    // portais de checkpoint com cores do arco-íris
    GATES.forEach((s, k) => { const [x, z] = pt(s), [dx, dz] = dirAt(s), ry = Math.atan2(-dz, dx), col = k ? [0xff4a4a, 0xffa040, 0xffe050, 0x5adf6a, 0x4aa8ff, 0xa060ff, 0xff60c0][(k - 1) % 7] : 0xffd040;
      for (const sd of [-1, 1]) w.put('prim/box', x - dz * 6.4 * sd, z + dx * 6.4 * sd, { s: [0.7, 4.8, 0.7], abs: 0, tint: T(k ? 0x4a4a5a : 0x1a1a1a), col: 'box' });
      w.put('prim/box', x, z, { s: [0.7, 0.7, 13.4], ry, abs: 4.6, tint: T(col) }); E.lamp(x, 5.5, z, col); if (!k) E.sign('🏁 LARGADA / CHEGADA', x, 6.3, z); });
    for (const s of PADS) { const [x, z] = pt(s), [dx, dz] = dirAt(s), ry = Math.atan2(-dz, dx); w.put('prim/box', x, z, { s: [3.6, 0.06, 4.4], ry, abs: 0.01, tint: [2, 1.7, 0.3] }); for (let k = -1; k <= 1; k++) w.put('prim/cone', x + dx * k * 1.2, z + dz * k * 1.2, { s: [0.9, 0.08, 0.9], abs: 0.08, tint: [2, 1.2, 0.2] }); E.lamp(x, 0.6, z, 0xffd040); }
    // grid de largada pintado, arquibancada, quiosque de modos e decoração
    const [sx0, sz0] = pt(0), [ddx, ddz] = dirAt(0); for (let k = 1; k <= 4; k++) for (const sd of [-1, 1]) w.put('prim/box', sx0 - ddx * k * 3.2 - ddz * 2.4 * sd, sz0 - ddz * k * 3.2 + ddx * 2.4 * sd, { s: [1.6, 0.03, 0.2], ry: Math.atan2(-ddz, ddx), abs: 0.02, tint: [1.8, 1.8, 1.8] });
    for (let row = 0; row < 5; row++) w.put('prim/box', 18, 56 + row * 1.4, { s: [30, 0.6 + row * 0.6, 1.4], abs: 0, tint: T([0xff4a4a, 0x4aa8ff, 0xffe050, 0x5adf6a, 0xa060ff][row]), col: 'box' });
    w.put('prim/box', -8, 52, { s: [3, 2.2, 2], abs: 0, tint: T(0x3a3a5a), col: 'box' }); w.put('prim/box', -8, 52, { s: [3.2, 0.2, 2.2], abs: 2.2, tint: T(0xffd040) }); E.sign('🎮 Modos de corrida: menu rápido', -8, 3.4, 52); E.lamp(-8, 2.8, 51, 0xffd040);
    E.npc('gpbot', 'Mecânica Faísca', 'Grande Prêmio', -11, 50, { fur: '#f08a2a', fur2: '#3b3b45', pattern: 4, eyes: '#4aa3e0', hat: 5 }, { lines: ['Escolha o modo no menu rápido: contra bot, contra jogadores ou treino!', 'Todo bot dá para vencer. O Impossível só perde para quem pega TODOS os turbos.', 'Duas voltas, passando pelos 8 portais coloridos em ordem.'], wander: 0 });
    E.portal('village', 8, 60);
    for (let i = 0; i < 46; i++) { const a = r() * PI * 2, d = 12 + r() * 66, x = Math.cos(a) * d, z = Math.sin(a) * d; if (nearest(x, z, 6).d < 11 || Math.hypot(x - 10, z - 54) < 22) continue; w.put(['nature/tree_default', 'nature/tree_fat', 'nature/tree_oak'][i % 3], x, z, { s: 3.6 + r() * 1.5, col: 'trunk', cw: 0.1 }); }
  },
  after(G, add) { // arcos de arco-íris sobre a pista
    this.arches = []; const cols = [0xff4a4a, 0xffa040, 0xffe050, 0x5adf6a, 0x4aa8ff, 0xa060ff];
    for (const f of [0.18, 0.43, 0.68, 0.93]) { const s = f * L, [x, z] = pt(s), [dx, dz] = dirAt(s); const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = Math.atan2(dx, dz) + H;
      cols.forEach((c, i) => { const m = new THREE.Mesh(new THREE.TorusGeometry(8.4 - i * 0.35, 0.18, 6, 32, PI), new THREE.MeshBasicMaterial({ color: c, fog: false })); grp.add(m); }); add(grp); for (const m of grp.children) G.world.extra.push(m); }
    gp.enter(G);
  },
  tick(dt, G) { gp.tick(dt, G); },
  amb() { return { wind: 0.25 }; }
};

// ---------- corrida ----------
export const gp = {
  G: null, active: false, mode: null, diff: 0, ph: 'idle', t0: 0, cd: 0, lap: 0, next: 1, fin: 0, bot: null, others: {}, start: null, sendT: 0, result: '',
  enter(G) { this.G = G; this.active = true; this.reset(); this.mode = null; emit('gpChoose'); },
  leave() { if (!this.active) return; this.active = false; this.reset(); MAPS.gp.netKey = undefined; },
  reset() { if (this.bot) { this.bot.av.dispose(); if (this.bot.rig) this.bot.rig.dispose(); } this.bot = null; this.ph = 'idle'; this.lap = 0; this.next = 1; this.fin = 0; this.others = {}; this.start = null; this.result = ''; if (this.G) { this.G.player.frozen = false; this.G.modeLabel = ''; } },
  me() { return net.id || 'me'; },
  host() { let h = this.me(); this.G.remotes.forEach((r, id) => { if (id < h) h = id; }); return h; },
  cruise() { const m = mounts.cur(); return WALK_SPEED * (m ? m.speed : 1) * (this.G.player.desktop ? 1.5 : 1); }, // sua velocidade máxima sem turbo
  choose(mode, diff) {
    const G = this.G; this.reset(); this.mode = mode; this.diff = diff || 0;
    MAPS.gp.netKey = mode === 'mp' ? undefined : 'gp_solo_' + this.me().slice(0, 8); if (net.online) { net.join(G.room, MAPS.gp.netKey || 'gp', G.roomPublic); G.pushMeta(); }
    if (mode === 'bot') this.countdown([this.me(), 'bot']);
    else if (mode === 'solo') this.countdown([this.me()]);
    else S.toast('👥 Corrida com jogadores: quando todos estiverem prontos, toque em "Largar"', '#9cf09c');
  },
  // multiplayer: qualquer um pede a largada; o anfitrião confirma para todos
  requestStart() { if (this.mode !== 'mp') return; if (this.host() === this.me()) this.hostStart(); else net.send('gp', { k: 'go' }); },
  hostStart() { const ids = [this.me()]; this.G.remotes.forEach((r, id) => { if (r.has) ids.push(id); }); if (ids.length < 2) { S.toast('Precisa de pelo menos 2 jogadores no mapa', '#ff9a8a'); return; } const at = net.now() + 4000; net.send('gp', { k: 'start', at, ids }); this.countdown(ids, at); },
  onNet(e) { if (!this.active || this.mode !== 'mp' || !e) return;
    if (e.k === 'go' && this.host() === this.me() && this.ph !== 'count' && this.ph !== 'race') this.hostStart();
    else if (e.k === 'start' && Array.isArray(e.ids) && e.ids.indexOf(this.me()) >= 0 && e.f === this.host()) this.countdown(e.ids.filter((x) => typeof x === 'string').slice(0, 8), Number(e.at) || net.now() + 3000);
    else if (e.k === 'p' && typeof e.pr === 'number') { const o = this.others[e.f] || (this.others[e.f] = {}); o.pr = clamp(e.pr, 0, LAPS * NG + 1); if (typeof e.fin === 'number' && e.fin > 0 && !o.fin) { o.fin = e.fin; if (this.fin && this.mode === 'mp' && e.fin < this.fin) this.mpResult(); } } },
  mpResult() { let place = 1; for (const id in this.others) { const o = this.others[id]; if (o.fin && o.fin < this.fin) place++; } this.result = '🏁 ' + ORD[place - 1] + ' de ' + (1 + Object.keys(this.others).length) + ' · ' + mmss(this.fin); return place; },
  countdown(ids, at) {
    const G = this.G, P = G.player; this.ph = 'count'; this.ids = ids; this.lap = 0; this.next = 1; this.fin = 0; this.result = ''; this.startAt = at || (net.online ? net.now() : Date.now()) + 3500; this._beep = 4;
    const slot = Math.max(0, ids.indexOf(this.me())); this.place(P, slot, true); P.frozen = true;
    if (ids.indexOf('bot') >= 0) { const d = DIFFS[this.diff]; const look = { fur: FUR_COLORS[(this.diff * 3 + 1) % FUR_COLORS.length], fur2: '#f5f1e8', pattern: this.diff % 6, eyes: '#e0b030', hat: [5, 1, 7, 11, 2][this.diff], outfit: [4, 5, 9, 12, 1][this.diff], laser: this.diff === 4 ? 1 : 0 };
      const av = new CatAvatar(look, '🤖 Bot ' + d.n, { tagColor: ['#9cf09c', '#8fd0ff', '#ffb070', '#ff8a8a', '#c8a0ff'][this.diff], sub: d.i + ' ' + d.n }); G.scene.add(av.root); const rig = buildRig(MOUNT_BY[d.mount]); G.scene.add(rig.root);
      this.bot = { av, rig, s: -3.2 * 2, lane: -2.4, sp: 0, fin: 0, h: MOUNT_BY[d.mount].h }; this.posBot(0); }
  },
  place(P, slot, face) { const back = -3.2 * (1 + Math.floor(slot / 2)), sd = slot % 2 ? -2.4 : 2.4, [x, z] = pt(back), [dx, dz] = dirAt(back); P.teleport(x - dz * sd, 0.3, z + dx * sd, face ? Math.atan2(-dx, -dz) : P.yaw); },
  posBot(dt) { const b = this.bot, [x, z] = pt(b.s), [dx, dz] = dirAt(b.s), px = x - dz * b.lane, pz = z + dx * b.lane, yaw = Math.atan2(-dx, -dz);
    b.rig.root.position.set(px, 0, pz); b.rig.root.rotation.y = yaw; b.av.root.position.set(px, b.h, pz); b.av.root.rotation.y = yaw; b.av.speed = b.sp; b.av.grounded = true; if (b.av.emote !== 3) b.av.setEmote(3); b.av.bubble = ''; b.av.update(dt, false); b.rig.update(dt, b.sp, false); },
  now() { return net.online ? net.now() : Date.now(); },
  progress() { return this.lap * NG + ((this.next + NG - 1) % NG) + this.frac(); },
  frac() { const P = this.G.player.pos, n = nearest(P.x, P.z, 2), g0 = GATES[(this.next + NG - 1) % NG]; let ds = n.s - g0; if (ds < -L / 2) ds += L; return clamp(ds / (L / NG), 0, 0.99); },
  tick(dt, G) {
    if (!this.active) return; const P = G.player, p = P.pos;
    for (const s of PADS) { const [x, z] = pt(s); if (Math.hypot(p.x - x, p.z - z) < 2.4 && !(G.trackBoost > 1.2)) { G.trackBoost = 1.6; whoosh(0.6); G.fx.burst(x, 0.5, z, 0xffd040, 16, 4, 1); } }
    if (this.ph === 'count') { const left = (this.startAt - this.now()) / 1000; const n = Math.ceil(left); if (n !== this._beep && n >= 0 && n <= 3) { this._beep = n; if (n > 0) { chime(1, 0.6); emit('banner', '🏁 ' + n, 0.9); } } if (this.bot) this.posBot(dt);
      G.modeLabel = '🏁 Largada em ' + Math.max(0, n) + '…'; if (left <= 0) { this.ph = 'race'; this.t0 = G.time; P.frozen = false; emit('banner', '🏁 VAI!', 1.2); play('confirm', 0.8); boing(0.5); } return; }
    if (this.ph !== 'race') { G.modeLabel = this.result || (this.mode === 'mp' ? '👥 Corrida com jogadores · peça a largada no menu' : this.mode ? '🏁 Corrida terminada · menu rápido para correr de novo' : '🏁 Grande Prêmio: escolha o modo no menu rápido'); return; }
    // bot: segue a pista na velocidade da dificuldade (um pouco mais devagar se abrir muita vantagem)
    if (this.bot && !this.bot.fin) { const b = this.bot, d = DIFFS[this.diff], ahead = b.s / (L / NG) - this.progress(); const target = this.cruise() * d.k * (ahead > NG / 4 ? 0.9 : 1); b.sp += (target - b.sp) * Math.min(1, dt * 1.5); b.s += b.sp * dt; if (b.s >= LAPS * L) { b.fin = G.time - this.t0; if (!this.fin) S.toast('🤖 O bot ' + d.n + ' cruzou a linha em ' + mmss(b.fin), '#ff9a8a'); } }
    if (this.bot) this.posBot(dt);
    // checkpoints do jogador
    const g = pt(GATES[this.next]); if (!this.fin && Math.hypot(p.x - g[0], p.z - g[1]) < 7.4) {
      if (this.next === 0) { this.lap++; if (this.lap >= LAPS) this.finish(G); else { this.next = 1; emit('banner', '🔁 Última volta!', 1.6); chime(3, 0.7); } }
      else { chime(this.next, 0.5); G.fx.burst(g[0], 4.6, g[1], 0x80e8ff, 12, 3, 1); this.next = (this.next + 1) % NG; } }
    // multiplayer: manda o progresso
    if (this.mode === 'mp') { this.sendT -= dt; if (this.sendT <= 0) { this.sendT = 0.5; net.send('gp', { k: 'p', pr: this.fin ? LAPS * NG + 1 : this.progress(), fin: this.fin || 0 }); } }
    // colocação
    const mine = this.fin ? LAPS * NG + 1 - this.fin / 1000 : this.progress(); let place = 1;
    if (this.bot) { const bp = this.bot.fin ? LAPS * NG + 1 - this.bot.fin / 1000 : this.bot.s / (L / NG); if (bp > mine) place++; }
    for (const id in this.others) { if (!G.remotes.has(id)) continue; const o = this.others[id], op = o.fin ? LAPS * NG + 1 - o.fin / 1000 : o.pr || 0; if (op > mine) place++; }
    this.place_ = place; const tot = 1 + (this.bot ? 1 : 0) + Object.keys(this.others).filter((id) => G.remotes.has(id)).length;
    G.modeLabel = this.fin ? '🏁 Você terminou em ' + ORD[place - 1] + ' · ' + mmss(this.fin) : '🏁 Volta ' + Math.min(LAPS, this.lap + 1) + '/' + LAPS + '  ·  ' + ORD[place - 1] + ' de ' + tot + '  ·  ' + mmss(G.time - this.t0);
    if (this.fin && (!this.bot || this.bot.fin) && this.mode !== 'mp') this.ph = 'done';
  },
  finish(G) {
    const t = G.time - this.t0; this.fin = t; G._confetti && G._confetti(30); const tot = 1 + (this.bot ? 1 : 0) + Object.keys(this.others).length;
    let place = 1; if (this.bot && this.bot.fin && this.bot.fin < t) place++; for (const id in this.others) { const o = this.others[id]; if (o.fin && o.fin < t) place++; }
    if (this.mode === 'bot') { const d = DIFFS[this.diff]; if (place === 1) { emit('banner', '🥇 Você venceu o bot ' + d.n + '!', 4); S.addCoins(d.coins); S.addXp(d.coins); S.stat('gpWin'); S.setStat('gpBest', Math.max(S.d.stats.gpBest || 0, this.diff + 1)); play('win', 0.8); } else { emit('banner', '🥈 O bot ' + d.n + ' venceu. Tente de novo!', 4); S.addXp(10); play('quest', 0.5); } this.result = (place === 1 ? '🥇 Venceu' : '🥈 Perdeu') + ' do bot ' + d.n + ' · ' + mmss(t); }
    else if (this.mode === 'mp') { emit('banner', (place === 1 ? '🥇 ' : place === 2 ? '🥈 ' : place === 3 ? '🥉 ' : '🏁 ') + ORD[place - 1] + ' lugar! ' + mmss(t), 4); S.addCoins([60, 35, 20][place - 1] || 10); S.addXp(40); if (place === 1) { S.stat('gpMpWin'); play('win', 0.8); } else play('quest', 0.6); this.result = '🏁 ' + ORD[place - 1] + ' de ' + tot + ' · ' + mmss(t); }
    else { emit('banner', '⏱ Treino: ' + mmss(t), 3); S.addXp(15); this.result = '⏱ Treino: ' + mmss(t); }
    S.stat('gpRaces'); S.touch();
  }
};
for (const id of ['gp']) if (MAP_ORDER.indexOf(id) < 0) MAP_ORDER.push(id);
Object.assign(MAP_ICONS, { gp: '🌈' }); Object.assign(PORTAL_COLORS, { gp: 0xff60c0 });
gp.pt = pt; gp.L = L; // usado por testes e pela câmera
