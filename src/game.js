import * as THREE from 'three';
import { World, worldMat, matU, glossify } from './world.js';
import { MAPS, initPrims, PORTAL_COLORS, MAP_ICONS } from './maps.js';
import { modelGeometry, play, playAt, meow, purr, pop, setUnder, ambience, chime, splashSfx, chirp, thunder } from './assets.js';
import { CatAvatar, HandPool, EMOTES, AGE_EYE } from './cat.js';
import { FX, LabelBatch } from './fx.js';
import { Sky } from './sky.js';
import { perf } from './perf.js';
import { net } from './net.js';
import { S } from './state.js';
import { ITEMS, ORES, PICKS, GLOVES, RODS, FISH_TABLE, TREASURE_TABLE, RARITY, QUESTS, currentEvent, HELD, PROPS, ENEMIES, BOSS_NAMES, BOSS_DROPS, titleFor, PETS } from './data.js';
import { rng, hashStr, clamp, emit, on, angDiff } from './util.js';
import { EYE, HAND_R } from './config.js';
import { maker } from './maker.js';
import { home } from './home.js';
import { voice } from './voice.js';
import { infect } from './infect.js';
import { admin } from './admin.js';
import { DAY_LENGTH } from './config.js';

const cleanName = (n) => String(n == null ? 'Gato' : n).replace(/[\u0000-\u001f<>]/g, '').slice(0, 16) || 'Gato';
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _col = new THREE.Color(), _col2 = new THREE.Color(), _q2 = new THREE.Quaternion();
const bubbleMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
  vertexShader: 'varying vec3 vN;\nvoid main(){ vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * mat3(instanceMatrix) * normal); gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'varying vec3 vN;\nvoid main(){ vec3 n = normalize(vN); float fr = pow(1.0 - abs(n.z), 2.2); float sp = smoothstep(0.90, 0.97, dot(n, normalize(vec3(-0.45, 0.6, 0.66)))) + 0.5 * smoothstep(0.95, 0.99, dot(n, normalize(vec3(0.5, -0.5, 0.7)))); vec3 c = mix(vec3(0.55, 0.92, 1.0), vec3(1.0), fr) + vec3(0.25, 0.1, 0.3) * n.y * fr; gl_FragColor = vec4(c + sp, clamp(0.10 + fr * 0.62 + sp, 0.0, 1.0)); }' });
const AMBIENT = { dark: 'ember', pool: '', aero: 'bubble', village: 'leaf', forest: 'fire', mine: 'spark', desert: 'dust', snow: 'snow', castle: 'leaf', island: 'leaf', training: 'leaf', arena: 'dust', nuke: 'dust' };
const UP = new THREE.Vector3(0, 1, 0), ZERO = new THREE.Vector3(0, 0, 0);
const instMat = new THREE.MeshLambertMaterial({ vertexColors: true }); glossify(instMat, 'rvinst', false);
const jellyMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: matU.uTime },
  vertexShader: 'uniform float uTime;\nvarying vec3 vN;\nvarying float vY;\nvoid main(){ vec3 p = position; float pl = 1.0 + sin(uTime * 2.4 + instanceMatrix[3][0]) * 0.14; p.xz *= pl; p.y /= pl; vY = position.y * 2.0; vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * mat3(instanceMatrix) * normal); gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'varying vec3 vN;\nvarying float vY;\nvoid main(){ float fr = pow(1.0 - abs(normalize(vN).z), 1.6); vec3 c = mix(vec3(1.0, 0.45, 0.85), vec3(0.6, 0.5, 1.0), vY) + fr * 0.6; gl_FragColor = vec4(c, 0.28 + fr * 0.6); }' });
function setInst(mesh, i, x, y, z, s, ry) { _q.setFromAxisAngle(UP, ry || 0); _m.compose(_p.set(x, y, z), _q, typeof s === 'number' ? _s.set(s, s, s) : _s.set(s[0], s[1], s[2])); mesh.setMatrixAt(i, _m); mesh.instanceMatrix.needsUpdate = true; }
function pickTable(tab, luck, r) { let tot = 0; const w = tab.map((t, i) => { const v = t[1] * (1 + (luck || 0) * i * 1.2); tot += v; return v; }); let x = (r || Math.random)() * tot; for (let i = 0; i < tab.length; i++) { x -= w[i]; if (x <= 0) return tab[i][0]; } return tab[0][0]; }

export const G = {
  drops: [], tChests: [], admT: 0, adminLabel: '',
  props: new Map(), propSeq: 0, fireT: 0, enemies: [], tool: 0,
  ready: false, mapId: null, def: null, world: null, E: null, objs: [], npcs: [], remotes: new Map(), sids: {}, sid: Math.random().toString(36).slice(2, 6),
  room: 'PRACA', roomName: 'Praça Central', roomPublic: true, chatLog: [], friends: [], fishing: null, spar: null, lastHurt: 0, netT: 0, evBlock: -1, evT: 0, fade: 0, pending: null, time: 0, stepT: 0, combo: 0, comboT: 0,

  init(scene, camera, renderer, player) {
    this.scene = scene; this.camera = camera; this.renderer = renderer; this.player = player;
    initPrims();
    this.sky = new Sky(scene); this.fx = new FX(scene); this.hands = new HandPool(scene, 96);
    this.laser = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)), new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.8 })); this.laser.frustumCulled = false; this.laser.visible = false; scene.add(this.laser);
    this.fadeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false })); this.fadeMesh.renderOrder = 999; this.fadeMesh.visible = false; camera.add(this.fadeMesh);
    this.bobber = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), new THREE.MeshBasicMaterial({ color: 0xff4040 })); this.bobber.visible = false; scene.add(this.bobber);
    this.line = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)), new THREE.LineBasicMaterial({ color: 0xffffff })); this.line.frustumCulled = false; this.line.visible = false; scene.add(this.line);
    player.onTrigger = () => this.onTrigger();
    this.tpBall = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), new THREE.MeshBasicMaterial({ color: 0x60e8ff, transparent: true, opacity: 0.85, fog: false })); this.tpBall.visible = false; this.tpBall.renderOrder = 8; scene.add(this.tpBall);
    this.tpArc = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(player.tp.pts, 3).setUsage(THREE.DynamicDrawUsage)), new THREE.LineBasicMaterial({ color: 0x60e8ff, transparent: true, opacity: 0.9, fog: false })); this.tpArc.frustumCulled = false; this.tpArc.visible = false; scene.add(this.tpArc);
    on('teleported', () => { play('portal', 0.45, 0, 1.5); const p = player.pos; this.fx.burst(p.x, p.y + 0.6, p.z, 0x60e8ff, 18, 3, 1); });
    this.heldMesh = new THREE.Mesh(modelGeometry('survival/tool-pickaxe'), instMat); this.heldMesh.visible = false; this.heldMesh.frustumCulled = false; scene.add(this.heldMesh);
    voice.init(this); infect.init(this); this._bindEvents(); this.ready = true;
  },

  // ================= carregamento de mapa =================
  travel(id) { if (this.pending || (!MAPS[id] && id !== 'custom' && id !== 'home') || (id === this.mapId && id !== 'home')) return; this.pending = id; this.fade = 0.001; play('portal', 0.6); },
  loadMap(id, keep) {
    const scene = this.scene; if (id !== 'nuke' || !keep) infect.leave(); this._disposeMap();
    const def = id === 'custom' ? this.customDef : id === 'home' ? this.homeDef : MAPS[id], w = new World(scene, def.size); w.surface = def.surface;
    if (id !== 'custom' && maker.playing) maker.close(); S._sbChests = [];
    const E = { npcs: [], ores: [], chests: [], portals: [], collects: [], digs: [], fishes: [], secrets: [], dummies: [], zones: [], lamps: [], signs: [], boards: [], springs: [] };
    E.npc = (nid, name, role, x, z, look, o) => E.npcs.push(Object.assign({ id: nid, name, role, x, z, look }, o));
    E.ore = (type, x, z) => E.ores.push({ type, x, z }); E.chest = (key, x, y, z, tier) => E.chests.push({ key, x, y, z, tier });
    E.portal = (to, x, z) => E.portals.push({ to, x, z }); E.collect = (item, model, x, z, s, tint) => E.collects.push({ item, model, x, z, s: s || 2, tint });
    E.dig = (x, z) => E.digs.push({ x, z }); E.fish = (x, z, r) => E.fishes.push({ x, z, r }); E.secret = (key, x, y, z, r) => E.secrets.push({ key, x, y, z, r });
    E.dummy = (x, z) => E.dummies.push({ x, z }); E.zone = (type, x, z, r) => E.zones.push({ type, x, z, r }); E.lamp = (x, y, z, c) => E.lamps.push({ x, y, z, c: c || 0xffd890 });
    E.sign = (text, x, y, z) => E.signs.push({ text, x, y, z }); E.board = (x, z, yaw) => E.boards.push({ x, z, yaw }); E.spring = (x, z, p) => E.springs.push({ x, z, p }); E.enemies = []; E.enemy = (type, x, z, boss) => E.enemies.push({ type, x, z, boss }); E.schools = []; E.school = (x, y, z, r, n) => E.schools.push({ x, y, z, r, n }); E.bubbleN = 0; E.bubbles = (n) => { E.bubbleN = n; }; E.rainbow = (x, z, r) => { E.rb = { x, z, r }; }; E.trees = []; E.tree = (x, z, model) => E.trees.push({ x, z, model: model || 'nature/tree_default' }); E.falls = []; E.waterfall = (x, y1, z, y0, wd) => E.falls.push({ x, y1, z, y0, wd });
    def.build(w, E, rng(hashStr(id)));
    w.swim = !!def.swim; matU.uTiles.value = id === 'pool' ? 1 : 0; matU.uGloss.value = id === 'pool' ? 0.6 : id === 'aero' || (def.custom && def.sky[0] === 0x4cc6ff) ? 1 : 0; matU.uCaust.value = def.swim ? 1 : 0;
    this.world = w; this.E = E; this.def = def; this.mapId = id;
    const add = (o) => { scene.add(o); this.objs.push(o); return o; };
    const inst = (geo, n, mat) => { const m = new THREE.InstancedMesh(geo, mat || instMat, Math.max(1, n)); m.count = n; m.frustumCulled = false; m.castShadow = true; return add(m); };
    this.labels = new LabelBatch(scene);
    // portais
    const sp = def.spawn;
    for (const p of E.portals) {
      p.y = w.heightAt(p.x, p.z); p.yaw = Math.atan2(sp[0] - p.x, sp[1] - p.z); if (id === 'village') p.yaw = Math.atan2(-p.x, -p.z);
      w.put('nature/statue_ring', p.x, p.z, { s: 4, ry: p.yaw, tint: [1.15, 1.15, 1.2] });
      const cs = Math.cos(p.yaw), sn = Math.sin(p.yaw); w.addBoxC(p.x - cs * 1.1, p.y, p.z + sn * 1.1, 0.5, 3, 0.5); w.addBoxC(p.x + cs * 1.1, p.y, p.z - sn * 1.1, 0.5, 3, 0.5);
      this.labels.add(MAP_ICONS[p.to] + ' ' + MAPS[p.to].name, p.x, p.y + 3.5, p.z, p.yaw, 3, '#fff', 'rgba(20,18,30,0.8)');
    }
    if (E.portals.length) {
      const dg = new THREE.CircleGeometry(0.95, 14); this.portalMesh = add(new THREE.InstancedMesh(dg, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }), E.portals.length)); this.portalMesh.frustumCulled = false;
      E.portals.forEach((p, i) => { setInst(this.portalMesh, i, p.x, p.y + 1.45, p.z, 1, p.yaw); this.portalMesh.setColorAt(i, _col.setHex(PORTAL_COLORS[p.to])); });
    }
    for (const s of E.springs) { s.y = s.fy != null ? s.fy : w.heightAt(s.x, s.z); w.put('plat/spring', s.x, s.z, { s: 2.4 }); }
    for (const s of E.signs) this.labels.add(s.text, s.x, s.y, s.z, Math.atan2(sp[0] - s.x, sp[1] - s.z), 3.2);
    for (const f of E.fishes) this.labels.add('🎣 Ponto de pesca', f.x, w.waterY + 1.6, f.z, Math.atan2(sp[0] - f.x, sp[1] - f.z), 2.6, '#bfe6ff');
    for (const z of E.zones) this.labels.add('⚔ Zona de luta (PvP)', z.x, w.heightAt(z.x, z.z) + 4.4, z.z + 0.01, Math.atan2(sp[0] - z.x, sp[1] - z.z), 3.4, '#ffb0a0');
    this.labels.build();
    // minérios (+8 vagas para o evento Chuva de Cristais)
    const nOre = E.ores.length + 8;
    this.oreMesh = inst(modelGeometry('survival/rock-b'), nOre); this.gemMesh = inst(modelGeometry('plat/jewel'), nOre);
    for (let i = 0; i < 8; i++) E.ores.push({ type: 'star', x: 0, z: 0, ev: true, alive: false });
    E.ores.forEach((o, i) => { o.i = i; o.y = o.fy != null ? o.fy : w.heightAt(o.x, o.z); o.hp = ORES[o.type].hp; if (o.alive == null) o.alive = true; o.ry = (i * 2.4) % 6.28; o.sc = 1.25 + (i % 3) * 0.2; this._oreVis(o); });
    // árvores cortáveis (machado): um InstancedMesh por modelo, toco fixo embaixo, tronco com colisão removível
    { const tg = {}; for (const t of E.trees) (tg[t.model] = tg[t.model] || []).push(t);
      for (const k in tg) { const mesh = inst(modelGeometry(k), tg[k].length), sc = k.indexOf('plat/') === 0 ? 2.6 : k.indexOf('palm') >= 0 ? 4.6 : 4.4; tg[k].forEach((t, i) => { t.mesh = mesh; t.i = i; t.y = w.heightAt(t.x, t.z); t.s = sc * (0.9 + (i % 4) * 0.07); t.ry = i * 2.1; t.hp = 5; t.alive = true; t.fall = 0; setInst(mesh, i, t.x, t.y, t.z, t.s, t.ry); mesh.setColorAt(i, _col.setRGB(1.12, 1.05, 0.9)); w.put('nature/stump_round', t.x, t.z, { s: 2.2 }); t.box = [t.x - 0.35, t.y, t.z - 0.35, t.x + 0.35, t.y + 3.2, t.z + 0.35]; w.dyn.push(t.box); }); }
      E.trees.forEach((t, i) => { t.n = i; }); }
    // baús (+1 vaga para o Baú Dourado)
    E.chests.push({ key: 'ev', x: 0, y: -999, z: 0, tier: 3, ev: true, hidden: true });
    this.chestMesh = inst(modelGeometry('plat/chest'), E.chests.length);
    E.chests.forEach((c, i) => { c.i = i; if (c.y == null) c.y = w.heightAt(c.x, c.z); c.ry = Math.atan2(sp[0] - c.x, sp[1] - c.z); this._chestVis(c); });
    // coletáveis por modelo
    const groups = {}; for (const c of E.collects) (groups[c.model] = groups[c.model] || []).push(c);
    for (const k in groups) { const mesh = inst(modelGeometry(k), groups[k].length); groups[k].forEach((c, i) => { c.mesh = mesh; c.i = i; c.y = c.fy != null ? c.fy : w.heightAt(c.x, c.z); c.alive = true; c.ry = i * 1.7; setInst(mesh, i, c.x, c.y, c.z, c.s, c.ry); mesh.setColorAt(i, c.tint ? _col.setRGB(c.tint[0], c.tint[1], c.tint[2]) : _col.setRGB(1.25, 1.25, 1.25)); }); }
    // tesouros enterrados (X)
    if (E.digs.length) { const a = new THREE.BoxGeometry(1.1, 0.06, 0.22), b = new THREE.BoxGeometry(0.22, 0.06, 1.1); a.rotateY(0.785); b.rotateY(0.785); const pos = new Float32Array(72 * 3), nr = new Float32Array(72 * 3); const an = a.toNonIndexed(), bn = b.toNonIndexed(); pos.set(an.attributes.position.array); pos.set(bn.attributes.position.array, 108); nr.set(an.attributes.normal.array); nr.set(bn.attributes.normal.array, 108); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nr, 3));
      this.digMesh = inst(g, E.digs.length, new THREE.MeshLambertMaterial({ color: 0xc03a2a })); E.digs.forEach((d, i) => { d.i = i; d.y = w.heightAt(d.x, d.z); d.hp = 4; d.alive = true; setInst(this.digMesh, i, d.x, d.y + 0.05, d.z, 1, i); }); }
    // segredos (estrela flutuante até serem achados)
    if (E.secrets.length) { this.starMesh = inst(modelGeometry('plat/star'), E.secrets.length); E.secrets.forEach((s, i) => { s.i = i; s.found = S.d.secrets.indexOf(s.key) >= 0; this.starMesh.setColorAt(i, _col.setRGB(1.3, 1.2, 0.6)); setInst(this.starMesh, i, s.x, s.y + 0.3, s.z, s.found ? 0 : 1.6, 0); }); }
    // bonecos de treino
    if (E.dummies.length) { this.dummyMesh = inst(modelGeometry('arena/character-soldier'), E.dummies.length); E.dummies.forEach((d, i) => { d.i = i; d.y = d.fy != null ? d.fy : w.heightAt(d.x, d.z); d.wob = 0; d.ry = Math.atan2(sp[0] - d.x, sp[1] - d.z); setInst(this.dummyMesh, i, d.x, d.y, d.z, 1.7, d.ry); this.dummyMesh.setColorAt(i, _col.setRGB(1, 1, 1)); w.put('prim/cyl', d.x, d.z, { s: [0.9, 0.12, 0.9], tint: [0.5, 0.4, 0.3] }); }); }
    // lanternas
    if (E.lamps.length) {
      this.lampMesh = inst(new THREE.IcosahedronGeometry(0.17, 0), E.lamps.length, new THREE.MeshBasicMaterial({ fog: false })); this.lampMesh.castShadow = false;
      const gp = new Float32Array(E.lamps.length * 3), gc = new Float32Array(E.lamps.length * 3);
      E.lamps.forEach((l, i) => { setInst(this.lampMesh, i, l.x, l.y, l.z, 1, 0); _col.setHex(l.c); this.lampMesh.setColorAt(i, _col); gp[i * 3] = l.x; gp[i * 3 + 1] = l.y; gp[i * 3 + 2] = l.z; gc[i * 3] = _col.r; gc[i * 3 + 1] = _col.g; gc[i * 3 + 2] = _col.b; });
      const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gp, 3)); gg.setAttribute('color', new THREE.BufferAttribute(gc, 3));
      this.glow = add(new THREE.Points(gg, new THREE.PointsMaterial({ size: 3.4, map: this.fx.tex, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }))); this.glow.frustumCulled = false; this.glow.renderOrder = 3;
    }
    // placares
    for (const b of E.boards) { const c = document.createElement('canvas'); c.width = 512; c.height = 512; const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; const m = add(new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ map: t }))); const y = w.heightAt(b.x, b.z); m.position.set(b.x, y + 2.3, b.z); m.rotation.y = b.yaw; b.canvas = c; b.tex = t; w.put('prim/box', b.x, b.z, { s: [3.3, 4, 0.2], ry: b.yaw, tint: [0.35, 0.25, 0.2], y: 0, col: 'box' }); m.position.x += Math.sin(b.yaw) * 0.12; m.position.z += Math.cos(b.yaw) * 0.12; }
    this._boards();
    // NPCs
    for (const n of E.npcs) {
      const av = new CatAvatar(n.look, n.name, { npc: true, sub: n.role, tagColor: '#ffe9a8' }); n.y = n.fy != null ? n.fy : w.heightAt(n.x, n.z); n.hx = n.x; n.hz = n.z; n.yaw = n.yaw || Math.atan2(sp[0] - n.x, sp[1] - n.z) + Math.PI; n.av = av; n.t = Math.random() * 5; n.wander = n.wander == null ? (n.shop || n.spar ? 0 : 1.6) : n.wander; n.tx = n.x; n.tz = n.z;
      av.root.position.set(n.x, n.y, n.z); av.root.rotation.y = n.yaw; scene.add(av.root); this.npcs.push(n);
      if (n.spar) { n.hpMax = 120; n.hp = 120; n.state = 'idle'; n.st = 0; n.zone = E.zones.find((z) => Math.hypot(z.x - n.x, z.z - n.z) < z.r + 8); }
    }
    this._npcMarks();
    // --- Frutiger Aero: bolhas brilhantes (estouráveis), cardumes e arco-íris ---
    this.bubbles = []; this.bubbleMesh = null; this.schoolMesh = null;
    if (E.bubbleN) { this.bubbleMesh = add(new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), bubbleMat, E.bubbleN)); this.bubbleMesh.frustumCulled = false; this.bubbleMesh.renderOrder = 6; const rb = rng(77);
      for (let i = 0; i < E.bubbleN; i++) { const a = rb() * 6.28, d = 6 + rb() * 70, x = Math.cos(a) * d, z = Math.sin(a) * d, gh = w.heightAt(x, z), uw = gh < -2 && rb() < 0.7; this.bubbles.push({ i, x, z, y: uw ? gh + 1 + rb() * (-gh - 2) : Math.max(gh, 0) + 1.2 + rb() * 9, r: 0.35 + rb() * 0.75, ph: rb() * 6.28, alive: true, t: 0 }); } }
    let nf = 0; for (const sc of E.schools) nf += sc.n; if (nf) { this.schoolMesh = inst(modelGeometry('survival/fish'), nf); let k = 0; for (const sc of E.schools) { sc.i0 = k; for (let i = 0; i < sc.n; i++) this.schoolMesh.setColorAt(k++, _col.setHSL((i * 0.13) % 1, 0.9, 0.7).multiplyScalar(1.6)); } }
    if (E.rb) { const R = E.rb.r, bands = [0xff5a5a, 0xffa040, 0xffe850, 0x60e070, 0x50b0ff, 0x9a70ff], seg = 40, pos = [], colr = [], idx = []; for (let b = 0; b <= bands.length; b++) for (let s2 = 0; s2 <= seg; s2++) { const a = s2 / seg * Math.PI, rr = R - b * 1.5; pos.push(Math.cos(a) * rr, Math.sin(a) * rr, 0); _col.setHex(bands[Math.min(b, bands.length - 1)]); colr.push(_col.r, _col.g, _col.b); }
      for (let b = 0; b < bands.length; b++) for (let s2 = 0; s2 < seg; s2++) { const p0 = b * (seg + 1) + s2, p1 = p0 + seg + 1; idx.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1); }
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); rg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colr), 3)); rg.setIndex(idx);
      const rm = add(new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false, fog: false }))); rm.position.set(E.rb.x, -6, E.rb.z); rm.frustumCulled = false; rm.renderOrder = -5; }
    matU.uWaterY.value = w.waterY;
    // --- Aero: golfinhos, águas-vivas, raios de luz, cintilação na água, aurora, cachoeiras, lens flare ---
    this.ax = null;
    if (E.aero) { const ax = this.ax = { dol: [], jel: [], falls: E.falls, flare: [] }, rb = rng(909);
      ax.dolMesh = inst(modelGeometry('survival/fish'), 3); for (let i = 0; i < 3; i++) { ax.dol.push({ a: i * 2.1, t: i * 2.3, r: 20 + i * 4, up: false }); ax.dolMesh.setColorAt(i, _col.setRGB(0.55, 0.8, 1.25)); }
      ax.jelMesh = add(new THREE.InstancedMesh(modelGeometry('prim/dome'), jellyMat, 10)); ax.jelMesh.frustumCulled = false; ax.jelMesh.renderOrder = 5;
      for (let i = 0; i < 10; i++) { const a = rb() * 6.28, d = 14 + rb() * 20; ax.jel.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: -3 - rb() * 6, ph: rb() * 6, s: 0.7 + rb() * 0.9 }); }
      const rayG = new THREE.PlaneGeometry(2.6, 15); rayG.translate(0, -7.5, 0); ax.rays = add(new THREE.InstancedMesh(rayG, new THREE.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: 0.11, side: THREE.DoubleSide, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }), 14)); ax.rays.frustumCulled = false; ax.rays.renderOrder = 6; ax.rayP = [];
      for (let i = 0; i < 14; i++) { const a = rb() * 6.28, d = 12 + rb() * 24; ax.rayP.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, ry: rb() * 3.14, ph: rb() * 6 }); }
      const NG = 140, gp = new Float32Array(NG * 3), gc = new Float32Array(NG * 3); ax.glP = []; for (let i = 0; i < NG; i++) { const a = rb() * 6.28, d = 10 + rb() * 29; gp[i * 3] = Math.cos(a) * d; gp[i * 3 + 1] = 0.12; gp[i * 3 + 2] = Math.sin(a) * d; ax.glP.push(rb() * 6.28); }
      const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gp, 3)); gg.setAttribute('color', new THREE.BufferAttribute(gc, 3).setUsage(THREE.DynamicDrawUsage)); ax.glints = add(new THREE.Points(gg, new THREE.PointsMaterial({ size: 0.9, map: this.fx.tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))); ax.glints.frustumCulled = false; ax.glints.renderOrder = 3;
      // faixas de aurora ("swoosh") no céu
      ax.aur = []; for (let k = 0; k < 3; k++) { const seg = 48, pos = [], colr = [], idx = [], R = 150 + k * 22, cA = [[0.2, 1, 0.9], [0.5, 0.7, 1], [0.6, 1, 0.5]][k]; for (let i = 0; i <= seg; i++) { const a = i / seg * 2.6 - 1.3 + k * 2.1, y = 70 + k * 16 + Math.sin(i * 0.5 + k) * 9, e = Math.sin(i / seg * Math.PI); pos.push(Math.sin(a) * R, y, -Math.cos(a) * R, Math.sin(a) * R, y + 20, -Math.cos(a) * R); colr.push(cA[0] * e, cA[1] * e, cA[2] * e, 0, 0, 0); if (i < seg) { const o = i * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); } }
        const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); ag.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colr), 3)); ag.setIndex(idx); const am = add(new THREE.Mesh(ag, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }))); am.frustumCulled = false; am.renderOrder = -6; ax.aur.push(am); }
      // cachoeiras: plano com textura de listras rolando
      for (const f of E.falls) { const c = document.createElement('canvas'); c.width = 32; c.height = 128; const g2 = c.getContext('2d'); g2.fillStyle = 'rgba(150,225,255,0.55)'; g2.fillRect(0, 0, 32, 128); for (let i = 0; i < 60; i++) { g2.fillStyle = 'rgba(255,255,255,' + (0.25 + Math.random() * 0.6) + ')'; g2.fillRect(Math.random() * 32, Math.random() * 128, 1 + Math.random() * 3, 8 + Math.random() * 30); }
        const tx = new THREE.CanvasTexture(c); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(2, (f.y1 - f.y0) / 8); const hgt = f.y1 - f.y0, m = add(new THREE.Mesh(new THREE.PlaneGeometry(f.wd, hgt), new THREE.MeshBasicMaterial({ map: tx, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false }))); m.position.set(f.x + 0.9, f.y0 + hgt / 2, f.z); m.rotation.y = Math.PI / 2; m.renderOrder = 2; f.tex = tx; f.mesh = m; }
      // lens flare: 4 brilhos na linha sol -> centro da tela
      for (let i = 0; i < 4; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.fx.tex, color: [0xfff2c0, 0x80e8ff, 0xffa0e0, 0xa0ffb0][i], transparent: true, opacity: 0.5, depthTest: false, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); sp.renderOrder = 12; sp.visible = false; add(sp); ax.flare.push(sp); } }
    // inimigos (um InstancedMesh por tipo)
    this.enemies = []; const eg = {}; for (const e of E.enemies) (eg[e.type] = eg[e.type] || []).push(e);
    for (const k in eg) { const def = ENEMIES[k], mesh = inst(modelGeometry(def.model), eg[k].length); eg[k].forEach((e, i) => { e.tc = def.tint || [1, 1, 1]; e.def = e.boss ? Object.assign({}, def, { n: BOSS_NAMES[k], s: def.s * 1.9, hp: def.hp * 6, dmg: Math.round(def.dmg * 1.6), sp: def.sp * 0.9, xp: def.xp * 8, coins: [def.coins[0] * 8, def.coins[1] * 8] }) : def; e.rg = e.boss ? 1.8 : 1; e.mesh = mesh; e.i = i; e.hx = e.x; e.hz = e.z; e.y = w.heightAt(e.x, e.z); e.hp = def.hp; e.state = 'idle'; e.st = 0; e.t = Math.random() * 6; e.ry = Math.random() * 6.28; e.ph = Math.random() * 6; e.tx = e.x; e.tz = e.z; e.flash = 0; e.kx = e.kz = 0; mesh.setColorAt(i, _col.setRGB(e.tc[0], e.tc[1], e.tc[2])); this.enemies.push(e); }); }
    w.buildGrid();
    this.player.teleport(sp[0], w.floorAt(sp[0], 50, sp[1]) + 0.1, sp[1], sp[2]);
    for (let i = 0; i < 12; i++) w.update(sp[0], sp[1], perf);
    this.fishing = null; this.bobber.visible = this.line.visible = false; this.spar = null; this.evBlock = -1; this.evT = 0;
    if (def.after) def.after(this, add);
    if (!def.custom) S.visit(id); S.hp = S.maxHp(); emit('hp'); emit('map', def.moodId || id);
    if (net.online && !keep) { net.join(this.room, def.netKey || id, this.roomPublic); this.pushMeta(); }
    if (def.infect) infect.enter();
  },
  _disposeMap() {
    for (const o of this.objs) { this.scene.remove(o); if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); /* geometrias de modelo (cache) ficam */ if (o.material && o.material !== instMat && o.material !== worldMat) { if (o.material.map && o.material.map !== this.fx.tex) o.material.map.dispose(); o.material.dispose(); } if (o.isInstancedMesh) o.dispose(); }
    this.props.forEach((p) => this.scene.remove(p.mesh)); this.props.clear();
    this.enemies = []; this.drops = []; this.tChests = []; this.coinMesh = this.dropGemMesh = this.tChestMesh = this.beamMesh = null; this._tKey = '';
    this.objs.length = 0; for (const n of this.npcs) n.av.dispose(); this.npcs.length = 0;
    if (this.labels) this.labels.dispose(); if (this.world) this.world.dispose();
    this.world = null; this.portalMesh = this.oreMesh = this.gemMesh = this.chestMesh = this.digMesh = this.starMesh = this.dummyMesh = this.lampMesh = this.glow = null;
  },
  _oreVis(o) { const d = ORES[o.type], on = o.alive; _col.set(d.c); if (d.gem) { setInst(this.oreMesh, o.i, o.x, o.y - 0.1, o.z, on ? o.sc * 0.9 : 0, o.ry); this.oreMesh.setColorAt(o.i, _col2.copy(_col).multiplyScalar(0.35).addScalar(0.4)); setInst(this.gemMesh, o.i, o.x, o.y + 0.25, o.z, on ? [2.3, 2.9, 2.3] : 0, o.ry); this.gemMesh.setColorAt(o.i, _col.set(d.c).multiplyScalar(1.5)); } else { setInst(this.oreMesh, o.i, o.x, o.y - 0.08, o.z, on ? o.sc * 1.5 : 0, o.ry); this.oreMesh.setColorAt(o.i, _col.multiplyScalar(1.6)); setInst(this.gemMesh, o.i, 0, -999, 0, 0, 0); } this.oreMesh.instanceColor.needsUpdate = true; if (this.gemMesh.instanceColor) this.gemMesh.instanceColor.needsUpdate = true; },
  _chestVis(c) { const open = !c.ev && S.chestOpen(this.mapId + ':' + c.key); c.open = open; setInst(this.chestMesh, c.i, c.x, c.hidden ? -999 : c.y, c.z, c.ev ? 2.6 : 1.9, c.ry); this.chestMesh.setColorAt(c.i, c.ev ? _col.setRGB(2, 1.6, 0.4) : open ? _col.setRGB(0.35, 0.35, 0.4) : c.tier >= 2 ? _col.setRGB(1.3, 1.1, 1.6) : _col.setRGB(1.1, 1.1, 1.1)); this.chestMesh.instanceColor.needsUpdate = true; },
  _npcMarks() { for (const n of this.npcs) { let mark = ''; if (n.quests) for (const q of n.quests) { const st = S.questState(q); if (st === 'ready') { mark = '❓ '; break; } if (st === 'open' && !mark) mark = '❗ '; } n.av.setName(mark + n.name, n.role); } },
  _boards() { if (!this.E || !this.E.boards.length) return; const draw = (lb) => { for (const b of this.E.boards) { const g = b.canvas.getContext('2d'); g.fillStyle = '#1c1830'; g.fillRect(0, 0, 512, 512); g.fillStyle = '#ffd76a'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.fillText('🏆 Ranking da Arena', 256, 46); g.font = 'bold 24px sans-serif'; g.textAlign = 'left'; const rows = lb ? lb.wins : []; if (!lb) { g.fillStyle = '#aaa'; g.fillText(net.online ? 'Carregando...' : 'Offline', 40, 110); } else if (!rows.length) { g.fillStyle = '#aaa'; g.fillText('Ninguém venceu ainda. Seja o primeiro!', 30, 110); } rows.forEach((r, i) => { g.fillStyle = i === 0 ? '#ffd76a' : i < 3 ? '#e8e8f0' : '#aab'; g.fillText((i + 1) + '. ' + r.name, 30, 100 + i * 38); g.textAlign = 'right'; g.fillText(r.wins + ' vitórias  Nv ' + r.level, 490, 100 + i * 38); g.textAlign = 'left'; }); b.tex.needsUpdate = true; } }; draw(null); if (net.online) net.leaderboard().then(draw).catch(() => {}); },
  pushMeta() { net.setMeta({ name: /^hark/i.test(S.name) && !admin.is ? 'Gato' : S.name, look: S.look, level: S.d.level, sid: this.sid, pet: S.d.pet, admin: admin.is ? 1 : 0, prof: S.d.prof, party: net.partyCode, fc: net.friendCode, held: S.d.hand, vc: voice.on ? 1 : 0, mic: voice.mic ? 1 : 0 }); },

  // ================= eventos de rede e de jogo =================
  _bindEvents() {
    on('questReady', () => this._npcMarks()); on('inv', () => { if (this.npcs.length) this._npcMarks(); });
    on('peerJoin', (id, meta) => { if (!meta || this.remotes.has(id)) return; meta.name = cleanName(meta.name); const av = new CatAvatar(meta.look, (admin.ids.has(id) ? '👑 ' : '') + (meta.name || 'Gato'), { sub: 'Nv ' + (meta.level || 1) + ' · ' + titleFor(meta.level || 1), tagColor: this._tagColor(id, meta) }); av.root.visible = false; this.scene.add(av.root); const r = { id, av, meta, has: false, x: 0, y: 0, z: 0, yaw: 0, hy: 0, hp: 0, h: [0, 0.6, -0.4, 0, 0.6, -0.4], flags: 1, life: 100, px: 0, pz: 0, hit: [0, 0], patT: 0 }; this.remotes.set(id, r); if (meta.sid) this.sids[meta.sid] = r; this._remoteHeld(r); setTimeout(() => this.props.forEach((p) => { if (p.owner === net.id) net.send('prop', { id: p.id, k: p.k, x: p.x, y: p.y, z: p.z, ry: p.ry }); }), 1500); emit('toast', meta.name + (this.mapId === 'home' && home.mine() ? ' veio te visitar! 🏠' : ' entrou'), '#bfe6ff'); if (home.mine()) setTimeout(() => home.share(), 1200); emit('players'); });
    on('peerMeta', (id, meta) => { const r = this.remotes.get(id); if (!r || !meta) return; meta.name = cleanName(meta.name); if (JSON.stringify(meta.look) !== JSON.stringify(r.meta.look)) r.av.setLook(meta.look); r.meta = meta; this._remoteHeld(r); r.av.tagColor = this._tagColor(id, meta); r.av.setName((admin.ids.has(id) ? '👑 ' : '') + (meta.name || 'Gato'), 'Nv ' + (meta.level || 1) + ' · ' + titleFor(meta.level || 1)); if (meta.sid) this.sids[meta.sid] = r; emit('players'); });
    on('peerLeave', (id) => { voice.close(id); const r = this.remotes.get(id); if (!r) return; if (r.pet && r.pet.av) r.pet.av.dispose(); if (r.heldMesh) this.scene.remove(r.heldMesh); this.props.forEach((p, k) => { if (p.owner === id) this._delProp(k); }); r.av.dispose(); this.remotes.delete(id); for (const k in this.sids) if (this.sids[k] === r) delete this.sids[k]; emit('players'); });
    on('peerState', (p) => { if (!Array.isArray(p) || p.length < 15) return; for (let i = 1; i < 15; i++) if (typeof p[i] !== 'number' || !Number.isFinite(p[i]) || Math.abs(p[i]) > 2000) return; const r = this.sids[p[0]]; if (!r) return; r.x = p[1]; r.y = p[2]; r.z = p[3]; r.yaw = p[4]; r.hy = p[5]; r.hp = p[6]; for (let i = 0; i < 6; i++) r.h[i] = p[7 + i]; const fl = p[13]; const em = (fl >> 4) & 15; r.tool = (fl >> 8) & 7; if (em !== r.av.emote) { r.av.setEmote(em); if (em === 7) playAt('click', r.av.root.position, this.camera, 0), meow(0.5, 1.1); } r.flags = fl; r.life = p[14]; if (!r.has) { r.has = true; r.av.root.position.set(r.x, r.y, r.z); r.av.root.visible = true; } });
    on('peerEvent', (e) => this._peerEvent(e));
    for (const ev of ['peerJoin', 'peerMeta', 'friends', 'party']) on(ev, () => { clearTimeout(this._vcT); this._vcT = setTimeout(() => voice.sync(), 600); });
    on('talking', (id, on) => { const r = this.remotes.get(id); if (!r) return; if (on) r.av.say('🔊', 60); else if (r.av.bubble === '🔊') r.av.say('', 0.01); });
    on('fling', () => S.stat('fling')); on('fellOut', () => { const sp = this.def.spawn; this.player.teleport(sp[0], this.world.floorAt(sp[0], 50, sp[1]) + 0.2, sp[1], sp[2]); });
    on('land', (v) => { const p = this.player.pos, sc = { snow: 0xffffff, sand: 0xe8d098, stone: 0xb8b8c0 }[this.world.surface] || 0xc8b890; if (!this.player.inWater) { this.fx.ring(p.x, this.world.floorAt(p.x, p.y + 0.3, p.z) + 0.04, p.z, sc, Math.min(2.4, 0.6 + v * 0.12), true, null, 0.5); this.fx.burst(p.x, p.y + 0.1, p.z, sc, Math.min(14, 4 + v | 0), 2, 4); } play('thud', Math.min(1, v / 14)); }); on('handTouch', (i, h) => { const sp = h.speed; if (sp > 1.2) { play(this.world.surface === 'snow' ? 'step_snow' : this.world.surface === 'stone' ? 'step_stone' : 'step_grass', Math.min(0.8, sp / 7)); this.player.pulse(Math.min(1, sp / 6), 20); } });
    on('splash', (v) => { splashSfx(Math.min(1, 0.5 + (v || 0) * 0.08)); const p = this.player.pos, wy = this.world.waterY; this.fx.burst(p.x, wy + 0.1, p.z, 0xd8f8ff, 26, 4.5); this.fx.ring(p.x, wy + 0.05, p.z, 0xd8f8ff, 2.6, true, null, 0.9); this.fx.ring(p.x, wy + 0.05, p.z, 0xffffff, 1.4, true, null, 0.6); });
    on('dodge', () => play('dodge', 0.4)); on('grab', () => play('cloth', 0.35));
    on('party', () => { this.remotes.forEach((r) => { r.av.tagColor = this._tagColor(r.id, r.meta); r.av.drawTag(); }); });
    on('inbox', (m) => this._inbox(m));
    on('admins', () => this.remotes.forEach((r) => { r.av.tagColor = this._tagColor(r.id, r.meta); r.av.setName((admin.ids.has(r.id) ? '👑 ' : '') + (r.meta.name || 'Gato'), r.av.sub); }));
    on('chatlog', (w, t) => this._log(w, t));
    on('adminHeal', () => { S.hp = S.maxHp(); emit('hp'); const p = this.player.pos; this.fx.burst(p.x, p.y + 1, p.z, 0x80ff90, 24, 2.5, -1); play('heart', 0.7); });
    on('confetti', () => this._confetti(40));
    on('adminSpawn', (d) => { if (!this.world || !ENEMIES[d.type]) return; const n = clamp(d.n | 0, 1, 8); for (let i = 0; i < n; i++) { const a = i / n * 6.28 + Math.random(), r = d.boss ? 4 : 2.5 + Math.random() * 2; this.spawnEnemy(d.type, d.x + Math.cos(a) * r, d.z + Math.sin(a) * r, !!d.boss); } this.fx.burst(d.x, this.world.heightAt(d.x, d.z) + 1, d.z, 0xb070ff, 30, 4); play('portal', 0.6); });
    on('adminDrop', (d) => { if (!this.world) return; const n = clamp(d.n | 0, 1, 30); for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, r = Math.random() * 3.2; this.spawnDrop(d.x + Math.cos(a) * r, d.y + 7 + Math.random() * 4, d.z + Math.sin(a) * r, d.item, d.coins); } });
    on('adminKick', (who) => { emit('banner', '🚪 ' + who + ' te mandou para a Vila', 5); if (this.mapId !== 'village') this.travel('village'); });
    on('adminTp', (d) => { if (d.map === (this.def.netKey || this.mapId)) { this.player.teleport(d.x, d.y + 0.2, d.z); this.fx.burst(d.x, d.y + 1, d.z, 0x60e8ff, 20, 3); play('portal', 0.6); } else if (MAPS[d.map]) this.travel(d.map); });
    on('adminEvent', (ev, late) => { this.admT = 0; if (ev && !late) { const n = { party: '🎉 FESTA!', invasion: '👾 INVASÃO!', goldrain: '💰 CHUVA DE OURO!', treasure: '🗝 CAÇA AO TESOURO!', xp2: '⭐ XP EM DOBRO!', night: '🌙 NOITE ETERNA', day: '☀ DIA ETERNO' }[ev.ev] || ev.ev; emit('banner', n + '  —  ' + ev.author, 6); play('event', 0.9); if (ev.ev !== 'night' && ev.ev !== 'day') this._confetti(30); } if (!ev) { this._tKey = ''; for (const c of this.tChests) c.gone = true; } });
    on('meta', () => { if (net.online) this.pushMeta(); }); on('levelup', () => { if (net.online) this.pushMeta(); const p = this.player.pos; this.fx.burst(p.x, p.y + 1, p.z, 0xffd76a, 40, 4, 3); });
  },
  muted(id) { return !!(S.d && S.d.muted && S.d.muted.indexOf(id) >= 0); },
  _tagColor(id, meta) { if (admin.ids.has(id)) return '#ffd040'; if (meta && meta.party && meta.party === net.partyCode && net.partyCode) return '#8fd0ff'; if (this.friends.some((f) => f.id === id && f.status === 'accepted')) return '#9cf09c'; return '#ffffff'; },
  _peerEvent(e) {
    const r = this.remotes.get(e.f), P = this.player;
    if (e.t === 'home') { home.remote(e); return; }
    if (e.t === 'vc') { voice.signal(e); return; }
    if (e.t === 'nk') { infect.onNet(e); return; }
    if (e.t === 'chat') { if (r && !this.muted(e.f)) { const tx = String(e.x == null ? '' : e.x).slice(0, 80); r.av.say(tx, 6); this._log(r.meta.name, tx); play('msg', 0.4); } }
    else if (e.t === 'tree') { const tr = this.E.trees[e.i | 0]; if (tr && tr.alive) this._fell(tr, Math.min(Number(e.u) || 0, net.now() + 180000), 0, 1); }
    else if (e.t === 'ore') { const o = this.E.ores[e.i | 0]; if (o && o.alive && !o.ev) { o.alive = false; o.respawn = Math.min(Number(e.u) || 0, net.now() + 180000); this._oreVis(o); } }
    else if (e.t === 'hit' && e.to === net.id && Number.isFinite(e.x) && Number.isFinite(e.z) && Number.isFinite(e.d)) {
      if (!P.fightZone || S.hp <= 0) return;
      const now = this.time; let d = clamp(e.d, 1, 60), blocked = false, dodged = P.iframes > 0;
      if (!dodged) {
        if (P.block && r) { const a = Math.atan2(-(r.av.root.position.x - P.pos.x), -(r.av.root.position.z - P.pos.z)); if (Math.abs(angDiff(P.headYaw, a)) < 1.2) { blocked = true; d = Math.ceil(d * (S.held().block || 0.2)); P.stamina = Math.max(0, P.stamina - 12); S.stat('blocked'); } }
        S.hp = Math.max(0, S.hp - d); this.lastHurt = now; P.vel.x += e.x * (blocked ? 1.5 : 4); P.vel.z += e.z * (blocked ? 1.5 : 4); if (!blocked) P.vel.y += 1.5;
        play(blocked ? 'block' : 'punch_heavy', 0.9); P.pulse(1, 60); emit('hp'); emit('hurt', blocked);
      }
      const ko = S.hp <= 0 && !dodged; net.send('hr', { a: e.f, d: dodged ? 0 : d, b: blocked ? 1 : 0, dg: dodged ? 1 : 0, ko: ko ? 1 : 0 });
      if (ko) this._knockedOut(r ? r.meta.name : 'alguém');
    }
    else if (e.t === 'hr') { // resultado de um golpe (visto por todos)
      const victim = r; if (!victim) return; const vp = victim.av.root.position;
      if (e.dg) this.fx.text(vp.x, vp.y + 1.5, vp.z, 'Esquivou!', '#bfe6ff'); else { victim.av.flash = 0.3; this.fx.burst(vp.x, vp.y + 0.8, vp.z, e.b ? 0x9fd0ff : 0xffb040, e.b ? 6 : 12, 3); }
      if (e.a === net.id) {
        if (e.dg) { this.combo = 0; return; }
        this.fx.text(vp.x, vp.y + 1.6, vp.z, e.b ? 'Bloqueado ' + e.d : '-' + e.d, e.b ? '#9fd0ff' : '#ffd040'); S.stat('hit'); this._combo();
        if (e.ko) { const ev = currentEvent(net.now()), dbl = ev.active && ev.ev.id === 'doublexp' && ev.map === this.mapId; S.toast('🥊 Você nocauteou ' + victim.meta.name + '!', '#ffd76a'); play('win', 0.7); S.stat('ko'); S.addXp(dbl ? 160 : 80); S.addCoins(40); if (dbl) S.stat('event'); emit('saveNow'); }
      } else playAt(e.b ? 'block' : 'punch', vp, this.camera, 0.7);
    }
    else if (e.t === 'pat' && e.to === net.id) { purr(0.8); this.fx.burst(P.pos.x, P.pos.y + 1.3, P.pos.z, 0xff6090, 6, 1.2, -1); if (r) S.toast(r.meta.name + ' fez carinho em você ❤', '#ff9ab8'); }
    else if (e.t === 'prop') { if (e.x > -500 && e.x < 500 && this.props.size < 60) this._addProp(e.f + ':' + e.id, e.f, e.k, e.x, e.y, e.z, e.ry); }
    else if (e.t === 'propdel') this._delProp(e.f + ':' + e.id);
    else if (e.t === 'fx') { if ([e.x, e.y, e.z, e.c].every(Number.isFinite)) this.fx.burst(e.x, e.y, e.z, e.c, clamp(e.n | 0, 1, 20), 3); }
  },
  _inbox(m) {
    if (m.k === 'friend') { S.toast('👋 ' + m.name + ' quer ser seu amigo (menu Social)', '#9cf09c'); play('msg', 0.6); emit('friendsDirty'); }
    else if (m.k === 'faccept') { S.toast('✔ ' + m.name + ' aceitou sua amizade', '#9cf09c'); emit('friendsDirty'); }
    else if (m.k === 'party') { this.invite = m; S.toast('👥 ' + m.name + ' convidou você para o grupo (menu Social)', '#8fd0ff'); play('msg', 0.6); emit('party'); }
    else if (m.k === 'dm' && !this.muted(m.from)) { m.x = String(m.x || '').slice(0, 80); m.name = cleanName(m.name); this._log('[privado] ' + m.name, m.x); S.toast('✉ ' + m.name + ': ' + m.x, '#ffe9a8'); play('msg', 0.6); }
  },
  _log(who, text) { this.chatLog.push({ who, text }); if (this.chatLog.length > 30) this.chatLog.shift(); emit('chat'); },
  say(text) { text = String(text).slice(0, 80); if (!text) return; this._log(S.name, text); net.send('chat', { x: text }); emit('selfSay', text); },
  emote(id) { const P = this.player; this.myEmote = id; this.emoteT = id === 3 || id === 4 ? 9999 : 3; if (id === 1) P.emoteWave = 2.5; P.emoteId = [2, 5, 6, 8, 10, 11, 12].indexOf(id) >= 0 ? id : 0; P.emoteTime = 0; if (id === 7) meow(1); if (id === 6) this.fx.burst(P.pos.x, P.pos.y + 1.4, P.pos.z, 0xff5080, 8, 1.2, -1); const e = EMOTES.find((x) => x.id === id); if (e) emit('selfSay', e.icon); S.stat('emote'); P.frozen = id === 3 || id === 4; },
  async refreshFriends() { if (!net.online) return; try { this.friends = await net.rpc('rv_friends'); S.setStat('friends', this.friends.filter((f) => f.status === 'accepted').length); this.remotes.forEach((r) => { r.av.tagColor = this._tagColor(r.id, r.meta); r.av.drawTag(); }); emit('friends'); } catch (e) { /* offline */ } },
  _combo() { this.combo = this.comboT > 0 ? this.combo + 1 : 1; this.comboT = 1.6; if (this.combo === 5) { S.stat('combo'); S.toast('🔥 COMBO x5!', '#ff9a40'); play('power', 0.5); } emit('combo', this.combo); },
  _knockedOut(by) { S.toast('💫 Você foi nocauteado por ' + by, '#ff8a8a'); play('ko', 0.7); this.player.frozen = true; this.koT = 2.2; this.fade = 0.001; this.pending = '__respawn'; },

  // ================= interação por gatilho =================
  aim() { // alvo sob o "laser" do controle
    const P = this.player, O = P.aimPos, D = P.aimDir; let best = null, bt = 7;
    const test = (x, y, z, r, obj, max) => { _v.set(x - O.x, y - O.y, z - O.z); const t = _v.dot(D); if (t < 0 || t > (max || 7) || t > bt) return; if (_v.lengthSq() - t * t < r * r) { bt = t; best = obj; } };
    for (const n of this.npcs) test(n.av.root.position.x, n.y + 0.7, n.av.root.position.z, 0.6, { npc: n });
    for (const c of this.E.chests) if (!c.hidden && !c.open) test(c.x, c.y + 0.4, c.z, 0.6, { chest: c }, 4);
    this.aimT = bt; return best;
  },
  onTrigger() {
    if (!this.world || this.pending) return true;
    if (this.uiClick && this.uiClick()) return true;
    if (maker.editing && this.mapId === 'custom') { maker.act(); return true; }
    if (home.editing && home.mine()) { home.act(); return true; }
    if (this.fishing) { this._reel(true); return true; }
    if (this.myEmote === 3 || this.myEmote === 4) { this.myEmote = 0; this.emoteT = 0; this.player.frozen = false; this.player.emoteId = 0; return true; }
    const a = this.aim();
    if (a && a.npc) { this.talk(a.npc); return true; }
    if (a && a.chest) { this.openChest(a.chest); return true; }
    if (home.interact(this)) return true;
    const P = this.player, O = P.aimPos, D = P.aimDir, w = this.world;
    if (D.y < -0.08 && this.E.fishes.length && !P.hands[0].touch) { const t = (w.waterY - O.y) / D.y; if (t > 1.5 && t < 24) { const x = O.x + D.x * t, z = O.z + D.z * t; if (w.heightAt(x, z) < w.waterY - 0.15) for (const f of this.E.fishes) if (Math.hypot(x - f.x, z - f.z) < f.r) { this._cast(x, z); return true; } } }
    return false;
  },
  talk(n) { play('book', 0.6); S.stat('talk'); n.av.say(n.lines[Math.floor(Math.random() * n.lines.length)].slice(0, 22) + '…', 2); emit('dialog', n); },
  openChest(c) {
    if (c.open || c.hidden) return; const key = this.mapId + ':' + c.key;
    if (c.ev) { if (S.chestOpen('ev' + this.evBlock)) return; S.markChest('ev' + this.evBlock); c.hidden = true; S.stat('event'); }
    else S.markChest(key);
    const mult = (c.tier + 1) * (S.profBonus('explorer') ? 1.5 : 1) * (1 + S.perk('luck') * 0.1), coins = Math.round((12 + Math.random() * 22) * mult);
    S.addCoins(coins); S.toast('Baú: +' + coins + ' moedas', '#ffd76a'); S.addXp(10 + c.tier * 10); S.stat('chest');
    const r = Math.random(); if (c.tier >= 3) { S.addItem('star', 2); S.addItem('relic', 1); } else if (c.tier === 2) S.addItem(r < 0.4 ? 'relic' : r < 0.7 ? 'emerald' : 'amethyst', 1); else if (c.tier === 1) { if (r < 0.7) S.addItem(r < 0.3 ? 'silver' : r < 0.5 ? 'quartz' : 'oldcoin', 1); } else if (r < 0.5) S.addItem(r < 0.25 ? 'snack' : 'copper', 1);
    play('chest', 0.8); play('coin', 0.6); this.fx.burst(c.x, c.y + 0.6, c.z, 0xffd040, 24, 3.5); net.send('fx', { x: c.x, y: c.y + 0.6, z: c.z, c: 0xffd040, n: 14 }); this._chestVis(c); this.player.pulse(0.8, 60);
  },
  // ---------- pesca ----------
  _cast(x, z) { const rod = RODS[S.d.equip.rod].p, ev = currentEvent(net.now()), shoal = ev.active && ev.ev.id === 'shoal' && ev.map === this.mapId; this.fishing = { x, z, phase: 'wait', t: 0, shoal, biteAt: (2.5 + Math.random() * 5) * (S.profBonus('fisher') ? 0.6 : 1) * (shoal ? 0.6 : 1) * (1 - rod * 0.5) }; this.bobber.position.set(x, this.world.waterY + 0.04, z); this.bobber.visible = this.line.visible = true; play('splash', 0.7); S.toast('Linha lançada... puxe quando a boia afundar!', '#bfe6ff'); },
  _reel(byTrigger) {
    const f = this.fishing; if (!f) return;
    if (f.phase === 'bite') {
      const luck = RODS[S.d.equip.rod].p + (S.profBonus('fisher') ? 0.15 : 0) + (f.shoal ? 0.35 : 0) + S.perk('luck') * 0.05, id = pickTable(FISH_TABLE, luck);
      S.addItem(id, 1); S.addXp(8 + ITEMS[id].r * 14); S.stat('fish'); if (f.shoal) S.stat('event'); play('pickup', 0.9); play('splash', 0.5); this.fx.burst(f.x, this.world.waterY + 0.2, f.z, 0x9fe0ff, 16, 3); this.player.pulse(1, 80);
    } else if (byTrigger) S.toast('Linha recolhida', '#aaa');
    this.fishing = null; this.bobber.visible = this.line.visible = false;
  },

  // ================= atualização por quadro =================
  update(dt) {
    const P = this.player, w = this.world; if (!w) return; this.time += dt; const now = net.now();
    // fade / troca de mapa
    if (this.fade > 0) {
      this.fadeMesh.visible = true;
      if (this.pending) { this.fade = Math.min(1, this.fade + dt * 3); if (this.fade >= 1) { if (this.pending === '__respawn') { if ((this.koT -= dt) <= 0) { const sp = this.def.spawn; P.teleport(sp[0], w.floorAt(sp[0], 50, sp[1]) + 0.1, sp[1], sp[2]); S.hp = S.maxHp(); P.frozen = false; this.pending = null; emit('hp'); } } else { const id = this.pending; this.pending = null; this.loadMap(id); } } }
      else { this.fade -= dt * 2; if (this.fade <= 0) { this.fade = 0; this.fadeMesh.visible = false; } }
      this.fadeMesh.material.opacity = clamp(this.fade, 0, 1);
      if (!this.world) return;
    }
    // zona de luta
    let fz = false; for (const z of this.E.zones) if (Math.hypot(P.pos.x - z.x, P.pos.z - z.z) < z.r) fz = true; if (fz !== P.fightZone) { P.fightZone = fz; S.toast(fz ? '⚔ Você entrou na zona de luta!' : 'Você saiu da zona de luta', fz ? '#ffb0a0' : '#bfe6ff'); emit('hp'); }
    P.update(dt, this.world);
    const W = this.world; W.update(P.pos.x, P.pos.z, perf);
    // vida / emote / combo
    if (S.hp > 0 && S.hp < S.maxHp() && (this.time - this.lastHurt > (fz ? 5 : 3.5))) { S.hp = Math.min(S.maxHp(), S.hp + (fz ? 3 : 12) * (S.held().regen || 1) * (1 + S.perk('regen') * 0.3) * dt); this._hpT = (this._hpT || 0) + dt; if (this._hpT > 0.5) { this._hpT = 0; emit('hp'); } }
    if (this.emoteT > 0 && (this.emoteT -= dt) <= 0) { this.myEmote = 0; P.frozen = false; P.emoteId = 0; }
    if (this.comboT > 0 && (this.comboT -= dt) <= 0) { this.combo = 0; emit('combo', 0); }
    this._held(dt); maker.update(this); home.update(this); voice.update(dt, this.camera); infect.update(dt); if (this.def && this.def.tick) this.def.tick(dt, this); this._adminFx(dt); this._pets(dt);
    const tp = P.tp; this.tpBall.visible = this.tpArc.visible = tp.show; if (tp.show) { this.tpBall.position.set(tp.x, tp.y + 0.22 + Math.sin(this.time * 6) * 0.04, tp.z); this.tpBall.material.color.setHex(tp.valid ? 0x60e8ff : 0xff5050); this.tpArc.material.color.setHex(tp.valid ? 0x60e8ff : 0xff5050); this.tpArc.geometry.setDrawRange(0, tp.n); this.tpArc.geometry.attributes.position.needsUpdate = true; }
    // passos
    if (P.grounded && P.speed > 1 && !P.wasTouching) { this.stepT -= dt * P.speed; if (this.stepT <= 0) { this.stepT = 2.2; if (P.speed > 3 && !P.inWater && perf.particles >= 0.5) this.fx.burst(P.pos.x, P.pos.y + 0.05, P.pos.z, { snow: 0xffffff, sand: 0xe8d098 }[W.surface] || 0xbcae90, 2, 0.8, 3); play(P.inWater ? 'splash' : this.E.aero && P.pos.y > 1.9 && Math.hypot(P.pos.x, P.pos.z) < 44 ? 'glass' : W.surface === 'snow' ? 'step_snow' : W.surface === 'stone' ? 'step_stone' : 'step_grass', 0.22); } }
    this._interact(dt, now); this._npcs(dt); this._enemies(dt); this._self(dt); this._remotes(dt); this._fishing(dt); this._events(dt, now);
    // mãos + sombras em lote
    const hp = this.hands; hp.begin(); const fur = this.infFur || S.look.fur;
    for (let i = 0; i < 2; i++) { const h = P.hands[i]; hp.hand(h.pos.x, h.pos.y, h.pos.z, HAND_R, P.block ? '#ffd0a0' : this.pawColor || fur); }
    if (perf.shadows) hp.blob(P.pos.x, W.floorAt(P.pos.x, P.pos.y + 0.3, P.pos.z), P.pos.z, 0.34);
    this.remotes.forEach((r) => { if (!r.has || !r.av.root.visible) return; const p = r.av.root.position; if (r.near) { hp.hand(p.x + r.h[0], p.y + r.h[1], p.z + r.h[2], HAND_R, r.av.look.fur); hp.hand(p.x + r.h[3], p.y + r.h[4], p.z + r.h[5], HAND_R, r.av.look.fur); } if (perf.shadows && r.near) hp.blob(p.x, W.floorAt(p.x, p.y + 0.3, p.z), p.z, 0.34); });
    for (const n of this.npcs) { if (!n.near) continue; const p = n.av.root.position, av = n.av; av.procHands(_v, _v2);
      if (n.spar && n.state !== 'idle' && n.state !== 'ko') { const c = Math.cos(av.root.rotation.y), sn = Math.sin(av.root.rotation.y), up = n.state === 'windup' ? 1.15 : n.state === 'strike' ? 0.85 : 0.8, fwd = n.state === 'windup' ? -0.1 : n.state === 'strike' ? 0.75 : 0.3; _v.set(p.x + c * 0.3 - sn * fwd, p.y + up, p.z - sn * 0.3 - c * fwd); _v2.set(p.x - c * 0.3 - sn * fwd, p.y + up, p.z + sn * 0.3 - c * fwd); }
      hp.hand(_v.x, _v.y, _v.z, HAND_R, av.look.fur); hp.hand(_v2.x, _v2.y, _v2.z, HAND_R, av.look.fur); if (perf.shadows) hp.blob(p.x, n.y, p.z, 0.34); }
    if (perf.shadows) for (const e of this.enemies) if (e.state !== 'dead' && e.near) hp.blob(e.x, e.y, e.z, 0.4);
    infect.hands(hp);
    hp.end(perf.shadows > 0);
    // lanternas e céu
    this.camera.getWorldPosition(_v); const under = W.swim && _v.y < W.waterY - 0.05; this.under = under;
    const skyNow = admin.eventOn('night') ? DAY_LENGTH * 750 : admin.eventOn('day') ? DAY_LENGTH * 250 : this.mapId === 'dark' ? DAY_LENGTH * 985 : now; // Reino Sombrio: crepúsculo eterno
    this.sky.update(skyNow, this.def, P.pos, perf, under); this._adminTick(dt, now);
    if (this.mapId === 'pool') { this.sky.hemi.groundColor.setHex(0xcfeef2); this.sky.hemi.color.setHex(0xffffff); this.sky.sun.color.setHex(0xf4fbff); } // luz fluorescente fria
    if (this.mapId === 'dark') { // relâmpagos com trovão
      this.boltT = (this.boltT == null ? 6 : this.boltT) - dt;
      if (this.boltT <= 0) { this.boltT = 9 + Math.random() * 16; this.bolt = 0.45; setTimeout(() => thunder(0.8), 300 + Math.random() * 900); }
      if (this.bolt > 0) { this.bolt -= dt; const k = this.bolt > 0.3 || (this.bolt > 0.12 && this.bolt < 0.2) ? 1 : 0.25; this.sky.hemi.intensity += k * 4; this.scene.background.lerp(_col.setHex(0xd8d0ff), k * 0.7); this.scene.fog.color.copy(this.scene.background); }
    }
    matU.uTime.value = this.time; if (under !== this._wasUnder) { this._wasUnder = under; setUnder(under); }
    this._aero(dt);
    if (this.lampMesh) { const n = this.E.aero ? Math.max(0.5, this.sky.night) : this.sky.night; this.lampMesh.material.color.setScalar(0.5 + n * 0.5); this.glow.visible = n > 0.12 && perf.particles >= 0.5; this.glow.material.opacity = n * 0.85; }
    if (this.portalMesh) this.portalMesh.material.opacity = 0.6 + Math.sin(this.time * 3) * 0.15;
    if (this.starMesh) for (const s of this.E.secrets) if (!s.found) setInst(this.starMesh, s.i, s.x, s.y + 0.5 + Math.sin(this.time * 2) * 0.15, s.z, 1.6, this.time * 1.5);
    if (W.waterU) W.waterU.uTime.value = this.time;
    this.fx.ambient(this.under ? 'bubble' : this.def.custom ? this.def.ambId : AMBIENT[this.mapId] || '', P.pos, this.time, this.sky.night);
    this.fx.update(dt);
    // laser de mira
    const a = this.uiOpen ? null : this.aim(); const show = this.uiOpen || !!a; this.laser.visible = show && !P.hands[0].touch && !P.desktop;
    if (this.laser.visible) { const arr = this.laser.geometry.attributes.position.array, O = P.viewMode === 1 && !P.sixAny ? P.hands[0].target : P.aimPos, D = P.aimDir, len = this.uiOpen ? (this.uiDist || 2) : this.aimT; arr[0] = O.x; arr[1] = O.y; arr[2] = O.z; arr[3] = O.x + D.x * len; arr[4] = O.y + D.y * len; arr[5] = O.z + D.z * len; this.laser.geometry.attributes.position.needsUpdate = true; }
    // rede: envia estado
    this.netT -= dt; if (this.netT <= 0 && net.status === 'online') { const hz = this.remotes.size > 6 ? Math.min(perf.netHz, 6) : perf.netHz; this.netT = 1 / hz; const h = P.hands, x = P.pos.x, y = P.pos.y, z = P.pos.z, f2 = (v) => Math.round(v * 100) / 100; const flags = (P.grounded ? 1 : 0) | (P.block ? 2 : 0) | (fz ? 4 : 0) | (P.iframes > 0 ? 8 : 0) | ((this.myEmote || 0) << 4) | (this.tool << 8); net.sendState([this.sid, f2(x), f2(y), f2(z), f2(P.bodyYaw), f2(angDiff(P.bodyYaw, P.headYaw)), f2(P.headPitch), f2(h[0].pos.x - x), f2(h[0].pos.y - y), f2(h[0].pos.z - z), f2(h[1].pos.x - x), f2(h[1].pos.y - y), f2(h[1].pos.z - z), flags, Math.round(S.hp)]); }
  },

  // ---------- item na pata (visual + bônus) ----------
  _held(dt) {
    const P = this.player, h = S.held(); P.speedMul = (h.speed || 1) * (1 + S.perk('speed') * 0.04); P.jumpMul = 1 + S.perk('jump') * 0.06;
    // ferramenta de contexto: sem item escolhido, a picareta aparece perto de minério, a pá perto de um X e a vara ao pescar
    let tool = 0;
    if (this.fishing) tool = 3; else if (h.id === 'none' || h.id === 'pick' || h.id === 'axe') { const px = P.pos.x, pz = P.pos.z; for (const o of this.E.ores) if (o.alive && Math.abs(o.x - px) < 3.5 && Math.abs(o.z - pz) < 3.5) { tool = 1; break; } if (!tool) for (const d of this.E.digs) if (d.alive && Math.abs(d.x - px) < 3.5 && Math.abs(d.z - pz) < 3.5) { tool = 2; break; } if (!tool) for (const tr of this.E.trees) if (tr.alive && Math.abs(tr.x - px) < 3.5 && Math.abs(tr.z - pz) < 3.5) { tool = 4; break; } }
    this.tool = tool;
    const vis = this._toolVis(this.heldMesh, tool === 3 || h.id === 'none' ? null : h, tool, S.d.equip.pick);
    this.heldMesh.visible = vis && !P.block && !P.emoteId;
    if (this.heldMesh.visible) { this.heldMesh.position.copy(P.hands[0].pos); const sw = Math.min(0.5, P.hands[0].speed * 0.06); _q.setFromUnitVectors(UP, _v.copy(P.ctrlDir).multiplyScalar(0.8 + sw).add(_v2.set(0, 0.62, 0)).normalize()); this.heldMesh.quaternion.copy(_q); }
    this.remotes.forEach((r) => { if (!r.heldMesh) { r.heldMesh = new THREE.Mesh(modelGeometry('survival/tool-pickaxe'), instMat); r.heldMesh.frustumCulled = false; r.heldMesh.visible = false; this.scene.add(r.heldMesh); } const hd = HELD.find((x) => x.id === (r.meta && r.meta.held)); const v = r.has && r.near && r.av.root.visible && this._toolVis(r.heldMesh, r.tool === 3 || !hd || hd.id === 'none' ? null : hd, r.tool || 0, 0); r.heldMesh.visible = !!v; if (v) { const p = r.av.root.position; r.heldMesh.position.set(p.x + r.h[0], p.y + r.h[1], p.z + r.h[2]); r.heldMesh.rotation.set(-0.7, r.av.root.rotation.y, 0, 'YXZ'); } });
    // trampolins e fogueiras colocados por jogadores
    this.fireT -= dt; const fire = this.fireT <= 0; if (fire) this.fireT = 0.25;
    this.props.forEach((p) => { const d = p.def; if (d.spring && Math.abs(P.pos.x - p.x) < 0.9 && Math.abs(P.pos.z - p.z) < 0.9 && P.pos.y - p.y < 1.1 && P.pos.y - p.y > -0.3 && P.vel.y <= 0.5) { P.vel.y = d.spring; P.grounded = false; play('power', 0.5, 0, 1.4); this.fx.burst(p.x, p.y + 0.8, p.z, 0x80ffb0, 10, 2); } if (d.fire && fire && Math.abs(P.pos.x - p.x) < 25 && Math.abs(P.pos.z - p.z) < 25) this.fx.burst(p.x, p.y + 0.3, p.z, 0xff8a30, 2, 0.8, -2.5); });
  },
  _remoteHeld(r) { /* o item do jogador remoto é atualizado a cada quadro em _held */ },
  // escolhe o modelo mostrado na pata: item equipado ou ferramenta de contexto (1 picareta, 2 pá, 3 vara)
  _toolVis(mesh, held, tool, tier) {
    let key = null, sc = 1;
    if (tool === 3) { key = 'prim/cyl'; sc = [0.035, 1.5, 0.035]; } else if (tool === 2) { key = 'survival/tool-shovel'; sc = 2.4; } else if (tool === 4) { key = 'survival/tool-axe'; sc = 2.6; } else if (tool === 1 || (held && held.id === 'pick')) { key = tier >= 2 ? 'survival/tool-pickaxe-upgraded' : 'survival/tool-pickaxe'; sc = 2.8; } else if (held && held.model) { key = held.model; sc = held.s; }
    if (!key) return false; if (mesh.userData.key !== key) { mesh.userData.key = key; mesh.geometry = modelGeometry(key); if (typeof sc === 'number') mesh.scale.setScalar(sc); else mesh.scale.set(sc[0], sc[1], sc[2]); }
    return true;
  },
  // ---------- seu próprio gato (visível em 2ª e 3ª pessoa) ----------
  _self(dt) {
    const P = this.player; if (!this.selfCat) { this.selfCat = new CatAvatar(S.look, S.name, { noTag: true }); this.scene.add(this.selfCat.root); on('look', () => this.selfCat.setLook(S.look)); }
    P.eye = EYE * AGE_EYE[clamp(S.look.age | 0, 0, 2)]; // filhotes e adolescentes enxergam mais baixo
    const av = this.selfCat; av.root.visible = P.viewMode !== 1; if (!av.root.visible) return;
    av.root.position.copy(P.pos); av.root.rotation.y = P.bodyYaw; av.speed = av.speed * 0.8 + P.speed * 0.2; av.grounded = P.grounded || P.wasTouching; av.blocking = P.block; av.headYaw = angDiff(P.bodyYaw, P.headYaw); av.headPitch = 0;
    if (av.emote !== (this.myEmote || 0)) { av.emote = this.myEmote || 0; av.emoteT = 0; } av.update(dt, false);
  },
  // ---------- inimigos: perseguem, avisam o golpe (incham e ficam vermelhos) e atacam; dá para bloquear e esquivar ----------
  _enemies(dt) {
    const P = this.player, w = this.world, t = this.time, px = P.pos.x, pz = P.pos.z;
    for (const e of this.enemies) {
      const def = e.def; let dx = px - e.x, dz = pz - e.z; const d = Math.hypot(dx, dz) || 0.001; e.near = d < perf.drawDist;
      if (e.state === 'dead') { if (t > e.respawn) { e.state = 'idle'; e.hp = def.hp; e.x = e.hx; e.z = e.hz; e.y = w.heightAt(e.x, e.z); } else continue; }
      if (d > 60) { if (!e.far) { e.far = true; setInst(e.mesh, e.i, e.x, e.y, e.z, def.s, e.ry); } continue; } e.far = false;
      e.st -= dt; e.t -= dt; let mv = 0, mx = 0, mz = 0, lean = 0, sc = 1;
      const dy = Math.abs(P.pos.y - e.y), alive = S.hp > 0 && !this.pending;
      if (e.state === 'idle') { if (d < 10 && dy < 3.5 && alive) { e.state = 'chase'; e.st = 0.4; this.fx.text(e.x, e.y + 2.2 * e.rg, e.z, (e.boss ? '👑 ' : '') + def.n + '!', e.boss ? '#ffb52e' : '#ff9a8a'); playAt('thud', _v.set(e.x, e.y, e.z), this.camera, 0.6); }
        else { if (e.t <= 0) { e.t = 2.5 + Math.random() * 4; const a = Math.random() * 6.28, r = Math.random() * 5; e.tx = e.hx + Math.cos(a) * r; e.tz = e.hz + Math.sin(a) * r; } const ex = e.tx - e.x, ez = e.tz - e.z, ed = Math.hypot(ex, ez); if (ed > 0.3) { mv = 0.8; mx = ex / ed; mz = ez / ed; } } }
      else if (e.state === 'chase') { if (!alive || Math.hypot(e.x - e.hx, e.z - e.hz) > 26 || d > 22) e.state = 'home'; else if (d > 1.3 * e.rg) { mv = def.sp; mx = dx / d; mz = dz / d; lean = 0.18; } else if (e.st <= 0 && dy < 1.6) { e.state = 'windup'; e.st = 0.55; } else { mx = dx / d; mz = dz / d; } }
      else if (e.state === 'windup') { mx = dx / d; mz = dz / d; lean = -0.35; sc = 1.18; e.flash = 0.2; if (e.st <= 0) { e.state = 'strike'; e.st = 0.22;
          if (d < 1.9 * e.rg && dy < 1.7 * e.rg && alive) { if (P.iframes > 0) this.fx.text(px, P.pos.y + 1.5, pz, 'Esquivou!', '#bfe6ff'); else { let dmg = def.dmg; const a = Math.atan2(-(e.x - px), -(e.z - pz)), blocked = P.block && Math.abs(angDiff(P.headYaw, a)) < 1.2; if (blocked) { dmg = Math.ceil(dmg * (S.held().block || 0.2)); S.stat('blocked'); P.stamina = Math.max(0, P.stamina - 10); } S.hp = Math.max(0, S.hp - dmg); this.lastHurt = t; P.vel.x += dx / d * (blocked ? 1.5 : 4.5); P.vel.z += dz / d * (blocked ? 1.5 : 4.5); if (!blocked) P.vel.y += 1.4; play(blocked ? 'block' : 'punch_heavy', 0.9); P.pulse(1, 70); emit('hp'); emit('hurt', blocked); if (this.selfCat) this.selfCat.flash = 0.3; if (S.hp <= 0) this._knockedOut(def.n); } } } }
      else if (e.state === 'strike') { mx = dx / d; mz = dz / d; lean = 0.55; if (e.st <= 0) { e.state = 'chase'; e.st = 0.7 + Math.random() * 0.5; } }
      else if (e.state === 'hurt') { lean = -0.3; sc = 0.9; mx = dx / d; mz = dz / d; if (e.st <= 0) e.state = 'chase'; }
      else if (e.state === 'home') { const ex = e.hx - e.x, ez = e.hz - e.z, ed = Math.hypot(ex, ez); e.hp = Math.min(def.hp, e.hp + 20 * dt); if (ed < 1) e.state = 'idle'; else { mv = def.sp; mx = ex / ed; mz = ez / ed; } if (d < 7 && alive && ed < 18) e.state = 'chase'; }
      // movimento (não entra na água) + empurrão ao levar golpe
      let nx = e.x + (mx * mv + e.kx) * dt, nz = e.z + (mz * mv + e.kz) * dt; e.kx *= Math.max(0, 1 - dt * 6); e.kz *= Math.max(0, 1 - dt * 6);
      if (Math.abs(nx) < w.half - 3 && Math.abs(nz) < w.half - 3 && (mx || mz || e.kx || e.kz)) { _v.set(nx, w.heightAt(nx, nz) + 0.75 * e.rg, nz); if (w.collide(_v, 0.32 * e.rg, null)) { nx = _v.x; nz = _v.z; e.kx = e.kz = 0; } } // não atravessa paredes: desliza
      if (Math.abs(nx) < w.half - 3 && Math.abs(nz) < w.half - 3) { const nh = w.heightAt(nx, nz); if (nh > w.waterY + 0.05 && nh - e.y < 1.2) { e.x = nx; e.z = nz; e.y = nh; } else { e.t = 0; } }
      if (mx || mz) e.ry += angDiff(e.ry, Math.atan2(mx, mz)) * Math.min(1, dt * 9);
      if (mv > 0) e.ph += dt * (6 + mv * 3);
      // golpes do jogador
      if (d < 2.6 * e.rg) this._handHits(e.x, e.y + (def.fly ? 1.0 : 0.75) * e.rg, e.z, 0.55 * e.rg, 1.5, (h) => { if (t - (e.last || 0) < 0.25) return; e.last = t; const dmg = this._damage(h), l = Math.hypot(h.vel.x, h.vel.z) || 1; e.hp -= dmg; e.flash = 0.25; e.kx = h.vel.x / l * 5; e.kz = h.vel.z / l * 5; if (e.state !== 'windup' && e.state !== 'strike' && dmg >= 14) { e.state = 'hurt'; e.st = 0.2; } else if (e.state === 'idle' || e.state === 'home') { e.state = 'chase'; e.st = 0.3; } play(dmg > 14 ? 'punch_heavy' : 'punch', 0.9); P.pulse(1, 40); this.fx.text(e.x, e.y + 2, e.z, '-' + dmg, '#ffd040'); this.fx.burst(e.x, e.y + 0.9, e.z, 0xffb040, 8, 3); S.stat('hit'); this._combo();
        if (e.hp <= 0) { e.state = 'dead'; e.respawn = e.temp ? Infinity : t + (e.boss ? 300 : 40); if (e.boss) { S.stat('boss'); S.addItem(BOSS_DROPS[Math.floor(Math.random() * BOSS_DROPS.length)], 1); play('win', 0.7); } setInst(e.mesh, e.i, 0, -999, 0, 0, 0); const c = def.coins[0] + Math.floor(Math.random() * (def.coins[1] - def.coins[0] + 1)); S.addCoins(c); S.addXp(def.xp); S.stat('kill', e.type); if (Math.random() < def.drop[1]) S.addItem(def.drop[0], 1); S.toast('☠ ' + def.n + ' derrotado: +' + c + ' moedas', '#ffd76a'); play('mine_break', 0.5); this.fx.burst(e.x, e.y + 0.8, e.z, 0xd0d0ff, 26, 4.5); } });
      if (e.state === 'dead') continue;
      // animação procedural: pulinhos ao andar, flutuar (fantasma), inclinar, inchar no aviso
      const hop = def.fly ? 0.35 + Math.sin(t * 2.2 + e.i) * 0.14 : mv > 0 ? Math.abs(Math.sin(e.ph)) * 0.2 : Math.sin(t * 2 + e.i) * 0.015 + 0.015;
      const sq = def.fly ? 1 : mv > 0 ? 1 + Math.cos(e.ph * 2) * 0.06 : 1 + Math.sin(t * 2 + e.i) * 0.02;
      _q.setFromAxisAngle(UP, e.ry); _q2.setFromAxisAngle(_v.set(1, 0, 0), lean + (def.fly ? Math.sin(t * 1.7 + e.i) * 0.08 : 0)); _q.multiply(_q2);
      _m.compose(_p.set(e.x, e.y + hop, e.z), _q, _s.set(def.s * sc / Math.sqrt(sq), def.s * sc * sq, def.s * sc / Math.sqrt(sq))); e.mesh.setMatrixAt(e.i, _m); e.mesh.instanceMatrix.needsUpdate = true;
      if (e.flash > 0 || e.wasFlash) { e.flash -= dt; const f = Math.max(0, e.flash) * 5; const tc = e.tc || [1, 1, 1]; e.mesh.setColorAt(e.i, e.state === 'windup' ? _col.setRGB(tc[0] + f * 1.5, tc[1] - f * 0.4, tc[2] - f * 0.4) : _col.setRGB(tc[0] + f * 2, tc[1] + f * 2, tc[2] + f * 2)); e.mesh.instanceColor.needsUpdate = true; e.wasFlash = e.flash > 0; }
    }
  },
  // ---------- objetos colocados no mundo (sincronizados por broadcast) ----------
  _addProp(key, owner, k, x, y, z, ry) {
    const def = PROPS.find((p) => p.id === k); if (!def || !this.world) return; this._delProp(key);
    const geo = modelGeometry(def.model), mesh = new THREE.Mesh(geo, instMat); mesh.position.set(x, y, z); mesh.rotation.y = ry || 0; mesh.scale.setScalar(def.s); mesh.castShadow = true; this.scene.add(mesh);
    let box = null; if (!def.nocol) { if (!geo.boundingBox) geo.computeBoundingBox(); const b = geo.boundingBox, hw = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * def.s * 0.5; box = [x - hw, y, z - hw, x + hw, y + b.max.y * def.s, z + hw]; this.world.dyn.push(box); }
    this.props.set(key, { id: key.split(':')[1], owner, k, x, y, z, ry, mesh, box, def });
  },
  _delProp(key) { const p = this.props.get(key); if (!p) return; this.scene.remove(p.mesh); if (p.box && this.world) { const i = this.world.dyn.indexOf(p.box); if (i >= 0) this.world.dyn.splice(i, 1); } this.props.delete(key); },
  spawnProp(k) {
    const P = this.player, def = PROPS.find((p) => p.id === k); if (!def || !this.world) return;
    const mine = []; this.props.forEach((p, key) => { if (p.owner === (net.id || 'me')) mine.push(key); });
    if (mine.length >= 8) { const old = mine[0]; net.send('propdel', { id: this.props.get(old).id }); this._delProp(old); }
    const x = P.pos.x - Math.sin(P.headYaw) * 1.8, z = P.pos.z - Math.cos(P.headYaw) * 1.8, y = this.world.floorAt(x, P.pos.y + 1, z), id = 'p' + (++this.propSeq), ry = P.headYaw + Math.PI;
    this._addProp((net.id || 'me') + ':' + id, net.id || 'me', k, x, y, z, ry); net.send('prop', { id, k, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, z: Math.round(z * 100) / 100, ry: Math.round(ry * 100) / 100 });
    play('wood', 0.7); this.fx.burst(x, y + 0.5, z, 0xffffff, 10, 2.5); S.toast('Colocado: ' + def.n, '#bfe6ff'); S.stat('spawn');
  },
  clearProps() { const me = net.id || 'me'; this.props.forEach((p, key) => { if (p.owner === me) { net.send('propdel', { id: p.id }); this._delProp(key); } }); S.toast('Seus objetos foram removidos', '#bfe6ff'); },

  // bolhas, cardumes, natação
  _aero(dt) {
    const P = this.player, t = this.time, W = this.world, ax = this.ax;
    // ambiente sonoro: marolas perto da água, ronco submarino, cachoeira por distância
    if (W.swim || ax || this.mapId === 'dark') { let fall = 0; if (ax) for (const f of ax.falls) { const d = Math.hypot(P.pos.x - f.x, P.pos.z - f.z); fall = Math.max(fall, clamp(1 - d / 34, 0, 1)); } const nearW = W.heightAt(P.pos.x, P.pos.z) < W.waterY + 2.5 || P.swimming; ambience({ water: this.under ? 0 : nearW ? (this.mapId === 'pool' ? 0.5 : 1) : 0.25, under: this.under ? 1 : 0, fall: this.under ? fall * 0.3 : fall * fall, wind: this.mapId === 'dark' ? 1 : 0, hum: this.mapId === 'pool' && !this.under ? 1 : 0 }); this._amb = true; } else if (this._amb) { this._amb = false; ambience({}); }
    // rastro de bolhas das braçadas
    if (P.swimming) for (const h of P.hands) if (h.speed > 1.6 && Math.random() < 0.35) this.fx.burst(h.pos.x, h.pos.y, h.pos.z, 0xdff8ff, 1, 0.6, -2.2);
    if (ax) {
      // golfinhos saltando em arco
      for (let i = 0; i < ax.dol.length; i++) { const d = ax.dol[i]; d.t += dt; const cyc = 7 + i * 1.7, ph = d.t % cyc, jump = ph < 1.5; if (jump && !d.up) { d.up = true; d.a += 0.9 + i; const x = Math.cos(d.a) * d.r, z = Math.sin(d.a) * d.r; this.fx.burst(x, 0.2, z, 0xe8fbff, 14, 4); this.fx.ring(x, 0.06, z, 0xffffff, 2, true, null, 0.8); _v.set(x, 0, z); if (_v.distanceTo(P.pos) < 45) { splashSfx(clamp(1 - _v.distanceTo(P.pos) / 45, 0.1, 0.8)); chirp(clamp(1 - _v.distanceTo(P.pos) / 45, 0.1, 0.8)); } }
        if (!jump && d.up) { d.up = false; const a2 = d.a + 0.45, x = Math.cos(a2) * d.r, z = Math.sin(a2) * d.r; this.fx.burst(x, 0.2, z, 0xe8fbff, 12, 3.5); this.fx.ring(x, 0.06, z, 0xffffff, 1.8, true, null, 0.8); }
        if (jump) { const k = ph / 1.5, a2 = d.a + k * 0.45, y = Math.sin(k * Math.PI) * 3.6 - 0.4; _q.setFromAxisAngle(UP, -a2 - Math.PI / 2); _q2.setFromAxisAngle(_v.set(0, 0, 1), (0.5 - k) * 2.2); _q.multiply(_q2); _m.compose(_p.set(Math.cos(a2) * d.r, y, Math.sin(a2) * d.r), _q, _s.set(11, 9, 14)); } else _m.makeScale(0, 0, 0).setPosition(0, -999, 0);
        ax.dolMesh.setMatrixAt(i, _m); } ax.dolMesh.instanceMatrix.needsUpdate = true;
      // águas-vivas pulsando
      for (let i = 0; i < ax.jel.length; i++) { const j = ax.jel[i]; _m.makeScale(j.s, j.s * 1.1, j.s).setPosition(j.x + Math.sin(t * 0.2 + j.ph) * 2, j.y + Math.sin(t * 0.6 + j.ph) * 1.4, j.z + Math.cos(t * 0.17 + j.ph) * 2); ax.jelMesh.setMatrixAt(i, _m); } ax.jelMesh.instanceMatrix.needsUpdate = true;
      // raios de luz só aparecem com a cabeça debaixo d'água
      ax.rays.visible = this.under; if (this.under) { for (let i = 0; i < ax.rayP.length; i++) { const r = ax.rayP[i]; _q.setFromAxisAngle(UP, r.ry + Math.sin(t * 0.3 + r.ph) * 0.3); _q2.setFromAxisAngle(_v.set(0, 0, 1), 0.22 + Math.sin(t * 0.5 + r.ph) * 0.08); _q.multiply(_q2); _m.compose(_p.set(r.x, 0, r.z), _q, _s.set(1 + Math.sin(t * 0.7 + r.ph) * 0.3, 1, 1)); ax.rays.setMatrixAt(i, _m); } ax.rays.instanceMatrix.needsUpdate = true; ax.rays.material.opacity = 0.03 + (1 - this.sky.night) * 0.035; }
      // cintilação do sol na superfície
      ax.glints.visible = !this.under && perf.particles >= 0.5; if (ax.glints.visible) { const C = ax.glints.geometry.attributes.color.array; for (let i = 0; i < ax.glP.length; i++) { const v = Math.pow(Math.max(0, Math.sin(t * 2.6 + ax.glP[i] * 7)), 10) * (1 - this.sky.night * 0.7); C[i * 3] = v; C[i * 3 + 1] = v; C[i * 3 + 2] = v; } ax.glints.geometry.attributes.color.needsUpdate = true; }
      for (let k = 0; k < ax.aur.length; k++) { const m = ax.aur[k]; m.visible = !this.under; m.rotation.y = t * 0.012 * (k % 2 ? -1 : 1); m.position.y = Math.sin(t * 0.2 + k) * 4; m.material.opacity = 0.22 + this.sky.night * 0.5 + Math.sin(t * 0.5 + k * 2) * 0.06; }
      for (const f of ax.falls) { f.tex.offset.y = t * 0.9; if (Math.random() < 0.5 && Math.abs(f.x - P.pos.x) < 50) this.fx.burst(f.x + 0.9, f.y0 + 0.4, f.z + (Math.random() - 0.5) * f.wd, 0xe8fbff, 1, 1.6, 2); }
      // lens flare
      const orb = this.sky.orb; _v.copy(orb.position).project(this.camera); const on = !this.under && _v.z < 1 && Math.abs(_v.x) < 1.15 && Math.abs(_v.y) < 1.15 && perf.level >= 1 && !this.renderer.xr.isPresenting;
      for (let i = 0; i < ax.flare.length; i++) { const sp = ax.flare[i]; sp.visible = on; if (on) { const k = [0.35, 0.7, 1.25, 1.7][i]; _v2.set(_v.x * (1 - k), _v.y * (1 - k), 0.5).unproject(this.camera); this.camera.getWorldPosition(_p); _v2.sub(_p).normalize().multiplyScalar(6).add(_p); sp.position.copy(_v2); const s = [1.1, 0.5, 1.5, 0.8][i]; sp.scale.set(s, s, 1); sp.material.opacity = 0.42 * (1 - Math.max(Math.abs(_v.x), Math.abs(_v.y)) * 0.6); } }
    }
    if (P.swimDist >= 5) { S.stat('swim', null, Math.floor(P.swimDist)); P.swimDist -= Math.floor(P.swimDist); }
    if (this.under) { this.bubT = (this.bubT || 0) - dt; if (this.bubT <= 0) { this.bubT = 0.7; this.camera.getWorldPosition(_v); this.fx.burst(_v.x, _v.y - 0.15, _v.z, 0xe8fbff, 2, 0.5, -3); } }
    if (this.bubbleMesh) { const bm = this.bubbleMesh; for (const b of this.bubbles) {
      if (!b.alive) { if (t > b.t) b.alive = true; else { continue; } }
      const y = b.y + Math.sin(t * 0.5 + b.ph) * 0.9, x = b.x + Math.sin(t * 0.23 + b.ph * 2) * 1.5, z = b.z + Math.cos(t * 0.19 + b.ph) * 1.5, wob = 1 + Math.sin(t * 2.3 + b.ph) * 0.05;
      _m.makeScale(b.r * wob, b.r / wob, b.r * wob).setPosition(x, y, z); bm.setMatrixAt(b.i, _m);
      if (Math.abs(x - P.pos.x) < 3 && Math.abs(z - P.pos.z) < 3) { let hit = false; for (const h of P.hands) if (h.target.distanceToSquared(_v.set(x, y, z)) < (b.r + HAND_R) * (b.r + HAND_R)) hit = true; if (!hit && _v.set(x, y, z).distanceToSquared(_v2.set(P.pos.x, P.pos.y + 0.7, P.pos.z)) < (b.r + 0.4) * (b.r + 0.4)) hit = true;
        if (hit) { b.alive = false; b.t = t + 8 + Math.random() * 6; _m.makeScale(0, 0, 0).setPosition(0, -999, 0); bm.setMatrixAt(b.i, _m); pop(0.8, b.r); this.fx.burst(x, y, z, 0xe8fbff, 14, 3, 1); this.fx.burst(x, y, z, 0x80e8ff, 6, 1.2, -1.5); this.fx.ring(x, y, z, 0xcff8ff, b.r * 2.2, false, this.camera.quaternion, 0.45); if (b.r > 0.85) chime(b.i, 0.5); S.stat('pop'); if ((S.d.stats.pop || 0) % 5 === 0) S.addCoins(2); P.pulse(0.4, 20); } } }
      bm.instanceMatrix.needsUpdate = true; }
    if (this.schoolMesh) for (const sc of this.E.schools) { if (Math.abs(sc.x - P.pos.x) > 70 || Math.abs(sc.z - P.pos.z) > 70) continue; for (let i = 0; i < sc.n; i++) { const a = t * (0.35 + (i % 3) * 0.08) + i * 6.283 / sc.n, rr = sc.r * (0.55 + (i % 5) * 0.11), x = sc.x + Math.cos(a) * rr, z = sc.z + Math.sin(a) * rr, y = sc.y + Math.sin(a * 2 + i) * 1.2; _q.setFromAxisAngle(UP, -a + Math.sin(t * 6 + i) * 0.25); _m.compose(_p.set(x, y, z), _q, _s.set(4, 4, 4)); this.schoolMesh.setMatrixAt(sc.i0 + i, _m); } this.schoolMesh.instanceMatrix.needsUpdate = true; }
  },
  // ---------- bichinhos de estimação: seguem o dono (o meu e os dos outros jogadores) ----------
  _pets(dt) {
    const P = this.player, w = this.world; if (!w) return;
    const follow = (o, owner, yaw, dt2, emote) => {
      const def = PETS.find((x) => x.id === o.id); if (!def || !def.look) return; if (!o.av) { o.av = new CatAvatar(def.look, '', { noTag: true, scale: 0.45 }); this.scene.add(o.av.root); o.av.root.position.copy(owner); }
      const av = o.av, p = av.root.position, tx = owner.x + Math.sin(yaw) * 0.9 - Math.cos(yaw) * 0.6, tz = owner.z + Math.cos(yaw) * 0.9 + Math.sin(yaw) * 0.6, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      if (d > 14) { p.set(tx, owner.y, tz); } let sp = 0; if (d > 0.35) { sp = Math.min(6.5, d * 3); p.x += dx / d * sp * dt2; p.z += dz / d * sp * dt2; av.root.rotation.y += angDiff(av.root.rotation.y, Math.atan2(-dx, -dz)) * Math.min(1, dt2 * 8); }
      else av.root.rotation.y += angDiff(av.root.rotation.y, Math.atan2(-(owner.x - p.x), -(owner.z - p.z))) * Math.min(1, dt2 * 3);
      const fy = w.floorAt(p.x, owner.y + 1.2, p.z), wy = w.waterY; p.y += ((fy < wy - 0.2 && w.swim ? wy - 0.3 : fy) - p.y) * Math.min(1, dt2 * 10);
      av.speed = sp; av.grounded = Math.abs(p.y - fy) < 0.3; o.idle = sp > 0.3 ? 0 : (o.idle || 0) + dt2;
      const em = emote === 2 || emote === 8 || emote === 10 ? emote : o.idle > 8 ? 3 : 0; if (av.emote !== em) { av.emote = em; av.emoteT = 0; }
      av.update(dt2, false);
    };
    const mine = this.myPet || (this.myPet = { id: 'none' }); if (mine.id !== S.d.pet) { if (mine.av) mine.av.dispose(); mine.av = null; mine.id = S.d.pet; }
    if (mine.id !== 'none') follow(mine, P.pos, P.bodyYaw, dt, this.myEmote || 0);
    this.remotes.forEach((r) => { const id = (r.meta && r.meta.pet) || 'none'; r.pet = r.pet || { id: 'none' }; if (r.pet.id !== id) { if (r.pet.av) r.pet.av.dispose(); r.pet.av = null; r.pet.id = id; }
      if (id !== 'none' && r.has) { if (!r.near) { if (r.pet.av) r.pet.av.root.visible = false; return; } follow(r.pet, r.av.root.position, r.av.root.rotation.y, dt, r.av.emote); r.pet.av.root.visible = r.av.root.visible; } });
  },
  // ---------- admin: efeitos no jogador ----------
  _adminFx(dt) {
    const P = this.player, t = this.time;
    if (infect.myInf) P.speedMul *= 1.05; // infectado: +5% de velocidade
    if (admin.has('speed')) P.speedMul *= 2.2; if (admin.has('jump')) P.jumpMul *= 2.3; P.gravMul = admin.has('lowgrav') ? 0.32 : 1; P.fly = admin.has('fly');
    const fr = admin.has('freeze'); if (fr && !this._admFrozen) { this._admFrozen = true; P.frozen = true; P.vel.set(0, 0, 0); } else if (!fr && this._admFrozen) { this._admFrozen = false; P.frozen = false; }
    if (fr && Math.random() < 0.3) this.fx.burst(P.pos.x, P.pos.y + 0.8, P.pos.z, 0xbfefff, 2, 1);
    this.pawColor = null;
    if (admin.has('rainbow')) { _col.setHSL((t * 0.4) % 1, 0.9, 0.6); this.pawColor = '#' + _col.getHexString(); if (Math.random() < 0.5) this.fx.burst(P.pos.x, P.pos.y + 0.4, P.pos.z, _col.getHex(), 1, 0.6, -0.5); }
    if (admin.has('gold')) { this.pawColor = '#ffd040'; if (Math.random() < 0.5) this.fx.burst(P.pos.x + (Math.random() - 0.5) * 0.6, P.pos.y + Math.random() * 1.3, P.pos.z + (Math.random() - 0.5) * 0.6, 0xffd040, 1, 0.4, -0.8); }
    if (P.fly && P.speed > 1 && Math.random() < 0.4) this.fx.burst(P.pos.x, P.pos.y + 0.3, P.pos.z, 0xffffff, 1, 0.3, 0.5);
  },
  _confetti(n) { const P = this.player.pos; for (let i = 0; i < 6; i++) { _col.setHSL(Math.random(), 0.9, 0.6); this.fx.burst(P.x + (Math.random() - 0.5) * 6, P.y + 3 + Math.random() * 2, P.z + (Math.random() - 0.5) * 6, _col.getHex(), Math.ceil(n / 6), 3, 3); } pop(0.5, 0.3); },
  // ---------- admin: eventos ----------
  _adminTick(dt, now) {
    const P = this.player, ev = admin.eventOn() ? admin.event : null, t = this.time; let label = '';
    if (admin.has('disco') || (ev && ev.ev === 'party')) { _col.setHSL((t * 0.15) % 1, 0.7, 0.45); this.scene.background.lerp(_col, 0.45); this.scene.fog.color.copy(this.scene.background); if (this.lampMesh) this.lampMesh.material.color.setHSL((t * 0.3) % 1, 1, 0.7); }
    if (ev) {
      const left = Math.max(0, Math.ceil((ev.until - now) / 1000)), mm = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
      this.admT -= dt;
      if (ev.ev === 'party') { label = '🎉 Festa · XP x2 · ' + mm; if (this.admT <= 0) { this.admT = 0.5; _col.setHSL(Math.random(), 0.9, 0.6); this.fx.burst(P.pos.x + (Math.random() - 0.5) * 10, P.pos.y + 4, P.pos.z + (Math.random() - 0.5) * 10, _col.getHex(), 10, 2.5, 2.5); } }
      else if (ev.ev === 'xp2') label = '⭐ XP em dobro · ' + mm;
      else if (ev.ev === 'night') label = '🌙 Noite eterna · ' + mm; else if (ev.ev === 'day') label = '☀ Dia eterno · ' + mm;
      else if (ev.ev === 'goldrain') { label = '💰 Chuva de Ouro · ' + mm; if (this.admT <= 0 && this.world) { this.admT = 0.45; const a = Math.random() * 6.28, r = 2 + Math.random() * 11, x = P.pos.x + Math.cos(a) * r, z = P.pos.z + Math.sin(a) * r, gem = Math.random() < 0.18; this.spawnDrop(x, P.pos.y + 12 + Math.random() * 4, z, gem ? ['quartz', 'amethyst', 'emerald', 'ruby', 'diamond'][Math.min(4, Math.floor(Math.random() * Math.random() * 5.5))] : null, gem ? 0 : 5 + Math.floor(Math.random() * 11)); } }
      else if (ev.ev === 'invasion') { const alive = this.enemies.filter((e) => e.inv && e.state !== 'dead').length; label = '👾 Invasão · onda ' + ev.wave + '/5 · ' + alive + ' inimigos · ' + mm;
        if (now > ev.nextWave && this.world && (alive === 0 || now > ev.nextWave + 30000)) { ev.wave++; if (ev.wave > 5) { ev.wave = 5; } else { ev.nextWave = now + 8000; const boss = ev.wave === 5, types = ['ghost', 'skeleton', 'zombie', 'orc'], n = boss ? 1 : 1 + ev.wave * 2; emit('banner', boss ? '👑 ONDA FINAL: CHEFE!' : '👾 Onda ' + ev.wave + '!', 3); play('ko', 0.6);
          for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, r = 9 + Math.random() * 5; const e = this.spawnEnemy(boss ? 'orc' : types[Math.floor(Math.random() * Math.min(4, ev.wave + 1))], P.pos.x + Math.cos(a) * r, P.pos.z + Math.sin(a) * r, boss); if (e) { e.inv = true; e.state = 'chase'; } } } } }
      else if (ev.ev === 'treasure') { const key = ev.t0 + ':' + this.mapId; if (this._tKey !== key && this.world) { this._tKey = key; this._spawnTreasure(ev.t0); } const found = this.tChests.filter((c) => c.open).length; label = '🗝 Caça ao Tesouro · ' + found + '/' + this.tChests.length + ' neste mapa · ' + mm; }
    }
    for (const fx of ['speed', 'jump', 'lowgrav', 'fly', 'rainbow', 'gold', 'disco']) if (admin.has(fx)) { label += (label ? '  ·  ' : '') + { speed: '⚡', jump: '🦘', lowgrav: '🪐', fly: '🕊', rainbow: '🌈', gold: '✨', disco: '🪩' }[fx] + ' ' + Math.ceil((admin.effects[fx] - now) / 1000) + 's'; }
    if (label !== this.adminLabel) { this.adminLabel = label; emit('hp'); }
    this._drops(dt); this._treasure(dt);
  },
  spawnEnemy(type, x, z, boss) {
    const base = ENEMIES[type]; if (!base || !this.world) return null; const w = this.world; x = clamp(x, -w.half + 4, w.half - 4); z = clamp(z, -w.half + 4, w.half - 4);
    const def = boss ? Object.assign({}, base, { n: BOSS_NAMES[type], s: base.s * 1.9, hp: base.hp * 6, dmg: Math.round(base.dmg * 1.6), sp: base.sp * 0.9, xp: base.xp * 8, coins: [base.coins[0] * 8, base.coins[1] * 8] }) : base;
    const mesh = new THREE.InstancedMesh(modelGeometry(base.model), instMat, 1); mesh.frustumCulled = false; mesh.castShadow = true; const tc = base.tint || [1, 1, 1]; mesh.setColorAt(0, _col.setRGB(tc[0], tc[1], tc[2])); this.scene.add(mesh); this.objs.push(mesh);
    const e = { type, x, z, boss, def, tc, rg: boss ? 1.8 : 1, mesh, i: 0, hx: x, hz: z, y: w.heightAt(x, z), hp: def.hp, state: 'idle', st: 0, t: 0, ry: Math.random() * 6.28, ph: 0, tx: x, tz: z, flash: 0, kx: 0, kz: 0, temp: true };
    setInst(mesh, 0, e.x, e.y, e.z, def.s, e.ry); this.enemies.push(e); return e;
  },
  // itens/moedas caindo do céu (eventos do admin): cada jogador pega a sua cópia
  spawnDrop(x, y, z, item, coins) {
    if (!this.world || this.drops.length >= 70) return; const w = this.world;
    if (!this.coinMesh) { const mk = (k, n) => { const m = new THREE.InstancedMesh(modelGeometry(k), instMat, n); m.frustumCulled = false; m.count = n; for (let i = 0; i < n; i++) { m.setMatrixAt(i, _m.makeScale(0, 0, 0)); m.setColorAt(i, _col.setRGB(1, 1, 1)); } this.scene.add(m); this.objs.push(m); return m; }; this.coinMesh = mk('plat/coin-gold', 70); this.dropGemMesh = mk('plat/jewel', 70); }
    const free = (arr) => { for (let i = 0; i < 70; i++) if (!this.drops.some((d) => d.gem === arr && d.i === i)) return i; return -1; }, gem = !!item, i = free(gem); if (i < 0) return;
    const d = { x: clamp(x, -w.half + 3, w.half - 3), y, z: clamp(z, -w.half + 3, w.half - 3), vy: 0, item, coins, gem, i, t: 0, land: false };
    d.gy = w.floorAt(d.x, y, d.z); if (gem && ITEMS[item]) this.dropGemMesh.setColorAt(i, _col.set(ORES[item] ? ORES[item].c : RARITY[ITEMS[item].r].c).multiplyScalar(1.4)); if (gem) this.dropGemMesh.instanceColor.needsUpdate = true; this.drops.push(d);
  },
  _drops(dt) {
    if (!this.drops.length) return; const P = this.player, t = this.time;
    for (let k = this.drops.length - 1; k >= 0; k--) { const d = this.drops[k], mesh = d.gem ? this.dropGemMesh : this.coinMesh; d.t += dt;
      if (!d.land) { d.vy -= 14 * dt; d.y += d.vy * dt; if (d.y <= d.gy + 0.05) { d.y = d.gy + 0.05; if (d.vy < -4) { d.vy = -d.vy * 0.35; this.fx.burst(d.x, d.y + 0.2, d.z, d.gem ? 0xbff6ff : 0xffd040, 3, 1.5); } else { d.land = true; } } }
      let got = Math.abs(d.x - P.pos.x) < 1.1 && Math.abs(d.z - P.pos.z) < 1.1 && Math.abs(d.y - P.pos.y - 0.5) < 1.4; if (!got) for (const h of P.hands) if (h.target.distanceToSquared(_v.set(d.x, d.y + 0.3, d.z)) < 0.25) got = true;
      if (got || d.t > 90) { if (got) { if (d.coins) { S.addCoins(d.coins); this.fx.text(d.x, d.y + 1, d.z, '+' + d.coins + ' 💰', '#ffd040'); play('coin', 0.6); } if (d.item) { S.addItem(d.item, 1); chime(d.i, 0.7); } this.fx.burst(d.x, d.y + 0.4, d.z, d.gem ? 0xbff6ff : 0xffd040, 10, 2.5); P.pulse(0.5, 20); } mesh.setMatrixAt(d.i, _m.makeScale(0, 0, 0)); mesh.instanceMatrix.needsUpdate = true; this.drops.splice(k, 1); continue; }
      _q.setFromAxisAngle(UP, t * 3 + d.i); _m.compose(_p.set(d.x, d.y + (d.land ? Math.sin(t * 3 + d.i) * 0.08 : 0), d.z), _q, _s.setScalar(d.gem ? 1.8 : 1.6)); mesh.setMatrixAt(d.i, _m); mesh.instanceMatrix.needsUpdate = true; }
  },
  // baús dourados da Caça ao Tesouro: mesmas posições para todos (sorteio pela hora do evento + mapa)
  _spawnTreasure(seed) {
    const w = this.world, r = rng((seed % 1e9) + hashStr(this.mapId)); for (const c of this.tChests) c.gone = true; this.tChests = [];
    if (!this.tChestMesh) { this.tChestMesh = new THREE.InstancedMesh(modelGeometry('plat/chest'), instMat, 5); this.tChestMesh.frustumCulled = false; this.scene.add(this.tChestMesh); this.objs.push(this.tChestMesh);
      const bg = new THREE.CylinderGeometry(0.35, 0.35, 40, 8, 1, true); bg.translate(0, 20, 0); this.beamMesh = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ color: 0xffd040, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide }), 5); this.beamMesh.frustumCulled = false; this.scene.add(this.beamMesh); this.objs.push(this.beamMesh); }
    for (let i = 0; i < 5; i++) { let x = 0, z = 0; for (let k = 0; k < 40; k++) { x = (r() - 0.5) * (w.half * 1.6); z = (r() - 0.5) * (w.half * 1.6); if (w.heightAt(x, z) > w.waterY + 0.3) break; }
      const y = w.floorAt(x, 80, z); this.tChests.push({ i, x, y, z, open: false }); setInst(this.tChestMesh, i, x, y, z, 2.6, r() * 6.28); this.tChestMesh.setColorAt(i, _col.setRGB(2, 1.6, 0.4)); setInst(this.beamMesh, i, x, y, z, 1, 0); }
    this.tChestMesh.instanceColor.needsUpdate = true;
  },
  _treasure() {
    if (!this.tChests.length) return; const P = this.player, ev = admin.event;
    for (const c of this.tChests) { if (c.gone && !c.open) { c.open = true; setInst(this.tChestMesh, c.i, 0, -999, 0, 0, 0); setInst(this.beamMesh, c.i, 0, -999, 0, 0, 0); continue; } if (c.open) continue;
      let hit = Math.abs(c.x - P.pos.x) < 1.4 && Math.abs(c.z - P.pos.z) < 1.4 && Math.abs(c.y - P.pos.y) < 1.6; if (!hit) for (const h of P.hands) if (h.target.distanceToSquared(_v.set(c.x, c.y + 0.5, c.z)) < 0.5) hit = true;
      if (hit) { c.open = true; setInst(this.tChestMesh, c.i, 0, -999, 0, 0, 0); setInst(this.beamMesh, c.i, 0, -999, 0, 0, 0); const coins = 60 + Math.floor(Math.random() * 90); S.addCoins(coins); S.addItem(['emerald', 'ruby', 'amethyst', 'relic', 'diamond'][Math.floor(Math.random() * 5)], 1); S.addXp(40); S.stat('chest'); S.stat('event');
        S.toast('🗝 Tesouro encontrado! +' + coins + ' moedas', '#ffd76a'); play('chest', 0.9); play('win', 0.5); this.fx.burst(c.x, c.y + 1, c.z, 0xffd040, 40, 5, 2); this._confetti(20); } }
    if (ev && ev.ev === 'treasure' && this.tChests.every((c) => c.open) && !this._tDone) { this._tDone = true; emit('banner', '🗝 Você achou todos os tesouros deste mapa!', 4); } if (!this.tChests.some((c) => !c.open)) this._tDone = this._tDone || false;
  },
  _handHits(x, y, z, r, minSpeed, fn) { const P = this.player; for (let i = 0; i < 2; i++) { const h = P.hands[i]; if (h.speed < minSpeed) continue; const t = h.target; const dx = t.x - x, dy = t.y - y, dz = t.z - z; if (dx * dx + dy * dy + dz * dz < (r + HAND_R) * (r + HAND_R)) fn(h, i); } },
  _interact(dt, now) {
    const P = this.player, E = this.E, px = P.pos.x, py = P.pos.y, pz = P.pos.z, t = this.time;
    // portais
    for (const p of E.portals) if (Math.abs(px - p.x) < 1.1 && Math.abs(pz - p.z) < 1.1 && Math.abs(py - p.y) < 2.5) { this.travel(p.to); return; }
    // trampolins
    for (const s of E.springs) if (Math.abs(px - s.x) < 1 && Math.abs(pz - s.z) < 1 && py - s.y < 1.2 && P.vel.y <= 0.5) { P.vel.y = s.p; P.grounded = false; play('power', 0.5, 0, 1.4); this.fx.burst(s.x, s.y + 0.8, s.z, 0x80ffb0, 10, 2); }
    // segredos
    for (const s of E.secrets) if (!s.found && Math.abs(px - s.x) < s.r && Math.abs(pz - s.z) < s.r && Math.abs(py - s.y) < 3) { s.found = true; S.secret(this.mapId + ':' + s.key, s.key); setInst(this.starMesh, s.i, 0, -999, 0, 0, 0); this.fx.burst(s.x, s.y + 1, s.z, 0xc080ff, 40, 4, 2); }
    // minérios
    const pick = PICKS[S.d.equip.pick], miner = S.profBonus('miner');
    for (const o of E.ores) {
      if (!o.alive) { if (!o.ev && o.respawn && now > o.respawn) { o.alive = true; o.hp = ORES[o.type].hp; o.respawn = 0; this._oreVis(o); } continue; }
      if (Math.abs(o.x - px) > 3 || Math.abs(o.z - pz) > 3) continue;
      this._handHits(o.x, o.y + 0.45, o.z, 0.72, 1.3, (h, i) => {
        if (t - (o.last || 0) < 0.22) return; o.last = t; const d = ORES[o.type];
        if (pick.p < 1 + d.tier * 0.6 && d.tier > S.d.equip.pick) { S.toast('Precisa de uma picareta melhor (' + PICKS[d.tier].n + ')', '#ff9a8a'); play('block', 0.5); this.fx.burst(o.x, o.y + 0.5, o.z, 0xaaaaaa, 3, 2); return; }
        o.hp -= pick.p * (S.held().mine || 1) * (1 + S.perk('mine') * 0.12) * (miner ? 1.25 : 1) * clamp(h.speed / 3, 0.6, 1.8); play('mine', 0.7); P.pulse(0.7, 30); this.fx.burst(o.x, o.y + 0.6, o.z, d.c, 5, 2.5);
        if (o.hp <= 0) { o.alive = false; o.respawn = now + (o.ev ? 9e9 : 45000 + ORES[o.type].tier * 15000); this._oreVis(o); const n = 1 + (miner && Math.random() < 0.25 ? 1 : 0) + (d.gem ? 0 : Math.random() < 0.3 ? 1 : 0); S.addItem(o.type, n); S.addXp(d.xp); S.stat('mine', o.type); if (o.ev) S.stat('event'); play('mine_break', 0.6); this.fx.burst(o.x, o.y + 0.6, o.z, d.c, 18, 4); if (!o.ev) net.send('ore', { i: o.i, u: o.respawn }); }
      });
    }
    // árvores: precisam do machado (aparece sozinho perto delas se a pata estiver livre)
    const axe = this.tool === 4 || S.d.hand === 'axe';
    for (const tr of E.trees) {
      if (tr.fall > 0) { tr.fall -= dt; const k = 1 - Math.max(0, tr.fall) / 0.9; _q.setFromAxisAngle(_v.set(tr.fz, 0, -tr.fx), k * k * 1.5); _q.multiply(_q2.setFromAxisAngle(UP, tr.ry)); _m.compose(_p.set(tr.x, tr.y, tr.z), _q, _s.setScalar(tr.fall <= 0 ? 0 : tr.s)); tr.mesh.setMatrixAt(tr.i, _m); tr.mesh.instanceMatrix.needsUpdate = true; if (tr.fall <= 0) { play('thud', 0.6); this.fx.burst(tr.x + tr.fx * 2, tr.y + 0.4, tr.z + tr.fz * 2, 0x9cf09c, 14, 3); } continue; }
      if (!tr.alive) { if (now > tr.respawn) { tr.alive = true; tr.hp = 5; setInst(tr.mesh, tr.i, tr.x, tr.y, tr.z, tr.s, tr.ry); this.world.dyn.push(tr.box); } continue; }
      if (Math.abs(tr.x - px) > 3 || Math.abs(tr.z - pz) > 3) continue;
      this._handHits(tr.x, tr.y + 1.0, tr.z, 0.55, 1.3, (h) => { if (t - (tr.last || 0) < 0.25) return; tr.last = t;
        if (!axe) { if (t - (this._axeWarn || 0) > 3) { this._axeWarn = t; S.toast('Precisa do machado para cortar (menu rápido > Itens na pata)', '#ff9a8a'); } play('block', 0.4); return; }
        tr.hp -= clamp(h.speed / 3, 0.7, 1.8); play('dig', 0.8); play('wood', 0.5); P.pulse(0.8, 30); this.fx.burst(tr.x, tr.y + 1, tr.z, 0xc8a070, 6, 2.5); setInst(tr.mesh, tr.i, tr.x, tr.y, tr.z, tr.s, tr.ry + Math.sin(t * 40) * 0.03);
        if (tr.hp <= 0) { const n = 2 + (Math.random() < 0.5 ? 1 : 0), u = now + 70000, d = Math.hypot(tr.x - px, tr.z - pz) || 1; this._fell(tr, u, (tr.x - px) / d, (tr.z - pz) / d); S.addItem('wood', n); S.addXp(8); S.stat('chop'); net.send('tree', { i: tr.n, u }); } });
    }
    // baús por toque
    for (const c of E.chests) if (!c.open && !c.hidden && Math.abs(c.x - px) < 2.5 && Math.abs(c.z - pz) < 2.5) this._handHits(c.x, c.y + 0.4, c.z, 0.55, 0, () => this.openChest(c));
    // coletáveis
    for (const c of E.collects) { if (!c.alive) { if (t > c.respawn) { c.alive = true; setInst(c.mesh, c.i, c.x, c.y, c.z, c.s, c.ry); } continue; } const dx = c.x - px, dz = c.z - pz; if (dx * dx + dz * dz > 6) continue; let got = dx * dx + dz * dz < 0.5 && Math.abs(c.y - py) < 1.2; if (!got) this._handHits(c.x, c.y + 0.25, c.z, 0.5, 0, () => { got = true; }); if (got) { c.alive = false; c.respawn = t + 100; setInst(c.mesh, c.i, 0, -999, 0, 0, 0); if (c.item === 'pearl' || c.item === 'coral') { chime(c.i, 0.9); this.fx.burst(c.x, c.y + 0.4, c.z, 0xffffff, 14, 2.5, -1); this.fx.ring(c.x, c.y + 0.4, c.z, 0xbff6ff, 1.2, false, this.camera.quaternion, 0.6); } S.addItem(c.item, 1); S.addXp(3); S.stat('forage', c.item); play('pickup', 0.7); this.fx.burst(c.x, c.y + 0.4, c.z, 0x9cf09c, 6, 2); } }
    // tesouros enterrados
    for (const d of E.digs) { if (!d.alive) { if (t > d.respawn) { d.alive = true; d.hp = 4; setInst(this.digMesh, d.i, d.x, d.y + 0.05, d.z, 1, d.i); } continue; } if (Math.abs(d.x - px) > 3 || Math.abs(d.z - pz) > 3) continue; this._handHits(d.x, d.y, d.z, 0.7, 1.2, () => { if (t - (d.last || 0) < 0.25) return; d.last = t; d.hp--; play('dig', 0.7); this.fx.burst(d.x, d.y + 0.2, d.z, 0xd8b070, 8, 2.5); P.pulse(0.6, 30); if (d.hp <= 0) { d.alive = false; d.respawn = t + 300; setInst(this.digMesh, d.i, 0, -999, 0, 0, 0); const id = pickTable(TREASURE_TABLE, S.profBonus('explorer') ? 0.3 : 0); S.addItem(id, 1); const c = 10 + Math.floor(Math.random() * 30); S.addCoins(c); S.addXp(20); S.stat('dig'); play('chest', 0.7); this.fx.burst(d.x, d.y + 0.5, d.z, 0xffd040, 20, 3.5); } }); }
    // bonecos de treino
    for (const d of E.dummies) { if (d.wob > 0) { d.wob -= dt; _q.setFromAxisAngle(_v.set(Math.cos(d.ry), 0, -Math.sin(d.ry)), Math.sin(d.wob * 22) * d.wob * 0.9); _q.multiply(_q2.setFromAxisAngle(UP, d.ry)); _m.compose(_p.set(d.x, d.y, d.z), _q, _s.set(1.7, 1.7, 1.7)); this.dummyMesh.setMatrixAt(d.i, _m); this.dummyMesh.instanceMatrix.needsUpdate = true; } if (Math.abs(d.x - px) > 3 || Math.abs(d.z - pz) > 3) continue; this._handHits(d.x, d.y + 0.8, d.z, 0.5, 1.5, (h) => { if (t - (d.last || 0) < 0.25) return; d.last = t; const dmg = this._damage(h); d.wob = 0.5; play(dmg > 14 ? 'punch_heavy' : 'punch', 0.8); P.pulse(0.9, 40); this.fx.text(d.x, d.y + 1.8, d.z, '-' + dmg, '#ffd040'); this.fx.burst(d.x, d.y + 0.9, d.z, 0xffb040, 6, 2.5); S.stat('hit'); this._combo(); S.addXp(1); }); }
  },
  _fell(tr, until, fx, fz) { tr.alive = false; tr.respawn = until; tr.fall = 0.9; tr.fx = fx; tr.fz = fz; const i = this.world.dyn.indexOf(tr.box); if (i >= 0) this.world.dyn.splice(i, 1); play('wood', 0.8); },
  _damage(h) { return Math.round((5 + clamp(h.speed, 0, 9) * 2.2) * (S.held().dmg || 1) * (1 + S.perk('dmg') * 0.06) * GLOVES[S.d.equip.glove].p * (S.profBonus('fighter') ? 1.15 : 1) * (1 + Math.min(this.combo, 5) * 0.12)); },

  _npcs(dt) {
    const P = this.player, w = this.world;
    for (const n of this.npcs) {
      const av = n.av, p = av.root.position, dx = P.pos.x - p.x, dz = P.pos.z - p.z, d = Math.hypot(dx, dz); n.near = d < perf.animDist;
      if (d > perf.drawDist) { av.root.visible = false; continue; } av.root.visible = true; if (av.tag) av.tag.visible = d < perf.tagDist;
      if (n.spar) this._spar(n, dt, d, dx, dz);
      else {
        n.t -= dt; let sp = 0;
        if (d < 5) { const want = Math.atan2(-dx, -dz); av.root.rotation.y += angDiff(av.root.rotation.y, want) * Math.min(1, dt * 4); av.headPitch = clamp(Math.atan2(P.pos.y + EYE - p.y - 0.95, d) * -1, -0.5, 0.5) * -1; }
        else if (n.wander) { if (n.t <= 0) { n.t = 3 + Math.random() * 5; const a = Math.random() * 6.28, r = Math.random() * n.wander; n.tx = n.hx + Math.cos(a) * r; n.tz = n.hz + Math.sin(a) * r; } const ex = n.tx - p.x, ez = n.tz - p.z, ed = Math.hypot(ex, ez); if (ed > 0.15) { sp = 0.9; p.x += ex / ed * sp * dt; p.z += ez / ed * sp * dt; p.y = w.heightAt(p.x, p.z); n.y = p.y; av.root.rotation.y += angDiff(av.root.rotation.y, Math.atan2(-ex, -ez)) * Math.min(1, dt * 5); } av.headPitch = 0; }
        av.speed = sp; av.grounded = true;
      }
      av.update(dt, !n.near);
    }
  },
  // NPC de treino (claramente identificado como NPC): persegue, arma o golpe (pisca), ataca; dá para bloquear/esquivar.
  _spar(n, dt, d, dx, dz) {
    const P = this.player, av = n.av, p = av.root.position, z = n.zone, t = this.time; n.st -= dt;
    const inZone = z && Math.hypot(P.pos.x - z.x, P.pos.z - z.z) < z.r;
    const face = () => { av.root.rotation.y += angDiff(av.root.rotation.y, Math.atan2(-dx, -dz)) * Math.min(1, dt * 8); };
    if (n.state !== 'ko' && n.state !== 'idle' && (!inZone || S.hp <= 0)) { n.state = 'idle'; n.hp = n.hpMax; av.setName(n.name, n.role); }
    if (n.state !== 'ko' && d < 2.5) this._handHits(p.x, p.y + 0.75, p.z, 0.45, 1.5, (h) => {
      if (t - (n.last || 0) < 0.25 || !inZone) { if (!inZone && t - (n.warn || 0) > 3) { n.warn = t; S.toast('Entre no ringue para lutar com o Mestre', '#ffb0a0'); } return; } n.last = t;
      const dmg = this._damage(h); n.hp -= dmg; av.flash = 0.3; play(dmg > 14 ? 'punch_heavy' : 'punch', 0.9); P.pulse(1, 40); this.fx.text(p.x, p.y + 1.7, p.z, '-' + dmg, '#ffd040'); this.fx.burst(p.x, p.y + 0.9, p.z, 0xffb040, 8, 3); S.stat('hit'); this._combo(); av.setName(n.name, 'Vida ' + Math.max(0, Math.round(n.hp)) + '/' + n.hpMax);
      if (n.state === 'idle') { n.state = 'chase'; n.st = 0.6; }
      if (n.hp <= 0) { n.state = 'ko'; n.st = 6; av.setEmote(4); const ev = currentEvent(net.now()), dbl = ev.active && ev.ev.id === 'doublexp' && ev.map === this.mapId; S.toast('🥊 Você venceu o Mestre!', '#ffd76a'); play('win', 0.7); S.stat('ko'); S.addXp(dbl ? 120 : 60); S.addCoins(30); if (dbl) S.stat('event'); }
    });
    let sp = 0;
    if (n.state === 'idle') { if (d < 6) face(); }
    else if (n.state === 'chase') { face(); if (d > 1.25) { sp = 2.4; p.x += dx / d * sp * dt; p.z += dz / d * sp * dt; if (z) { const zx = p.x - z.x, zz = p.z - z.z, zd = Math.hypot(zx, zz); if (zd > z.r - 0.6) { p.x = z.x + zx / zd * (z.r - 0.6); p.z = z.z + zz / zd * (z.r - 0.6); } } p.y = this.world.floorAt(p.x, p.y + 1, p.z); } else if (n.st <= 0) { n.state = 'windup'; n.st = 0.55; av.flash = 0.55; play('cloth', 0.5); } }
    else if (n.state === 'windup') { face(); if (n.st <= 0) { n.state = 'strike'; n.st = 0.18; if (d < 1.7 && Math.abs(P.pos.y - p.y) < 1.2) { if (P.iframes > 0) this.fx.text(P.pos.x, P.pos.y + 1.5, P.pos.z, 'Esquivou!', '#bfe6ff'); else { let dmg = 12; const a = Math.atan2(-(p.x - P.pos.x), -(p.z - P.pos.z)), blocked = P.block && Math.abs(angDiff(P.headYaw, a)) < 1.2; if (blocked) { dmg = S.held().block ? 1 : 2; S.stat('blocked'); P.stamina = Math.max(0, P.stamina - 10); } S.hp = Math.max(0, S.hp - dmg); this.lastHurt = t; P.vel.x -= dx / d * (blocked ? 1.5 : 4.5); P.vel.z -= dz / d * (blocked ? 1.5 : 4.5); play(blocked ? 'block' : 'punch_heavy', 0.9); P.pulse(1, 70); emit('hp'); emit('hurt', blocked); if (S.hp <= 0) this._knockedOut(n.name); } } } }
    else if (n.state === 'strike') { if (n.st <= 0) { n.state = 'chase'; n.st = 0.7 + Math.random() * 0.6; } }
    else if (n.state === 'ko') { if (n.st <= 0) { n.state = 'idle'; n.hp = n.hpMax; av.setEmote(0); av.setName(n.name, n.role); p.set(n.hx, n.y, n.hz); } }
    av.speed = sp; av.grounded = true;
  },

  _remotes(dt) {
    const P = this.player, k = Math.min(1, dt * 12), t = this.time;
    this.remotes.forEach((r) => {
      if (!r.has) return; const av = r.av, p = av.root.position;
      const ox = p.x, oz = p.z; if (Math.abs(r.x - p.x) > 12 || Math.abs(r.z - p.z) > 12) p.set(r.x, r.y, r.z); else { p.x += (r.x - p.x) * k; p.y += (r.y - p.y) * k; p.z += (r.z - p.z) * k; }
      av.root.rotation.y += angDiff(av.root.rotation.y, r.yaw) * k; av.headYaw = r.hy; av.headPitch = r.hp;
      av.speed = av.speed * 0.8 + Math.hypot(p.x - ox, p.z - oz) / Math.max(dt, 0.001) * 0.2; av.grounded = !!(r.flags & 1); av.blocking = !!(r.flags & 2);
      const dx = p.x - P.pos.x, dz = p.z - P.pos.z, d = Math.hypot(dx, dz); r.near = d < perf.animDist; av.root.visible = d < perf.drawDist; if (av.tag) av.tag.visible = d < perf.tagDist;
      av.update(dt, !r.near);
      if (d > 2.6) return;
      // socos (somente na zona de luta) e carinho (fora dela)
      if (P.fightZone && (r.flags & 4) && S.hp > 0) {
        this._handHits(p.x, p.y + 0.62, p.z, 0.4, 1.6, (h, i) => { if (t - r.hit[i] < 0.32) return; r.hit[i] = t; const dmg = this._damage(h), l = Math.hypot(h.vel.x, h.vel.z) || 1; net.send('hit', { to: r.id, d: dmg, x: h.vel.x / l, z: h.vel.z / l }); play('punch', 0.8); P.pulse(1, 40); });
        this._handHits(p.x, p.y + 0.98, p.z, 0.34, 1.6, (h, i) => { if (t - r.hit[i] < 0.32) return; r.hit[i] = t; const dmg = Math.round(this._damage(h) * 1.3), l = Math.hypot(h.vel.x, h.vel.z) || 1; net.send('hit', { to: r.id, d: dmg, x: h.vel.x / l, z: h.vel.z / l }); play('punch_heavy', 0.8); P.pulse(1, 50); });
      } else if (!P.fightZone && t - r.patT > 4) {
        for (const h of P.hands) { const dy = h.target.y - (p.y + 1.15); if (h.speed < 1.4 && h.speed > 0.15 && Math.abs(dy) < 0.22 && Math.hypot(h.target.x - p.x, h.target.z - p.z) < 0.34) { r.patT = t; net.send('pat', { to: r.id }); purr(0.7); S.stat('pat'); this.fx.burst(p.x, p.y + 1.4, p.z, 0xff6090, 6, 1.2, -1); S.toast('Você fez carinho em ' + r.meta.name + ' ❤', '#ff9ab8'); break; } }
      }
    });
  },
  _fishing(dt) {
    const f = this.fishing; if (!f) return; const P = this.player, wy = this.world.waterY; f.t += dt;
    if (Math.hypot(P.pos.x - f.x, P.pos.z - f.z) > 26) { this._reel(false); return; }
    if (f.phase === 'wait') { this.bobber.position.y = wy + 0.04 + Math.sin(f.t * 3) * 0.02; if (f.t > f.biteAt) { f.phase = 'bite'; f.t = 0; play('bite', 1); play('splash', 0.5); P.pulse(1, 120); this.fx.burst(f.x, wy + 0.1, f.z, 0xffffff, 8, 2); } else if (f.t > 0.8 && P.flickUp > 3.2) { S.toast('Cedo demais!', '#ff9a8a'); this._reel(false); return; } }
    else { this.bobber.position.y = wy - 0.12 + Math.sin(f.t * 30) * 0.03; if (P.flickUp > 1.6) { this._reel(false); return; } if (f.t > 1.3) { S.toast('O peixe escapou...', '#ff9a8a'); f.phase = 'wait'; f.t = 0; f.biteAt = 2 + Math.random() * 4; } }
    const a = this.line.geometry.attributes.position.array, h = P.hands[0].pos; a[0] = h.x; a[1] = h.y; a[2] = h.z; a[3] = f.x; a[4] = this.bobber.position.y; a[5] = f.z; this.line.geometry.attributes.position.needsUpdate = true;
  },
  // eventos mundiais (determinísticos pelo relógio sincronizado)
  _events(dt, now) {
    this.evT -= dt; if (this.evT > 0) return; this.evT = 2; S.rollDaily();
    const ev = currentEvent(now), E = this.E, here = ev.active && ev.map === this.mapId;
    if (ev.active && this.annBlock !== ev.block) { this.annBlock = ev.block; S.toast('🌟 Evento: ' + ev.ev.n + ' — ' + ev.ev.d + ' ' + MAPS[ev.map].name + '!', '#ffe070'); play('event', 0.6); emit('event'); }
    if (here && this.evBlock !== ev.block) {
      this.evBlock = ev.block; const r = rng(ev.block * 7919 + hashStr(this.mapId)), sp = this.def.spawn;
      const spot = () => { for (let i = 0; i < 30; i++) { const a = r() * 6.28, d = 8 + r() * 26, x = sp[0] + Math.cos(a) * d, z = sp[1] + Math.sin(a) * d; if (Math.abs(x) < this.world.half - 6 && Math.abs(z) < this.world.half - 6 && this.world.heightAt(x, z) > this.world.waterY + 0.2) return [x, z]; } return [sp[0] + 4, sp[1] + 4]; };
      if (ev.ev.id === 'crystal') for (const o of E.ores) if (o.ev) { const s = spot(); o.x = s[0]; o.z = s[1]; o.y = this.world.heightAt(o.x, o.z); o.alive = true; o.hp = ORES.star.hp; this._oreVis(o); this.fx.burst(o.x, o.y + 1, o.z, 0xfff27a, 10, 3); }
      if (ev.ev.id === 'goldchest' && !S.chestOpen('ev' + ev.block)) { const c = E.chests[E.chests.length - 1], s = spot(); c.x = s[0]; c.z = s[1]; c.y = this.world.heightAt(c.x, c.z); c.hidden = false; this._chestVis(c); }
    } else if (!here && this.evBlock !== -1) { this.evBlock = -1; for (const o of E.ores) if (o.ev && o.alive) { o.alive = false; this._oreVis(o); } const c = E.chests[E.chests.length - 1]; if (!c.hidden) { c.hidden = true; this._chestVis(c); } }
  }
};
