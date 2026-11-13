import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { uuid, randHex, store, emit } from './util.js';

// Rede real via Supabase: RPCs para salvar/carregar e Realtime (broadcast + presence)
// para jogadores, chat, amigos e grupos. Sem senha: a identidade é um id temporário
// + segredo gerados no dispositivo e guardados no localStorage.
export const net = {
  client: null, id: null, secret: null, friendCode: '', online: false, timeOffset: 0,
  room: null, map: null, ch: null, status: 'offline', peers: new Map(),
  lobby: null, lobbyState: {}, inbox: null, party: null, partyCode: '', partyMembers: [],
  meta: {}, handlers: {}, _retry: 0, _gen: 0,

  now() { return Date.now() + this.timeOffset; },

  async init(name, look) {
    let ident = store.get('ident', null);
    if (!ident || !ident.id || !ident.secret) { ident = { id: uuid(), secret: randHex(24) }; store.set('ident', ident); }
    this.id = ident.id; this.secret = ident.secret;
    this.client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, realtime: { params: { eventsPerSecond: 20 } } });
    const { data, error } = await this.client.rpc('rv_login', { p_id: this.id, p_secret: this.secret, p_name: name, p_look: look });
    if (error) throw error;
    this.online = true; this.isAdmin = !!data.admin; this.friendCode = data.friend_code; this.timeOffset = (data.now || Date.now()) - Date.now();
    addEventListener('online', () => this._rejoinSoon(200));
    return data;
  },
  async rpc(fn, args) {
    const { data, error } = await this.client.rpc(fn, Object.assign({ p_id: this.id, p_secret: this.secret }, args || {}));
    if (error) throw error; return data;
  },
  async save(name, look, data) {
    if (!this.online) return false;
    try { await this.rpc('rv_save', { p_name: name, p_look: look, p_data: data }); return true; } catch (e) { console.warn('save', e.message); return false; }
  },
  async rooms() { const { data, error } = await this.client.rpc('rv_rooms_list'); if (error) throw error; return data || []; },
  async roomGet(code) { const { data, error } = await this.client.rpc('rv_room_get', { p_code: code }); if (error) throw error; return data; },
  async leaderboard() { const { data, error } = await this.client.rpc('rv_leaderboard'); if (error) throw error; return data; },

  // ---------- lobby global: quem está online e em qual sala (contagem real) ----------
  joinLobby() {
    if (this.lobby) return;
    const ch = this.lobby = this.client.channel('rv:lobby', { config: { presence: { key: this.id } } });
    ch.on('presence', { event: 'sync' }, () => { this.lobbyState = ch.presenceState(); emit('lobby'); });
    ch.subscribe((st) => { if (st === 'SUBSCRIBED') this._trackLobby(); });
    // caixa de entrada pessoal: convites de amizade/grupo e mensagens diretas
    const ib = this.inbox = this.client.channel('rv:u:' + this.id, { config: { broadcast: { self: false } } });
    ib.on('broadcast', { event: 'inbox' }, (m) => emit('inbox', m.payload));
    ib.subscribe();
  },
  _trackLobby() { if (this.lobby) this.lobby.track({ n: this.meta.name, r: this.roomPublic ? this.room : null, m: this.map, pub: this.roomPublic ? 1 : 0, l: this.meta.level }); },
  roomCounts() { const c = {}; for (const k in this.lobbyState) { const p = this.lobbyState[k][0]; if (p && p.r) c[p.r] = (c[p.r] || 0) + 1; } return c; },
  onlineCount() { return Object.keys(this.lobbyState).length; },
  whereIs(id) { const p = this.lobbyState[id]; return p && p[0] ? p[0] : null; },
  async sendTo(id, payload) {
    payload.from = this.id; payload.name = this.meta.name;
    const ch = this.client.channel('rv:u:' + id);
    try { await ch.send({ type: 'broadcast', event: 'inbox', payload }); } catch (e) { /* destinatário offline */ }
    this.client.removeChannel(ch);
  },

  // ---------- sala + mapa ----------
  join(room, map, roomPublic) {
    this.leave();
    this.room = room; this.map = map; this.roomPublic = roomPublic; this._open();
    this._trackLobby();
  },
  _open() {
    const gen = ++this._gen; const topic = 'rv:' + this.room + ':' + this.map;
    const ch = this.ch = this.client.channel(topic, { config: { broadcast: { self: false, ack: false }, presence: { key: this.id } } });
    this.status = 'connecting'; emit('net', this.status);
    ch.on('presence', { event: 'sync' }, () => {
      const st = ch.presenceState(), seen = {};
      for (const k in st) { if (k === this.id) continue; seen[k] = 1; const p = st[k][0]; if (!this.peers.has(k)) { this.peers.set(k, p); emit('peerJoin', k, p); } else { this.peers.set(k, p); emit('peerMeta', k, p); } }
      this.peers.forEach((v, k) => { if (!seen[k]) { this.peers.delete(k); emit('peerLeave', k); } });
    });
    ch.on('broadcast', { event: 's' }, (m) => emit('peerState', m.payload));
    ch.on('broadcast', { event: 'e' }, (m) => emit('peerEvent', m.payload));
    ch.subscribe((st) => {
      if (gen !== this._gen) return;
      if (st === 'SUBSCRIBED') { this.status = 'online'; this._retry = 0; emit('net', this.status); ch.track(this.meta); }
      else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') { this.status = 'reconnecting'; emit('net', this.status); this._rejoinSoon(); }
    });
  },
  // reconexão automática com backoff
  _rejoinSoon(ms) {
    if (!this.room || this._timer) return;
    const wait = ms || Math.min(15000, 1000 * Math.pow(2, this._retry++));
    this._timer = setTimeout(() => {
      this._timer = null; if (!this.room || this.status === 'online') return;
      const old = this.ch; this.ch = null; this._gen++; if (old) this.client.removeChannel(old);
      this.peers.forEach((v, k) => emit('peerLeave', k)); this.peers.clear();
      this._open();
    }, wait);
  },
  leave() {
    this._gen++; if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    if (this.ch) { const c = this.ch; this.ch = null; try { c.untrack(); } catch (e) { /* já saiu */ } this.client.removeChannel(c); }
    this.peers.forEach((v, k) => emit('peerLeave', k)); this.peers.clear(); this.status = 'offline';
  },
  setMeta(meta) { this.meta = meta; if (this.ch && this.status === 'online') this.ch.track(meta); this._trackLobby(); if (this.party) this.party.track({ n: meta.name, l: meta.level, r: this.room, m: this.map }); },
  sendState(arr) { if (this.ch && this.status === 'online' && this.peers.size > 0) this.ch.send({ type: 'broadcast', event: 's', payload: arr }); },
  send(type, data) { if (this.ch && this.status === 'online') { data = data || {}; data.t = type; data.f = this.id; this.ch.send({ type: 'broadcast', event: 'e', payload: data }); } },

  // ---------- grupo (party) por código ----------
  joinParty(code) {
    this.leaveParty(); if (!code) return;
    this.partyCode = code = code.toUpperCase();
    const ch = this.party = this.client.channel('rv:party:' + code, { config: { broadcast: { self: false }, presence: { key: this.id } } });
    ch.on('presence', { event: 'sync' }, () => { const st = ch.presenceState(); this.partyMembers = Object.keys(st).map((k) => Object.assign({ id: k }, st[k][0])); emit('party'); });
    ch.on('broadcast', { event: 'chat' }, (m) => emit('partyChat', m.payload));
    ch.subscribe((st) => { if (st === 'SUBSCRIBED') ch.track({ n: this.meta.name, l: this.meta.level, r: this.room, m: this.map }); });
  },
  leaveParty() { if (this.party) { this.client.removeChannel(this.party); this.party = null; } this.partyCode = ''; this.partyMembers = []; emit('party'); },
  partySay(text) { if (this.party) this.party.send({ type: 'broadcast', event: 'chat', payload: { id: this.id, n: this.meta.name, x: text } }); }
};
