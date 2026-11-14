import { ITEMS, QUESTS, DAILY, ACHIEVEMENTS, PROFS, PICKS, GLOVES, RODS, HAT_PRICES, RARITY, HELD, RECIPES, ACCS, PERKS, CONTRACT_TYPES, ALBUM, titleFor, PETS } from './data.js';
import { emit, on, store, dayKey, rng } from './util.js';
import { net } from './net.js';
import { play } from './assets.js';
import { HATS } from './cat.js';

// Progresso do jogador (salvo no Supabase via RPC; cópia local como reserva offline).
export const S = {
  name: 'Gato', look: null,
  d: null, dirty: false, boostUntil: 0, hp: 100, combo: 0,
  blank() { return { level: 1, xp: 0, coins: 30, inv: {}, equip: { pick: 0, glove: 0, rod: 0 }, hats: [0], prof: '', profXp: {}, q: { active: {}, done: [] }, daily: { day: 0, prog: [0, 0, 0], claimed: [] }, ach: [], stats: {}, chests: { day: 0, open: [] }, secrets: [], maps: [], party: '', held: ['none', 'pick'], hand: 'none', perks: {}, seen: {}, albumDone: [], accSeen: [], contract: null, streak: { day: 0, n: 0 }, pets: ['none'], pet: 'none', muted: [], mounts: ['none'], mount: 'none', best: {}, job: '', shop: {}, angel: { got: 0, on: 1, hover: 1 } }; },
  load(data) {
    const b = this.blank(); const d = data && typeof data === 'object' ? data : {};
    for (const k in b) if (d[k] == null) d[k] = b[k];
    d.equip = Object.assign(b.equip, d.equip); d.q = Object.assign(b.q, d.q); d.daily = Object.assign(b.daily, d.daily); d.chests = Object.assign(b.chests, d.chests);
    this.d = d; this.rollDaily(); this.hp = this.maxHp();
  },
  held() { return HELD.find((h) => h.id === this.d.hand) || HELD[0]; },
  setHand(id) { const h = HELD.find((x) => x.id === id); if (!h) return 'Item inválido'; if (this.d.held.indexOf(id) < 0) { const pr = this.buyPrice(h.price); if (this.d.coins < pr) return 'Faltam ' + (pr - this.d.coins) + ' moedas'; this.d.coins -= pr; this.d.held.push(id); play('coin', 0.7); emit('coins'); } this.d.hand = id; this.toast(id === 'none' ? 'Patas livres' : 'Na pata: ' + h.n + ' (' + h.d + ')', '#6fd26f'); play('pickup', 0.7); this.touch(); emit('meta'); return ''; },
  // ---------- fabricação ----------
  recipeState(r) { const o = r.out, d = this.d; let have = true; for (const k in r.need) if (this.count(k) < r.need[k]) have = false;
    let done = false, locked = false; if (o.equip) { done = d.equip[o.equip] >= o.tier; locked = d.equip[o.equip] < o.tier - 1; } else if (o.held) done = d.held.indexOf(o.held) >= 0; else if (o.hat != null) done = d.hats.indexOf(o.hat) >= 0;
    return { have, done, locked, ok: have && !done && !locked }; },
  craft(r) { const st = this.recipeState(r); if (st.done) return 'Você já tem'; if (st.locked) return 'Fabrique o nível anterior primeiro'; if (!st.have) return 'Faltam materiais';
    for (const k in r.need) this.removeItem(k, r.need[k]); const o = r.out, d = this.d;
    if (o.item) this.addItem(o.item, o.n); else if (o.equip) d.equip[o.equip] = o.tier; else if (o.held) { d.held.push(o.held); d.hand = o.held; emit('meta'); } else if (o.hat != null) d.hats.push(o.hat);
    this.toast('🔨 Fabricado: ' + r.n, '#ffd76a'); play('wood', 0.8); play('confirm', 0.6); this.addXp(15); this.stat('craft'); this.touch(); emit('inv'); return ''; },
  maxHp() { return 100 + (this.d.prof === 'fighter' ? 20 : 0) + Math.min(40, this.d.level * 2) + this.perk('hp') * 10; },
  xpNeed(l) { l = l || this.d.level; return 90 + l * 65 + l * l * 3; },
  // ---------- talentos, título, acessórios, álbum, contratos, sequência diária ----------
  petOk(p) { return this.d.pets.indexOf(p.id) >= 0 || (p.s && (p.s === 'level' ? this.d.level : this.d.stats[p.s] || 0) >= p.v); },
  setPet(id) { const p = PETS.find((x) => x.id === id); if (!p) return 'Bichinho inválido'; if (!this.petOk(p)) { if (!p.price) return p.how; const pr = this.buyPrice(p.price); if (this.d.coins < pr) return 'Moedas insuficientes'; this.d.coins -= pr; emit('coins'); play('coin', 0.7); }
    if (this.d.pets.indexOf(id) < 0) this.d.pets.push(id); this.d.pet = id; if (id !== 'none') { this.toast('🐾 ' + p.n + ' agora segue você!', '#ffd76a'); play('heart', 0.7); } this.touch(); emit('meta'); return ''; },
  perk(id) { return this.d.perks[id] || 0; },
  perkPoints() { let used = 0; for (const k in this.d.perks) used += this.d.perks[k]; return this.d.level - 1 - used; },
  addPerk(id) { const p = PERKS.find((x) => x.id === id); if (!p || this.perkPoints() <= 0 || this.perk(id) >= p.max) return; this.d.perks[id] = this.perk(id) + 1; play('power', 0.5); this.toast('Talento: ' + p.n + ' ' + this.d.perks[id] + '/' + p.max, '#c06bff'); this.touch(); emit('hp'); },
  resetPerks() { if (this.d.coins < 100) return 'Custa 100 moedas'; this.d.coins -= 100; this.d.perks = {}; this.touch(); emit('coins'); return ''; },
  title() { return titleFor(this.d.level); },
  accOk(i) { const a = ACCS[i]; return !!a && (i === 0 || (this.d.stats[a.s] || (a.s === 'level' ? this.d.level : 0)) >= a.v); },
  checkAccs() { for (let i = 1; i < ACCS.length; i++) if (this.accOk(i) && this.d.accSeen.indexOf(i) < 0) { this.d.accSeen.push(i); this.toast('🎀 Acessório conquistado: ' + ACCS[i].n + ' (vista em Avatar)', '#ff9ad8'); play('secret', 0.6); } },
  albumCount(k) { let have = 0, tot = 0; for (const id in ITEMS) if (ITEMS[id].k === k) { tot++; if (this.d.seen[id]) have++; } return [have, tot]; },
  newContract() { const lvl = this.d.level, r = Math.random, T = CONTRACT_TYPES[Math.floor(r() * CONTRACT_TYPES.length)], tier = 1 + Math.floor(r() * 3), n = Math.max(1, Math.round(T.base * tier * (1 + lvl * 0.04)));
    this.d.contract = { t: T.t, n, p: 0, title: T.title.replace('%n', n), xp: Math.round((50 + lvl * 14) * tier), coins: Math.round((40 + lvl * 11) * tier), tier }; play('book', 0.7); this.touch(); },
  claimContract() { const c = this.d.contract; if (!c || c.p < c.n) return; this.d.contract = null; this.addXp(c.xp); this.addCoins(c.coins); this.toast('📋 Contrato concluído: +' + c.xp + ' XP, +' + c.coins + ' moedas', '#6fd26f'); play('quest', 0.7); this.stat('contracts'); },
  streakCheck() { const now = net.now(), k = dayKey(now), st = this.d.streak; if (st.day === k) return; st.n = st.day === dayKey(now - 86400000) ? st.n + 1 : 1; st.day = k; const c = 25 * Math.min(st.n, 7); this.d.coins += c; this.toast('📅 Sequência diária: dia ' + st.n + ' — +' + c + ' moedas', '#ffd76a'); this.touch(); emit('coins'); },
  touch() { this.dirty = true; this.localDirty = true; }, // gravação real em lote (ver setInterval abaixo)
  toast(t, c) { emit('toast', t, c); },

  addXp(n, why) {
    if (this.sandbox) return;
    if (n <= 0) return;
    if (net.now() < this.boostUntil) n = Math.round(n * 1.2);
    if (this.xpMul) n = Math.round(n * this.xpMul());
    const hx = this.held().xp; if (hx) n = Math.round(n * hx);
    n = Math.round(n * (1 + this.perk('xp') * 0.05));
    const d = this.d; d.xp += n; let up = false;
    while (d.xp >= this.xpNeed()) { d.xp -= this.xpNeed(); d.level++; up = true; }
    emit('xp', n);
    if (up) { this.hp = this.maxHp(); this.toast('⭐ Nível ' + d.level + '!', '#ffd76a'); play('levelup', 0.7); this.addCoins(d.level * 10); this.setStat('level', d.level); emit('levelup', d.level); if (d.level >= 100) this.angelCheck(); }
    this.touch();
  },
  addCoins(n) { if (!n || (this.sandbox && n > 0)) return; this.d.coins += n; if (n > 0) this.stat('earned', null, n); this.touch(); emit('coins'); },
  count(id) { return this.d.inv[id] || 0; },
  // 😇 nível 100: vira Gato-Anjo (homenagem ao Keyboard Cat) e ganha as ferramentas celestiais e 999 petiscos bons
  angelCheck() { const d = this.d; if (!d || this.sandbox || d.level < 100 || d.angel.got) return false; d.angel.got = 1; if (!d.angel.pref) d.angel.on = 1; for (const id of ['caxe', 'csword', 'cpick']) if (d.held.indexOf(id) < 0) d.held.push(id); this.addItem('snackq', 999, true); this.setStat('angel', 1); this.touch(); emit('angel'); return true; },
  angelOn() { const d = this.d; return !!(d && d.level >= 100 && d.angel && d.angel.got && d.angel.on); },
  addItem(id, n, silent) {
    if (this.sandbox) { if (!silent && ITEMS[id]) this.toast('(' + ITEMS[id].n + ' — mapas criados não dão itens)', '#99a'); return; }
    n = n || 1; this.d.inv[id] = (this.d.inv[id] || 0) + n; const it = ITEMS[id];
    if (it && !this.d.seen[id]) { this.d.seen[id] = 1; if (ALBUM[it.k]) { const c = this.albumCount(it.k); this.toast('📖 Novo no álbum: ' + it.n + ' (' + ALBUM[it.k] + ' ' + c[0] + '/' + c[1] + ')', '#bfe6ff'); if (c[0] === c[1] && this.d.albumDone.indexOf(it.k) < 0) { this.d.albumDone.push(it.k); this.d.coins += 400; this.toast('📖 Coleção completa: ' + ALBUM[it.k] + '! +400 moedas', '#ffb52e'); play('win', 0.6); this.stat('collections'); emit('coins'); } } }
    if (id === 'pearl') this.stat('pearl', null, n);
    if (!silent && it) this.toast('+' + n + ' ' + it.n, RARITY[it.r].c);
    if (it && it.r >= 3 && (it.k === 'gem')) this.stat('epic', null, 1);
    if (id === 'moonfish') this.stat('moonfish', null, 1);
    this.touch(); emit('inv');
  },
  removeItem(id, n) { const c = this.count(id); if (c < n) return false; if (c === n) delete this.d.inv[id]; else this.d.inv[id] = c - n; this.touch(); emit('inv'); return true; },
  sellPrice(id) { return Math.round(ITEMS[id].v * (this.d.prof === 'merchant' ? 1.2 : 1)); },
  buyPrice(p) { return Math.round(p * (this.d.prof === 'merchant' ? 0.9 : 1)); },
  sell(id, n) { n = Math.min(n, this.count(id)); if (n <= 0 || !ITEMS[id].v) return 0; const v = this.sellPrice(id) * n; this.removeItem(id, n); this.addCoins(v); this.stat('sold', null, v); play('coin', 0.7); return v; },
  sellAll(kind) { let t = 0; for (const id of Object.keys(this.d.inv)) { const it = ITEMS[id]; if (it && it.v && it.k !== 'food' && it.k !== 'quest' && (!kind || it.k === kind)) t += this.sell(id, this.count(id)); } return t; },
  // compra de uma oferta de loja; devolve mensagem de erro ou ''
  offerInfo(o) {
    if (o.k === 'item') return { name: ITEMS[o.id].n, price: this.buyPrice(o.price), owned: false };
    if (o.k === 'hat') return { name: 'Chapéu: ' + HATS[o.id], price: this.buyPrice(HAT_PRICES[o.id]), owned: this.d.hats.indexOf(o.id) >= 0 };
    const T = o.k === 'pick' ? PICKS : o.k === 'glove' ? GLOVES : RODS;
    return { name: T[o.id].n, price: this.buyPrice(T[o.id].price), owned: this.d.equip[o.k] >= o.id, locked: this.d.equip[o.k] < o.id - 1 };
  },
  buy(o) {
    const inf = this.offerInfo(o);
    if (inf.owned) return 'Você já tem'; if (inf.locked) return 'Compre o anterior primeiro'; if (this.d.coins < inf.price) return 'Moedas insuficientes';
    this.d.coins -= inf.price;
    if (o.k === 'item') this.addItem(o.id, 1); else if (o.k === 'hat') { this.d.hats.push(o.id); this.toast('Novo chapéu! Vista em Perfil.', '#ffd76a'); } else { this.d.equip[o.k] = o.id; this.toast('Equipado: ' + inf.name, '#6fd26f'); }
    play('coin', 0.7); this.touch(); emit('coins'); return '';
  },
  useItem(id) {
    const it = ITEMS[id]; if (!it || it.k !== 'food' || !this.count(id)) return;
    this.removeItem(id, 1);
    if (it.heal) { this.hp = Math.min(this.maxHp(), this.hp + it.heal); this.toast('Nham! +' + it.heal + ' de vida', '#6fd26f'); }
    if (it.boost) { this.boostUntil = net.now() + it.boost * 1000; this.toast('Erva-de-gato! +20% de XP por 3 min', '#c06bff'); }
    play('pickup', 0.8); emit('hp');
  },
  setProf(p) { this.d.prof = p; this.toast('Profissão: ' + PROFS[p].n, '#ffd76a'); this.touch(); emit('meta'); },

  // ---------- estatísticas -> missões, diárias, conquistas ----------
  setStat(s, v) { if ((this.d.stats[s] || 0) < v) { this.d.stats[s] = v; this.checkAch(); this.checkAccs(); } },
  stat(t, key, n) {
    if (this.sandbox) return;
    n = n || 1; const d = this.d; d.stats[t] = (d.stats[t] || 0) + n;
    for (const id in d.q.active) { const q = QUESTS[id], g = q.goal; if (g.t === t && g.t !== 'deliver' && (!g.k || g.k === key)) { const before = d.q.active[id]; d.q.active[id] = Math.min(g.n, before + n); if (before < g.n && d.q.active[id] >= g.n) { this.toast('Missão pronta: ' + q.title, '#ffd76a'); play('sel', 0.6); emit('questReady'); } } }
    const dl = this.dailyList();
    for (let i = 0; i < 3; i++) { const g = dl[i].goal; if (g.t === t && d.daily.prog[i] < g.n) { d.daily.prog[i] = Math.min(g.n, d.daily.prog[i] + n); if (d.daily.prog[i] >= g.n) { this.toast('Diária concluída! Resgate no menu Missões.', '#ffd76a'); play('sel', 0.6); } } }
    const ct = d.contract; if (ct && ct.t === t && ct.p < ct.n) { ct.p = Math.min(ct.n, ct.p + n); if (ct.p >= ct.n) { this.toast('📋 Contrato pronto! Resgate em Missões.', '#ffd76a'); play('sel', 0.6); } }
    this.checkAch(); this.checkAccs(); this.touch();
  },
  checkAch() {
    const d = this.d;
    for (const a of ACHIEVEMENTS) if (d.ach.indexOf(a.id) < 0 && (d.stats[a.s] || 0) >= a.v) { d.ach.push(a.id); d.coins += a.c; this.toast('🏆 Conquista: ' + a.n + ' (+' + a.c + ' moedas)', '#ffb52e'); play('quest', 0.6); emit('coins'); }
  },
  // ---------- missões ----------
  questState(id) { const d = this.d, q = QUESTS[id]; if (d.q.done.indexOf(id) >= 0) return 'done'; if (id in d.q.active) return this.questProgress(id) >= q.goal.n ? 'ready' : 'active'; if (q.after && d.q.done.indexOf(q.after) < 0) return 'locked'; return 'open'; },
  questProgress(id) { const q = QUESTS[id]; return q.goal.t === 'deliver' ? Math.min(q.goal.n, this.count(q.goal.k)) : this.d.q.active[id] || 0; },
  accept(id) { this.d.q.active[id] = 0; this.toast('Missão aceita: ' + QUESTS[id].title, '#bfe6ff'); play('book', 0.8); this.touch(); },
  complete(id) {
    const q = QUESTS[id]; if (this.questState(id) !== 'ready') return false;
    if (q.goal.t === 'deliver') this.removeItem(q.goal.k, q.goal.n);
    delete this.d.q.active[id]; this.d.q.done.push(id);
    this.toast('✔ ' + q.title + ': +' + q.xp + ' XP, +' + q.coins + ' moedas', '#6fd26f'); play('quest', 0.7);
    this.addXp(q.xp); this.addCoins(q.coins); this.stat('quests', null, 1); return true;
  },
  rollDaily() { const k = dayKey(net.now()); if (this.d.daily.day !== k) { this.d.daily = { day: k, prog: [0, 0, 0], claimed: [] }; this.d.chests = { day: k, open: [] }; this.d.stats.visitToday = 0; this.dirty = true; } },
  dailyList() { const r = rng(this.d.daily.day || 1), idx = []; while (idx.length < 3) { const i = Math.floor(r() * DAILY.length); if (idx.indexOf(i) < 0) idx.push(i); } return idx.map((i) => DAILY[i]); },
  claimDaily(i) { const q = this.dailyList()[i], d = this.d.daily; if (d.prog[i] < q.goal.n || d.claimed.indexOf(i) >= 0) return; d.claimed.push(i); this.addXp(q.xp); this.addCoins(q.coins); this.toast('Diária: +' + q.xp + ' XP, +' + q.coins + ' moedas', '#6fd26f'); play('quest', 0.7); this.stat('quests', null, 1); },
  chestOpen(key) { if (this.sandbox) return (this._sbChests || []).indexOf(key) >= 0; return this.d.chests.open.indexOf(key) >= 0; },
  markChest(key) { if (this.sandbox) { (this._sbChests = this._sbChests || []).push(key); return; } this.d.chests.open.push(key); this.touch(); },
  visit(map) { if (this.d.maps.indexOf(map) < 0) { this.d.maps.push(map); this.setStat('maps', this.d.maps.length); this.addXp(25); } this.stat('visit', map, 1); },
  secret(key, map) { if (this.sandbox) { this.toast('✨ Segredo do mapa encontrado!', '#c06bff'); play('secret', 0.7); return true; } if (this.d.secrets.indexOf(key) >= 0) return false; this.d.secrets.push(key); if (/moon_felicette$/.test(key)) { this.stat('felicette'); this.toast('🐈‍⬛ Obrigada pela visita! — Félicette, primeira gata no espaço (1963)', '#ffe0a0'); } const xp = this.d.prof === 'explorer' ? 160 : 80; this.toast('✨ Segredo descoberto! +' + xp + ' XP', '#c06bff'); play('secret', 0.7); this.addXp(xp); this.stat('secret', map, 1); return true; },
  profBonus(p) { return this.d.prof === p; }
};
// salvamento periódico
setInterval(() => { if (S.dirty && S.d) { S.dirty = false; net.save(S.name, S.look, S.d).then((ok) => { if (!ok) S.dirty = true; }); } }, 8000);
setInterval(() => { if (S.localDirty && S.d) { S.localDirty = false; store.set('save', { name: S.name, look: S.look, d: S.d }); } }, 3000);
addEventListener('pagehide', () => { if (S.d) store.set('save', { name: S.name, look: S.look, d: S.d }); });
document.addEventListener('visibilitychange', () => { if (document.hidden && S.d) { store.set('save', { name: S.name, look: S.look, d: S.d }); if (S.dirty) { S.dirty = false; net.save(S.name, S.look, S.d); } } });
on('saveNow', () => { if (S.d) { S.dirty = false; net.save(S.name, S.look, S.d); } });
