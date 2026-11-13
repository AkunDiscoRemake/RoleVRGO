import * as THREE from 'three';
import { G } from './game.js';
import { S } from './state.js';
import { net } from './net.js';
import { perf } from './perf.js';
import { MAPS, MAP_ORDER, MAP_ICONS } from './maps.js';
import { ITEMS, RARITY, QUESTS, ACHIEVEMENTS, PROFS, SHOPS, PICKS, GLOVES, RODS, QUICK_CHAT, currentEvent, HELD, PROPS, RECIPES, ACCS, PERKS, ALBUM } from './data.js';
import { music } from './music.js';
import { hands } from './hands.js';
import { LANG, LANGS, setLang, langName } from './i18n.js';
import { admin, EFFECTS, EVENTS_ADM } from './admin.js';
import { ENEMIES, BOSS_NAMES } from './data.js';
import { maker, SKIES, GROUNDS, MOODS, AMBS, COLORS, CAT_ORDER } from './maker.js';
import { rec } from './rec.js';
import { FUR_COLORS, EYE_COLORS, PATTERNS, HATS, EMOTES, roundRect } from './cat.js';
import { play, setVolume, audioVolume } from './assets.js';
import { on, emit, store, clamp } from './util.js';
import { VERSION } from './config.js';

// Menu e HUD desenhados em canvas e exibidos como painéis 3D. O "laser" do controle
// (ou o centro da tela no desktop) aponta; o gatilho clica. Todos os botões fazem algo real.
const W = 768, H = 512, PW = 1.5, PH = 1.0;
const TABS = [['map', '🗺 Mapa'], ['bag', '🎒 Bolsa'], ['quests', '📜 Missões'], ['profile', '🐱 Perfil'], ['social', '👥 Social'], ['emotes', '😺 Emotes'], ['maker', '🛠 Criar'], ['config', '⚙ Config']];
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _n = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _c = new THREE.Vector3(), _hit = new THREE.Vector3();

export const ui = {
  open: false, page: 'map', sub: 'room', scroll: 0, widgets: [], hover: null, npc: null, line: 0, kb: null, rooms: null, msg: '', shopSell: false,
  toasts: [], hudDirty: true, hudT: 0,

  init(scene, camera, player) {
    this.scene = scene; this.camera = camera; this.player = player;
    this.canvas = document.createElement('canvas'); this.canvas.width = W; this.canvas.height = H; this.g = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.minFilter = THREE.LinearFilter; this.tex.generateMipmaps = false;
    this.panel = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, fog: false, depthTest: false })); this.panel.renderOrder = 20; this.panel.visible = false; scene.add(this.panel);
    this.hl = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, fog: false, depthTest: false })); this.hl.renderOrder = 21; this.hl.visible = false; this.panel.add(this.hl);
    this.dot = new THREE.Mesh(new THREE.CircleGeometry(0.012, 10), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, fog: false, depthTest: false })); this.dot.renderOrder = 22; this.dot.visible = false; this.panel.add(this.dot);
    // HUD preso à cabeça (parte de baixo do campo de visão)
    this.hc = document.createElement('canvas'); this.hc.width = 512; this.hc.height = 160; this.hg = this.hc.getContext('2d');
    this.htex = new THREE.CanvasTexture(this.hc); this.htex.minFilter = THREE.LinearFilter; this.htex.generateMipmaps = false;
    this.hud = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.28), new THREE.MeshBasicMaterial({ map: this.htex, transparent: true, fog: false, depthTest: false, depthWrite: false })); this.hud.renderOrder = 15; this.hud.position.set(0, -0.36, -1.15); this.hud.rotation.x = -0.25; camera.add(this.hud);
    // faixa de anúncio (mensagens globais e eventos do admin)
    this.bc = document.createElement('canvas'); this.bc.width = 768; this.bc.height = 96; this.btex = new THREE.CanvasTexture(this.bc); this.btex.minFilter = THREE.LinearFilter; this.btex.generateMipmaps = false;
    this.banner = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.15), new THREE.MeshBasicMaterial({ map: this.btex, transparent: true, fog: false, depthTest: false, depthWrite: false })); this.banner.renderOrder = 16; this.banner.position.set(0, 0.3, -1.2); this.banner.visible = false; camera.add(this.banner); this.bannerT = 0;
    on('banner', (txt, secs) => { const g = this.bc.getContext('2d'); g.clearRect(0, 0, 768, 96); const grd = g.createLinearGradient(0, 0, 768, 0); grd.addColorStop(0, 'rgba(120,70,10,0.0)'); grd.addColorStop(0.12, 'rgba(120,70,10,0.9)'); grd.addColorStop(0.88, 'rgba(120,70,10,0.9)'); grd.addColorStop(1, 'rgba(120,70,10,0.0)'); g.fillStyle = grd; g.fillRect(0, 10, 768, 76);
      g.strokeStyle = '#ffd76a'; g.lineWidth = 3; g.beginPath(); g.moveTo(60, 12); g.lineTo(708, 12); g.moveTo(60, 84); g.lineTo(708, 84); g.stroke(); g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; let t = String(txt); while (t.length > 4 && g.measureText(t).width > 680) t = t.slice(0, -2); if (t !== String(txt)) t += '…'; g.fillStyle = '#fff6d0'; g.fillText(t, 384, 49); this.btex.needsUpdate = true; this.banner.visible = true; this.bannerT = secs || 5; });
    // mira (desktop)
    this.cross = new THREE.Mesh(new THREE.RingGeometry(0.004, 0.007, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, fog: false, depthTest: false })); this.cross.position.z = -0.6; this.cross.renderOrder = 30; camera.add(this.cross);
    player.onMenu = () => this.toggle();
    player.onBack = () => this.quick();
    G.uiClick = () => this.click();
    on('toast', (t, c) => { this.toasts.push({ t, c: c || '#fff', life: 4.5 }); if (this.toasts.length > 3) this.toasts.shift(); this.hudDirty = true; });
    for (const ev of ['hp', 'xp', 'coins', 'net', 'combo', 'map', 'event', 'rec']) on(ev, () => { this.hudDirty = true; });
    on('view', (m) => { S.toast('📷 Câmera: ' + ['1ª pessoa', '2ª pessoa', '3ª pessoa'][m - 1], '#bfe6ff'); this.dirty = true; });
    for (const ev of ['inv', 'coins', 'players', 'friends', 'party', 'chat', 'lobby', 'map', 'meta', 'hands']) on(ev, () => { if (this.open) this.dirty = true; });
    on('dialog', (n) => { this.npc = n; this.line = Math.floor(Math.random() * n.lines.length); this.show('dialog'); });
    on('friendsDirty', () => G.refreshFriends()); on('partyChat', (m) => { G._log('[grupo] ' + m.n, m.x); play('msg', 0.4); });
    on('combo', (n) => { this.combo = n; });
    on('maker', () => { if (this.open) this.dirty = true; }); on('key', (c) => { if (!(this.open && this.page === 'kb')) maker.key(c); });
    on('makerText', (o) => this.keyboard(o.k === 'npc' ? 'NPC — escreva "Nome: fala"' : 'Texto da placa', '', 60, (t) => { if (o.k === 'npc') { const i = t.indexOf(':'); o.d = { name: (i > 0 ? t.slice(0, i) : 'Gato').trim().slice(0, 16), text: (i > 0 ? t.slice(i + 1) : t).trim() }; } else o.d = { text: t }; maker.commit(o); }, 'close'));
    addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT') return;
      if (this.open && this.page === 'kb') { if (e.key === 'Enter') this._kbDone(); else if (e.key === 'Backspace') { this.kb.text = this.kb.text.slice(0, -1); this.dirty = true; } else if (e.key === 'Escape') this.show(this.kb.back); else if (e.key.length === 1 && this.kb.text.length < this.kb.max) { this.kb.text += e.key; this.dirty = true; } e.preventDefault(); }
      else if (e.code === 'Enter' && !this.open) { this.keyboard('Mensagem para a sala', '', 60, (t) => { G.say(t); }, 'close'); }
      else if (e.code === 'Escape' && this.open) this.hide();
      else if (e.code === 'Backspace') { e.preventDefault(); this.quick(); }
      else if (!this.open && /^Digit[1-9]$/.test(e.code)) G.emote(+e.code.slice(5));
    });
  },
  toggle() { if (this.open) this.hide(); else this.show(this.page === 'dialog' || this.page === 'shop' || this.page === 'prof' || this.page === 'kb' || this.page[0] === 'q' ? 'map' : this.page); },
  // Menu rápido (botão Back): coluna vertical de categorias. Back de novo volta um nível / fecha.
  quick() { if (!this.open) this.show('q_root'); else if (this.page === 'q_root') this.hide(); else if (this.page === 'kb') this.show(this.kb.back === 'close' ? 'q_root' : this.kb.back); else { this.page = 'q_root'; this.scroll = 0; this.msg = ''; this.dirty = true; play('click', 0.4); } },
  qrow(i, title, sub, cb, o) { o = o || {}; const y = 64 + i * 58, x = 214, w = 340; this.btn(x + 10, y, w - 20, 52, sub ? '' : title, cb, o); if (sub) { this.text(x + 24, y + 17, title, { fs: 19, c: o.off ? '#8a88a0' : '#fff', max: w - 50 }); this.text(x + 24, y + 38, sub, { fs: 14, b: false, c: o.off ? '#8a88a0' : '#dfe6ff', max: w - 50 }); } },
  qhead(title, root) { this.text(384, 34, title, { a: 'center', fs: 22, c: '#ffd76a' }); if (!root) this.btn(224, 14, 70, 38, '◀', () => { this.page = 'q_root'; this.scroll = 0; this.msg = ''; }, { bg: '#33355a' }); this.btn(474, 14, 70, 38, '✕', () => this.hide(), { bg: '#b04050' }); },
  qpager(n, per) { const pages = Math.max(1, Math.ceil(n / per)); this.scroll = clamp(this.scroll, 0, pages - 1); if (pages > 1) { this.btn(224, 462, 90, 40, '▲', () => { this.scroll--; }, { off: this.scroll <= 0, bg: '#33355a' }); this.text(384, 482, (this.scroll + 1) + '/' + pages, { a: 'center' }); this.btn(454, 462, 90, 40, '▼', () => { this.scroll++; }, { off: this.scroll >= pages - 1, bg: '#33355a' }); } return this.scroll * per; },
  p_q_root() {
    this.qhead('Menu rápido', true); const h = S.held(), P = this.player;
    const rows = [['🐱 Avatar', 'q_avatar'], ['🗡 Itens na pata: ' + h.n, 'q_items'], ['🔨 Fabricar itens', 'q_craft'], ['📦 Colocar objetos', 'q_spawn'], ['😺 Emotes', 'q_emotes'], ['🗺 Viajar', 'q_travel'], ['🍖 Consumíveis', 'q_use']];
    rows.forEach((r, i) => this.btn(224, 60 + i * 44, 320, 40, r[0], () => { this.page = r[1]; this.scroll = 0; }, { bg: '#4a5cc8', fs: 18 }));
    this.btn(224, 60 + 7 * 44, 320, 40, '📷 Câmera: ' + ['1ª pessoa', '2ª pessoa (de frente)', '3ª pessoa (por trás)'][P.viewMode - 1], () => P.cycleView(), { bg: '#33355a', fs: 17 });
    this.btn(224, 60 + 8 * 44, 320, 40, rec.on ? '⏹ Parar e baixar vídeo (' + Math.floor(rec.seconds()) + 's)' : '⏺ Gravar vídeo', () => { const m = rec.toggle(G.renderer.domElement); if (m) this.msg = m; else if (rec.on) this.hide(); }, { bg: rec.on ? '#b04050' : '#33355a', fs: 17, off: !rec.supported() });
    this.btn(224, 60 + 9 * 44, 320, 40, '📜 Menu completo', () => { this.page = 'map'; }, { bg: '#33355a', fs: 17 });
  },
  p_q_craft() {
    this.qhead('🔨 Fabricar'); const off = this.qpager(RECIPES.length, 6);
    RECIPES.slice(off, off + 6).forEach((r, i) => { const st = S.recipeState(r); const need = Object.keys(r.need).map((k) => ITEMS[k].n + ' ' + S.count(k) + '/' + r.need[k]).join(' · ');
      this.qrow(i, (st.done ? '✔ ' : '') + r.n, st.done ? 'Você já tem' : st.locked ? 'Fabrique o nível anterior primeiro' : need, () => { this.msg = S.craft(r); if (!this.msg) emit('saveNow'); }, { off: !st.ok, bg: '#3a9a5a' }); });
    this.text(384, 424, 'Materiais vêm de mineração, coleta e pesca.', { a: 'center', fs: 13, c: '#99a', b: false });
  },
  p_q_avatar() {
    this.qhead('🐱 Avatar'); const L = S.look, d = S.d;
    const cyc = (list, key, dir) => { const i = list.indexOf(L[key]); L[key] = list[(i + dir + list.length) % list.length]; this._look(); };
    const row = (i, label, value, color, prev, next) => { const y = 64 + i * 58; this.btn(224, y, 60, 52, '◀', prev, { bg: '#33355a' }); this.btn(484, y, 60, 52, '▶', next, { bg: '#33355a' }); const g = this.g; g.fillStyle = 'rgba(255,255,255,0.08)'; roundRect(g, 290, y, 188, 52, 9); g.fill(); this.text(384, y + 15, label, { a: 'center', fs: 14, c: '#bfe6ff', b: false }); if (color) { g.fillStyle = color; roundRect(g, 344, y + 26, 80, 20, 6); g.fill(); } else this.text(384, y + 36, value, { a: 'center', fs: 17, max: 180 }); };
    row(0, 'Pelagem', '', L.fur, () => cyc(FUR_COLORS, 'fur', -1), () => cyc(FUR_COLORS, 'fur', 1));
    row(1, 'Cor de detalhe', '', L.fur2, () => cyc(FUR_COLORS, 'fur2', -1), () => cyc(FUR_COLORS, 'fur2', 1));
    row(2, 'Olhos', '', L.eyes, () => cyc(EYE_COLORS, 'eyes', -1), () => cyc(EYE_COLORS, 'eyes', 1));
    row(3, 'Padrão', PATTERNS[L.pattern], null, () => { L.pattern = (L.pattern + PATTERNS.length - 1) % PATTERNS.length; this._look(); }, () => { L.pattern = (L.pattern + 1) % PATTERNS.length; this._look(); });
    const hi = Math.max(0, d.hats.indexOf(L.hat)); row(4, 'Chapéu (' + d.hats.length + ' seus)', HATS[L.hat], null, () => { L.hat = d.hats[(hi + d.hats.length - 1) % d.hats.length]; this._look(); }, () => { L.hat = d.hats[(hi + 1) % d.hats.length]; this._look(); });
    this.qrow(5, '✏ Nome: ' + S.name, null, () => this.keyboard('Seu nome', S.name, 16, (t) => { if (/^hark/i.test(t.trim()) && !admin.is) { S.toast('Nome reservado ao admin', '#ff9a8a'); return; } S.name = t.trim() || S.name; S.touch(); G.pushMeta(); emit('saveNow'); }, 'q_avatar'), { bg: '#33355a', fs: 17 });
    const own = ACCS.map((a, i) => i).filter((i) => S.accOk(i)), ai = Math.max(0, own.indexOf(L.acc || 0)); row(6, 'Acessório (' + (own.length - 1) + '/' + (ACCS.length - 1) + ' conquistados)', ACCS[L.acc || 0].n, null, () => { L.acc = own[(ai + own.length - 1) % own.length]; this._look(); }, () => { L.acc = own[(ai + 1) % own.length]; this._look(); });
    this.text(384, 484, 'Veja como conquistar em Missões > Acessórios.', { a: 'center', fs: 13, c: '#99a', b: false });
  },
  p_q_items() {
    this.qhead('🗡 Itens na pata'); const off = this.qpager(HELD.length, 6);
    HELD.slice(off, off + 6).forEach((h, i) => { const own = S.d.held.indexOf(h.id) >= 0, on = S.d.hand === h.id, pr = S.buyPrice(h.price); this.qrow(i, (on ? '✔ ' : '') + h.n + (own ? '' : '  —  ' + pr + ' 💰'), h.d + (own ? on ? '  (na pata)' : '  — toque para segurar' : S.d.coins < pr ? '  — moedas insuficientes' : '  — toque para comprar'), () => { this.msg = S.setHand(h.id); if (!this.msg) emit('saveNow'); }, { sel: on, off: !own && S.d.coins < pr, bg: own ? '#4a5cc8' : '#3a9a5a' }); });
    this.text(384, 424, '💰 ' + S.d.coins + ' moedas · o bônus vale enquanto o item está na pata', { a: 'center', fs: 13, c: '#ffd76a', b: false, max: 330 });
  },
  p_q_spawn() {
    this.qhead('📦 Colocar objetos'); let mine = 0; G.props.forEach((p) => { if (p.owner === (net.id || 'me')) mine++; });
    PROPS.slice(0, 6).forEach((p, i) => this.qrow(i, p.n, p.spring ? 'Pula alto! Aparece à sua frente' : p.fire ? 'Decoração com faíscas' : p.nocol ? 'Decoração' : 'Sólido: dá para subir e escalar', () => { G.spawnProp(p.id); }, { bg: '#4a5cc8' }));
    this.btn(224, 414, 156, 42, PROPS[6].n, () => G.spawnProp(PROPS[6].id), { bg: '#4a5cc8', fs: 16 }); this.btn(388, 414, 156, 42, '🧹 Limpar (' + mine + '/8)', () => G.clearProps(), { bg: '#8a4a4a', fs: 16, off: !mine });
    this.text(384, 480, 'Todos na sala veem seus objetos.', { a: 'center', fs: 13, c: '#99a', b: false });
  },
  p_q_emotes() { this.qhead('😺 Emotes'); EMOTES.forEach((e, i) => this.btn(224 + (i % 2) * 162, 64 + Math.floor(i / 2) * 58, 156, 52, e.icon + ' ' + e.name, () => { G.emote(e.id); this.hide(); }, { bg: '#4a5cc8', fs: 18 })); },
  p_q_travel() { this.qhead('🗺 Viajar'); const ids = MAP_ORDER.filter((id) => id === 'village' || S.d.maps.indexOf(id) >= 0); const off = this.qpager(ids.length, 6); ids.slice(off, off + 6).forEach((id, i) => this.qrow(i, MAP_ICONS[id] + ' ' + MAPS[id].name, id === G.mapId ? 'Você está aqui' : 'Toque para viajar', () => { this.hide(); G.travel(id); }, { off: id === G.mapId, bg: '#4a5cc8' })); if (ids.length < MAP_ORDER.length) this.text(384, 440, 'Outros mapas: entre pelos portais da Vila.', { a: 'center', fs: 13, c: '#99a', b: false }); },
  p_q_use() { this.qhead('🍖 Consumíveis'); const ids = ['snack', 'catnip']; ids.forEach((id, i) => { const it = ITEMS[id], c = S.count(id); this.qrow(i, it.n + '  x' + c, it.heal ? 'Recupera ' + it.heal + ' de vida' : '+20% de XP por 3 minutos', () => S.useItem(id), { off: !c, bg: '#3a9a5a' }); }); this.text(384, 200, 'Vida: ' + Math.round(S.hp) + '/' + S.maxHp() + ' · compre mais nas mercearias', { a: 'center', fs: 13, c: '#99a', b: false }); },
  show(page) {
    this.page = page; this.scroll = 0; this.msg = '';
    if (!this.open) {
      const P = this.player, yaw = P.viewYaw; P.headPos(_c);
      this.panel.position.set(_c.x - Math.sin(yaw) * 1.25, _c.y - 0.08, _c.z - Math.cos(yaw) * 1.25); this.panel.rotation.set(0, yaw, 0);
      this.panel.visible = true; this.open = true; G.uiOpen = true; play('open', 0.5);
    }
    if (page === 'social') this._loadRooms();
    this.dirty = true;
  },
  hide() { this.open = false; G.uiOpen = false; this.panel.visible = false; this.hl.visible = false; this.dot.visible = false; play('close', 0.4); },

  // ---------- ponteiro ----------
  pointer() {
    const P = this.player;
    _o.copy(P.aimPos); _d.copy(P.aimDir);
    this.panel.getWorldDirection(_n); const den = _d.dot(_n); if (den > -0.01) return null;
    const t = _c.copy(this.panel.position).sub(_o).dot(_n) / den; if (t < 0 || t > 6) return null;
    _hit.copy(_o).addScaledVector(_d, t).sub(this.panel.position);
    _r.set(1, 0, 0).applyQuaternion(this.panel.quaternion); _u.set(0, 1, 0);
    const lx = _hit.dot(_r), ly = _hit.dot(_u); if (Math.abs(lx) > PW / 2 || Math.abs(ly) > PH / 2) return null;
    G.uiDist = t; return { x: (lx / PW + 0.5) * W, y: (0.5 - ly / PH) * H, lx, ly };
  },
  click() {
    if (!this.open) return false; const p = this.pointer(); if (!p) { if (this.page !== 'kb') this.hide(); return true; }
    for (let i = this.widgets.length - 1; i >= 0; i--) { const w = this.widgets[i]; if (p.x >= w.x && p.x <= w.x + w.w && p.y >= w.y && p.y <= w.y + w.h) { if (w.off) play('error', 0.4); else { play('click', 0.5); w.cb(); this.dirty = true; } return true; } }
    return true;
  },
  update(dt) {
    // HUD
    for (const t of this.toasts) t.life -= dt; if (this.toasts.length && this.toasts[0].life <= 0) { this.toasts.shift(); this.hudDirty = true; }
    this.hudT -= dt; if (this.hudDirty && this.hudT <= 0) { this.hudDirty = false; this.hudT = 0.2; this.drawHud(); }
    this.cross.visible = this.player.desktop;
    if (this.bannerT > 0) { this.bannerT -= dt; this.banner.material.opacity = Math.min(1, this.bannerT * 2); this.banner.scale.setScalar(1 + Math.max(0, this.bannerT - (this.bannerT > 0 ? 0 : 0)) * 0); if (this.bannerT <= 0) this.banner.visible = false; }
    if (!this.open) return;
    if (this.page === 'config' || this.page === 'map') { this.cfgT = (this.cfgT || 0) - dt; if (this.cfgT <= 0) { this.cfgT = 1; this.dirty = true; } }
    if (this.dirty) { this.dirty = false; this.draw(); }
    const p = this.pointer(); let hov = null;
    if (p) { this.dot.visible = true; this.dot.position.set(p.lx, p.ly, 0.004); for (let i = this.widgets.length - 1; i >= 0; i--) { const w = this.widgets[i]; if (p.x >= w.x && p.x <= w.x + w.w && p.y >= w.y && p.y <= w.y + w.h) { hov = w; break; } } } else this.dot.visible = false;
    if (hov !== this.hover) { this.hover = hov; if (hov) { play('hover', 0.25); this.hl.visible = true; this.hl.scale.set(hov.w / W * PW, hov.h / H * PH, 1); this.hl.position.set(((hov.x + hov.w / 2) / W - 0.5) * PW, (0.5 - (hov.y + hov.h / 2) / H) * PH, 0.002); } else this.hl.visible = false; }
    // fecha se o jogador se afastar
    if (this.panel.position.distanceToSquared(this.player.pos) > 16) this.hide();
  },

  // ---------- primitivas de desenho ----------
  btn(x, y, w, h, label, cb, o) {
    o = o || {}; const g = this.g; g.fillStyle = o.off ? '#3a3850' : o.sel ? '#e8a030' : o.bg || '#4a5cc8'; roundRect(g, x, y, w, h, 9); g.fill();
    g.fillStyle = o.off ? '#8a88a0' : o.fg || '#fff'; let fs = o.fs || 20; g.font = 'bold ' + fs + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const tw = g.measureText(label).width; if (tw > w - 8) { fs = Math.max(11, Math.floor(fs * (w - 8) / tw)); g.font = 'bold ' + fs + 'px sans-serif'; }
    g.fillText(label, x + w / 2, y + h / 2 + 1); this.widgets.push({ x, y, w, h, cb, off: !!o.off });
  },
  text(x, y, str, o) { o = o || {}; const g = this.g; g.fillStyle = o.c || '#fff'; g.font = (o.b === false ? '' : 'bold ') + (o.fs || 20) + 'px sans-serif'; g.textAlign = o.a || 'left'; g.textBaseline = 'middle'; if (o.max) { let s = str; while (s.length > 3 && g.measureText(s).width > o.max) s = s.slice(0, -2); if (s !== str) str = s + '…'; } g.fillText(str, x, y); },
  wrap(x, y, str, maxW, lh, o) { const g = this.g; o = o || {}; g.font = (o.b === false ? '' : 'bold ') + (o.fs || 20) + 'px sans-serif'; const words = String(str).split(' '); let line = ''; for (const wd of words) { if (g.measureText(line + wd).width > maxW && line) { this.text(x, y, line, o); y += lh; line = ''; } line += wd + ' '; } if (line) { this.text(x, y, line, o); y += lh; } return y; },
  bar(x, y, w, h, f, c) { const g = this.g; g.fillStyle = 'rgba(0,0,0,0.5)'; roundRect(g, x, y, w, h, h / 2); g.fill(); if (f > 0.01) { g.fillStyle = c; roundRect(g, x, y, Math.max(h, w * clamp(f, 0, 1)), h, h / 2); g.fill(); } },
  pager(n, per, y) { const pages = Math.max(1, Math.ceil(n / per)); this.scroll = clamp(this.scroll, 0, pages - 1); if (pages > 1) { this.btn(560, y, 50, 36, '◀', () => { this.scroll--; }, { off: this.scroll <= 0 }); this.text(650, y + 18, (this.scroll + 1) + '/' + pages, { a: 'center' }); this.btn(690, y, 50, 36, '▶', () => { this.scroll++; }, { off: this.scroll >= pages - 1 }); } return this.scroll * per; },

  draw() {
    const g = this.g; this.widgets.length = 0; this.hover = null; this.hl.visible = false;
    g.clearRect(0, 0, W, H);
    if (this.page[0] === 'q' && this.page[1] === '_') { g.fillStyle = 'rgba(24,22,44,0.95)'; roundRect(g, 214, 0, 340, H, 20); g.fill(); g.strokeStyle = '#ffd76a'; g.lineWidth = 3; roundRect(g, 216, 2, 336, H - 4, 18); g.stroke(); this['p_' + this.page](); if (this.msg) this.text(384, H - 14, this.msg, { a: 'center', c: '#ff9a8a', fs: 14 }); this.tex.needsUpdate = true; return; }
    g.fillStyle = 'rgba(24,22,44,0.94)'; roundRect(g, 0, 0, W, H, 22); g.fill(); g.strokeStyle = '#6a7cff'; g.lineWidth = 3; roundRect(g, 2, 2, W - 4, H - 4, 20); g.stroke();
    const sub2 = this.page === 'ach' || this.page === 'album' || this.page === 'perks' || this.page === 'accs';
    const modal = false && this.page === 'admin' || this.page === 'mk_pal' || this.page === 'dialog' || this.page === 'shop' || this.page === 'prof' || this.page === 'kb' || this.page === 'help' || sub2;
    const tabs = admin.is ? TABS.concat([['admin', '👑 Admin']]) : TABS, tw = 752 / tabs.length;
    if (!modal) { tabs.forEach((t, i) => this.btn(8 + i * tw, 10, tw - 3, 44, t[1], () => { this.page = t[0]; this.scroll = 0; this.msg = ''; if (t[0] === 'social') this._loadRooms(); if (t[0] === 'maker') this._mkLoad(); }, { sel: this.page === t[0], fs: tabs.length > 8 ? 13 : 15, bg: t[0] === 'admin' ? '#8a6a10' : '#33355a' })); }
    else this.btn(W - 60, 10, 48, 44, '✕', () => { if (this.page === 'kb') this.show(this.kb.back); else if (this.page === 'shop' || this.page === 'prof') this.page = 'dialog'; else if (sub2) this.page = 'quests'; else if (this.page === 'mk_pal') this.page = 'maker'; else if (this.page === 'help') this.page = 'config'; else this.hide(); }, { bg: '#b04050' });
    this['p_' + this.page]();
    if (this.msg) { g.fillStyle = 'rgba(0,0,0,0.6)'; roundRect(g, 140, H - 44, W - 280, 34, 10); g.fill(); this.text(W / 2, H - 27, this.msg, { a: 'center', c: '#ffd76a', fs: 18 }); }
    this.tex.needsUpdate = true;
  },

  // ---------- páginas ----------
  p_map() {
    const ev = currentEvent(net.now()); this.text(20, 80, 'Viagem rápida (mapas já visitados)', { c: '#bfe6ff' });
    MAP_ORDER.forEach((id, i) => { const ok = id === 'village' || S.d.maps.indexOf(id) >= 0, here = id === G.mapId; this.btn(20 + (i % 7) * 104, 96 + Math.floor(i / 7) * 92, 100, 84, MAP_ICONS[id] + ' ' + MAPS[id].name, () => { this.hide(); G.travel(id); }, { off: !ok || here, sel: here, fs: 16, bg: ev.active && ev.map === id ? '#a05cc8' : '#4a5cc8' }); });
    this.text(20, 278, 'Mapas com 🔒 cinza: entre uma vez pelo portal na Vila para liberar.', { fs: 15, c: '#99a', b: false });
    const g = this.g; g.fillStyle = 'rgba(255,255,255,0.07)'; roundRect(g, 20, 296, W - 40, 150, 12); g.fill();
    this.text(34, 318, '🌟 ' + (ev.active ? 'Evento ativo: ' + ev.ev.n : 'Próximo evento: ' + ev.ev.n), { c: '#ffe070' });
    this.text(34, 344, ev.ev.d + ' ' + MAPS[ev.map].name + (ev.active ? ' — termina em ' : ' — começa em ') + Math.ceil(ev.left / 60) + ' min', { fs: 17, b: false });
    const h = G.sky.hour; this.text(34, 376, (h > 6 && h < 18 ? '☀ Dia' : '🌙 Noite') + ' — ' + String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.floor((h % 1) * 60)).padStart(2, '0') + '   |   Sala: ' + G.roomName + ' (' + (G.roomPublic ? 'pública' : 'privada') + ')', { fs: 17 });
    this.text(34, 404, 'Jogadores neste mapa: ' + (G.remotes.size + 1) + '   |   Online no jogo: ' + (net.online ? Math.max(1, net.onlineCount()) : 0) + '   |   Rede: ' + (net.online ? net.status : 'offline'), { fs: 17 });
    this.text(34, 430, 'Você: ' + S.name + ' — Nv ' + S.d.level + ' — ' + S.d.coins + ' moedas' + (S.d.prof ? ' — ' + PROFS[S.d.prof].n : ''), { fs: 17, c: '#9cf09c' });
    this.btn(20, 458, 160, 40, '❓ Como jogar', () => { this.page = 'help'; }, { bg: '#33355a', fs: 17 });
    this.btn(190, 458, 200, 40, '🌐 ' + langName(), () => { const i = LANGS.findIndex((l) => l[0] === LANG); setLang(LANGS[(i + 1) % LANGS.length][0]); emit('saveNow'); this.msg = '...'; setTimeout(() => location.reload(), 600); }, { bg: '#33355a', fs: 17 });
  },
  p_bag() {
    const d = S.d; this.text(20, 78, '💰 ' + d.coins + ' moedas', { c: '#ffd76a', fs: 22 });
    this.text(250, 78, '⛏ ' + PICKS[d.equip.pick].n + '   🥊 ' + GLOVES[d.equip.glove].n + '   🎣 ' + RODS[d.equip.rod].n, { fs: 15, c: '#bfe6ff', max: 500 });
    const ids = Object.keys(d.inv).sort((a, b) => (ITEMS[b] ? ITEMS[b].r : 0) - (ITEMS[a] ? ITEMS[a].r : 0)); const off = this.pager(ids.length, 8, 460);
    if (!ids.length) this.text(W / 2, 250, 'Bolsa vazia. Minere, pesque, colete e abra baús!', { a: 'center', c: '#99a' });
    ids.slice(off, off + 8).forEach((id, i) => { const it = ITEMS[id]; if (!it) return; const y = 104 + i * 43; const g = this.g; g.fillStyle = 'rgba(255,255,255,0.06)'; roundRect(g, 20, y, W - 40, 38, 8); g.fill(); this.text(34, y + 19, it.n, { c: RARITY[it.r].c }); this.text(300, y + 19, 'x' + d.inv[id], {}); this.text(380, y + 19, RARITY[it.r].n, { fs: 16, c: RARITY[it.r].c, b: false }); this.text(500, y + 19, it.v ? it.v + ' 💰' : '—', { fs: 16, b: false }); if (it.k === 'food') this.btn(620, y + 3, 110, 32, 'Usar', () => S.useItem(id), { bg: '#3a9a5a', fs: 17 }); });
    this.text(20, 478, 'Venda itens nas lojas dos NPCs.', { fs: 15, c: '#99a', b: false });
  },
  p_quests() {
    const d = S.d; this.text(20, 76, 'Missões diárias', { c: '#ffd76a', fs: 18 }); this.text(W - 20, 76, '📅 Sequência: dia ' + (d.streak.n || 1), { a: 'right', fs: 15, c: '#bfe6ff' });
    S.dailyList().forEach((q, i) => { const y = 90 + i * 38, pr = d.daily.prog[i], done = pr >= q.goal.n, cl = d.daily.claimed.indexOf(i) >= 0; this.bar(20, y, 500, 32, pr / q.goal.n, cl ? '#3a6a4a' : '#3a9a5a'); this.text(32, y + 16, q.title + '  (' + pr + '/' + q.goal.n + ')', { fs: 16 }); this.btn(532, y, 216, 32, cl ? '✔ Resgatada' : '+' + q.xp + ' XP  +' + q.coins + ' 💰', () => S.claimDaily(i), { off: !done || cl, bg: '#e8a030', fs: 15 }); });
    this.text(20, 220, 'Contrato (infinitos — a recompensa cresce com seu nível)', { c: '#ffd76a', fs: 18 }); const c = d.contract;
    if (c) { this.bar(20, 234, 500, 34, c.p / c.n, '#a05cc8'); this.text(32, 251, c.title + '  (' + c.p + '/' + c.n + ')', { fs: 16 }); this.btn(532, 234, 150, 34, '+' + c.xp + ' XP +' + c.coins + '💰', () => S.claimContract(), { off: c.p < c.n, bg: '#e8a030', fs: 14 }); this.btn(688, 234, 60, 34, '↻', () => S.newContract(), { bg: '#8a4a4a' }); }
    else this.btn(20, 234, 728, 34, '📋 Pegar um contrato novo', () => S.newContract(), { bg: '#a05cc8', fs: 17 });
    this.text(20, 290, 'Missões de NPCs', { c: '#ffd76a', fs: 18 }); const act = Object.keys(d.q.active); const off = this.pager(act.length, 3, 458);
    if (!act.length) this.text(20, 322, 'Nenhuma ativa. Fale com NPCs marcados com ❗', { fs: 16, c: '#99a', b: false });
    act.slice(off, off + 3).forEach((id, i) => { const q = QUESTS[id], y = 304 + i * 48, pr = S.questProgress(id); this.bar(20, y, W - 40, 42, pr / q.goal.n, '#4a5cc8'); this.text(32, y + 13, q.title + '  (' + pr + '/' + q.goal.n + ')', { fs: 16 }); this.text(32, y + 31, q.desc, { fs: 14, b: false, c: '#dde', max: W - 70 }); });
    const pts = S.perkPoints();
    [['🏆 Conquistas ' + d.ach.length + '/' + ACHIEVEMENTS.length, 'ach'], ['📖 Álbum', 'album'], ['⭐ Talentos' + (pts > 0 ? ' (' + pts + ')' : ''), 'perks'], ['🎀 Acessórios', 'accs']].forEach((b, i) => this.btn(20 + i * 132, 458, 126, 40, b[0], () => { this.page = b[1]; this.scroll = 0; }, { bg: i === 2 && pts > 0 ? '#a05cc8' : '#33355a', fs: 14 }));
  },
  p_album() {
    this.text(20, 34, '📖 Álbum de coleção', { fs: 24, c: '#ffd76a' }); this.text(20, 64, 'Cada coleção completa rende 400 moedas. Itens novos entram aqui na primeira vez que você os pega.', { fs: 14, b: false, c: '#bfe6ff', max: W - 90 });
    Object.keys(ALBUM).forEach((k, row) => { const y = 84 + row * 82, c = S.albumCount(k), g = this.g; g.fillStyle = 'rgba(255,255,255,0.06)'; roundRect(g, 20, y, W - 40, 76, 10); g.fill(); this.text(32, y + 16, ALBUM[k] + '  ' + c[0] + '/' + c[1] + (c[0] === c[1] ? '  ✔ completa' : ''), { fs: 17, c: c[0] === c[1] ? '#ffd76a' : '#fff' });
      let x = 32, yy = y + 40; for (const id in ITEMS) { const it = ITEMS[id]; if (it.k !== k) continue; const has = S.d.seen[id], label = has ? it.n : '???'; g.font = 'bold 14px sans-serif'; const w2 = g.measureText(label).width + 16; if (x + w2 > W - 30) { x = 32; yy += 24; } g.fillStyle = has ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.35)'; roundRect(g, x, yy - 10, w2, 21, 7); g.fill(); this.text(x + 8, yy + 1, label, { fs: 14, c: has ? RARITY[it.r].c : '#667' }); x += w2 + 6; } });
  },
  p_perks() {
    const pts = S.perkPoints(); this.text(20, 34, '⭐ Talentos', { fs: 24, c: '#ffd76a' }); this.text(20, 64, 'Você ganha 1 ponto por nível. Pontos disponíveis: ' + pts, { fs: 16, c: pts > 0 ? '#9cf09c' : '#bfe6ff' });
    PERKS.forEach((p, i) => { const x = 20 + (i % 2) * 368, y = 84 + Math.floor(i / 2) * 84, n = S.perk(p.id), g = this.g; g.fillStyle = 'rgba(255,255,255,0.06)'; roundRect(g, x, y, 360, 76, 10); g.fill(); this.text(x + 12, y + 18, p.n + '   ' + n + '/' + p.max, { fs: 18 }); this.text(x + 12, y + 42, p.d, { fs: 14, b: false, c: '#dde', max: 250 }); this.bar(x + 12, y + 58, 240, 8, n / p.max, '#c06bff'); this.btn(x + 272, y + 14, 76, 48, '+', () => S.addPerk(p.id), { off: pts <= 0 || n >= p.max, bg: '#a05cc8', fs: 28 }); });
    this.btn(20, 430, 300, 40, '↺ Redistribuir (100 moedas)', () => { this.msg = S.resetPerks() || 'Talentos zerados'; }, { bg: '#8a4a4a', fs: 16 });
  },
  p_accs() {
    this.text(20, 34, '🎀 Acessórios conquistáveis', { fs: 24, c: '#ffd76a' }); this.text(20, 64, 'Não se compram: cada um é liberado por um feito. Toque para vestir.', { fs: 15, b: false, c: '#bfe6ff' });
    ACCS.forEach((a, i) => { const x = 20 + (i % 2) * 368, y = 84 + Math.floor(i / 2) * 62, ok = S.accOk(i), on = (S.look.acc || 0) === i, v = a.s ? Math.min(a.v, a.s === 'level' ? S.d.level : S.d.stats[a.s] || 0) : 0;
      this.btn(x, y, 360, 56, '', () => { S.look.acc = i; this._look(); }, { off: !ok, sel: on, bg: '#4a5cc8' }); this.text(x + 14, y + 18, (on ? '✔ ' : ok ? '' : '🔒 ') + a.n, { fs: 17, c: ok ? '#fff' : '#8a88a0' }); this.text(x + 14, y + 40, i === 0 ? 'Sem acessório' : a.how + (ok ? '' : '  (' + v + '/' + a.v + ')'), { fs: 13, b: false, c: ok ? '#dfe6ff' : '#8a88a0', max: 330 }); });
  },
  p_ach() {
    this.text(20, 34, '🏆 Conquistas', { fs: 24, c: '#ffd76a' }); const off = this.pager(ACHIEVEMENTS.length, 8, 460);
    ACHIEVEMENTS.slice(off, off + 8).forEach((a, i) => { const y = 66 + i * 48, has = S.d.ach.indexOf(a.id) >= 0, v = S.d.stats[a.s] || 0; this.bar(20, y, W - 40, 42, has ? 1 : v / a.v, has ? '#8a6a20' : '#33355a'); this.text(32, y + 13, (has ? '✔ ' : '') + a.n, { fs: 17, c: has ? '#ffd76a' : '#fff' }); this.text(32, y + 31, a.d + (has ? '' : '  (' + Math.min(v, a.v) + '/' + a.v + ')'), { fs: 14, b: false, c: '#dde' }); this.text(W - 34, y + 21, '+' + a.c + ' 💰', { a: 'right', fs: 16 }); });
  },
  p_profile() {
    const d = S.d, L = S.look; this.text(20, 80, S.name + ' — Nível ' + d.level + ' · ' + S.title(), { fs: 24 }); this.btn(560, 62, 188, 36, '✏ Mudar nome', () => this.keyboard('Seu nome', S.name, 16, (t) => { if (/^hark/i.test(t.trim()) && !admin.is) { S.toast('Nome reservado ao admin', '#ff9a8a'); return; } S.name = t.trim() || S.name; S.touch(); G.pushMeta(); emit('saveNow'); }, 'profile'), { bg: '#33355a', fs: 16 });
    this.bar(20, 100, 520, 18, d.xp / S.xpNeed(), '#6a9cff'); this.text(552, 109, d.xp + '/' + S.xpNeed() + ' XP', { fs: 15 });
    this.text(20, 136, 'Profissão: ' + (d.prof ? PROFS[d.prof].icon + ' ' + PROFS[d.prof].n : 'nenhuma (fale com o Mestre Ofício na Vila)') + '   |   Código de amigo: ' + (net.friendCode || '—'), { fs: 15, c: '#bfe6ff', max: W - 40 });
    const sw = (y, label, list, key) => { this.text(20, y + 17, label, { fs: 16 }); list.forEach((c, i) => { const x = 130 + i * 50; const g = this.g; if (L[key] === c) { g.fillStyle = '#fff'; roundRect(g, x - 3, y - 3, 46, 40, 9); g.fill(); } g.fillStyle = c; roundRect(g, x, y, 40, 34, 7); g.fill(); this.widgets.push({ x, y, w: 40, h: 34, cb: () => { L[key] = c; this._look(); } }); }); };
    sw(160, 'Pelagem', FUR_COLORS, 'fur'); sw(204, 'Detalhe', FUR_COLORS, 'fur2'); sw(248, 'Olhos', EYE_COLORS, 'eyes');
    this.text(20, 309, 'Padrão', { fs: 16 }); PATTERNS.forEach((p, i) => this.btn(130 + i * 103, 292, 98, 34, p, () => { L.pattern = i; this._look(); }, { sel: L.pattern === i, fs: 15, bg: '#33355a' }));
    this.text(20, 353, 'Chapéu', { fs: 16 }); d.hats.slice(0, 10).forEach((h, i) => this.btn(130 + (i % 5) * 124, 336 + Math.floor(i / 5) * 40, 119, 34, HATS[h], () => { L.hat = h; this._look(); }, { sel: L.hat === h, fs: 14, bg: '#33355a' }));
    const s = d.stats; this.text(20, 438, 'Minérios ' + (s.mine || 0) + ' · Golpes ' + (s.hit || 0) + ' · Vitórias ' + (s.ko || 0) + ' · Peixes ' + (s.fish || 0) + ' · Baús ' + (s.chest || 0) + ' · Segredos ' + d.secrets.length, { fs: 15, c: '#9cf09c' });
    this.text(20, 466, 'A aparência aparece para os outros jogadores (você vê suas patas na cor da pelagem).', { fs: 14, c: '#99a', b: false });
  },
  _look() { S.touch(); G.pushMeta(); emit('look'); emit('saveNow'); },
  p_emotes() {
    this.text(20, 80, 'Emotes e gestos — os outros jogadores veem a animação', { c: '#bfe6ff', fs: 18 });
    EMOTES.forEach((e, i) => this.btn(40 + (i % 3) * 235, 100 + Math.floor(i / 3) * 74, 220, 64, e.icon + ' ' + e.name, () => { G.emote(e.id); this.hide(); }, { fs: 22, bg: '#4a5cc8' }));
    this.text(20, 410, 'Carinho: passe a pata devagar na cabeça de outro gato (fora da zona de luta).', { fs: 16, b: false }); this.text(20, 436, 'Sentado/dormindo: aperte o gatilho para levantar.', { fs: 16, b: false });
  },
  p_config() {
    this.text(20, 80, 'Desempenho (Thermal Controller)', { c: '#ffd76a' });
    ['performance', 'balanced', 'quality'].forEach((p, i) => this.btn(20 + i * 170, 98, 162, 44, perf.profiles[p].name, () => { perf.setProfile(p); store.set('profile', p); }, { sel: perf.profile === p, bg: '#33355a' }));
    this.btn(540, 98, 208, 44, 'Ajuste automático: ' + (perf.auto ? 'SIM' : 'NÃO'), () => { perf.auto = !perf.auto; }, { bg: perf.auto ? '#3a9a5a' : '#8a4a4a', fs: 16 });
    const inf = G.renderer.info.render; this.bar(20, 156, 728, 20, perf.load / 1.5, perf.load > 1.15 ? '#e05050' : perf.load > 0.95 ? '#e8a030' : '#3a9a5a');
    this.text(20, 196, 'FPS ' + perf.fps.toFixed(0) + '  ·  ' + perf.ms.toFixed(1) + ' ms/quadro  ·  carga ' + Math.round(perf.load * 100) + '%  ·  nível de qualidade ' + perf.level + '/3  ·  ' + perf.status, { fs: 16 });
    this.text(20, 222, 'Resolução ' + Math.round(perf.scale * 100) + '%  ·  visão ' + perf.drawDist + ' m  ·  draw calls ' + inf.calls + '  ·  triângulos ' + inf.triangles + (perf.heapMB ? '  ·  memória JS ' + perf.heapMB + ' MB' : ''), { fs: 16 });
    this.text(20, 246, 'Sem sensor térmico no navegador: a carga é estimada pelo tempo de quadro.', { fs: 14, c: '#99a', b: false });
    this.text(20, 290, 'Volume', {}); this.btn(120, 272, 50, 38, '−', () => { setVolume(clamp(audioVolume - 0.2, 0, 1)); store.set('vol', audioVolume); }); this.bar(180, 282, 200, 18, audioVolume, '#6a9cff'); this.btn(390, 272, 50, 38, '+', () => { setVolume(clamp(audioVolume + 0.2, 0, 1)); store.set('vol', audioVolume); play('confirm', 0.6); });
    this.btn(20, 380, 230, 40, '🎵 Música: ' + (music.on ? 'SIM' : 'NÃO'), () => music.setOn(!music.on), { bg: music.on ? '#3a9a5a' : '#8a4a4a', fs: 16 });
    this.btn(480, 272, 268, 38, 'Controle na mão: ' + (this.player.side > 0 ? 'direita' : 'esquerda'), () => { this.player.side *= -1; store.set('side', this.player.side); }, { bg: '#33355a', fs: 16 });
    this.btn(20, 330, 230, 44, '❓ Como jogar', () => { this.page = 'help'; }, { bg: '#33355a' });
    this.btn(266, 330, 230, 44, '💾 Salvar agora', () => { emit('saveNow'); this.msg = net.online ? 'Progresso salvo no servidor' : 'Offline: salvo só neste aparelho'; }, { bg: '#33355a' });
    if (G.renderer.xr.isPresenting) this.btn(512, 330, 236, 44, '🚪 Sair do VR', () => { const s = G.renderer.xr.getSession(); if (s) s.end(); }, { bg: '#b04050' });
    this.btn(266, 380, 300, 40, '✋ Mãos pela câmera: ' + (hands.loading ? '...' : hands.on ? 'SIM' : 'NÃO'), () => { if (hands.on) hands.stop(); else hands.start(); }, { bg: hands.on ? '#3a9a5a' : '#33355a', fs: 15, off: hands.loading });
    if (self.RVcard && self.RVcard.on) { this.btn(574, 380, 174, 40, 'Sair do VR Box', () => { self.RVcard.exit(); this.hide(); }, { bg: '#b04050', fs: 15 }); this.btn(574, 330, 174, 44, '🧭 Recentralizar', () => this.player.recenter(), { bg: '#33355a', fs: 15 }); }
    this.text(20, 428, 'Mãos: ' + hands.status + (hands.on ? ' (' + hands.fps.toFixed(0) + ' Hz)' : '') + '  ·  Gamepad/Joy-Con: ' + (this.player.gpFound ? 'conectado' : 'não detectado (aperte um botão)'), { fs: 13, c: '#bfe6ff', b: false, max: W - 40 });
    this.text(20, 446, 'RoleVRGO v' + VERSION + '  ·  Assets: Kenney.nl (CC0)  ·  Multiplayer: Supabase Realtime', { fs: 15, c: '#99a', b: false });
    this.text(20, 466, 'ID temporário deste aparelho: ' + (net.id ? net.id.slice(0, 8) : '—') + '  ·  ' + (net.online ? 'conectado' : 'OFFLINE (jogo solo, sem salvar na nuvem)'), { fs: 15, c: net.online ? '#9cf09c' : '#ff9a8a', b: false });
  },
  p_help() {
    this.text(20, 34, '❓ Como jogar', { fs: 24, c: '#ffd76a' }); let y = 74;
    const L = this.player.sixAny ? ['META QUEST: cada pata segue o seu controle (ou a sua mão, sem controles). Encoste no chão e empurre para trás para se impulsionar.', 'ESCALAR: encoste as patas na parede e puxe para baixo, uma mão de cada vez. Soltar no ar lança você.', 'ANALÓGICO ESQUERDO: andar · DIREITO: girar 30° (empurrar para frente = mira de teleporte, solte para ir).', 'GATILHO: falar com NPCs, abrir baús, pescar, clicar no menu (aponte com o controle). Mãos: junte polegar e indicador.', 'A: pular · B: menu · X: menu rápido · Y: câmera · os dois grips: bloquear.', 'SOCOS / MINERAR / CORTAR: bata com as mãos de verdade. Mais velocidade = mais dano.'] : this.player.desktop ? ['Mouse: olhar e apontar as patas · WASD: andar · Espaço: pular · Shift: correr', 'Clique: gatilho (agarrar superfícies, falar com NPC, abrir baú, pescar)', 'Olhe para o chão e mova o mouse para empurrar com as patas (impulso).', 'M/Tab: menu · B: menu rápido · V: câmera · R: gravar · T (segurar): teleporte · Enter: chat · Q/E: esquiva · F: bloquear', 'Socos: mova as patas rápido contra o alvo (bonecos, Mestre, jogadores na zona de luta).']
      : ['IMPULSO: aponte o controle para o chão até as patas encostarem e varra para trás.', 'ESCALAR: encoste as patas numa parede, SEGURE o gatilho, puxe para baixo e solte.', 'ANDAR: segure o gatilho com as patas no ar — você anda na direção apontada.', 'TOUCHPAD: toque no centro = menu · SEGURAR o centro = mira de teleporte (solte para ir) · cima = menu rápido · lados = girar · baixo = bloquear.', 'APONTAR + GATILHO: falar com NPCs, abrir baús, lançar a linha de pesca na água.', 'SOCAR / MINERAR / CAVAR: bata com as patas rápido no alvo. Mais velocidade = mais dano.'];
    for (const l of L) { y = this.wrap(24, y, '• ' + l, W - 50, 24, { fs: 17, b: false }) + 8; }
    if (!this.player.sixAny) this.wrap(24, y + 6, 'As duas patas são bolinhas flutuantes: uma segue o controle e a outra espelha o movimento. O Oculus Go só rastreia a rotação do controle (3DoF), então tudo foi pensado para girar o pulso.', W - 50, 22, { fs: 15, b: false, c: '#bfe6ff' });
  },
  // ---------- social ----------
  _loadRooms() { if (!net.online) return; net.rooms().then((r) => { this.rooms = r; this.dirty = true; }).catch(() => {}); G.refreshFriends(); },
  p_social() {
    const subs = [['room', 'Salas'], ['players', 'Jogadores'], ['friends', 'Amigos'], ['party', 'Grupo'], ['chat', 'Chat']];
    subs.forEach((s, i) => this.btn(20 + i * 147, 62, 142, 36, s[1], () => { this.sub = s[0]; this.scroll = 0; this.msg = ''; }, { sel: this.sub === s[0], fs: 17, bg: '#2a2c4a' }));
    if (!net.online) { this.text(W / 2, 250, 'Offline — sem conexão com o servidor.', { a: 'center', c: '#ff9a8a' }); return; }
    this['s_' + this.sub]();
  },
  _join(code, name, pub) { G.room = code; G.roomName = name; G.roomPublic = pub; store.set('room', { code, name, pub }); net.join(code, G.mapId, pub); G.pushMeta(); S.toast('Você entrou na sala ' + name, '#bfe6ff'); },
  s_room() {
    this.text(20, 122, 'Sala atual: ' + G.roomName + '  [' + G.room + ']  ' + (G.roomPublic ? 'pública' : 'privada — compartilhe o código'), { fs: 17, c: '#9cf09c', max: W - 40 });
    const counts = net.roomCounts(), rooms = this.rooms || []; const off = this.pager(rooms.length, 5, 458);
    if (!this.rooms) this.text(20, 160, 'Carregando salas...', { c: '#99a' });
    rooms.slice(off, off + 5).forEach((r, i) => { const y = 142 + i * 44; this.btn(20, y, 500, 38, (r.permanent ? '★ ' : '') + r.name + '   —   ' + (counts[r.code] || 0) + ' online', () => this._join(r.code, r.name, true), { sel: r.code === G.room, off: r.code === G.room, bg: '#33355a', fs: 17 }); });
    this.btn(540, 142, 208, 40, '+ Sala pública', () => this._create(true), { bg: '#3a9a5a', fs: 17 }); this.btn(540, 188, 208, 40, '+ Sala privada', () => this._create(false), { bg: '#3a9a5a', fs: 17 });
    this.btn(540, 234, 208, 40, '🔑 Entrar por código', () => this.keyboard('Código da sala', '', 5, (t) => { net.roomGet(t.toUpperCase()).then((r) => { if (r) this._join(r.code, r.name, r.is_public); else S.toast('Sala não encontrada', '#ff9a8a'); }).catch(() => S.toast('Erro ao buscar sala', '#ff9a8a')); }, 'social'), { bg: '#33355a', fs: 16 });
    this.btn(540, 280, 208, 40, '↻ Atualizar', () => this._loadRooms(), { bg: '#33355a', fs: 17 });
  },
  _create(pub) { this.keyboard('Nome da sala ' + (pub ? 'pública' : 'privada'), 'Sala de ' + S.name, 24, (t) => { net.rpc('rv_room_create', { p_name: t, p_public: pub }).then((r) => { this._join(r.code, r.name, r.is_public); if (!pub) S.toast('Código da sala privada: ' + r.code, '#ffd76a'); this._loadRooms(); }).catch(() => S.toast('Não foi possível criar a sala', '#ff9a8a')); }, 'social'); },
  s_players() {
    const list = Array.from(G.remotes.values()); this.text(20, 122, 'Jogadores reais neste mapa e sala: ' + (list.length + 1), { fs: 17, c: '#bfe6ff' }); const off = this.pager(list.length, 7, 458);
    if (!list.length) this.text(20, 170, 'Só você por aqui agora. Convide amigos com o código da sala!', { fs: 17, c: '#99a', b: false });
    list.slice(off, off + 7).forEach((r, i) => { const y = 142 + i * 44, fr = G.friends.find((f) => f.id === r.id); this.text(24, y + 19, r.meta.name + '  (Nv ' + (r.meta.level || 1) + ')', { c: r.av.tagColor, max: 300 });
      this.btn(340, y, 190, 36, fr ? (fr.status === 'accepted' ? '✔ Amigo' : fr.status === 'incoming' ? 'Aceitar amizade' : 'Pedido enviado') : '+ Amigo', () => { if (fr && fr.status === 'incoming') net.rpc('rv_friend_accept', { p_other: r.id }).then(() => { net.sendTo(r.id, { k: 'faccept' }); G.refreshFriends(); }); else if (r.meta.fc) net.rpc('rv_friend_add', { p_code: r.meta.fc }).then((x) => { if (x.ok) { net.sendTo(r.id, { k: x.status === 'accepted' ? 'faccept' : 'friend' }); S.toast(x.status === 'accepted' ? 'Agora vocês são amigos!' : 'Pedido de amizade enviado', '#9cf09c'); G.refreshFriends(); } }); }, { off: !!fr && fr.status !== 'incoming', bg: '#3a9a5a', fs: 16 });
      this.btn(540, y, 208, 36, '👥 Convidar p/ grupo', () => { if (!net.partyCode) this._newParty(); net.sendTo(r.id, { k: 'party', code: net.partyCode }); S.toast('Convite de grupo enviado', '#8fd0ff'); }, { bg: '#33355a', fs: 16 }); });
  },
  s_friends() {
    this.text(20, 122, 'Seu código de amigo: ' + net.friendCode, { fs: 18, c: '#ffd76a' }); this.btn(480, 104, 268, 36, '+ Adicionar por código', () => this.keyboard('Código do amigo', '', 6, (t) => { net.rpc('rv_friend_add', { p_code: t }).then((x) => { if (x.ok) { net.sendTo(x.id, { k: x.status === 'accepted' ? 'faccept' : 'friend' }); S.toast('Pedido enviado para ' + x.name, '#9cf09c'); G.refreshFriends(); } else S.toast('Código não encontrado', '#ff9a8a'); }).catch(() => S.toast('Erro ao adicionar', '#ff9a8a')); }, 'social'), { bg: '#3a9a5a', fs: 16 });
    const list = G.friends; const off = this.pager(list.length, 6, 458); if (!list.length) this.text(20, 180, 'Nenhum amigo ainda. Troque códigos ou adicione pela aba Jogadores.', { fs: 17, c: '#99a', b: false });
    list.slice(off, off + 6).forEach((f, i) => { const y = 150 + i * 50, w = net.whereIs(f.id); this.text(24, y + 12, f.name + '  (Nv ' + f.level + ')', { c: f.status === 'accepted' ? '#9cf09c' : '#fff', max: 330 }); this.text(24, y + 32, f.status === 'incoming' ? 'quer ser seu amigo' : f.status === 'outgoing' ? 'pedido pendente' : w ? '● online' + (w.r ? ' — ' + (MAPS[w.m] ? MAPS[w.m].name : '') : ' — sala privada') : '○ offline', { fs: 14, b: false, c: w ? '#9cf09c' : '#99a' });
      if (f.status === 'incoming') this.btn(380, y + 4, 120, 36, 'Aceitar', () => net.rpc('rv_friend_accept', { p_other: f.id }).then(() => { net.sendTo(f.id, { k: 'faccept' }); G.refreshFriends(); }), { bg: '#3a9a5a', fs: 16 });
      else if (f.status === 'accepted' && w && w.r) this.btn(380, y + 4, 120, 36, 'Ir até lá', () => { this.hide(); this._join(w.r, 'Sala ' + w.r, true); if (w.m && w.m !== G.mapId) { this._goMap(w.m); } }, { bg: '#4a5cc8', fs: 16 });
      if (f.status === 'accepted' && w) this.btn(510, y + 4, 110, 36, '✉ Msg', () => this.keyboard('Mensagem para ' + f.name, '', 60, (t) => { net.sendTo(f.id, { k: 'dm', x: t }); G._log('[para ' + f.name + ']', t); }, 'social'), { bg: '#33355a', fs: 16 });
      this.btn(630, y + 4, 118, 36, 'Remover', () => net.rpc('rv_friend_remove', { p_other: f.id }).then(() => G.refreshFriends()), { bg: '#8a4a4a', fs: 16 }); });
  },
  _newParty() { const c = Math.random().toString(36).slice(2, 7).toUpperCase(); net.joinParty(c); S.d.party = c; S.touch(); G.pushMeta(); },
  s_party() {
    if (G.invite) { this.text(20, 122, G.invite.name + ' convidou você para um grupo', { c: '#8fd0ff', fs: 18 }); this.btn(480, 104, 130, 36, 'Aceitar', () => { net.joinParty(G.invite.code); S.d.party = G.invite.code; S.touch(); G.invite = null; G.pushMeta(); }, { bg: '#3a9a5a', fs: 16 }); this.btn(618, 104, 130, 36, 'Recusar', () => { G.invite = null; }, { bg: '#8a4a4a', fs: 16 }); }
    if (!net.partyCode) { this.text(20, 170, 'Você não está em um grupo.', { c: '#99a' }); this.btn(20, 200, 230, 44, '+ Criar grupo', () => this._newParty(), { bg: '#3a9a5a' }); this.btn(266, 200, 260, 44, '🔑 Entrar por código', () => this.keyboard('Código do grupo', '', 5, (t) => { net.joinParty(t); S.d.party = t.toUpperCase(); S.touch(); G.pushMeta(); }, 'social'), { bg: '#33355a' }); this.text(20, 280, 'Grupos têm chat próprio, nomes em azul e você vê onde cada membro está.', { fs: 16, b: false, c: '#bfe6ff' }); return; }
    this.text(20, 160, 'Grupo ' + net.partyCode + ' — ' + net.partyMembers.length + ' membro(s)', { c: '#8fd0ff' }); this.btn(588, 142, 160, 36, 'Sair do grupo', () => { net.leaveParty(); S.d.party = ''; S.touch(); G.pushMeta(); }, { bg: '#8a4a4a', fs: 16 });
    net.partyMembers.slice(0, 6).forEach((m, i) => { const y = 190 + i * 42; this.text(24, y + 18, (m.id === net.id ? '★ ' : '') + (m.n || 'Gato') + '  (Nv ' + (m.l || 1) + ')', { max: 300 }); this.text(340, y + 18, (MAPS[m.m] ? MAPS[m.m].name : '?') + ' — sala ' + (m.r || '?'), { fs: 15, b: false, c: '#bfe6ff', max: 250 }); if (m.id !== net.id && m.r) this.btn(608, y, 140, 36, 'Ir até lá', () => { this.hide(); net.roomGet(m.r).then((r) => { if (r) this._join(r.code, r.name, r.is_public); if (m.m && m.m !== G.mapId) { this._goMap(m.m); } }); }, { bg: '#4a5cc8', fs: 16 }); });
    this.btn(20, 452, 300, 40, '💬 Falar no grupo', () => this.keyboard('Mensagem para o grupo', '', 60, (t) => { net.partySay(t); G._log('[grupo] ' + S.name, t); }, 'social'), { bg: '#33355a', fs: 17 });
  },
  s_chat() {
    const log = G.chatLog.slice(-6); if (!log.length) this.text(20, 130, 'Nenhuma mensagem ainda.', { c: '#99a' });
    log.forEach((m, i) => { this.text(20, 122 + i * 24, m.who + ':', { fs: 16, c: '#ffd76a', max: 170 }); this.text(196, 122 + i * 24, m.text, { fs: 16, b: false, max: 550 }); });
    QUICK_CHAT.forEach((q, i) => this.btn(20 + (i % 4) * 184, 280 + Math.floor(i / 4) * 44, 178, 38, q, () => { G.say(q); }, { bg: '#33355a', fs: 16 }));
    this.btn(20, 420, 360, 44, '⌨ Escrever mensagem', () => this.keyboard('Mensagem para a sala', '', 60, (t) => G.say(t), 'social'), { bg: '#4a5cc8' });
  },
  // ---------- Painel de admin ----------
  p_admin() {
    if (!admin.is) { this.page = 'map'; return; }
    const a = this.adm || (this.adm = { sub: 'msg', tgt: 'all', dur: 120, qty: 5, boss: false, ip: 0 }), mk = G.def.netKey || G.mapId;
    const done = (p) => p.then((e) => { this.msg = e || '✔ Enviado'; this.dirty = true; });
    [['msg', '📢 Mensagem'], ['spawn', '🎁 Spawnar'], ['fx', '✨ Efeitos'], ['ev', '🎉 Eventos'], ['pl', '👥 Jogadores']].forEach((t, i) => this.btn(20 + i * 147, 62, 142, 36, t[1], () => { a.sub = t[0]; this.scroll = 0; this.msg = ''; }, { sel: a.sub === t[0], bg: '#5a4510', fs: 16 }));
    const T = (y) => { this.text(20, y + 18, 'Alvo:', { fs: 16, c: '#ffd76a' }); [['me', '🙋 Só eu'], ['map', '🗺 Este mapa'], ['all', '🌍 Todo mundo']].forEach((o, i) => this.btn(80 + i * 140, y, 134, 36, o[1], () => { a.tgt = o[0]; }, { sel: a.tgt === o[0], bg: '#33355a', fs: 15 })); };
    const D = (y, x0) => { this.text(x0, y + 18, 'Duração:', { fs: 16, c: '#ffd76a' }); [[30, '30 s'], [120, '2 min'], [300, '5 min'], [600, '10 min']].forEach((o, i) => this.btn(x0 + 84 + i * 76, y, 72, 36, o[1], () => { a.dur = o[0]; }, { sel: a.dur === o[0], bg: '#33355a', fs: 15 })); };
    const target = () => (a.tgt === 'all' ? 'all' : 'map:' + mk);
    if (a.sub === 'msg') {
      this.text(20, 120, 'Mensagem global: aparece em faixa dourada no topo da visão de todos os jogadores online.', { fs: 15, b: false, c: '#dde', max: W - 40 });
      this.btn(20, 140, 360, 50, '⌨ Escrever mensagem global', () => this.keyboard('Mensagem global', '', 80, (t) => done(admin.send('msg', 'all', { text: t })), 'admin'), { bg: '#8a6a10', fs: 18 });
      this.btn(388, 140, 360, 50, '⌨ Mensagem só para este mapa', () => this.keyboard('Mensagem para o mapa', '', 80, (t) => done(admin.send('msg', 'map:' + mk, { text: t })), 'admin'), { bg: '#33355a', fs: 16 });
      ['Bem-vindos à Beta do RoleVRGO! 🐱', 'Evento começando em 2 minutos!', 'Servidor vai reiniciar em 5 minutos.', 'Obrigado por testar! Relatem bugs 💛', 'Festa na Vila agora! 🎉', 'Respeitem os outros jogadores, por favor.'].forEach((m, i) => this.btn(20 + (i % 2) * 368, 206 + Math.floor(i / 2) * 48, 360, 42, m, () => done(admin.send('msg', 'all', { text: m })), { bg: '#2a2c4a', fs: 14 }));
    } else if (a.sub === 'spawn') {
      this.text(20, 118, 'Itens (cai do céu perto de você para todos do mapa, ou direto na sua bolsa):', { fs: 14, b: false, c: '#dde', max: W - 40 });
      const ids = Object.keys(ITEMS).filter((k) => ITEMS[k].k !== 'quest'), per = 12, pages = Math.ceil(ids.length / per); a.ip = clamp(a.ip, 0, pages - 1);
      ids.slice(a.ip * per, a.ip * per + per).forEach((id, i) => this.btn(20 + (i % 6) * 104, 130 + Math.floor(i / 6) * 40, 100, 36, ITEMS[id].n, () => { a.item = id; }, { sel: a.item === id, bg: '#33355a', fs: 12, fg: RARITY[ITEMS[id].r].c }));
      this.btn(648, 130, 50, 36, '◀', () => { a.ip--; }, { off: a.ip <= 0, bg: '#2a2c4a' }); this.btn(698, 130, 50, 36, '▶', () => { a.ip++; }, { off: a.ip >= pages - 1, bg: '#2a2c4a' }); this.text(698, 186, (a.ip + 1) + '/' + pages, { a: 'center', fs: 14 });
      [1, 5, 20].forEach((q, i) => this.btn(20 + i * 70, 214, 64, 36, 'x' + q, () => { a.qty = q; }, { sel: a.qty === q, bg: '#2a2c4a', fs: 15 }));
      const P = this.player, it = a.item;
      this.btn(236, 214, 170, 36, '🎒 Para mim', () => { if (!it) { this.msg = 'Escolha um item'; return; } S.addItem(it, a.qty); }, { off: !it, bg: '#3a9a5a', fs: 15 });
      this.btn(412, 214, 336, 36, '🌧 Chuva aqui (todos do mapa)', () => { if (!it) { this.msg = 'Escolha um item'; return; } done(admin.send('drop', 'map:' + mk, { item: it, n: a.qty, x: P.pos.x, y: P.pos.y, z: P.pos.z })); }, { off: !it, bg: '#8a6a10', fs: 15 });
      this.btn(20, 258, 240, 36, '💰 Chuva de 20 moedas', () => done(admin.send('drop', 'map:' + mk, { coins: 10, n: 20, x: P.pos.x, y: P.pos.y, z: P.pos.z })), { bg: '#8a6a10', fs: 15 });
      this.btn(268, 258, 220, 36, '💰 +1000 para mim', () => { S.addCoins(1000); }, { bg: '#3a9a5a', fs: 15 }); this.btn(496, 258, 252, 36, '⭐ +1 nível para mim', () => { S.addXp(S.xpNeed() - S.d.xp); }, { bg: '#3a9a5a', fs: 15 });
      this.text(20, 318, 'Bichos (aparecem perto de você, para todos do mapa):', { fs: 14, b: false, c: '#dde' });
      Object.keys(ENEMIES).forEach((k, i) => this.btn(20 + i * 80, 330, 76, 40, (a.boss ? '👑 ' : '') + (a.boss ? BOSS_NAMES[k] : ENEMIES[k].n), () => done(admin.send('spawn', 'map:' + mk, { type: k, boss: a.boss, n: a.boss ? 1 : Math.min(8, a.qty), x: P.pos.x - Math.sin(P.headYaw) * 6, z: P.pos.z - Math.cos(P.headYaw) * 6 })), { bg: '#6a3a8a', fs: 13 }));
      this.btn(500, 330, 248, 40, a.boss ? '👑 Chefes: SIM' : '👑 Chefes: NÃO', () => { a.boss = !a.boss; }, { bg: a.boss ? '#8a6a10' : '#33355a', fs: 15 });
      this.text(20, 392, 'Quantidade de bichos = quantidade escolhida acima (máx. 8). Chefe = 1 por vez.', { fs: 13, b: false, c: '#99a' });
    } else if (a.sub === 'fx') {
      T(108); D(152, 20);
      EFFECTS.forEach((e, i) => this.btn(20 + (i % 3) * 245, 200 + Math.floor(i / 3) * 46, 239, 40, e[1], () => { if (a.tgt === 'me') { admin.selfEffect(e[0], a.dur); if (e[0] === 'heal') emit('adminHeal'); if (e[0] === 'confetti') emit('confetti'); } else done(admin.send('effect', target(), { fx: e[0] }, a.dur)); }, { bg: '#4a5cc8', fs: 15 }));
      this.text(20, 400, 'Voar: gatilho/WASD movem, Espaço sobe, C desce. Os efeitos somem sozinhos no fim da duração.', { fs: 13, b: false, c: '#99a', max: W - 40 });
      this.btn(20, 418, 240, 36, '⏹ Tirar efeitos de mim', () => { admin.effects = {}; }, { bg: '#8a4a4a', fs: 15 });
    } else if (a.sub === 'ev') {
      D(108, 20); this.text(420, 126, 'Eventos valem para todos, em todos os mapas.', { fs: 13, b: false, c: '#99a' });
      EVENTS_ADM.forEach((e, i) => { const y = 152 + Math.floor(i / 2) * 64, x = 20 + (i % 2) * 368, on = admin.eventOn(e[0]); this.btn(x, y, 360, 58, '', () => done(admin.send('event', 'all', { ev: e[0] }, a.dur)), { bg: on ? '#8a6a10' : '#4a5cc8', sel: on }); this.text(x + 14, y + 20, e[1] + (on ? '  (ativo)' : ''), { fs: 18 }); this.text(x + 14, y + 42, e[2], { fs: 13, b: false, c: '#dfe6ff', max: 330 }); });
      this.btn(20, 412, 360, 40, '⏹ Encerrar evento e efeitos de todos', () => done(admin.send('stop', 'all', {}, 1)), { bg: '#8a4a4a', fs: 15 });
    } else {
      const list = Array.from(G.remotes.values()); this.text(20, 118, 'Neste mapa (' + list.length + '):', { fs: 15, c: '#ffd76a' }); const P = this.player;
      list.slice(0, 5).forEach((r, i) => { const y = 132 + i * 44; this.text(24, y + 18, r.meta.name + ' (Nv ' + (r.meta.level || 1) + ')', { fs: 15, max: 200 });
        this.btn(228, y, 96, 36, '➡ Ir até', () => { const p = r.av.root.position; P.teleport(p.x + 1, p.y + 0.2, p.z + 1); this.hide(); }, { bg: '#33355a', fs: 14 });
        this.btn(330, y, 104, 36, '⬅ Puxar', () => done(admin.send('tp', 'p:' + r.id, { map: mk, x: P.pos.x + 1, y: P.pos.y, z: P.pos.z + 1 })), { bg: '#33355a', fs: 14 });
        this.btn(440, y, 104, 36, '🎁 +100', () => done(admin.send('give', 'p:' + r.id, { coins: 100 })), { bg: '#3a9a5a', fs: 14 });
        this.btn(550, y, 96, 36, '❤ Curar', () => done(admin.send('effect', 'p:' + r.id, { fx: 'heal' })), { bg: '#3a9a5a', fs: 14 });
        this.btn(652, y, 96, 36, '🚪 Vila', () => done(admin.send('kick', 'p:' + r.id, {})), { bg: '#8a4a4a', fs: 14 }); });
      const lob = Object.keys(net.lobbyState).filter((k) => k !== net.id).map((k) => Object.assign({ id: k }, net.lobbyState[k][0])); this.text(20, 368, 'Online em outros lugares (' + lob.length + '):', { fs: 15, c: '#ffd76a' });
      lob.slice(0, 2).forEach((p, i) => { const y = 380 + i * 40; this.text(24, y + 16, (p.n || 'Gato') + ' — ' + (MAPS[p.m] ? MAPS[p.m].name : p.m || '?'), { fs: 14, max: 380 }); if (p.m) this.btn(420, y, 150, 34, '➡ Ir para o mapa', () => { this.hide(); this._goMap(p.m); }, { bg: '#33355a', fs: 13 }); this.btn(578, y, 170, 34, '⬅ Puxar p/ cá', () => done(admin.send('tp', 'p:' + p.id, { map: mk, x: P.pos.x + 1, y: P.pos.y, z: P.pos.z + 1 })), { bg: '#33355a', fs: 13 }); });
      this.text(20, 470, '"Vila" e "Puxar" dependem do jogo do jogador obedecer: não é um banimento.', { fs: 12, b: false, c: '#99a', max: W - 40 });
    }
  },
  // ---------- Criador de Mapas ----------
  _goMap(m) { if (!m) return; if (m.indexOf('c_') === 0) { maker.play(G, m.slice(2), false).then((e) => { if (e) S.toast(e, '#ff9a8a'); }).catch(() => S.toast('Não foi possível abrir o mapa', '#ff9a8a')); return; } if (!MAPS[m]) return; if (S.d.maps.indexOf(m) < 0) S.d.maps.push(m); G.travel(m); },
  _mkLoad() { const k = this.mk || (this.mk = { sub: maker.playing && maker.mine ? 'ed' : 'com', sort: 'new', list: null, mine: null, err: '' }); if (!net.online) { k.err = 'Offline: só o rascunho local está disponível.'; return; }
    maker.list(k.sort).then((l) => { k.list = l; k.err = ''; this.dirty = true; }).catch(() => { k.err = 'Comunidade indisponível: o banco ainda não tem as tabelas de mapas (rode supabase/maps.sql).'; k.list = []; this.dirty = true; }); maker.listMine().then((l) => { k.mine = l; this.dirty = true; }).catch(() => { k.mine = []; }); },
  _mkOpen(id, edit) { this.msg = 'Carregando mapa...'; maker.play(G, id, edit).then((e) => { if (e) { this.msg = e; this.dirty = true; } else { this.hide(); if (edit) S.toast('Modo edição: aponte e aperte o gatilho para colocar. Menu > Criar para opções.', '#9cf09c'); else S.toast('Mapa da comunidade: sem recompensas permanentes aqui.', '#bfe6ff'); } }).catch(() => { this.msg = 'Erro ao abrir o mapa'; this.dirty = true; }); },
  p_maker() {
    const k = this.mk || (this._mkLoad(), this.mk), inEd = maker.playing && G.mapId === 'custom';
    [['com', '🌍 Comunidade'], ['mine', '📁 Meus mapas'], ['ed', '🛠 Editor']].forEach((t, i) => this.btn(20 + i * 246, 62, 240, 36, t[1], () => { k.sub = t[0]; this.scroll = 0; this.msg = ''; if (t[0] !== 'ed') this._mkLoad(); }, { sel: k.sub === t[0], bg: '#2a2c4a', fs: 17, off: t[0] === 'ed' && !inEd }));
    if (k.sub === 'ed' && !inEd) k.sub = 'mine';
    if (k.sub === 'com') {
      this.btn(20, 106, 200, 34, k.sort === 'new' ? 'Ordem: mais novos' : 'Ordem: populares', () => { k.sort = k.sort === 'new' ? 'top' : 'new'; k.list = null; this._mkLoad(); }, { bg: '#33355a', fs: 15 });
      this.btn(228, 106, 220, 34, '🔑 Abrir por código', () => this.keyboard('Código do mapa', '', 6, (t) => this._mkOpen(t.toUpperCase(), false), 'maker'), { bg: '#33355a', fs: 15 });
      if (k.err) this.wrap(20, 170, k.err, W - 40, 22, { fs: 16, c: '#ff9a8a', b: false }); else if (!k.list) this.text(20, 170, 'Carregando...', { c: '#99a' }); else if (!k.list.length) this.text(20, 170, 'Nenhum mapa publicado ainda. Seja o primeiro: Meus mapas > Novo mapa.', { fs: 16, c: '#99a', b: false });
      const L = k.list || [], off = this.pager(L.length, 6, 458);
      L.slice(off, off + 6).forEach((m, i) => { const y = 148 + i * 51, g = this.g; g.fillStyle = 'rgba(255,255,255,0.06)'; roundRect(g, 20, y, W - 40, 46, 8); g.fill(); this.text(32, y + 14, m.name, { fs: 17, max: 380 }); this.text(32, y + 34, 'por ' + m.author + '  ·  ▶ ' + m.plays + '  ·  ♥ ' + m.likes + '  ·  ' + m.objects + ' objetos  ·  código ' + m.id, { fs: 13, b: false, c: '#bfe6ff', max: 470 });
        this.btn(W - 250, y + 5, 130, 36, '▶ Jogar', () => this._mkOpen(m.id, false), { bg: '#3a9a5a', fs: 16 }); this.btn(W - 112, y + 5, 82, 36, '♥', () => { maker.like(m.id).then((r) => { m.likes = r.likes; this.dirty = true; }).catch(() => {}); }, { bg: '#b04070', fs: 18 }); });
    } else if (k.sub === 'mine') {
      this.btn(20, 106, 200, 36, '＋ Novo mapa', () => this.keyboard('Nome do mapa', 'Mapa de ' + S.name, 28, (t) => { maker.open(G, maker.blank(t), null, true, true); this.hide(); S.toast('Modo edição: aponte e aperte o gatilho para colocar. Menu > Criar para opções.', '#9cf09c'); }, 'maker'), { bg: '#3a9a5a', fs: 17 });
      const d = maker.draft(); if (d && d.map) this.btn(228, 106, 300, 36, '✎ Continuar rascunho: ' + d.map.name, () => { maker.open(G, d.map, d.id, true, true); this.hide(); }, { bg: '#4a5cc8', fs: 15 });
      const L = k.mine || [], off = this.pager(L.length, 6, 458); if (net.online && !L.length) this.text(20, 180, k.err || 'Você ainda não salvou nenhum mapa no servidor.', { fs: 16, c: '#99a', b: false, max: W - 40 });
      L.slice(off, off + 6).forEach((m, i) => { const y = 150 + i * 51, g = this.g; g.fillStyle = 'rgba(255,255,255,0.06)'; roundRect(g, 20, y, W - 40, 46, 8); g.fill(); this.text(32, y + 14, m.name, { fs: 17, max: 330 }); this.text(32, y + 34, (m.is_public ? '🌍 publicado' : '🔒 privado') + '  ·  código ' + m.id + '  ·  ▶ ' + m.plays + '  ♥ ' + m.likes + '  ·  ' + m.objects + ' objetos', { fs: 13, b: false, c: '#bfe6ff', max: 400 });
        this.btn(W - 330, y + 5, 96, 36, '✎ Editar', () => this._mkOpen(m.id, true), { bg: '#4a5cc8', fs: 15 }); this.btn(W - 228, y + 5, 96, 36, '▶ Jogar', () => this._mkOpen(m.id, false), { bg: '#3a9a5a', fs: 15 }); this.btn(W - 126, y + 5, 96, 36, 'Excluir', () => { maker.remove(m.id).then(() => this._mkLoad()).catch(() => {}); }, { bg: '#8a4a4a', fs: 15 }); });
    } else {
      const m = maker.map, b = maker.brush, can = maker.mine, set = (fn) => () => { fn(); maker.rebuild(); }, cyc = (v, n) => (v + 1) % n;
      this.text(20, 116, m.name + (maker.id ? '  [' + maker.id + ']' : '  [rascunho]') + '  ·  ' + m.objs.length + '/700 objetos  ·  ' + Math.round(JSON.stringify(m).length / 1024) + ' KB' + (can ? '' : '  ·  (somente jogar: mapa de outro autor)'), { fs: 15, c: '#bfe6ff', max: W - 40 });
      if (can) {
        const R = (i, j, label, cb, o) => this.btn(20 + i * 183, 132 + j * 44, 178, 38, label, cb, Object.assign({ bg: '#33355a', fs: 14 }, o || {}));
        R(0, 0, '✏ Nome', () => this.keyboard('Nome do mapa', m.name, 28, (t) => { m.name = t; maker.rebuild(); }, 'maker')); R(1, 0, 'Tamanho: ' + m.size + ' m', set(() => { m.size = m.size >= 200 ? 60 : m.size + 20; })); R(2, 0, 'Céu: ' + SKIES[m.sky].n, set(() => { m.sky = cyc(m.sky, SKIES.length); })); R(3, 0, 'Chão: ' + GROUNDS[m.ground][0], set(() => { m.ground = cyc(m.ground, GROUNDS.length); }));
        R(0, 1, 'Água: ' + (m.water ? m.water + ' m' : 'não'), set(() => { m.water = m.water >= 6 ? 0 : m.water + 1; })); R(1, 1, 'Relevo: ' + ['plano', 'suave', 'médio', 'forte'][m.hills], set(() => { m.hills = cyc(m.hills, 4); })); R(2, 1, 'Música: ' + (MAPS[MOODS[m.mood]] ? MAPS[MOODS[m.mood]].name : MOODS[m.mood]), set(() => { m.mood = cyc(m.mood, MOODS.length); })); R(3, 1, 'Partículas: ' + (AMBS[m.amb] || 'nenhuma'), set(() => { m.amb = cyc(m.amb, AMBS.length); }));
        R(0, 2, maker.tool === 'erase' ? '🧽 Ferramenta: APAGAR' : '🖌 Ferramenta: COLOCAR', () => { maker.tool = maker.tool === 'erase' ? 'place' : 'erase'; }, { bg: maker.tool === 'erase' ? '#b04050' : '#3a9a5a' }); R(1, 2, '↶ Desfazer (' + maker.undo.length + ')', () => maker.undoLast(), { off: !maker.undo.length }); R(2, 2, 'Grade: ' + (b.grid ? 'sim' : 'não'), () => { b.grid = !b.grid; }); R(3, 2, 'Colisão: ' + (b.col ? 'sim' : 'não'), () => { b.col = !b.col; });
        const A = (i, label, cb) => this.btn(20 + i * 91.5, 264, 87, 38, label, cb, { bg: '#2a2c4a', fs: 14 });
        A(0, '⟲ Girar', () => { b.ry -= Math.PI / 12; }); A(1, 'Girar ⟳', () => { b.ry += Math.PI / 12; }); A(2, 'Menor', () => { b.s = Math.max(0.2, b.s / 1.2); }); A(3, 'Maior', () => { b.s = Math.min(6, b.s * 1.2); }); A(4, 'Descer', () => { b.dy -= 0.25; }); A(5, 'Subir', () => { b.dy += 0.25; });
        this.btn(20 + 6 * 91.5, 264, 179, 38, 'Cor', () => { b.color = cyc(b.color, COLORS.length); }, { bg: '#' + ('00000' + COLORS[b.color].toString(16)).slice(-6), fg: b.color < 3 || b.color === 14 ? '#222' : '#fff', fs: 14 });
        this.text(20, 318, 'Pincel: ' + b.key + '  ·  escala ' + b.s.toFixed(2) + '  ·  giro ' + Math.round(b.ry * 57.3) + '°  ·  altura ' + b.dy.toFixed(2), { fs: 14, c: '#9cf09c', max: W - 40 });
        this.btn(20, 334, 360, 46, '🎨 Escolher objeto', () => { this.page = 'mk_pal'; this.scroll = 0; }, { bg: '#4a5cc8', fs: 19 }); this.btn(388, 334, 360, 46, '📁 Importar meu asset (.glb / imagem)', () => { if (G.renderer.xr.isPresenting) { this.msg = 'Saia do VR para escolher um arquivo'; return; } const f = document.getElementById('file'); if (f) f.click(); }, { bg: '#a05cc8', fs: 15 });
        this.btn(20, 392, 178, 44, maker.editing ? '▶ Testar' : '✎ Voltar a editar', () => { maker.setEditing(!maker.editing); this.hide(); }, { bg: '#e8a030', fs: 16 }); this.btn(203, 392, 178, 44, '💾 Salvar (privado)', () => { this.msg = 'Salvando...'; maker.save(false).then((r) => { this.msg = r; this.dirty = true; }); }, { bg: '#33355a', fs: 15 });
        this.btn(386, 392, 178, 44, '🌍 Publicar', () => { this.msg = 'Publicando...'; maker.save(true).then((r) => { this.msg = r; this.dirty = true; }); }, { bg: '#3a9a5a', fs: 16 });
      }
      this.btn(570, 392, 178, 44, '🚪 Sair do mapa', () => { this.hide(); G.travel('village'); }, { bg: '#8a4a4a', fs: 16 });
      this.text(20, 452, 'PC: Z/X girar · -/= escala · PgUp/PgDn altura · G grade · Del apagar · U desfazer. Mapas criados não dão XP/moedas/itens.', { fs: 13, c: '#99a', b: false, max: W - 40 });
    }
  },
  p_mk_pal() {
    const cat = maker.catalog(), k = this.mk; k.cat = k.cat || 'Formas'; this.text(20, 34, '🎨 Escolher objeto', { fs: 22, c: '#ffd76a' });
    CAT_ORDER.forEach((c, i) => this.btn(20 + i * 104, 62, 100, 36, c, () => { k.cat = c; this.scroll = 0; }, { sel: k.cat === c, bg: '#2a2c4a', fs: 13 }));
    const L = k.cat === 'Meus assets' ? maker.myAssets() : cat[k.cat], off = this.pager(L.length, 24, 462);
    if (!L.length) this.text(20, 140, 'Nenhum asset importado. Use "Importar meu asset" no Editor (.glb até 20 mil vértices, ou imagem).', { fs: 15, c: '#99a', b: false, max: W - 40 });
    L.slice(off, off + 24).forEach((it, i) => this.btn(20 + (i % 4) * 183, 108 + Math.floor(i / 4) * 58, 178, 52, it[1], () => { maker.setBrush(it[0]); this.hide(); S.toast('Pincel: ' + it[1], '#9cf09c'); }, { sel: maker.brush.key === it[0], bg: '#33355a', fs: 14 }));
  },
  // ---------- NPC: diálogo, loja, profissão ----------
  p_dialog() {
    const n = this.npc; if (!n) return; this.text(20, 34, n.name, { fs: 26, c: '#ffe9a8' }); this.text(20, 62, n.role + ' — NPC', { fs: 16, c: '#99a', b: false });
    const g = this.g; g.fillStyle = 'rgba(255,255,255,0.08)'; roundRect(g, 20, 82, W - 40, 98, 12); g.fill(); this.wrap(34, 104, '“' + n.lines[this.line % n.lines.length] + '”', W - 70, 24, { fs: 18, b: false });
    this.btn(W - 190, 186, 170, 34, 'Próxima fala ▶', () => { this.line++; play('book', 0.5); }, { bg: '#33355a', fs: 15 });
    let y = 232;
    for (const id of n.quests || []) { const q = QUESTS[id], st = S.questState(id); if (st === 'locked') continue; if (y > 380) break;
      const pr = S.questProgress(id); g.fillStyle = 'rgba(255,255,255,0.06)'; roundRect(g, 20, y, W - 40, 56, 10); g.fill();
      this.text(32, y + 16, (st === 'done' ? '✔ ' : st === 'ready' ? '❓ ' : st === 'open' ? '❗ ' : '… ') + q.title + (st === 'active' || st === 'ready' ? '  (' + pr + '/' + q.goal.n + ')' : ''), { fs: 17, c: st === 'done' ? '#9cf09c' : '#ffd76a' }); this.text(32, y + 39, q.desc + '  → ' + q.xp + ' XP, ' + q.coins + ' 💰', { fs: 14, b: false, max: 540 });
      if (st === 'open') this.btn(W - 170, y + 9, 140, 38, 'Aceitar', () => { S.accept(id); G._npcMarks(); }, { bg: '#3a9a5a', fs: 17 }); else if (st === 'ready') this.btn(W - 170, y + 9, 140, 38, 'Entregar', () => { S.complete(id); G._npcMarks(); emit('saveNow'); }, { bg: '#e8a030', fs: 17 });
      y += 62; }
    let x = 20; if (n.shop === 'smith') { this.btn(W - 340, 440, 160, 50, '🔨 Forja', () => { this.page = 'q_craft'; this.scroll = 0; }, { bg: '#b07020' }); }
    if (n.shop) { this.btn(x, 440, 200, 50, '🛒 Loja', () => { this.page = 'shop'; this.shopSell = false; this.scroll = 0; }, { bg: '#4a5cc8' }); x += 214; }
    if (n.prof) { this.btn(x, 440, 240, 50, '🎓 Escolher profissão', () => { this.page = 'prof'; }, { bg: '#4a5cc8' }); x += 254; }
    if (n.spar) this.text(20, 250, 'Acerte o Mestre dentro do ringue para iniciar o treino. Ele avisa (pisca) antes de atacar: bloqueie ou esquive!', { fs: 15, b: false, max: W - 40 });
    this.btn(W - 170, 440, 150, 50, 'Tchau!', () => this.hide(), { bg: '#33355a' });
  },
  p_shop() {
    const n = this.npc; this.text(20, 34, '🛒 ' + n.name + ' — ' + n.role, { fs: 22, c: '#ffe9a8' }); this.text(W - 80, 80, '💰 ' + S.d.coins, { a: 'right', c: '#ffd76a', fs: 22 });
    this.btn(20, 62, 150, 38, 'Comprar', () => { this.shopSell = false; this.scroll = 0; }, { sel: !this.shopSell, bg: '#33355a' }); this.btn(178, 62, 150, 38, 'Vender', () => { this.shopSell = true; this.scroll = 0; }, { sel: this.shopSell, bg: '#33355a' });
    if (!this.shopSell) {
      SHOPS[n.shop].forEach((o, i) => { const y = 112 + i * 52, inf = S.offerInfo(o); const g = this.g; g.fillStyle = 'rgba(255,255,255,0.06)'; roundRect(g, 20, y, W - 40, 46, 8); g.fill(); this.text(34, y + 23, inf.name, { max: 420 }); this.btn(W - 250, y + 5, 220, 36, inf.owned ? '✔ Você já tem' : inf.locked ? '🔒 Compre o anterior' : 'Comprar — ' + inf.price + ' 💰', () => { this.msg = S.buy(o) || 'Comprado!'; if (o.k === 'hat') emit('saveNow'); }, { off: inf.owned || inf.locked || S.d.coins < inf.price, bg: '#3a9a5a', fs: 16 }); });
    } else {
      const ids = Object.keys(S.d.inv).filter((id) => ITEMS[id] && ITEMS[id].v && ITEMS[id].k !== 'quest'); const off = this.pager(ids.length, 6, 460);
      if (!ids.length) this.text(20, 150, 'Nada para vender.', { c: '#99a' });
      ids.slice(off, off + 6).forEach((id, i) => { const it = ITEMS[id], y = 112 + i * 50, c = S.count(id), pr = S.sellPrice(id); this.text(34, y + 21, it.n + '  x' + c, { c: RARITY[it.r].c, max: 300 }); this.btn(360, y + 3, 170, 36, 'Vender 1 — ' + pr, () => { S.sell(id, 1); }, { bg: '#e8a030', fs: 16 }); this.btn(540, y + 3, 208, 36, 'Vender tudo — ' + pr * c, () => { S.sell(id, c); }, { bg: '#e8a030', fs: 16 }); });
      this.btn(20, 458, 330, 40, 'Vender minérios, gemas e peixes', () => { const v = S.sellAll('ore') + S.sellAll('gem') + S.sellAll('fish'); this.msg = v ? 'Vendido por ' + v + ' moedas' : 'Nada para vender'; }, { bg: '#b07020', fs: 16 });
    }
  },
  p_prof() {
    this.text(20, 34, '🎓 Profissões', { fs: 24, c: '#ffd76a' }); this.text(20, 70, 'Escolha uma. O bônus vale em todos os mapas e pode ser trocado a qualquer momento.', { fs: 15, b: false, c: '#bfe6ff' });
    Object.keys(PROFS).forEach((k, i) => { const p = PROFS[k], y = 92 + i * 78, g = this.g; g.fillStyle = 'rgba(255,255,255,0.06)'; roundRect(g, 20, y, W - 40, 70, 10); g.fill(); this.text(34, y + 22, p.icon + ' ' + p.n, { fs: 21 }); this.text(34, y + 50, p.d, { fs: 15, b: false, max: 520 }); this.btn(W - 190, y + 14, 160, 42, S.d.prof === k ? '✔ Atual' : 'Escolher', () => { S.setProf(k); emit('saveNow'); }, { off: S.d.prof === k, bg: '#3a9a5a' }); });
  },
  // ---------- teclado virtual ----------
  keyboard(title, text, max, cb, back) { this.kb = { title, text: text || '', max, cb, back: back || 'map', shift: false }; this.show('kb'); },
  _kbDone() { const k = this.kb, t = k.text.trim(); if (k.back === 'close') this.hide(); else this.show(k.back); if (t) k.cb(t); },
  p_kb() {
    const k = this.kb, g = this.g; this.text(20, 34, k.title, { fs: 22, c: '#ffd76a' });
    g.fillStyle = '#0e0d1c'; roundRect(g, 20, 62, W - 40, 54, 10); g.fill(); this.text(34, 89, k.text + '▏', { fs: 24, max: W - 70 });
    const rows = ['1234567890', 'qwertyuiop', 'asdfghjklç', 'zxcvbnm,.?', 'áéíóúãõâê!'];
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const ch = k.shift ? r[i].toUpperCase() : r[i]; this.btn(22 + i * 73, 130 + j * 56, 68, 50, ch, () => { if (k.text.length < k.max) k.text += ch; }, { bg: '#33355a', fs: 24 }); } });
    this.btn(22, 412, 120, 50, k.shift ? '⇩ abc' : '⇧ ABC', () => { k.shift = !k.shift; }, { bg: '#2a2c4a' }); this.btn(150, 412, 300, 50, 'espaço', () => { if (k.text.length < k.max) k.text += ' '; }, { bg: '#33355a' });
    this.btn(458, 412, 110, 50, '⌫', () => { k.text = k.text.slice(0, -1); }, { bg: '#8a4a4a' }); this.btn(576, 412, 170, 50, '✔ OK', () => this._kbDone(), { bg: '#3a9a5a' });
    this.text(22, 484, 'No computador você também pode digitar no teclado físico.', { fs: 14, c: '#99a', b: false });
  },

  // ---------- HUD ----------
  drawHud() {
    const g = this.hg, d = S.d; g.clearRect(0, 0, 512, 160); if (!d) return;
    let y = 94; for (let i = this.toasts.length - 1; i >= (G.adminLabel ? Math.max(0, this.toasts.length - 2) : 0); i--) { const t = this.toasts[i]; g.font = 'bold 20px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; let s = t.t; while (s.length > 4 && g.measureText(s).width > 490) s = s.slice(0, -2); const w = g.measureText(s).width + 20; g.fillStyle = 'rgba(16,14,30,0.78)'; roundRect(g, 256 - w / 2, y - 14, w, 28, 9); g.fill(); g.fillStyle = t.c; g.fillText(s, 256, y + 1); y -= 31; }
    g.fillStyle = 'rgba(16,14,30,0.7)'; roundRect(g, 26, 112, 460, 44, 14); g.fill();
    g.textAlign = 'left'; g.font = 'bold 20px sans-serif'; g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText('Nv ' + d.level, 40, 134);
    g.fillStyle = 'rgba(0,0,0,0.5)'; roundRect(g, 100, 127, 110, 14, 7); g.fill(); g.fillStyle = '#6a9cff'; roundRect(g, 100, 127, Math.max(14, 110 * d.xp / S.xpNeed()), 14, 7); g.fill();
    const hp = S.hp / S.maxHp(); g.fillStyle = 'rgba(0,0,0,0.5)'; roundRect(g, 222, 127, 110, 14, 7); g.fill(); g.fillStyle = hp > 0.5 ? '#4ac86a' : hp > 0.25 ? '#e8a030' : '#e05050'; roundRect(g, 222, 127, Math.max(14, 110 * hp), 14, 7); g.fill();
    g.fillStyle = '#ffd76a'; g.fillText('💰' + d.coins, 344, 134);
    g.fillStyle = !net.online ? '#e05050' : net.status === 'online' ? '#4ac86a' : '#e8a030'; g.beginPath(); g.arc(466, 134, 7, 0, 6.3); g.fill();
    if (rec.on) { g.textAlign = 'left'; g.font = 'bold 20px sans-serif'; g.fillStyle = '#ff5050'; g.fillText('● REC ' + Math.floor(rec.seconds()) + 's', 30, 14); this.hudDirty = true; }
    if (G.adminLabel) { g.textAlign = 'center'; g.font = 'bold 18px sans-serif'; let s2 = G.adminLabel; while (s2.length > 4 && g.measureText(s2).width > 480) s2 = s2.slice(0, -2); const w2 = g.measureText(s2).width + 18; g.fillStyle = 'rgba(120,70,10,0.82)'; roundRect(g, 256 - w2 / 2, 2, w2, 24, 8); g.fill(); g.fillStyle = '#ffe9a8'; g.fillText(s2, 256, 15); }
    if (this.combo > 1) { g.textAlign = 'center'; g.font = 'bold 22px sans-serif'; g.fillStyle = '#ff9a40'; g.fillText('COMBO x' + this.combo, 256, G.adminLabel ? 40 : 14); }
    this.htex.needsUpdate = true;
  }
};
