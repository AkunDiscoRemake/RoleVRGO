// Host dos scripts e mods (estilo Roblox, "listen server"):
// - Scripts (servidor) rodam num iframe sandbox SÓ no jogador anfitrião (quem está no mapa há mais tempo).
// - LocalScripts (cliente) rodam num iframe sandbox em cada jogador.
// - O mundo criado pelo servidor é replicado a todos pela sala (Supabase Realtime); quem entra depois recebe uma "foto".
// - RemoteEvent/RemoteFunction viajam cliente <-> anfitrião pela mesma sala. DataStore fica no Supabase (ou no aparelho).
// Nada disso roda no contexto da página: scripts e mods não veem a conta, o login nem o save, e não têm rede (CSP).
import * as THREE from 'three';
import { PRELUDE, iframeBoot, luauToLua } from './runtime.js';
import { emit, store } from '../util.js';
import { S } from '../state.js';
import { play } from '../assets.js';
import { net } from '../net.js';

const VENDOR = () => new URL('assets/vendor/fengari-web.js', document.baseURI).href;
const MAX_PARTS = 600, MAX_OPS = 60;
const geoms = { Block: new THREE.BoxGeometry(1, 1, 1), Ball: new THREE.SphereGeometry(0.5, 16, 12), Cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 16) };
geoms.Cylinder.rotateZ(Math.PI / 2); // no Roblox o cilindro deita no eixo X
const PART = /^(Part|SpawnLocation|WedgePart|MeshPart|TrussPart|CornerWedgePart|UnionOperation|Seat)$/, GUI = /^(ScreenGui|Frame|TextLabel|TextButton|ImageLabel|ImageButton|TextBox|ScrollingFrame)$/;
export const uidOf = (id) => { let h = 2166136261; for (const c of String(id)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 2000000000) + 1; };
// valores com etiqueta ($v3/$c3/$u2/$ref/$cf/$enum) <-> objetos do jogo
const dec = (js) => { if (js == null || js === '') return undefined; let v; try { v = JSON.parse(js); } catch (e) { return undefined; } return fix(v); };
function fix(v) { if (!v || typeof v !== 'object') return v; if (Array.isArray(v)) return v.map(fix);
  if (v.$v3) return new THREE.Vector3(+v.$v3[0], +v.$v3[1], +v.$v3[2]); if (v.$c3) return new THREE.Color(+v.$c3[0], +v.$c3[1], +v.$c3[2]); if (v.$u2) return v.$u2.map(Number); if (v.$ref) return { ref: String(v.$ref) }; if (v.$cf) return new THREE.Vector3(+v.$cf[0], +v.$cf[1], +v.$cf[2]); if (v.$enum) return String(v.$enum[1]);
  const o = {}; for (const k in v) o[k] = fix(v[k]); return o; }
function enc(v) { if (v instanceof THREE.Vector3) return { $v3: [v.x, v.y, v.z] }; if (v instanceof THREE.Color) return { $c3: [v.r, v.g, v.b] }; if (v && v.ref) return { $ref: v.ref }; if (Array.isArray(v)) return v.length === 4 && v.every((x) => typeof x === 'number') ? { $u2: v } : v; if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = enc(v[k]); return o; } return v; }

export const host = {
  G: null, running: false, studio: false, cfg: null, opts: {}, log: [], mods: [], vm: { server: null, client: null }, ready: { server: false, client: false }, pending: { server: [], client: [] },
  objs: new Map(), parts: new Map(), gui: new Map(), dets: new Map(), touching: new Set(), srvTouch: new Map(), srvUids: new Set(), out: [], outSet: new Map(), outT: 0, extra: [],
  hostId: null, snapOk: false, reqT: 0, chkT: 0, lbT: 0, lbDirty: false, guiRoot: null, lbEl: null, promptEl: null, curPrompt: null, camT: 0, camJs: '', dsWarned: false,
  myUid() { return uidOf(net.online && net.id ? net.id : 'local'); },
  // ---------- ciclo de vida ----------
  start(G, scripts, mods, opts) {
    this.stop(); this.G = G; this.opts = opts || {}; this.studio = !!this.opts.studio; this.log = []; this.running = true; this.snapOk = false; this.reqT = 0; this.chkT = 0;
    const conv = (s) => ({ n: s.n || 'Script', src: luauToLua(s.src) }), list = (scripts || []).filter((s) => s && s.src && s.on !== false);
    this.cfg = { server: list.filter((s) => s.k === 'server').map(conv), client: list.filter((s) => !s.k || s.k === 'client').map(conv), modules: list.filter((s) => s.k === 'module').map(conv) };
    for (const m of mods || []) if (m && m.html && m.on !== false) this._bootMod(m);
    if (this.cfg.client.length) this._boot('client');
    // online: espera ~1,5 s a lista de jogadores da sala antes de decidir quem é o servidor
    if (net.online && net.id) { this.hostId = null; this.chkT = 1.5; } else { this.hostId = 'local'; if (this.cfg.server.length) this._boot('server'); }
    if (!this._lis) { this._lis = (ev) => this._msg(ev); addEventListener('message', this._lis); }
    if (!this._keys) { this._keys = (e) => this._key(e); addEventListener('keydown', this._keys); addEventListener('keyup', this._keys); }
    const n = this.cfg.server.length + this.cfg.client.length + this.cfg.modules.length; if (n || this.mods.length) this.print('info', '▶ ' + this.cfg.server.length + ' Script(s) de servidor, ' + this.cfg.client.length + ' LocalScript(s), ' + this.cfg.modules.length + ' módulo(s) e ' + this.mods.length + ' mod(s) · ' + (this.hostId === 'local' ? 'você é o servidor' : 'escolhendo o servidor...'));
  },
  stop() {
    for (const k of ['server', 'client']) if (this.vm[k]) { this.vm[k].remove(); this.vm[k] = null; this.ready[k] = false; this.pending[k] = []; }
    for (const x of this.mods) x.f.remove(); this.mods = [];
    for (const [, p] of this.parts) this._dropPart(p); this.parts.clear(); this.objs.clear(); this.dets.clear(); this.srvUids.clear(); this.srvTouch.clear(); this.touching.clear(); this.out = []; this.outSet.clear();
    for (const e of this.extra) { if (e.parent) e.parent.remove(e); } this.extra = [];
    if (this.guiRoot) { this.guiRoot.remove(); this.guiRoot = null; } this.gui.clear(); if (this.lbEl) { this.lbEl.remove(); this.lbEl = null; } if (this.promptEl) { this.promptEl.remove(); this.promptEl = null; } this.curPrompt = null;
    if (this.G) { const P = this.G.player; P.scriptWalk = 1; P.scriptJump = 1; this.G.scriptFly = false; this.G.scriptGrav = null; this.G.scriptTime = null; }
    if (this.running) { this.running = false; emit('studioLog'); }
  },
  print(lvl, msg) { this.log.push({ lvl, msg: String(msg).slice(0, 600), t: Date.now() }); if (this.log.length > 400) this.log.shift(); emit('studioLog'); },
  _me() { return net.online && net.id ? net.id : 'local'; },
  // anfitrião = quem entrou no mapa primeiro (menor "jt"), desempate pelo id
  _electHost() { const G = this.G; if (!net.online || !net.id) return 'local'; let best = net.id, bj = G.mapJt || 0;
    G.remotes.forEach((r, id) => { const jt = r.meta && typeof r.meta.jt === 'number' ? r.meta.jt : Infinity; if (jt < bj || (jt === bj && id < best)) { best = id; bj = jt; } }); return best; },
  isHost() { return this.hostId === this._me(); },
  _boot(ctx) {
    const f = document.createElement('iframe'); f.setAttribute('sandbox', 'allow-scripts'); f.style.display = 'none'; f.title = ctx;
    f.srcdoc = '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' \'unsafe-eval\' ' + new URL(VENDOR()).origin + '"><script src="' + VENDOR() + '"></script><script>(' + iframeBoot.toString() + ')()</script>';
    const pre = [['ctx', uidOf(this.opts.mapId || this.opts.mapName || 'local'), String(this.G.room || '')]]; if (ctx === 'client') pre.push(['player', S.name || 'Gato', this.myUid()]);
    f.onload = () => f.contentWindow.postMessage({ __rvh: 1, op: 'boot', ctx, prelude: PRELUDE, modules: this.cfg.modules, scripts: this.cfg[ctx], pre }, '*');
    document.body.appendChild(f); this.vm[ctx] = f; this.ready[ctx] = false; this.pending[ctx] = [];
  },
  _bootMod(m) {
    const f = document.createElement('iframe'); f.setAttribute('sandbox', 'allow-scripts'); f.title = m.n || 'mod'; f.className = 'rvmod';
    Object.assign(f.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', border: '0', background: 'transparent', zIndex: 15, pointerEvents: m.interactive ? 'auto' : 'none' }); f.allowTransparency = 'true';
    const csp = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' \'unsafe-eval\'; style-src \'unsafe-inline\'; img-src data: blob:; media-src data: blob:; font-src data:">'; // sem rede
    const api = csp + '<script>(' + modApi.toString() + ')()</script>';
    f.srcdoc = /<head[^>]*>/i.test(m.html) ? m.html.replace(/<head[^>]*>/i, (h) => h + api) : api + m.html;
    document.body.appendChild(f); this.mods.push({ f, m });
  },
  // envia para um VM (fila até ele ficar pronto)
  _vm(ctx, list) { const f = this.vm[ctx]; if (!f || !list.length) return; if (!this.ready[ctx]) { this.pending[ctx].push(...list); if (this.pending[ctx].length > 5000) this.pending[ctx].splice(0, 1000); return; } f.contentWindow.postMessage({ __rvh: 1, op: 'batch', list }, '*'); },
  _toMods(m) { m.__rvh = 1; for (const x of this.mods) if (x.f.contentWindow) x.f.contentWindow.postMessage(m, '*'); },
  _msg(ev) {
    const d = ev.data; if (!d || !d.__rv || !this.running) return;
    const ctx = ev.source && this.vm.server && ev.source === this.vm.server.contentWindow ? 'server' : ev.source && this.vm.client && ev.source === this.vm.client.contentWindow ? 'client' : null;
    const mod = ctx ? null : this.mods.find((x) => x.f.contentWindow === ev.source); if (!ctx && !mod) return; // só aceita dos nossos iframes
    try { if (ctx === 'server') this._srvOp(d); else if (ctx === 'client') this._cliOp(d); else this._modOp(d, mod); } catch (e) { this.print('error', 'host: ' + e.message); }
  },
  // ---------- mensagens do VM do SERVIDOR ----------
  _srvOp(d) {
    switch (d.op) {
      case 'ready': this.ready.server = true; this._vm('server', this.pending.server.splice(0)); this.srvUids.clear(); this._syncPlayers(); break;
      case 'print': this.print(d.id, d.k); break;
      case 'new': { const op = ['n', d.id, d.k, d.t || null, d.v || '{}']; this._apply(op, true); this._push(op); this._vm('client', [['rnew', d.id, d.k, d.t || null, d.v || '{}']]); break; }
      case 'set': { const op = ['s', d.id, d.k, d.v]; this._apply(op, true); this._push(op); this._vm('client', [['rset', d.id, d.k, d.v]]); break; }
      case 'parent': { const op = ['p', d.id, d.v || null]; this._apply(op, true); this._push(op); this._vm('client', [['rpar', d.id, d.v || null]]); break; }
      case 'del': { const op = ['d', d.id]; this._apply(op, true); this._push(op); this._vm('client', [['rdel', d.id]]); break; }
      case 'api': this._srvApi(d.id, d.v || []); break;
    }
  },
  _srvApi(n, a) {
    const me = this.myUid();
    switch (n) {
      case 'fireClient': if (+a[1] === me) this._vm('client', [['remote', a[0], null, a[2]]]); else this._net('rxe', { to: this._peerOf(+a[1]), r: a[0], a: a[2] }); break;
      case 'fireAll': this._vm('client', [['remote', a[0], null, a[1]]]); this._net('rxe', { r: a[0], a: a[1] }); break;
      case 'invokeReply': if (+a[0] === me) this._vm('client', [['ret', a[1], true, a[2]]]); else this._net('rxir', { to: this._peerOf(+a[0]), q: a[1], a: a[2] }); break;
      case 'hum': if (+a[0] === me) this._hum(a[1], a[2]); else this._net('rxh', { to: this._peerOf(+a[0]), k: a[1], v: a[2] }); break;
      case 'ds': this._ds(a[1], a[2], a[3], a[4], a[5]).then((r) => this._vm('server', [['ret', a[0], true, r == null ? '' : r]])).catch((e) => this._vm('server', [['ret', a[0], false, String(e.message || e)]])); break;
      case 'soundAll': this._api('play', [a[0], a[1]]); this._net('rxapi', { n: 'play', a: [a[0], a[1]] }); break;
      case 'toast': case 'banner': case 'fx': case 'boom': case 'model': case 'npc': case 'sky': case 'time': case 'gravity': this._api(n, a); this._net('rxapi', { n, a }); break;
      default: break; // say/teleport/walk/fly/emote só fazem sentido no cliente
    }
  },
  // ---------- mensagens do VM do CLIENTE (só valem para este aparelho) ----------
  _cliOp(d) {
    if ((d.op === 'new' || d.op === 'set' || d.op === 'parent' || d.op === 'del') && this.objs.has(d.id) && this.objs.get(d.id).server) return; // LocalScript não mexe no mundo do servidor
    switch (d.op) {
      case 'ready': this.ready.client = true; this._vm('client', this.pending.client.splice(0)); this._replayToClient(); break;
      case 'print': this.print(d.id, d.k); break;
      case 'new': this._apply(['n', d.id, d.k, d.t || null, d.v || '{}'], false); break;
      case 'set': this._apply(['s', d.id, d.k, d.v], false); break;
      case 'parent': this._apply(['p', d.id, d.v || null], false); break;
      case 'del': this._apply(['d', d.id], false); break;
      case 'sound': play(/^[a-z_]+$/i.test(d.k) ? d.k : 'click', Math.min(1, +d.v || 0.6)); break;
      case 'api': { const a = d.v || [];
        if (d.id === 'fireServer') { if (this.isHost()) this._vm('server', [['remote', a[0], this.myUid(), a[1]]]); else this._net('rxc', { r: a[0], a: a[1] }); }
        else if (d.id === 'invokeServer') { if (this.isHost()) this._vm('server', [['invoke', a[0], this.myUid(), a[1], a[2]]]); else this._net('rxi', { r: a[0], q: a[1], a: a[2] }); }
        else this._api(d.id, a); break; }
    }
  },
  // o VM do cliente pode subir depois do mundo do servidor: manda o que já existe
  _replayToClient() { const list = []; for (const op of this._snapshot()) list.push(['rnew', op[1], op[2], op[3], op[4]]); if (list.length) this._vm('client', list); },
  _modOp(d, mod) {
    switch (d.op) {
      case 'new': if (PART.test(d.k)) this._apply(['n', d.id, d.k, null, '{}'], false); break;
      case 'set': { const v = d.t === 'v3' ? { $v3: d.v } : d.t === 'c3' ? { $c3: d.v } : d.v; this._apply(['s', d.id, d.k, JSON.stringify(v)], false); break; }
      case 'del': this._apply(['d', d.id], false); break;
      case 'api': this._api(d.id, d.v || []); break;
      case 'interactive': mod.f.style.pointerEvents = d.v ? 'auto' : 'none'; break;
    }
  },
  // ---------- efeitos e chamadas locais ----------
  _api(n, a) {
    const G = this.G, P = G.player;
    switch (n) {
      case 'toast': emit('toast', String(a[0]).slice(0, 120), typeof a[1] === 'string' && /^#[0-9a-f]{3,8}$/i.test(a[1]) ? a[1] : '#bfe6ff'); break;
      case 'banner': emit('banner', String(a[0]).slice(0, 80), Math.min(10, +a[1] || 3)); break;
      case 'say': { const t = performance.now(); if (t - (this._sayT || -1e9) < 5000) break; this._sayT = t; G.say(String(a[0]).slice(0, 80)); break; } // no máximo 1 mensagem a cada 5 s
      case 'play': play(String(a[0]).replace(/[^a-z_0-9]/gi, ''), Math.min(1, +a[1] || 0.7)); break;
      case 'fx': G.fx.burst(+a[0], +a[1], +a[2], +a[3] | 0, Math.min(80, +a[4] || 20), 3, 2); break;
      case 'boom': { const r = Math.min(40, +a[3] || 4); G.fx.burst(+a[0], +a[1], +a[2], 0xff9a30, 50, r * 1.5, 4); G.fx.burst(+a[0], +a[1], +a[2], 0x555555, 30, r, 1); play('ko', 0.8); break; }
      case 'teleport': if ([a[0], a[1], a[2]].every(Number.isFinite)) P.teleport(a[0], a[1], a[2], P.yaw); break;
      case 'walk': P.scriptWalk = Math.max(0, Math.min(10, (+a[0] || 16) / 16)); break;
      case 'jump': P.scriptJump = Math.max(0, Math.min(6, (+a[0] || 50) / 50)); break;
      case 'health': if (this.studio || G.mapId === 'custom') { S.hp = Math.max(0, Math.min(S.maxHp(), (+a[0] / Math.max(1, +a[1] || 100)) * S.maxHp())); emit('hp'); } break;
      case 'gravity': G.scriptGrav = Math.max(0, Math.min(5, (+a[0] || 196.2) / 196.2)); break;
      case 'time': G.scriptTime = ((+a[0] || 0) % 24 + 24) % 24; break;
      case 'fly': G.scriptFly = !!a[0]; break;
      case 'sky': G.scene.background && G.scene.background.setRGB(+a[0], +a[1], +a[2]); break;
      case 'emote': G.emote && G.emote(+a[0] | 0); break;
      case 'model': { const g = G.modelMesh ? G.modelMesh(String(a[1])) : null; if (!g) break; g.position.set(+a[2], +a[3], +a[4]); g.scale.multiplyScalar(Math.min(20, +a[5] || 1)); g.rotation.y = +a[6] || 0; g.userData.sid = a[0]; G.scene.add(g); this.extra.push(g); break; }
      case 'npc': if (G.scriptNpc) G.scriptNpc(String(a[0]).slice(0, 24), +a[1], +a[2], +a[3], String(a[4] || 'Miau!').split('\n').slice(0, 8)); break;
    }
  },
  // Humanoid do jogador local mudado pelo servidor
  _hum(k, js) {
    const G = this.G, P = G.player, v = dec(js);
    if (k === 'MaxHealth') this._maxH = Math.max(1, +v || 100);
    else if (k === 'Health') { if (this.studio || G.mapId === 'custom') { const max = this._maxH || 100; S.hp = Math.max(0, Math.min(S.maxHp(), (+v / max) * S.maxHp())); emit('hp'); } if (+v <= 0) { play('ko', 0.8); G.fx.burst(P.pos.x, P.pos.y + 1, P.pos.z, 0xff5050, 30, 3, 2); emit('banner', '💀 Você caiu!', 2.5); } }
    else if (k === 'WalkSpeed') P.scriptWalk = Math.max(0, Math.min(10, (+v || 16) / 16)); else if (k === 'JumpPower') P.scriptJump = Math.max(0, Math.min(6, (+v || 50) / 50)); else if (k === 'JumpHeight') P.scriptJump = Math.max(0, Math.min(6, (+v || 7.2) / 7.2));
    else if (k === 'tp' && v && Number.isFinite(v.x)) P.teleport(v.x, v.y, v.z, P.yaw);
    else if (k === 'respawn') { const sp = (G.def && G.def.spawn) || [0, 0, 0]; P.teleport(sp[0], G.world.floorAt(sp[0], 80, sp[1]) + 0.3, sp[1], P.yaw); S.hp = S.maxHp(); emit('hp'); }
    else if (k === 'kick') { emit('toast', '🚪 O mapa te expulsou' + (v ? ': ' + String(v).slice(0, 80) : ''), '#ff9a8a'); setTimeout(() => G.travel('village'), 300); }
    this._vm('client', [['hum', k, js]]);
  },
  // ---------- mundo (Parts, GUI, valores, detectores) ----------
  _apply(op, server) {
    const [t, id] = op;
    if (t === 'n') { const cls = op[2]; if (this.objs.has(id)) return; const props = dec(op[4]) || {}; const o = { id, cls, parent: op[3], props, server }; this.objs.set(id, o);
      if (PART.test(cls)) { if (this.parts.size >= MAX_PARTS) { this.print('warn', 'Limite de ' + MAX_PARTS + ' Parts'); return; } const p = this._newPart(id, server); for (const k in props) this._setPart(p, k, props[k]); }
      else if (GUI.test(cls) && !server) { this._newGui(id, cls, op[3]); const g = this.gui.get(id); for (const k in props) this._setGui(g, k, props[k]); }
      else if (cls === 'ClickDetector' || cls === 'ProximityPrompt') this.dets.set(id, o);
      if (server) this.lbDirty = true; return; }
    const o = this.objs.get(id); if (!o) return;
    if (t === 's') { const v = dec(op[3]); o.props[op[2]] = v; const p = this.parts.get(id); if (p) this._setPart(p, op[2], v); else if (this.gui.has(id)) this._setGui(this.gui.get(id), op[2], v); if (o.server && (o.cls === 'Player' || /Value$/.test(o.cls) || op[2] === 'Name')) this.lbDirty = true; }
    else if (t === 'p') { o.parent = op[2]; const g = this.gui.get(id); if (g) { const par = this.gui.get(op[2]); (par ? par.el : this._root()).appendChild(g.el); } this.lbDirty = true; }
    else if (t === 'd') { const p = this.parts.get(id); if (p) { this._dropPart(p); this.parts.delete(id); } const g = this.gui.get(id); if (g) { g.el.remove(); this.gui.delete(id); } if (this.curPrompt && this.curPrompt.id === id) this.curPrompt = null; this.dets.delete(id); this.objs.delete(id); this.srvTouch.delete(id); this.touching.delete(id); this.lbDirty = true;
      const x = this.extra.find((e) => e.userData.sid === id); if (x && x.parent) x.parent.remove(x); }
  },
  _newPart(id, server) { const mat = new THREE.MeshLambertMaterial({ color: 0xa3a2a5 }); const m = new THREE.Mesh(geoms.Block, mat); m.castShadow = true; m.receiveShadow = true; m.userData.rvpart = id; this.G.scene.add(m);
    const p = { id, server, mesh: m, shape: 'Block', size: new THREE.Vector3(4, 1, 2), pos: new THREE.Vector3(0, 5, 0), rot: new THREE.Euler(0, 0, 0, 'YXZ'), anchored: true, collide: true, vel: new THREE.Vector3(), box: null, transp: 0 }; this.parts.set(id, p); this._fit(p); return p; },
  _setPart(p, k, v) {
    switch (k) {
      case 'Position': if (v instanceof THREE.Vector3) p.pos.copy(v); break;
      case 'Size': if (v instanceof THREE.Vector3) p.size.set(Math.max(0.05, Math.min(2048, v.x)), Math.max(0.05, Math.min(2048, v.y)), Math.max(0.05, Math.min(2048, v.z))); break;
      case 'Orientation': if (v instanceof THREE.Vector3) p.rot.set(v.x * Math.PI / 180, v.y * Math.PI / 180, v.z * Math.PI / 180, 'YXZ'); break;
      case 'Color': if (v instanceof THREE.Color) { p.mesh.material.color.copy(v); if (p.neon) p.mesh.material.emissive.copy(v).multiplyScalar(0.9); } break;
      case 'Transparency': p.transp = Math.max(0, Math.min(1, +v || 0)); this._mat(p); break;
      case 'Material': p.neon = v === 'Neon' || v === 'ForceField'; p.glass = v === 'Glass' || v === 'ForceField'; if (p.neon) p.mesh.material.emissive.copy(p.mesh.material.color).multiplyScalar(0.9); else p.mesh.material.emissive.setRGB(0, 0, 0); this._mat(p); break;
      case 'Anchored': p.anchored = !!v; break; case 'CanCollide': p.collide = !!v; break; case 'Velocity': if (v instanceof THREE.Vector3) p.vel.copy(v); break;
      case 'Shape': if (geoms[v]) { p.shape = v; p.mesh.geometry = geoms[v]; } break;
    } this._fit(p);
  },
  _mat(p) { const op = (1 - p.transp) * (p.glass ? 0.55 : 1); p.mesh.material.transparent = op < 1; p.mesh.material.opacity = op; p.mesh.visible = p.transp < 1; },
  _fit(p) { p.mesh.position.copy(p.pos); p.mesh.rotation.copy(p.rot); p.mesh.scale.copy(p.size); const W = this.G.world; if (!W) return;
    if (p.box) { const i = W.dyn.indexOf(p.box); if (i >= 0) W.dyn.splice(i, 1); p.box = null; }
    if (p.collide && p.mesh.visible !== false) { const h = p.size.clone().multiplyScalar(0.5); if (Math.abs(p.rot.y) > 0.01) { const c = Math.abs(Math.cos(p.rot.y)), s = Math.abs(Math.sin(p.rot.y)); const hx = h.x * c + h.z * s, hz = h.x * s + h.z * c; h.x = hx; h.z = hz; } p.box = [p.pos.x - h.x, p.pos.y - h.y, p.pos.z - h.z, p.pos.x + h.x, p.pos.y + h.y, p.pos.z + h.z]; W.dyn.push(p.box); } },
  _dropPart(p) { if (p.mesh) { p.mesh.parent && p.mesh.parent.remove(p.mesh); p.mesh.material.dispose(); } if (p.box && this.G && this.G.world) { const i = this.G.world.dyn.indexOf(p.box); if (i >= 0) this.G.world.dyn.splice(i, 1); } },
  // ---------- GUI ----------
  _root() { if (!this.guiRoot) { const r = this.guiRoot = document.createElement('div'); Object.assign(r.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: 16, fontFamily: 'sans-serif' }); document.body.appendChild(r); } return this.guiRoot; },
  _newGui(id, cls, parentId) { const el = document.createElement(/Button$/.test(cls) ? 'button' : cls === 'TextBox' ? 'input' : 'div'); const g = { id, cls, el }; Object.assign(el.style, { position: 'absolute', boxSizing: 'border-box', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', borderRadius: '8px', border: '0', font: 'bold 22px sans-serif' });
    if (cls === 'ScreenGui') Object.assign(el.style, { inset: '0', background: 'transparent', display: 'block' }); else { el.style.background = 'rgb(33,31,51)'; el.style.color = '#fff'; el.style.left = '0px'; el.style.top = '0px'; el.style.width = '200px'; el.style.height = '50px'; }
    if (/Button$/.test(cls)) { el.style.pointerEvents = 'auto'; el.style.cursor = 'pointer'; el.onclick = (e) => { e.stopPropagation(); this._vm('client', [['gui', id]]); }; }
    if (cls === 'TextBox') { el.style.pointerEvents = 'auto'; el.addEventListener('keydown', (e) => e.stopPropagation()); el.addEventListener('change', () => this._vm('client', [['gui', id, String(el.value).slice(0, 200)]])); }
    const par = this.gui.get(parentId); (par ? par.el : this._root()).appendChild(el); this.gui.set(id, g); },
  _setGui(g, k, v) { if (g.cls === 'ScreenGui' && k !== 'Visible' && k !== 'Enabled') return; const st = g.el.style, col = (c) => 'rgb(' + Math.round(c.r * 255) + ',' + Math.round(c.g * 255) + ',' + Math.round(c.b * 255) + ')';
    switch (k) { case 'Text': if (g.cls === 'TextBox') g.el.value = String(v).slice(0, 400); else g.el.textContent = String(v).slice(0, 400); break; case 'TextSize': st.fontSize = Math.max(6, Math.min(120, +v)) + 'px'; break; case 'TextColor3': if (v instanceof THREE.Color) st.color = col(v); break;
      case 'BackgroundColor3': if (v instanceof THREE.Color) { g.bg = col(v); st.background = g.bg; } break; case 'BackgroundTransparency': st.background = v >= 1 ? 'transparent' : g.bg || 'rgb(33,31,51)'; if (v > 0 && v < 1) st.opacity = 1 - v * 0.5; break;
      case 'Enabled': case 'Visible': st.display = v ? (g.cls === 'ScreenGui' ? 'block' : 'flex') : 'none'; break;
      case 'Position': if (g.cls !== 'ScreenGui' && Array.isArray(v)) { st.left = 'calc(' + (+v[0] * 100) + '% + ' + (+v[1]) + 'px)'; st.top = 'calc(' + (+v[2] * 100) + '% + ' + (+v[3]) + 'px)'; } break;
      case 'Size': if (g.cls !== 'ScreenGui' && Array.isArray(v)) { st.width = 'calc(' + (+v[0] * 100) + '% + ' + (+v[1]) + 'px)'; st.height = 'calc(' + (+v[2] * 100) + '% + ' + (+v[3]) + 'px)'; } break;
      case 'Image': if (/^Image/.test(g.cls) && /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(String(v))) { st.backgroundImage = 'url("' + String(v) + '")'; st.backgroundSize = 'contain'; st.backgroundRepeat = 'no-repeat'; st.backgroundPosition = 'center'; } break; } },
  // ---------- placar (leaderstats) ----------
  _leaderboard() {
    const rows = [], all = [...this.objs.values()]; let cols = [];
    for (const o of all) { if (o.cls !== 'Player' || !o.server) continue; const ls = all.find((x) => x.parent === o.id && x.props.Name === 'leaderstats'); if (!ls) continue;
      const vals = all.filter((x) => x.parent === ls.id && /Value$/.test(x.cls)); for (const v of vals) if (!cols.includes(v.props.Name)) cols.push(v.props.Name);
      rows.push({ name: o.props.Name || 'Gato', me: o.props.UserId === this.myUid(), vals: Object.fromEntries(vals.map((v) => [v.props.Name, v.props.Value])) }); }
    cols = cols.slice(0, 4);
    if (!rows.length) { if (this.lbEl) { this.lbEl.remove(); this.lbEl = null; } return; }
    if (!this.lbEl) { const el = this.lbEl = document.createElement('div'); Object.assign(el.style, { position: 'fixed', top: '10px', right: '10px', zIndex: 17, background: 'rgba(20,18,34,.82)', color: '#fff', borderRadius: '12px', padding: '8px 10px', font: '600 14px system-ui,sans-serif', pointerEvents: 'none', minWidth: '160px' }); document.body.appendChild(el); }
    const first = cols[0]; rows.sort((a, b) => (+b.vals[first] || 0) - (+a.vals[first] || 0));
    const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
    this.lbEl.innerHTML = '<table style="border-collapse:collapse;width:100%"><tr style="color:#ffd76a"><td>🐱</td>' + cols.map((c) => '<td style="padding-left:10px;text-align:right">' + esc(c) + '</td>').join('') + '</tr>' +
      rows.slice(0, 12).map((r) => '<tr' + (r.me ? ' style="color:#9cf09c"' : '') + '><td>' + esc(r.name).slice(0, 16) + '</td>' + cols.map((c) => '<td style="padding-left:10px;text-align:right">' + esc(r.vals[c] == null ? '-' : typeof r.vals[c] === 'number' ? Math.round(r.vals[c] * 100) / 100 : r.vals[c]).slice(0, 10) + '</td>').join('') + '</tr>').join('') + '</table>';
  },
  // ---------- ClickDetector / ProximityPrompt ----------
  _fire(d) { const me = this.myUid(); this._vm('client', [['click', d.id, me]]); if (d.server) { if (this.isHost()) this._vm('server', [['click', d.id, me]]); else this._net('rxk', { d: d.id }); } play('click', 0.6); },
  press(G) { if (!this.running) return false; if (this.curPrompt) { this._fire(this.curPrompt); return true; } if (!this.dets.size) return false;
    let best = null, bd = 1e9; const o = new THREE.Vector3(), dir = new THREE.Vector3(); G.camera.getWorldPosition(o); G.camera.getWorldDirection(dir); const ray = new THREE.Raycaster(o, dir, 0, 60);
    for (const d of this.dets.values()) { if (d.cls !== 'ClickDetector') continue; const p = this.parts.get(d.parent); if (!p || !p.mesh.visible) continue; const hit = ray.intersectObject(p.mesh, false)[0]; const max = +d.props.MaxActivationDistance || 32; if (hit && hit.distance < Math.min(bd, max)) { bd = hit.distance; best = d; } }
    if (best) { this._fire(best); return true; } return false; },
  _prompts() { const P = this.G.player.pos; let best = null, bd = 1e9;
    for (const d of this.dets.values()) { if (d.cls !== 'ProximityPrompt' || d.props.Enabled === false) continue; const p = this.parts.get(d.parent); if (!p) continue; const dist = p.pos.distanceTo(P) - Math.max(p.size.x, p.size.z) / 2; if (dist < (+d.props.MaxActivationDistance || 10) && dist < bd) { bd = dist; best = d; } }
    if (best !== this.curPrompt) { this.curPrompt = best; if (!best) { if (this.promptEl) this.promptEl.style.display = 'none'; return; }
      if (!this.promptEl) { const el = this.promptEl = document.createElement('div'); Object.assign(el.style, { position: 'fixed', left: '50%', bottom: '120px', transform: 'translateX(-50%)', zIndex: 17, background: 'rgba(20,18,34,.85)', color: '#fff', borderRadius: '12px', padding: '10px 16px', font: '700 17px system-ui,sans-serif', pointerEvents: 'none' }); document.body.appendChild(el); }
      const key = String(best.props.KeyboardKeyCode || 'E').slice(0, 10), esc = (t) => String(t || '').replace(/[&<>]/g, ''); this.promptEl.innerHTML = '<span style="background:#fff;color:#14122a;border-radius:6px;padding:1px 8px;margin-right:8px">' + esc(key) + '</span>' + esc(best.props.ActionText || 'Interagir') + (best.props.ObjectText ? ' <span style="color:#aab">· ' + esc(best.props.ObjectText) + '</span>' : ''); this.promptEl.style.display = 'block'; } },
  _key(e) { if (!this.running || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) || e.repeat) return; const down = e.type === 'keydown';
    this._vm('client', [['key', e.code, down ? 1 : 0]]); this._toMods({ op: 'key', a: e.code, b: down ? 1 : 0 });
    if (down && this.curPrompt && e.code === 'Key' + String(this.curPrompt.props.KeyboardKeyCode || 'E').toUpperCase()) this._fire(this.curPrompt); },
  mouse(down) { if (this.running) this._vm('client', [['mdown', down ? 1 : 0]]); },
  // ---------- jogadores (para o servidor) ----------
  _peerOf(uid) { if (uid === this.myUid()) return this._me(); for (const id of this.G.remotes.keys()) if (uidOf(id) === uid) return id; return null; },
  _players() { const G = this.G, P = G.player, list = [[this.myUid(), S.name || 'Gato', P.pos.x, P.pos.y, P.pos.z]]; G.remotes.forEach((r, id) => { if (r.has) list.push([uidOf(id), (r.meta && r.meta.name) || 'Gato', r.x, r.y, r.z]); }); return list; },
  _syncPlayers() { if (!this.vm.server || !this.ready.server) return; const now = new Set(), msgs = [];
    for (const p of this._players()) { now.add(p[0]); if (!this.srvUids.has(p[0])) msgs.push(['pjoin', p[0], p[1]]); }
    for (const u of this.srvUids) if (!now.has(u)) msgs.push(['pleave', u]); this.srvUids = now; if (msgs.length) this._vm('server', msgs); },
  // ---------- rede ----------
  _net(t, data) { if (net.online && this.G.remotes.size) net.send(t, data); },
  _push(op) { // fila de replicação (posições repetidas de uma mesma Part ficam só com a última)
    if (op[0] === 's') { const key = op[1] + '|' + op[2], i = this.outSet.get(key); if (i != null && this.out[i] && this.out[i][0] === 's' && this.out[i][1] === op[1] && this.out[i][2] === op[2]) { this.out[i] = op; return; } this.outSet.set(key, this.out.length); }
    this.out.push(op); },
  _flush() { if (!this.out.length) return; const ops = this.out; this.out = []; this.outSet.clear(); if (!net.online || !this.G.remotes.size) return; for (let i = 0; i < ops.length; i += MAX_OPS) net.send('rx', { ops: ops.slice(i, i + MAX_OPS) }); },
  _snapshot() { const ops = [], seen = new Set(), all = [...this.objs.values()].filter((o) => o.server);
    const add = (o) => { if (seen.has(o.id)) return; seen.add(o.id); const par = this.objs.get(o.parent); if (par && par.server) add(par); ops.push(['n', o.id, o.cls, o.parent || null, JSON.stringify(enc(o.props))]); };
    for (const o of all) add(o); return ops; },
  _requestSnap() { this.reqT = 3; this._net('rxreq', {}); },
  _applyRemote(ops) { const list = []; for (const op of ops || []) { if (!Array.isArray(op) || typeof op[1] !== 'string') continue; this._apply(op, true); const m = op[0] === 'n' ? ['rnew', op[1], op[2], op[3], op[4]] : op[0] === 's' ? ['rset', op[1], op[2], op[3]] : op[0] === 'p' ? ['rpar', op[1], op[2]] : op[0] === 'd' ? ['rdel', op[1]] : null; if (m) list.push(m); } this._vm('client', list); },
  onNet(e) {
    if (!this.running) return; const me = this._me(), fromHost = e.f === this.hostId, toMe = !e.to || e.to === me, isHost = this.isHost();
    switch (e.t) {
      case 'rx': if (fromHost && !isHost && Array.isArray(e.ops)) this._applyRemote(e.ops.slice(0, MAX_OPS)); break;
      case 'rxsnap': if (fromHost && e.to === me && Array.isArray(e.ops)) { this._applyRemote(e.ops.slice(0, MAX_OPS)); if (e.last) { this.snapOk = true; this.reqT = 0; } } break;
      case 'rxreq': if (isHost && this.vm.server) { const ops = this._snapshot(); if (!ops.length) { net.send('rxsnap', { to: e.f, ops: [], last: 1 }); break; } for (let i = 0; i < ops.length; i += MAX_OPS) net.send('rxsnap', { to: e.f, ops: ops.slice(i, i + MAX_OPS), last: i + MAX_OPS >= ops.length ? 1 : 0 }); } break;
      case 'rxc': if (isHost && typeof e.r === 'string' && typeof e.a === 'string' && e.a.length < 20000) this._vm('server', [['remote', e.r, uidOf(e.f), e.a]]); break;
      case 'rxi': if (isHost && typeof e.r === 'string' && typeof e.a === 'string' && e.a.length < 20000) this._vm('server', [['invoke', e.r, uidOf(e.f), +e.q, e.a]]); break;
      case 'rxk': if (isHost && typeof e.d === 'string' && this.dets.has(e.d)) this._vm('server', [['click', e.d, uidOf(e.f)]]); break;
      case 'rxe': if (fromHost && toMe && typeof e.a === 'string') this._vm('client', [['remote', e.r, null, e.a]]); break;
      case 'rxir': if (fromHost && e.to === me && typeof e.a === 'string') this._vm('client', [['ret', +e.q, true, e.a]]); break;
      case 'rxh': if (fromHost && e.to === me && typeof e.k === 'string') this._hum(e.k, e.v); break;
      case 'rxapi': if (fromHost && Array.isArray(e.a) && /^(toast|banner|fx|boom|model|npc|sky|time|gravity|play)$/.test(e.n)) this._api(e.n, e.a); break;
    }
  },
  // troca de anfitrião (alguém saiu ou chegou antes): limpa o mundo do servidor antigo e recomeça
  _checkHost() { const h = this._electHost(); if (h === this.hostId) return; const first = this.hostId == null, was = !first && this.isHost(); this.hostId = h;
    const gone = [...this.objs.values()].filter((o) => o.server).map((o) => ['d', o.id]); if (gone.length) this._applyRemote(gone);
    if (this.vm.server) { this.vm.server.remove(); this.vm.server = null; this.ready.server = false; this.srvUids.clear(); }
    if (this.isHost()) { if (this.cfg.server.length) { this._boot('server'); this.print('info', first ? '🖥 Você é o servidor deste mapa' : '🖥 Você virou o servidor deste mapa'); } } else { this.snapOk = false; if (this.cfg.server.length || was) this._requestSnap(); this.print('info', first ? '🌐 Servidor: outro jogador (você recebe o mundo dele)' : was ? 'Outro jogador virou o servidor' : '🌐 Novo servidor: outro jogador'); } },
  // ---------- DataStore ----------
  async _ds(op, storeName, key, a, b) {
    const ns = this.opts.mapId ? 'map:' + this.opts.mapId : 'local:' + (this.opts.mapName || 'studio'), lk = 'ds|' + ns + '|' + storeName + '|';
    const local = () => { const all = store.get('datastore', {}) || {};
      if (op === 'get') return all[lk + key] == null ? null : all[lk + key]; if (op === 'set') { all[lk + key] = String(a).slice(0, 16000); store.set('datastore', all); return null; } if (op === 'del') { delete all[lk + key]; store.set('datastore', all); return null; }
      if (op === 'list') { const items = Object.keys(all).filter((k) => k.startsWith(lk)).map((k) => ({ key: k.slice(lk.length), value: dec(all[k]) })).filter((x) => typeof x.value === 'number'); items.sort((x, y) => (a === 'asc' ? x.value - y.value : y.value - x.value)); return JSON.stringify(items.slice(0, Math.min(100, +b || 10))); } return null; };
    if (!this.opts.mapId || !net.online) return local();
    try { const r = await net.rpc('rv_ds', { p_map: String(this.opts.mapId), p_store: String(storeName).slice(0, 60), p_key: String(key).slice(0, 60), p_op: op, p_value: op === 'set' ? String(a).slice(0, 16000) : null, p_asc: a === 'asc', p_limit: Math.min(100, +b || 10) });
      return op === 'list' ? JSON.stringify(r || []) : r == null ? null : String(r); }
    catch (e) { if (/rv_ds|PGRST202|schema cache|does not exist/i.test(e.message || '')) { if (!this.dsWarned) { this.dsWarned = true; this.print('warn', 'DataStore do servidor ainda não instalado (supabase/datastore.sql): salvando só neste aparelho'); } return local(); } throw e; }
  },
  // ---------- a cada quadro ----------
  tick(dt) {
    if (!this.running || !this.G) return; const G = this.G, P = G.player, pp = P.pos, isHost = this.isHost();
    this.chkT -= dt; if (this.chkT <= 0) { this.chkT = 1; if (net.online) this._checkHost(); this._syncPlayers(); }
    if (!isHost && this.reqT > 0) { this.reqT -= dt; if (this.reqT <= 0 && !this.snapOk) this._requestSnap(); }
    const cli = [], srv = [], players = this.vm.server ? this._players() : null;
    for (const [id, p] of this.parts) {
      if (!p.anchored && (p.server ? isHost : true)) { p.vel.y -= 9.8 * (G.scriptGrav == null ? 1 : G.scriptGrav) * dt; p.pos.addScaledVector(p.vel, dt); const fl = G.world ? G.world.heightAt(p.pos.x, p.pos.z) + p.size.y / 2 : 0; if (p.pos.y < fl) { p.pos.y = fl; p.vel.y = Math.abs(p.vel.y) > 2 ? -p.vel.y * 0.3 : 0; p.vel.x *= 0.9; p.vel.z *= 0.9; } this._fit(p);
        if (p.server) { srv.push(['pos', id, p.pos.x, p.pos.y, p.pos.z]); this._push(['s', id, 'Position', JSON.stringify({ $v3: [p.pos.x, p.pos.y, p.pos.z] })]); } else cli.push(['pos', id, p.pos.x, p.pos.y, p.pos.z]); }
      const h = p.size, near = (x, y, z) => Math.abs(x - p.pos.x) < h.x / 2 + 0.35 && Math.abs(z - p.pos.z) < h.z / 2 + 0.35 && y + 1.2 > p.pos.y - h.y / 2 && y - 0.15 < p.pos.y + h.y / 2;
      const inside = near(pp.x, pp.y, pp.z); if (inside && !this.touching.has(id)) { this.touching.add(id); cli.push(['touch', id, 1]); } else if (!inside && this.touching.has(id)) { this.touching.delete(id); cli.push(['touch', id, 0]); }
      if (players && p.server) { let set = this.srvTouch.get(id); if (!set) this.srvTouch.set(id, set = new Set()); for (const q of players) { const t = near(q[2], q[3], q[4]); if (t && !set.has(q[0])) { set.add(q[0]); srv.push(['touch', id, 1, q[0]]); } else if (!t && set.has(q[0])) { set.delete(q[0]); srv.push(['touch', id, 0, q[0]]); } } } }
    if (this.vm.client) { this.camT -= dt; if (this.camT <= 0) { this.camT = 0.1; const cam = G.camera, o = new THREE.Vector3(), d = new THREE.Vector3(); cam.getWorldPosition(o); cam.getWorldDirection(d); const ray = new THREE.Raycaster(o, d, 0, 200); const meshes = [...this.parts.values()].map((p) => p.mesh).filter((m) => m.visible); const hit = meshes.length ? ray.intersectObjects(meshes, false)[0] : null; const hp = hit ? hit.point : o.clone().addScaledVector(d, 100);
        this.camJs = JSON.stringify([o.x, o.y, o.z, d.x, d.y, d.z, hp.x, hp.y, hp.z, hit ? hit.object.userData.rvpart : null]); }
      const others = []; G.remotes.forEach((r, id) => { if (r.has) others.push([uidOf(id), (r.meta && r.meta.name) || 'Gato', r.x, r.y, r.z]); });
      this._vm('client', [['tick', dt, pp.x, pp.y, pp.z, JSON.stringify(others), this.camJs], ...cli]); }
    if (this.vm.server) this._vm('server', [['tick', dt, 0, 0, 0, JSON.stringify(players), ''], ...srv]);
    if (this.mods.length) this._toMods({ op: 'tick', dt, p: [pp.x, pp.y, pp.z], touch: cli.filter((x) => x[0] === 'touch').map((x) => [x[1], x[2]]) });
    this.outT -= dt; if (this.outT <= 0) { this.outT = 0.1; if (isHost) this._flush(); }
    this.lbT -= dt; if (this.lbT <= 0 && this.lbDirty) { this.lbT = 0.25; this.lbDirty = false; this._leaderboard(); }
    if (this.dets.size) this._prompts(); else if (this.curPrompt) { this.curPrompt = null; if (this.promptEl) this.promptEl.style.display = 'none'; }
  },
  chat(text) { if (!this.running) return; const t = String(text).slice(0, 80); this._vm('client', [['chat', t, this.myUid()]]); if (this.isHost()) this._vm('server', [['chat', t, this.myUid()]]); this._toMods({ op: 'chat', a: t }); },
  remoteChat(id, text) { if (this.running && this.isHost()) this._vm('server', [['chat', String(text).slice(0, 80), uidOf(id)]]); }
};

// API JavaScript dos mods (vai como texto para dentro do iframe do mod)
function modApi() {
  const post = (m) => parent.postMessage(Object.assign({ __rv: 1 }, m), '*'); const L = { tick: [], key: [], chat: [], touch: [] }; let n = 0; const id = () => 'j' + (++n) + '_' + Math.random().toString(36).slice(2, 6);
  const set = (pid, k, v) => { if (v && typeof v === 'object' && 'x' in v) post({ op: 'set', id: pid, k, t: 'v3', v: [v.x, v.y, v.z] }); else if (Array.isArray(v) && k === 'Color') post({ op: 'set', id: pid, k, t: 'c3', v }); else post({ op: 'set', id: pid, k, v }); };
  window.rv = {
    part(props) { const pid = id(); post({ op: 'new', id: pid, k: 'Part' }); for (const k in props || {}) set(pid, k, props[k]); return { id: pid, set: (k, v) => set(pid, k, v), destroy: () => post({ op: 'del', id: pid }) }; },
    toast: (t, c) => post({ op: 'api', id: 'toast', v: [String(t), c || '#bfe6ff'] }), banner: (t, s) => post({ op: 'api', id: 'banner', v: [String(t), s || 3] }), say: (t) => post({ op: 'api', id: 'say', v: [String(t)] }),
    sound: (nm, vol) => post({ op: 'api', id: 'play', v: [nm, vol || 0.7] }), effect: (x, y, z, cor, q) => post({ op: 'api', id: 'fx', v: [x, y, z, cor || 0xffd040, q || 20] }), teleport: (x, y, z) => post({ op: 'api', id: 'teleport', v: [x, y, z] }),
    walkSpeed: (s) => post({ op: 'api', id: 'walk', v: [s] }), jumpPower: (s) => post({ op: 'api', id: 'jump', v: [s] }), gravity: (g) => post({ op: 'api', id: 'gravity', v: [g] }), clockTime: (h) => post({ op: 'api', id: 'time', v: [h] }), fly: (on) => post({ op: 'api', id: 'fly', v: [!!on] }),
    model: (key, x, y, z, s, ry) => { const pid = id(); post({ op: 'api', id: 'model', v: [pid, key, x, y, z, s || 1, ry || 0] }); return { destroy: () => post({ op: 'del', id: pid }) }; },
    npc: (nome, x, y, z, falas) => post({ op: 'api', id: 'npc', v: [nome, x, y, z, (falas || ['Miau!']).join('\n')] }),
    interactive: (on) => post({ op: 'interactive', v: !!on }),
    on(ev, fn) { (L[ev] || (L[ev] = [])).push(fn); }, player: { x: 0, y: 0, z: 0 }
  };
  addEventListener('message', (e) => { const m = e.data; if (!m || !m.__rvh) return; if (m.op === 'tick') { rv.player.x = m.p[0]; rv.player.y = m.p[1]; rv.player.z = m.p[2]; for (const f of L.tick) try { f(m.dt) } catch (er) { console.error(er); } for (const t of m.touch || []) for (const f of L.touch) f(t[0], !!t[1]); }
    else if (m.op === 'key') for (const f of L.key) f(m.a, !!m.b); else if (m.op === 'chat') for (const f of L.chat) f(m.a); });
}
