import { net } from './net.js';
import { S } from './state.js';
import { emit } from './util.js';
import { play } from './assets.js';

// Painel de admin. Segurança: a senha é conferida no servidor (rv_admin_login, hash bcrypt) e cada ação
// passa por rv_admin_send, que só aceita admins. Os jogadores recebem as ações pela tabela rv_admin_events
// (Supabase Realtime), que só o servidor escreve — então ninguém consegue se passar pelo admin pela rede.
export const EFFECTS = [
  ['lowgrav', '🪐 Gravidade baixa'], ['speed', '⚡ Super velocidade'], ['jump', '🦘 Super pulo'], ['fly', '🕊 Voar'], ['heal', '❤ Curar tudo'],
  ['rainbow', '🌈 Arco-íris'], ['gold', '✨ Brilho dourado'], ['confetti', '🎊 Confete'], ['freeze', '🧊 Congelar (5 s)'], ['disco', '🪩 Disco']
];
export const EVENTS_ADM = [
  ['party', '🎉 Festa', 'Confete, luzes coloridas e XP em dobro'], ['invasion', '👾 Invasão', 'Ondas de inimigos e um chefe no fim'], ['goldrain', '💰 Chuva de Ouro', 'Moedas e gemas caem do céu'],
  ['treasure', '🗝 Caça ao Tesouro', '5 baús dourados escondidos em cada mapa'], ['xp2', '⭐ XP em dobro', 'Todo XP vale o dobro'], ['night', '🌙 Noite eterna', 'Fica noite em todos os mapas'], ['day', '☀ Dia eterno', 'Fica dia em todos os mapas']
];
export const admin = {
  is: false, ids: new Set(), effects: {}, event: null, ch: null, seen: new Set(), log: [],
  async login(pw) { const r = await net.rpc('rv_admin_login', { p_password: pw }); if (r && r.ok) { this.is = true; this.ids.add(net.id); emit('admin'); } return r || { ok: false }; },
  // ---------- envio (só funciona para admins; o servidor confere) ----------
  async send(kind, target, data, secs) {
    if (!this.is) return 'Você não é admin';
    try { await net.rpc('rv_admin_send', { p_kind: kind, p_target: target || 'all', p_data: data || {}, p_secs: secs || 0 }); return ''; }
    catch (e) { return /rv_admin|PGRST202|schema cache/.test(e.message || '') ? 'O banco ainda não tem o admin (rode supabase/admin.sql)' : 'Erro: ' + (e.message || e); }
  },
  // ---------- recebimento ----------
  start() {
    if (this.ch || !net.client) return;
    this.ch = net.client.channel('rv:admin').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rv_admin_events' }, (m) => this.receive(m.new)).subscribe();
    net.client.rpc('rv_admin_active').then(({ data }) => { if (!data) return; (data.admins || []).forEach((id) => this.ids.add(id)); emit('admins'); (data.events || []).forEach((e) => this.receive(e, true)); }).catch(() => {});
  },
  targets(t) {
    if (!t || t === 'all') return true; if (t === 'p:' + net.id) return true;
    if (t.indexOf('map:') === 0) return t.slice(4) === (net.map || '');
    return false;
  },
  receive(e, late) {
    if (!e || this.seen.has(e.id)) return; this.seen.add(e.id); if (!this.targets(e.target)) return;
    const until = Date.parse(e.ends_at), d = e.data || {};
    if (e.kind === 'msg') { emit('banner', '📢 ' + e.author + ': ' + d.text, 8); emit('chatlog', '📢 ' + e.author, d.text); play('event', 0.8); }
    else if (e.kind === 'effect') this.applyEffect(d.fx, until, e.author, late);
    else if (e.kind === 'event') { this.event = { ev: d.ev, until, t0: Date.parse(e.created_at), author: e.author, wave: 0, nextWave: 0, data: d }; emit('adminEvent', this.event, late); }
    else if (e.kind === 'stop') { this.event = null; this.effects = {}; emit('adminEvent', null); if (!late) emit('banner', '⏹ ' + e.author + ': eventos encerrados', 4); }
    else if (e.kind === 'spawn' && !late) emit('adminSpawn', d);
    else if (e.kind === 'drop' && !late) emit('adminDrop', d);
    else if (e.kind === 'give' && !late) { if (d.coins) { S.addCoins(d.coins); S.toast('🎁 ' + e.author + ' te deu ' + d.coins + ' moedas', '#ffd76a'); } if (d.item) S.addItem(d.item, d.n || 1); play('coin', 0.8); }
    else if (e.kind === 'kick' && !late) emit('adminKick', e.author);
    else if (e.kind === 'tp' && !late) emit('adminTp', d);
  },
  applyEffect(fx, until, author, late) {
    if (fx === 'heal') { if (!late) emit('adminHeal'); return; } if (fx === 'confetti') { if (!late) emit('confetti'); return; }
    if (fx === 'freeze') until = Math.min(until, net.now() + 5000);
    this.effects[fx] = until; if (!late) { const n = EFFECTS.find((x) => x[0] === fx); emit('banner', '✨ ' + (n ? n[1] : fx) + (author ? ' — ' + author : ''), 4); play('power', 0.6); }
  },
  // aplica em mim sem passar pelo servidor (efeitos só para o próprio admin)
  selfEffect(fx, secs) { this.applyEffect(fx, net.now() + secs * 1000, '', false); },
  has(fx) { const u = this.effects[fx]; if (!u) return false; if (net.now() > u) { delete this.effects[fx]; return false; } return true; },
  eventOn(ev) { const e = this.event; if (!e) return false; if (net.now() > e.until) { this.event = null; emit('adminEvent', null); return false; } return !ev || e.ev === ev; },
  xpMul() { return this.eventOn('xp2') || this.eventOn('party') ? 2 : 1; }
};
