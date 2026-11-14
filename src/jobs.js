import * as THREE from 'three';
import { S } from './state.js';
import { net } from './net.js';
import { ITEMS } from './data.js';
import { emit, clamp } from './util.js';
import { play, siren, whistle, chime, splashSfx } from './assets.js';

// Profissões de roleplay: cada uma tem uniforme, ações próprias e "salário" (moedas + XP por ação).
// Lojinha: com um Caixa na casa, o dono vende itens da bolsa para quem visita (compra entre jogadores reais).
export const JOBS = [
  { id: '', n: 'Sem profissão', i: '🐱', d: 'Escolha uma profissão para fazer roleplay e ganhar salário' },
  { id: 'chef', n: 'Cozinheiro(a)', i: '👨‍🍳', outfit: 11, hat: 10, d: 'Cozinhe pratos com o que pesca e coleta e venda na lojinha' },
  { id: 'vendedor', n: 'Vendedor(a)', i: '🛍️', outfit: 14, d: 'Lojinha na sua casa: +25% de bônus em cada venda' },
  { id: 'medico', n: 'Médico(a)', i: '🩺', outfit: 8, d: 'Cure os jogadores que estiverem perto' },
  { id: 'policial', n: 'Policial', i: '👮', outfit: 12, hat: 11, d: 'Sirene, apito e salário por patrulhar' },
  { id: 'bombeiro', n: 'Bombeiro(a)', i: '🚒', outfit: 13, hat: 12, d: 'Apague fogueiras com a mangueira' },
  { id: 'entregador', n: 'Entregador(a)', i: '📦', outfit: 5, d: 'Leve encomendas até os NPCs do mapa' },
  { id: 'professor', n: 'Professor(a)', i: '📚', outfit: 9, d: 'Dê aulas: quem está perto ganha XP' }
];
export const JOB_BY = {}; for (const j of JOBS) JOB_BY[j.id] = j;
export const COOK = [{ id: 'sushi', need: { tilapia: 1 }, n: 2 }, { id: 'grilled', need: { sardine: 1, wood: 1 }, n: 1 }, { id: 'soup', need: { mushroom: 2 }, n: 1 }, { id: 'pie', need: { pumpkin: 2, flower: 1 }, n: 1 }, { id: 'juice', need: { cactusfruit: 2 }, n: 1 }, { id: 'icecream', need: { snowbell: 2 }, n: 1 }];
const SELLABLE = ['food', 'fish', 'forage', 'ore', 'gem', 'treasure'];
export const priceOf = (id) => Math.max(3, Math.ceil((ITEMS[id] ? ITEMS[id].v : 5) * 1.5));

export const jobs = {
  G: null, siren: false, sirT: 0, hoseT: 0, deliv: null, cd: {}, patrol: 0, lastPos: null, shopList: null, shopOwner: null, sales: 0, lights: new Map(),
  init(G) { this.G = G; },
  cur() { return JOB_BY[S.d.job || ''] || JOBS[0]; },
  sub(meta) { const j = JOB_BY[(meta && meta.job) || '']; return j && j.id ? j.i + ' ' + j.n : null; }, // texto embaixo do nome
  set(id) { const j = JOB_BY[id]; if (!j) return; S.d.job = id; if (id !== 'policial') this.siren = false; this.deliv = null; S.touch(); emit('meta'); emit('job'); S.toast(id ? '💼 Agora você é ' + j.i + ' ' + j.n + '!' : 'Sem profissão', '#9cf09c'); play('confirm', 0.6); },
  uniform() { const j = this.cur(); if (!j.id) return; const L = S.look; if (j.outfit != null) L.outfit = j.outfit; if (j.hat) { L.hat = j.hat; if (S.d.hats.indexOf(j.hat) < 0) S.d.hats.push(j.hat); } emit('wearLook'); S.toast('👔 Uniforme vestido!', '#9cf09c'); play('cloth', 0.6); },
  pay(n, why) { S.addCoins(n); S.addXp(Math.round(n * 1.5)); S.stat('jobActs'); S.toast('💼 +' + n + ' moedas · ' + why, '#ffd76a'); play('coin', 0.5); },
  ready(k, secs) { const t = performance.now() / 1000; if (this.cd[k] && t - this.cd[k] < secs) return Math.ceil(secs - (t - this.cd[k])); this.cd[k] = t; return 0; },
  nearest(maxD) { const P = this.G.player.pos; let best = null, bd = maxD; this.G.remotes.forEach((r) => { if (!r.has) return; const d = Math.hypot(r.x - P.x, r.z - P.z); if (d < bd) { bd = d; best = r; } }); return best; },
  // ---------- ações ----------
  cook(rec) { for (const k in rec.need) if (S.count(k) < rec.need[k]) return 'Faltam ingredientes'; for (const k in rec.need) S.removeItem(k, rec.need[k]); S.addItem(rec.id, rec.n); const p = this.G.player.pos; this.G.fx.burst(p.x, p.y + 1.2, p.z, 0xffc070, 14, 2, -1); play('pickup', 0.6); this.pay(3, 'cozinhou ' + ITEMS[rec.id].n); emit('inv'); return ''; },
  heal() { const r = this.nearest(3.5); if (!r) return 'Chegue perto de um jogador (até 3 m)'; const w = this.ready('heal' + r.id, 20); if (w) return 'Esse paciente acabou de ser atendido (' + w + ' s)'; net.send('heal', { to: r.id }); this.G.fx.burst(r.x, r.y + 1, r.z, 0x80ff90, 24, 3, -1); play('heart', 0.7); this.pay(6, 'atendeu ' + r.meta.name); return ''; },
  toggleSiren() { this.siren = !this.siren; emit('meta'); if (this.siren) siren(0.6); this.sirT = 0; },
  whistle() { whistle(0.7); net.send('whistle', {}); },
  hose() { if (this.hoseT > 0) return ''; this.hoseT = 5; splashSfx(0.6); return ''; },
  takeDelivery() { const npcs = this.G.npcs.filter((n) => Math.hypot(n.x - this.G.player.pos.x, n.z - this.G.player.pos.z) > 12); if (!npcs.length) return 'Nenhum NPC longe o bastante neste mapa (vá para a Vila)'; const n = npcs[Math.floor(Math.random() * npcs.length)]; this.deliv = { n }; S.toast('📦 Leve a encomenda para ' + n.name + ' (siga o brilho!)', '#ffd76a'); play('book', 0.6); return ''; },
  teach() { const w = this.ready('teach', 45); if (w) return 'Próxima aula em ' + w + ' s'; let n = 0; const P = this.G.player.pos; this.G.remotes.forEach((r) => { if (r.has && Math.hypot(r.x - P.x, r.z - P.z) < 8) n++; }); net.send('class', {}); chime(2, 0.7); this.G.fx.burst(P.x, P.y + 2, P.z, 0xffe070, 20, 3, -1); this.pay(4 + n * 2, 'aula para ' + n + ' aluno(s)'); return ''; },
  // ---------- eventos de outros jogadores ----------
  onNet(e) {
    const G = this.G, r = G.remotes.get(e.f); if (!r) return; const me = net.id;
    if (e.t === 'heal' && e.to === me) { S.hp = S.maxHp(); emit('hp'); const p = G.player.pos; G.fx.burst(p.x, p.y + 1, p.z, 0x80ff90, 30, 3, -1); play('heart', 0.7); S.toast('🩺 ' + r.meta.name + ' curou você!', '#80ff90'); }
    else if (e.t === 'class') { if (Math.hypot(r.x - G.player.pos.x, r.z - G.player.pos.z) < 8) { S.addXp(15); S.toast('📚 Aula de ' + r.meta.name + ': +15 XP', '#ffe070'); chime(1, 0.5); } }
    else if (e.t === 'whistle') { if (Math.hypot(r.x - G.player.pos.x, r.z - G.player.pos.z) < 30) whistle(0.4); }
    else if (e.t === 'ext') G._delProp && G._delProp(e.id);
    // lojinha
    else if (e.t === 'shopq' && e.to === me) { if (!this.shopOpenHere()) { net.send('shopl', { to: e.f, closed: 1 }); return; } net.send('shopl', { to: e.f, items: this.stock() }); }
    else if (e.t === 'shopl' && e.to === me) { this.shopList = e.closed ? [] : (Array.isArray(e.items) ? e.items.filter((a) => Array.isArray(a) && ITEMS[a[0]] && a[1] > 0).slice(0, 30) : []); this.shopClosed = !!e.closed; this.shopOwner = e.f; emit('shop'); }
    else if (e.t === 'buy' && e.to === me) { const id = e.id, pr = priceOf(id); if (!this.shopOpenHere() || !ITEMS[id] || !(S.d.shop && S.d.shop[id]) || S.count(id) < 1 || e.price !== pr) { net.send('sold', { to: e.f, id, fail: 1 }); return; }
      S.removeItem(id, 1); const bonus = S.d.job === 'vendedor' ? Math.ceil(pr * 0.25) : 0; S.addCoins(pr + bonus); this.sales++; S.stat('jobActs'); S.stat('shopSales'); S.toast('🛒 ' + r.meta.name + ' comprou ' + ITEMS[id].n + ': +' + (pr + bonus) + ' moedas' + (bonus ? ' (com bônus)' : ''), '#ffd76a'); play('coin', 0.7); emit('inv'); net.send('sold', { to: e.f, id, price: pr }); net.send('shopl', { to: e.f, items: this.stock() }); }
    else if (e.t === 'sold' && e.to === me) { if (e.fail) { S.toast('Não deu: o item acabou ou a loja fechou', '#ff9a8a'); return; } if (!ITEMS[e.id] || typeof e.price !== 'number') return; S.d.coins = Math.max(0, S.d.coins - e.price); S.addItem(e.id, 1); S.touch(); emit('coins'); emit('inv'); S.toast('🛍️ Você comprou ' + ITEMS[e.id].n + '!', '#9cf09c'); play('pickup', 0.7); }
  },
  // ---------- lojinha ----------
  shopOpenHere() { const G = this.G; return G.mapId === 'home' && G.def && G.def.mine && G.def.acts && G.def.acts.some((a) => a.act === 'shop'); },
  sellable(id) { return ITEMS[id] && SELLABLE.indexOf(ITEMS[id].k) >= 0; },
  stock() { const out = []; const sh = S.d.shop || {}; for (const id in sh) if (sh[id] && S.count(id) > 0 && this.sellable(id)) out.push([id, S.count(id), priceOf(id)]); return out; },
  toggleSale(id) { S.d.shop = S.d.shop || {}; S.d.shop[id] = !S.d.shop[id]; S.touch(); },
  ask(owner) { this.shopList = null; this.shopOwner = owner; net.send('shopq', { to: owner }); },
  buy(id) { const pr = priceOf(id); if (S.d.coins < pr) return 'Moedas insuficientes'; net.send('buy', { to: this.shopOwner, id, price: pr }); return ''; },
  // ---------- por quadro ----------
  update(dt) {
    const G = this.G, P = G.player, j = S.d.job || '';
    if (this.siren) { this.sirT -= dt; if (this.sirT <= 0) { this.sirT = 7; siren(0.35); } if (j !== 'policial') this.siren = false; }
    // patrulha: policial com sirene ligada que anda bastante ganha a cada minuto
    if (j === 'policial' && this.siren) { if (this.lastPos) this.patrol += Math.min(5, P.pos.distanceTo(this.lastPos)); this.patT = (this.patT || 0) + dt; if (this.patT >= 60) { if (this.patrol > 60) this.pay(3, 'patrulha'); this.patT = 0; this.patrol = 0; } }
    this.lastPos = (this.lastPos || P.pos.clone()).copy(P.pos);
    // mangueira: jatos d'água da pata, apaga fogueiras à frente
    if (this.hoseT > 0) { this.hoseT -= dt; const h = P.hands[0].pos, d = P.aimDir; for (let k = 0; k < 3; k++) G.fx.streak(h.x, h.y, h.z, d.x * 9 + (Math.random() - 0.5), d.y * 9 + 1 + Math.random(), d.z * 9 + (Math.random() - 0.5), 0x80d8ff, 0.5);
      G.props.forEach((p, k) => { if (p.k !== 'fire') return; const dx = p.x - P.pos.x, dz = p.z - P.pos.z, dist = Math.hypot(dx, dz); if (dist < 6 && (dx * d.x + dz * d.z) / (dist || 1) > 0.5) { G.fx.burst(p.x, p.y + 0.5, p.z, 0xd0f0ff, 20, 3, -1); splashSfx(0.5); net.send('ext', { id: k }); G._delProp(k); this.pay(5, 'apagou um fogo'); } }); }
    // entrega: brilho em cima do NPC e pagamento ao chegar
    if (this.deliv) { const n = this.deliv.n; if (G.npcs.indexOf(n) < 0) this.deliv = null; else { if (Math.random() < 0.5) G.fx.streak(n.x + (Math.random() - 0.5) * 0.6, n.y + 2.2, n.z + (Math.random() - 0.5) * 0.6, 0, 2.5, 0, 0xffd040, 0.8); if (Math.hypot(n.x - P.pos.x, n.z - P.pos.z) < 2.5) { this.deliv = null; n.av.say('📦 Obrigado!', 2.5); this.pay(12, 'entrega para ' + n.name); } } }
    // luzes de sirene (suas e dos outros policiais)
    const want = new Set(); if (this.siren && G.selfCat && G.selfCat.root.visible) want.add(G.selfCat); G.remotes.forEach((r) => { if (r.meta && r.meta.sir) want.add(r.av); });
    this.lights.forEach((m, av) => { if (!want.has(av)) { av.root.remove(m); m.children.forEach((c) => c.material.dispose()); this.lights.delete(av); } });
    const t = performance.now() / 1000;
    want.forEach((av) => { let m = this.lights.get(av); if (!m) { m = new THREE.Group(); const g = this._lg || (this._lg = new THREE.SphereGeometry(0.07, 8, 6)); for (const [x, c] of [[-0.12, 0xff2030], [0.12, 0x2060ff]]) { const s = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: c, fog: false })); s.position.x = x; m.add(s); } m.position.y = 1.55; av.root.add(m); this.lights.set(av, m); }
      const on = Math.floor(t * 4) % 2; m.children[0].material.color.setHex(on ? 0xff2030 : 0x401010); m.children[1].material.color.setHex(on ? 0x101840 : 0x2060ff); });
  }
};
