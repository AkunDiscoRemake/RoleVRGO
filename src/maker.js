import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { modelKeys, modelGeometry, modelInfo, addRaw, play } from './assets.js';
import { net } from './net.js';
import { S } from './state.js';
import { ORES, ENEMIES, ITEMS } from './data.js';
import { store, emit, clamp, fbm, noise2 } from './util.js';

// Criador de Mapas: o jogador monta um mapa com qualquer modelo do jogo, formas coloridas,
// entidades de jogo e assets próprios (.glb / imagens), salva e publica para a comunidade.
// Em mapas criados NÃO há recompensas permanentes (XP, moedas, itens), para não quebrar a economia.
export const SKIES = [
  { n: 'Dia claro', sky: [0x8fd0f5, 0xffb27a, 0x0b1230] }, { n: 'Aero', sky: [0x4cc6ff, 0xffb8e6, 0x0c2a66] }, { n: 'Pôr do sol', sky: [0xffa070, 0xff8a5a, 0x2a1030] },
  { n: 'Neve', sky: [0xc8e4f8, 0xf5b8a0, 0x0c1430] }, { n: 'Noite roxa', sky: [0x2a2060, 0x40206a, 0x100820] }, { n: 'Caverna', sky: [0x16141e, 0x16141e, 0x16141e], indoor: true }
];
export const GROUNDS = [['Grama', 0x6fbf4f, 0x58a844, 'grass'], ['Grama Aero', 0x5fe03c, 0x86f24e, 'grass'], ['Areia', 0xe8c878, 0xd9b060, 'sand'], ['Neve', 0xf4f8ff, 0xdde8f5, 'snow'], ['Pedra', 0x8a8f98, 0x777c86, 'stone'], ['Asfalto', 0x4a4d55, 0x3f424a, 'stone'], ['Terra', 0x8a6a45, 0x7a5c3c, 'grass'], ['Vidro', 0xbfefff, 0x9fe0f6, 'stone']];
export const MOODS = ['village', 'forest', 'mine', 'desert', 'snow', 'arena', 'castle', 'city', 'island', 'training', 'aero'];
export const AMBS = ['', 'leaf', 'snow', 'dust', 'fire', 'spark', 'bubble'];
export const COLORS = [0xffffff, 0xd9d9d9, 0x8a8f98, 0x3b3b45, 0xe05050, 0xf2a65a, 0xf2c230, 0x6fd26f, 0x2fb8a0, 0x4aa8ff, 0x4a5cc8, 0xa45cf0, 0xe39ab0, 0x8a6a45, 0x9fe8ff];
const KIT_SCALE = { nature: 3.5, town: 4, castle: 5, city: 6.5, pirate: 1.2, survival: 3, arena: 3, holiday: 2.2, plat: 2, dungeon: 3, grave: 2.5, prim: 2, asset: 2 };
const KIT_CAT = { nature: 'Natureza', town: 'Construção', castle: 'Construção', city: 'Cidade', pirate: 'Decoração', survival: 'Decoração', arena: 'Decoração', holiday: 'Decoração', plat: 'Decoração', dungeon: 'Decoração', grave: 'Decoração', prim: 'Formas' };
export const CAT_ORDER = ['Natureza', 'Construção', 'Cidade', 'Decoração', 'Formas', 'Jogo', 'Meus assets'];
// entidades de jogo colocáveis: id -> rótulo
export const ENTS = [['spawn', '🚩 Ponto de início'], ['npc', '🐱 NPC (com fala)'], ['sign', '🪧 Placa de texto'], ['spring', '🌀 Trampolim'], ['lamp', '💡 Luz'], ['chest:0', '📦 Baú comum'], ['chest:1', '📦 Baú raro'], ['chest:2', '📦 Baú épico'],
  ['dummy', '🥊 Boneco de treino'], ['zone', '⚔ Zona de luta (PvP)'], ['secret', '⭐ Segredo'], ['dig', '❌ Tesouro enterrado'], ['fish', '🎣 Ponto de pesca'], ['portal', '🌀 Portal para a Vila'], ['bubbles', '🫧 Bolhas (20)']]
  .concat(Object.keys(ORES).map((k) => ['ore:' + k, '⛏ ' + ITEMS[k].n])).concat(Object.keys(ENEMIES).map((k) => ['enemy:' + k, '👾 ' + ENEMIES[k].n])).concat(Object.keys(ENEMIES).map((k) => ['boss:' + k, '👑 Chefe ' + ENEMIES[k].n]))
  .concat(['mushroom', 'flower', 'shell', 'pearl', 'wood', 'snowbell', 'cactusfruit', 'package'].map((k) => ['collect:' + k, '🧺 ' + ITEMS[k].n]));
const COLLECT_MODEL = { mushroom: 'nature/mushroom_red', flower: 'nature/flower_redA', shell: 'nature/rock_smallC', pearl: 'plat/jewel', wood: 'survival/resource-wood', snowbell: 'nature/flower_purpleC', cactusfruit: 'nature/cactus_short', package: 'survival/box' };
const T = (hex) => [((hex >> 16) & 255) / 255 * 1.05, ((hex >> 8) & 255) / 255 * 1.05, (hex & 255) / 255 * 1.05];
const C = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); }
function unb64(str) { const s = atob(str), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }

export const maker = {
  map: null, id: null, mine: false, editing: false, playing: false, tool: 'place', undo: [], dirty: false, cats: null, ghost: null, hit: new THREE.Vector3(), hitOk: false, G: null, status: '',
  brush: { kind: 'm', key: 'prim/box', ry: 0, s: 1, dy: 0, color: 0, grid: true, col: true },
  blank(name) { return { v: 1, name: name || 'Meu mapa', size: 120, ground: 0, sky: 0, water: 0, hills: 0, mood: 0, amb: 0, spawn: [0, 20, 0], objs: [], assets: {} }; },
  // catálogo por categoria (montado na primeira vez)
  catalog() {
    if (this.cats) return this.cats; const c = {}; for (const n of CAT_ORDER) c[n] = [];
    for (const k of modelKeys()) { const kit = k.split('/')[0]; if (KIT_CAT[kit]) c[KIT_CAT[kit]].push([k, k.split('/')[1].replace(/[-_]/g, ' ')]); }
    c.Jogo = ENTS.slice(); this.cats = c; return c;
  },
  myAssets() { const out = []; if (this.map) for (const id in this.map.assets) out.push(['asset:' + id, (this.map.assets[id].k === 'img' ? '🖼 ' : '🧊 ') + this.map.assets[id].n]); return out; },
  // registra os assets próprios do mapa como modelos utilizáveis
  loadAssets(map) {
    for (const id in map.assets) { const a = map.assets[id]; if (a.k !== 'model' || a._ok) continue;
      const q = new Int16Array(unb64(a.p).buffer), pos = new Float32Array(q.length), col = unb64(a.c), idx = new Uint16Array(unb64(a.x).buffer), b = a.b;
      for (let i = 0; i < q.length; i += 3) { pos[i] = b[0] + (q[i] + 32767) / 65534 * (b[3] - b[0]); pos[i + 1] = b[1] + (q[i + 1] + 32767) / 65534 * (b[4] - b[1]); pos[i + 2] = b[2] + (q[i + 2] + 32767) / 65534 * (b[5] - b[2]); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals(); const n = g.attributes.normal.array, nrm = new Int8Array(n.length); for (let i = 0; i < n.length; i++) nrm[i] = n[i] * 127; g.dispose();
      addRaw('asset:' + id, { pos, nrm, col, idx, v: pos.length / 3, i: idx.length, b }); Object.defineProperty(a, '_ok', { value: true, enumerable: false, writable: true }); }
  },
  // definição de mapa compatível com G.loadMap
  def() {
    const m = this.map, sk = SKIES[m.sky] || SKIES[0], gr = GROUNDS[m.ground] || GROUNDS[0], self = this; this.loadAssets(m);
    return { name: m.name, size: clamp(m.size, 60, 200), surface: gr[3], sky: sk.sky, indoor: sk.indoor, fog: 1.1, swim: m.water > 0, spawn: [m.spawn[0], m.spawn[1], m.spawn[2] || 0], custom: true, netKey: 'c_' + (this.id || 'l' + String(net.id || '').slice(0, 8)), moodId: MOODS[m.mood] || 'village', ambId: AMBS[m.amb] || '',
      build(w, E) {
        const half = w.half, amp = m.hills || 0;
        w.heightFn = (x, z) => { let h = amp ? (fbm(x * 0.03, z * 0.03, 5, 2) - 0.45) * amp * 2.2 : 0; const d = Math.max(Math.abs(x), Math.abs(z)); if (d > half - 8) h += Math.min(8, (d - half + 8) * (d - half + 8) * 0.12); return h; };
        const c1 = C(gr[1]), c2 = C(gr[2]);
        w.buildGround(48, (x, z, h, c) => { const k = noise2(x * 0.12, z * 0.12, 3); c[0] = c1[0] + (c2[0] - c1[0]) * k; c[1] = c1[1] + (c2[1] - c1[1]) * k; c[2] = c1[2] + (c2[2] - c1[2]) * k; });
        if (m.water > 0) w.addWater(m.water, 0x2ccbf2);
        E.imgs = []; let bub = 0;
        for (const o of m.objs) {
          if (o.t === 'm') { const kit = o.k.split(/[/:]/)[0]; if (kit === 'asset' && m.assets[o.k.slice(6)] && m.assets[o.k.slice(6)].k === 'img') { E.imgs.push(o); continue; }
            w.put(o.k, o.x, o.z, { s: (KIT_SCALE[kit] || 2) * o.s, ry: o.ry, abs: o.y, tint: o.c != null ? T(COLORS[o.c]) : null, col: o.nc ? null : 'box' }); }
          else { const k = o.k.split(':'), a = k[0], b = k[1];
            if (a === 'ore') E.ores.push({ type: b, x: o.x, z: o.z, fy: o.y }); else if (a === 'chest') E.chest('u' + E.chests.length, o.x, o.y, o.z, +b); else if (a === 'enemy' || a === 'boss') E.enemy(b, o.x, o.z, a === 'boss');
            else if (a === 'npc') { const d = o.d || {}; E.npcs.push({ id: 'u' + E.npcs.length, name: d.name || 'Gato', role: 'NPC do mapa', x: o.x, z: o.z, fy: o.y, yaw: o.ry, look: { fur: '#' + ('00000' + COLORS[(o.c || 5) % COLORS.length].toString(16)).slice(-6), fur2: '#f5f1e8', pattern: (o.c || 0) % 6, eyes: '#58c26a', hat: 0 }, lines: [d.text || 'Miau!'], wander: 0 }); }
            else if (a === 'sign') E.sign((o.d && o.d.text) || 'Placa', o.x, o.y + 2.4, o.z); else if (a === 'spring') E.springs.push({ x: o.x, z: o.z, p: 9 + o.s * 6, fy: o.y }); else if (a === 'lamp') E.lamp(o.x, o.y + 1.2, o.z, COLORS[o.c != null ? o.c : 6]);
            else if (a === 'dummy') E.dummies.push({ x: o.x, z: o.z, fy: o.y }); else if (a === 'zone') E.zone('fight', o.x, o.z, 5 + o.s * 3); else if (a === 'secret') E.secret('u' + E.secrets.length, o.x, o.y + 0.6, o.z, 2.2); else if (a === 'dig') E.dig(o.x, o.z);
            else if (a === 'fish') E.fish(o.x, o.z, 8); else if (a === 'portal') E.portal('village', o.x, o.z); else if (a === 'bubbles') bub += 20; else if (a === 'collect') E.collects.push({ item: b, model: COLLECT_MODEL[b], x: o.x, z: o.z, s: 2.4, fy: o.y, tint: b === 'pearl' ? [2.2, 2.2, 2.4] : b === 'shell' ? [1.5, 1.2, 1.3] : null }); }
        }
        if (bub) E.bubbles(Math.min(80, bub));
        if (!E.portals.length) E.portal('village', clamp(m.spawn[0] + 5, -half + 6, half - 6), clamp(m.spawn[1] + 5, -half + 6, half - 6));
        if (self.editing) for (const o of m.objs) if (o.t === 'e') w.put('prim/cone', o.x, o.z, { s: [0.35, 0.5, 0.35], abs: o.y + 2.6, tint: [1.6, 1.3, 0.2] }); // marcador das entidades no editor
      },
      after(G, add) { // quadros com imagens próprias (um plano texturizado por imagem)
        for (const o of G.E.imgs || []) { const a = m.assets[o.k.slice(6)]; if (!a) continue; const tx = new THREE.Texture(); const im = new Image(); im.onload = () => { tx.image = im; tx.needsUpdate = true; }; im.src = a.d; const hgt = 2.4 * o.s, wd = hgt * a.w / a.h;
          const me = add(new THREE.Mesh(new THREE.PlaneGeometry(wd, hgt), new THREE.MeshBasicMaterial({ map: tx, side: THREE.DoubleSide }))); me.position.set(o.x, o.y + hgt / 2 + 0.05, o.z); me.rotation.y = o.ry; }
      } };
  },
  // ---------- sessão ----------
  open(G, map, id, mine, editing) { this.G = G; this.map = map; this.id = id || null; this.mine = !!mine; this.editing = !!editing; this.playing = true; this.undo = []; this.dirty = false; S.sandbox = true; G.customDef = this.def(); if (G.mapId === 'custom') G.loadMap('custom'); else G.travel('custom'); emit('maker'); },
  rebuild() { const G = this.G, P = G.player, x = P.pos.x, y = P.pos.y, z = P.pos.z, yaw = P.yaw; G.customDef = this.def(); G.loadMap('custom', true); P.teleport(x, y + 0.05, z, yaw); this.dirty = true; this.autosave(); emit('maker'); },
  close() { this.playing = false; this.editing = false; S.sandbox = false; if (this.ghost) this.ghost.visible = false; emit('maker'); },
  setEditing(v) { this.editing = v; this.rebuild(); },
  autosave() { if (this.mine || !this.id) store.set('mapdraft', { id: this.id, map: this.map }); },
  draft() { return store.get('mapdraft', null); },
  // ---------- pincel ----------
  setBrush(key) { const ent = ENTS.some((e) => e[0] === key); this.brush.kind = ent ? 'e' : 'm'; this.brush.key = key; this.tool = 'place'; play('sel', 0.5); },
  // ponto apontado: marcha um raio até bater no cenário/chão
  aim(P, world) {
    const o = P.aimPos, d = P.aimDir, p = this.hit; p.copy(o); this.hitOk = false; const n = this._n || (this._n = new THREE.Vector3()), t = this._t || (this._t = new THREE.Vector3());
    for (let i = 0; i < 100; i++) { p.addScaledVector(d, 0.3); t.copy(p); if (world.collide(t, 0.06, n)) { p.copy(t); p.y -= 0.06; this.hitOk = true; break; } }
    if (this.hitOk && this.brush.grid) { p.x = Math.round(p.x * 2) / 2; p.z = Math.round(p.z * 2) / 2; p.y = Math.round(p.y * 4) / 4; }
    return this.hitOk;
  },
  update(G) {
    if (!this.editing || G.mapId !== 'custom' || !G.world) { if (this.ghost) this.ghost.visible = false; return; }
    if (!this.ghost) { this.ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x60ff90, transparent: true, opacity: 0.5, depthWrite: false, fog: false })); this.ghost.renderOrder = 9; G.scene.add(this.ghost); this._gk = ''; }
    const ok = this.aim(G.player, G.world) && !G.uiOpen, gh = this.ghost, b = this.brush; gh.visible = ok; if (!ok) return;
    const gk = this.tool + b.kind + b.key; if (gk !== this._gk) { this._gk = gk; const img = b.kind === 'm' && b.key.indexOf('asset:') === 0 && this.map.assets[b.key.slice(6)] && this.map.assets[b.key.slice(6)].k === 'img'; gh.geometry = this.tool === 'erase' || b.kind === 'e' || img ? this._sph || (this._sph = new THREE.IcosahedronGeometry(0.5, 1)) : modelGeometry(b.key); }
    gh.material.color.setHex(this.tool === 'erase' ? 0xff5050 : 0x60ff90);
    if (this.tool === 'erase' || b.kind === 'e') { gh.scale.setScalar(this.tool === 'erase' ? 1.6 : 1); gh.position.set(this.hit.x, this.hit.y + 0.5, this.hit.z); gh.rotation.y = 0; }
    else { const kit = b.key.split(/[/:]/)[0], sc = (KIT_SCALE[kit] || 2) * b.s; gh.scale.setScalar(sc); gh.position.set(this.hit.x, this.hit.y + b.dy, this.hit.z); gh.rotation.y = b.ry; }
  },
  act() { // gatilho no modo edição
    if (!this.hitOk) return; const m = this.map, b = this.brush, h = this.hit, r2 = (v) => Math.round(v * 100) / 100;
    if (this.tool === 'erase') { let best = -1, bd = 9; m.objs.forEach((o, i) => { const d = (o.x - h.x) * (o.x - h.x) + (o.z - h.z) * (o.z - h.z) + (o.y - h.y) * (o.y - h.y) * 0.3; if (d < bd) { bd = d; best = i; } }); if (best < 0) { emit('toast', 'Nada para apagar aqui', '#ff9a8a'); return; } this.undo.push({ add: m.objs.splice(best, 1)[0] }); play('close', 0.6); this.rebuild(); return; }
    if (m.objs.length >= 700) { emit('toast', 'Limite de 700 objetos por mapa', '#ff9a8a'); return; }
    if (b.kind === 'e' && b.key === 'spawn') { m.spawn = [r2(h.x), r2(h.z), r2(this.G.player.yaw)]; emit('toast', 'Ponto de início definido', '#9cf09c'); play('confirm', 0.6); this.dirty = true; this.autosave(); return; }
    const o = { t: b.kind, k: b.key, x: r2(h.x), y: r2(h.y + (b.kind === 'm' ? b.dy : 0)), z: r2(h.z), ry: r2(b.ry), s: r2(b.s) }; if (b.color > 0 || b.kind === 'e') o.c = b.color; if (!b.col && b.kind === 'm') o.nc = 1;
    if (b.kind === 'e' && (b.key === 'npc' || b.key === 'sign')) { emit('makerText', o); return; } // pede o texto antes de colocar
    m.objs.push(o); this.undo.push({ del: o }); play('wood', 0.6); this.rebuild();
  },
  commit(o) { this.map.objs.push(o); this.undo.push({ del: o }); play('wood', 0.6); this.rebuild(); },
  undoLast() { const u = this.undo.pop(); if (!u) return; if (u.del) { const i = this.map.objs.indexOf(u.del); if (i >= 0) this.map.objs.splice(i, 1); } else if (u.add) this.map.objs.push(u.add); this.rebuild(); },
  key(code) { if (!this.editing) return; const b = this.brush; if (code === 'KeyZ') b.ry -= Math.PI / 12; else if (code === 'KeyX') b.ry += Math.PI / 12; else if (code === 'Equal') b.s = Math.min(6, b.s * 1.15); else if (code === 'Minus') b.s = Math.max(0.2, b.s / 1.15); else if (code === 'PageUp') b.dy += 0.25; else if (code === 'PageDown') b.dy -= 0.25; else if (code === 'KeyG') b.grid = !b.grid; else if (code === 'Delete') this.tool = this.tool === 'erase' ? 'place' : 'erase'; else if (code === 'KeyU') this.undoLast(); else return; emit('maker'); },
  // ---------- importar assets próprios ----------
  async importFile(file) {
    const m = this.map; if (!m) return 'Abra um mapa no editor primeiro'; if (Object.keys(m.assets).length >= 8) return 'Limite de 8 assets por mapa';
    const id = Math.random().toString(36).slice(2, 7), name = file.name.replace(/\.[^.]+$/, '').slice(0, 18);
    if (/\.(png|jpe?g|webp)$/i.test(file.name)) {
      const url = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
      const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const k = Math.min(1, 256 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k)); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      m.assets[id] = { k: 'img', n: name, d: c.toDataURL('image/jpeg', 0.82), w: c.width, h: c.height };
    } else if (/\.glb$/i.test(file.name)) {
      const buf = await file.arrayBuffer(); const gltf = await new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej));
      const P = [], Cc = [], I = [], v = new THREE.Vector3(), col = new THREE.Color(); const uvv = new THREE.Vector2(); gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => { if (!o.isMesh || !o.geometry.attributes.position) return; const g = o.geometry, pos = g.attributes.position, uv = g.attributes.uv, vc = g.attributes.color, mat = Array.isArray(o.material) ? o.material[0] : o.material, base = P.length / 3;
        let px = null; if (mat && mat.map && mat.map.image) { try { const im = mat.map.image, c = document.createElement('canvas'); c.width = Math.min(256, im.width); c.height = Math.min(256, im.height); const x = c.getContext('2d'); x.drawImage(im, 0, 0, c.width, c.height); px = x.getImageData(0, 0, c.width, c.height); } catch (e) { px = null; } }
        for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); P.push(v.x, v.y, v.z); col.copy(mat && mat.color ? mat.color : col.set(0xffffff)); let r = col.r * 255, g2 = col.g * 255, b2 = col.b * 255;
          if (px && uv) { uvv.set(uv.getX(i), uv.getY(i)); if (mat.map.matrixAutoUpdate) mat.map.updateMatrix(); uvv.applyMatrix3(mat.map.matrix); let u = uvv.x, w2 = uvv.y; u -= Math.floor(u); w2 -= Math.floor(w2); if (mat.map.flipY) w2 = 1 - w2; const k = (Math.min(px.height - 1, Math.floor(w2 * px.height)) * px.width + Math.min(px.width - 1, Math.floor(u * px.width))) * 4; r *= px.data[k] / 255; g2 *= px.data[k + 1] / 255; b2 *= px.data[k + 2] / 255; }
          if (vc) { r *= vc.getX(i); g2 *= vc.getY(i); b2 *= vc.getZ(i); } Cc.push(Math.min(255, r), Math.min(255, g2), Math.min(255, b2)); }
        if (g.index) for (let i = 0; i < g.index.count; i++) I.push(base + g.index.getX(i)); else for (let i = 0; i < pos.count; i++) I.push(base + i); });
      const nv = P.length / 3; if (!nv) return 'O arquivo não tem malhas'; if (nv > 20000) return 'Modelo grande demais (' + nv + ' vértices; máx. 20000)';
      const bb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]; for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) { bb[k] = Math.min(bb[k], P[i * 3 + k]); bb[k + 3] = Math.max(bb[k + 3], P[i * 3 + k]); }
      // normaliza: maior dimensão = 1, base no chão, centrado
      const sc = 1 / Math.max(bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2], 1e-6), cx = (bb[0] + bb[3]) / 2, cz = (bb[2] + bb[5]) / 2, nb = [(bb[0] - cx) * sc, 0, (bb[2] - cz) * sc, (bb[3] - cx) * sc, (bb[4] - bb[1]) * sc, (bb[5] - cz) * sc];
      const q = new Int16Array(nv * 3); for (let i = 0; i < nv; i++) { const x = (P[i * 3] - cx) * sc, y = (P[i * 3 + 1] - bb[1]) * sc, z = (P[i * 3 + 2] - cz) * sc; q[i * 3] = Math.round((x - nb[0]) / Math.max(1e-6, nb[3] - nb[0]) * 65534 - 32767); q[i * 3 + 1] = Math.round(y / Math.max(1e-6, nb[4]) * 65534 - 32767); q[i * 3 + 2] = Math.round((z - nb[2]) / Math.max(1e-6, nb[5] - nb[2]) * 65534 - 32767); }
      m.assets[id] = { k: 'model', n: name, p: b64(new Uint8Array(q.buffer)), c: b64(new Uint8Array(Cc)), x: b64(new Uint8Array(new Uint16Array(I).buffer)), b: nb.map((n) => Math.round(n * 1000) / 1000) };
    } else return 'Formato não suportado (use .glb, .png ou .jpg)';
    const size = JSON.stringify(m).length; if (size > 900000) { delete m.assets[id]; return 'O mapa ficaria grande demais (' + Math.round(size / 1024) + ' KB; máx. 880 KB)'; }
    this.loadAssets(m); this.setBrush('asset:' + id); this.dirty = true; this.autosave(); emit('maker'); return '';
  },
  // ---------- servidor (comunidade) ----------
  async save(pub) {
    this.autosave(); if (!net.online) return 'Offline: rascunho salvo só neste aparelho';
    try { const r = await net.rpc('rv_map_save', { p_map_id: this.mine ? this.id : null, p_name: this.map.name, p_data: this.map, p_public: !!pub }); const first = this.id !== r.id; this.id = r.id; this.mine = true; this.dirty = false; this.pub = !!pub; this.autosave(); emit('maker');
      if (first && this.G && this.G.mapId === 'custom') { this.G.customDef.netKey = 'c_' + r.id; net.join(this.G.room, 'c_' + r.id, this.G.roomPublic); this.G.pushMeta(); } return pub ? 'Publicado! Código: ' + r.id : 'Salvo (privado). Código: ' + r.id; }
    catch (e) { return /rv_map|schema cache|PGRST202/.test(e.message || '') ? 'O banco ainda não tem as tabelas de mapas (rode supabase/maps.sql)' : 'Erro ao salvar: ' + (e.message || e); }
  },
  async list(sort) { const { data, error } = await net.client.rpc('rv_map_list', { p_sort: sort || 'new' }); if (error) throw error; return data || []; },
  async listMine() { return (await net.rpc('rv_map_mine')) || []; },
  async fetch(id) { const { data, error } = await net.client.rpc('rv_map_get', { p_map_id: String(id).toUpperCase() }); if (error) throw error; return data; },
  async play(G, id, edit) { const r = await this.fetch(id); if (!r) return 'Mapa não encontrado'; this.open(G, r.data, r.id, r.owner === net.id, edit && r.owner === net.id); this.pub = r.is_public; return ''; },
  async like(id) { return net.rpc('rv_map_like', { p_map_id: id }); },
  async remove(id) { return net.rpc('rv_map_delete', { p_map_id: id }); }
};
