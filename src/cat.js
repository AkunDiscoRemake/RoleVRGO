import * as THREE from 'three';
import { clamp } from './util.js';

// Gato low-poly procedural: UMA malha por gato; pernas, cabeça e cauda são
// animadas no vertex shader (atributos aPart/aPivot), então cada gato custa 1 draw call.
export const PATTERNS = ['Liso', 'Barriga clara', 'Siamês', 'Tigrado', 'Malhado', 'Meias'];
export const HATS = ['Nenhum', 'Cartola', 'Coroa', 'Laço', 'Chapéu de palha', 'Capacete de minerador', 'Gorro', 'Bandana pirata', 'Chapéu de mago', 'Auréola'];
export const FUR_COLORS = ['#f2a65a', '#3b3b45', '#f5f1e8', '#8a8f98', '#c9793d', '#6b4a36', '#e8c27a', '#b8b0d8', '#7fb7c9', '#e39ab0', '#5d8f5a', '#d9d9d9'];
export const EYE_COLORS = ['#58c26a', '#4aa3e0', '#e0b030', '#c86a2a', '#9b6ad6', '#e0e0e0'];
export const EMOTES = [
  { id: 1, name: 'Acenar', icon: '👋' }, { id: 2, name: 'Dançar', icon: '💃' }, { id: 3, name: 'Sentar', icon: '🪑' }, { id: 4, name: 'Dormir', icon: '💤' },
  { id: 5, name: 'Rir', icon: '😹' }, { id: 6, name: 'Coração', icon: '❤' }, { id: 7, name: 'Miar', icon: '🐱' }, { id: 8, name: 'Comemorar', icon: '🎉' }, { id: 9, name: 'Bravo', icon: '😾' }
];
export function defaultLook(seed) {
  const r = seed == null ? Math.random() : seed;
  return { fur: FUR_COLORS[Math.floor(r * FUR_COLORS.length) % FUR_COLORS.length], fur2: '#f5f1e8', pattern: Math.floor(r * 97) % PATTERNS.length, eyes: EYE_COLORS[Math.floor(r * 31) % EYE_COLORS.length], hat: 0 };
}
export function cleanLook(l) {
  const d = defaultLook(0.3); l = l || {};
  const hex = (v, f) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : f);
  return { fur: hex(l.fur, d.fur), fur2: hex(l.fur2, d.fur2), pattern: clamp(l.pattern | 0, 0, PATTERNS.length - 1), eyes: hex(l.eyes, d.eyes), hat: clamp(l.hat | 0, 0, HATS.length - 1) };
}

const _c = new THREE.Color();
function rgb(hex, mul) { _c.set(hex); const m = mul == null ? 1 : mul; return [Math.min(255, _c.r * 255 * m), Math.min(255, _c.g * 255 * m), Math.min(255, _c.b * 255 * m)]; }

class Builder {
  constructor() { this.pos = []; this.nrm = []; this.col = []; this.part = []; this.piv = []; this.idx = []; }
  add(geo, c, part, pivot, weight) {
    const g = geo.index ? geo.toNonIndexed() : geo; const p = g.attributes.position, n = g.attributes.normal, base = this.pos.length / 3;
    for (let i = 0; i < p.count; i++) {
      this.pos.push(p.getX(i), p.getY(i), p.getZ(i)); this.nrm.push(n.getX(i), n.getY(i), n.getZ(i)); this.col.push(c[0], c[1], c[2]);
      let w = weight == null ? 1 : weight;
      if (weight === 'tail') w = clamp((p.getZ(i) - pivot[2]) / 0.34 + (p.getY(i) - pivot[1]) / 0.5, 0, 1.4);
      this.part.push(part, w); this.piv.push(pivot[0], pivot[1], pivot[2]); this.idx.push(base + i);
    }
    geo.dispose(); if (g !== geo) g.dispose();
  }
  box(w, h, d, x, y, z, c, part, pivot, weight, rx, rz) {
    const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); g.translate(x, y, z); this.add(g, c, part || 0, pivot || [0, 0, 0], weight);
  }
  cone(r, h, seg, x, y, z, c, part, pivot, ry) { const g = new THREE.ConeGeometry(r, h, seg); if (ry) g.rotateY(ry); g.translate(x, y, z); this.add(g, c, part || 0, pivot || [0, 0, 0]); }
  cyl(rt, rb, h, seg, x, y, z, c, part, pivot) { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(x, y, z); this.add(g, c, part || 0, pivot || [0, 0, 0]); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.nrm), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(this.col), 3, true));
    g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(this.part), 2));
    g.setAttribute('aPivot', new THREE.BufferAttribute(new Float32Array(this.piv), 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.6, 0), 1.1);
    return g;
  }
}

// O gato olha para -Z. Partes: 0 tronco, 1 cabeça, 2 perna esq., 3 perna dir., 4 cauda.
export function buildCatGeometry(look) {
  look = cleanLook(look);
  const b = new Builder(), pt = look.pattern;
  const fur = rgb(look.fur), dark = rgb(look.fur, 0.72), f2 = rgb(look.fur2), pink = [236, 140, 160], eye = rgb(look.eyes), black = [30, 28, 34];
  const legC = pt === 2 ? rgb(look.fur2, 0.55) : fur, pawC = pt === 1 || pt === 5 ? f2 : pt === 2 ? rgb(look.fur2, 0.45) : dark;
  const tailC = pt === 2 ? rgb(look.fur2, 0.55) : fur, earC = pt === 2 ? rgb(look.fur2, 0.55) : fur;
  const NECK = [0, 0.74, 0];
  // tronco
  b.box(0.36, 0.42, 0.28, 0, 0.53, 0, fur, 0);
  if (pt === 1) b.box(0.24, 0.3, 0.02, 0, 0.5, -0.145, f2, 0);
  if (pt === 3) for (let i = 0; i < 3; i++) b.box(0.37, 0.045, 0.2, 0, 0.42 + i * 0.11, 0.05, dark, 0);
  if (pt === 4) { b.box(0.16, 0.16, 0.02, 0.1, 0.6, 0.145, f2, 0); b.box(0.02, 0.18, 0.14, 0.185, 0.5, -0.02, rgb('#3b3b45'), 0); b.box(0.02, 0.14, 0.12, -0.185, 0.58, 0.04, f2, 0); }
  // coleira
  b.box(0.3, 0.035, 0.26, 0, 0.745, 0, [200, 60, 70], 0); b.box(0.05, 0.05, 0.03, 0, 0.72, -0.14, [240, 200, 60], 0);
  // cabeça
  b.box(0.44, 0.36, 0.36, 0, 0.94, -0.02, fur, 1, NECK);
  b.box(0.2, 0.12, 0.05, 0, 0.86, -0.21, pt === 1 || pt === 4 ? f2 : pt === 2 ? rgb(look.fur2, 0.5) : rgb(look.fur, 1.12), 1, NECK);
  b.box(0.05, 0.035, 0.02, 0, 0.9, -0.24, pink, 1, NECK);
  b.box(0.075, 0.09, 0.02, -0.11, 0.99, -0.205, eye, 1, NECK); b.box(0.075, 0.09, 0.02, 0.11, 0.99, -0.205, eye, 1, NECK);
  b.box(0.03, 0.075, 0.02, -0.11, 0.99, -0.215, black, 1, NECK); b.box(0.03, 0.075, 0.02, 0.11, 0.99, -0.215, black, 1, NECK);
  if (pt === 3) { b.box(0.05, 0.02, 0.2, -0.09, 1.125, -0.05, dark, 1, NECK); b.box(0.05, 0.02, 0.2, 0, 1.125, -0.05, dark, 1, NECK); b.box(0.05, 0.02, 0.2, 0.09, 1.125, -0.05, dark, 1, NECK); }
  if (pt === 4) b.box(0.2, 0.2, 0.02, 0.12, 1.02, 0.165, rgb('#3b3b45'), 1, NECK);
  // orelhas
  b.cone(0.085, 0.16, 4, -0.14, 1.19, -0.02, earC, 1, NECK, Math.PI / 4); b.cone(0.085, 0.16, 4, 0.14, 1.19, -0.02, earC, 1, NECK, Math.PI / 4);
  b.cone(0.045, 0.1, 4, -0.14, 1.17, -0.05, pink, 1, NECK, Math.PI / 4); b.cone(0.045, 0.1, 4, 0.14, 1.17, -0.05, pink, 1, NECK, Math.PI / 4);
  // bigodes
  b.box(0.16, 0.008, 0.008, -0.2, 0.88, -0.2, [245, 245, 245], 1, NECK); b.box(0.16, 0.008, 0.008, 0.2, 0.88, -0.2, [245, 245, 245], 1, NECK);
  // pernas (patas traseiras; sem braços — as mãos são bolinhas flutuantes)
  const HL = [-0.1, 0.34, 0], HR = [0.1, 0.34, 0];
  b.box(0.13, 0.26, 0.15, -0.1, 0.21, 0, legC, 2, HL); b.box(0.15, 0.09, 0.2, -0.1, 0.045, -0.03, pawC, 2, HL);
  b.box(0.13, 0.26, 0.15, 0.1, 0.21, 0, legC, 3, HR); b.box(0.15, 0.09, 0.2, 0.1, 0.045, -0.03, pawC, 3, HR);
  // cauda
  const TB = [0, 0.4, 0.13];
  b.box(0.07, 0.07, 0.2, 0, 0.42, 0.22, tailC, 4, TB, 'tail'); b.box(0.07, 0.2, 0.07, 0, 0.52, 0.34, tailC, 4, TB, 'tail');
  b.box(0.075, 0.14, 0.075, 0, 0.68, 0.36, pt === 3 || pt === 2 ? dark : pt === 1 || pt === 5 ? f2 : tailC, 4, TB, 'tail');
  // chapéus (presos à cabeça)
  const H = look.hat, top = 1.12;
  if (H === 1) { b.cyl(0.2, 0.2, 0.02, 10, 0, top + 0.01, -0.02, [28, 28, 34], 1, NECK); b.cyl(0.12, 0.12, 0.2, 10, 0, top + 0.11, -0.02, [28, 28, 34], 1, NECK); b.cyl(0.123, 0.123, 0.04, 10, 0, top + 0.05, -0.02, [190, 40, 50], 1, NECK); }
  else if (H === 2) { b.cyl(0.13, 0.12, 0.07, 8, 0, top + 0.035, -0.02, [245, 200, 50], 1, NECK); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; b.cone(0.035, 0.08, 4, Math.cos(a) * 0.1, top + 0.1, -0.02 + Math.sin(a) * 0.1, [245, 200, 50], 1, NECK); } b.box(0.04, 0.04, 0.02, 0, top + 0.04, -0.15, [220, 50, 70], 1, NECK); }
  else if (H === 3) { b.box(0.1, 0.09, 0.04, -0.08, top + 0.04, -0.02, [235, 90, 150], 1, NECK); b.box(0.1, 0.09, 0.04, 0.08, top + 0.04, -0.02, [235, 90, 150], 1, NECK); b.box(0.05, 0.05, 0.05, 0, top + 0.04, -0.02, [200, 60, 120], 1, NECK); }
  else if (H === 4) { b.cyl(0.3, 0.3, 0.015, 10, 0, top + 0.01, -0.02, [225, 195, 120], 1, NECK); b.cyl(0.13, 0.15, 0.1, 10, 0, top + 0.06, -0.02, [225, 195, 120], 1, NECK); b.cyl(0.152, 0.152, 0.03, 10, 0, top + 0.03, -0.02, [150, 90, 50], 1, NECK); }
  else if (H === 5) { b.cyl(0.19, 0.22, 0.1, 8, 0, top + 0.04, -0.02, [240, 190, 40], 1, NECK); b.box(0.07, 0.06, 0.05, 0, top + 0.05, -0.23, [255, 250, 200], 1, NECK); }
  else if (H === 6) { b.cyl(0.19, 0.22, 0.07, 8, 0, top + 0.03, -0.02, [245, 245, 245], 1, NECK); b.cone(0.18, 0.24, 8, 0, top + 0.18, -0.02, [200, 50, 60], 1, NECK); b.box(0.06, 0.06, 0.06, 0, top + 0.32, -0.02, [245, 245, 245], 1, NECK); }
  else if (H === 7) { b.box(0.45, 0.08, 0.37, 0, top - 0.02, -0.02, [190, 40, 50], 1, NECK); b.box(0.06, 0.12, 0.04, 0.2, top - 0.08, 0.17, [190, 40, 50], 1, NECK); }
  else if (H === 8) { b.cyl(0.27, 0.27, 0.015, 10, 0, top + 0.01, -0.02, [80, 60, 160], 1, NECK); b.cone(0.16, 0.36, 8, 0, top + 0.19, -0.02, [80, 60, 160], 1, NECK); b.box(0.05, 0.05, 0.02, 0, top + 0.1, -0.17, [245, 215, 80], 1, NECK); }
  else if (H === 9) { const g = new THREE.TorusGeometry(0.13, 0.018, 4, 10); g.rotateX(Math.PI / 2); g.translate(0, top + 0.16, -0.02); b.add(g, [255, 235, 120], 1, NECK); }
  return b.build();
}

function makeCatMaterial() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  const u = { uLegs: { value: new THREE.Vector2() }, uHead: { value: new THREE.Vector2() }, uTail: { value: 0 } };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uLegs = u.uLegs; sh.uniforms.uHead = u.uHead; sh.uniforms.uTail = u.uTail;
    sh.vertexShader = 'attribute vec2 aPart;\nattribute vec3 aPivot;\nuniform vec2 uLegs;\nuniform vec2 uHead;\nuniform float uTail;\n' + sh.vertexShader.replace('#include <begin_vertex>', [
      '#include <begin_vertex>',
      'vec3 pv = transformed - aPivot;',
      'if (aPart.x > 0.5) {',
      '  if (aPart.x < 1.5) { float c = cos(uHead.y), s = sin(uHead.y); pv = vec3(pv.x, pv.y * c - pv.z * s, pv.y * s + pv.z * c); c = cos(uHead.x); s = sin(uHead.x); pv = vec3(pv.x * c + pv.z * s, pv.y, -pv.x * s + pv.z * c); }',
      '  else if (aPart.x < 3.5) { float a = aPart.x < 2.5 ? uLegs.x : uLegs.y; float c = cos(a), s = sin(a); pv = vec3(pv.x, pv.y * c - pv.z * s, pv.y * s + pv.z * c); }',
      '  else { float a = uTail * aPart.y; float c = cos(a), s = sin(a); pv = vec3(pv.x * c + pv.z * s, pv.y, -pv.x * s + pv.z * c); }',
      '}',
      'transformed = pv + aPivot;'
    ].join('\n'));
  };
  m.customProgramCacheKey = () => 'rvcat';
  return m;
}

// ---------- pool compartilhado de bolinhas-mão e sombras (2 draw calls para todos os gatos) ----------
export class HandPool {
  constructor(scene, max) {
    this.max = max; this.n = 0; this.sn = 0;
    const g = new THREE.IcosahedronGeometry(1, 1);
    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial(), max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.frustumCulled = false; this.mesh.count = 0;
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1)); this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
    const sg = new THREE.CircleGeometry(1, 10); sg.rotateX(-Math.PI / 2);
    this.shadow = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }), max);
    this.shadow.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.shadow.frustumCulled = false; this.shadow.count = 0; this.shadow.renderOrder = 2;
    scene.add(this.shadow);
    this._m = new THREE.Matrix4(); this._c = new THREE.Color();
  }
  begin() { this.n = 0; this.sn = 0; }
  hand(x, y, z, r, color) {
    if (this.n >= this.max) return;
    this._m.makeScale(r, r, r).setPosition(x, y, z); this.mesh.setMatrixAt(this.n, this._m); this.mesh.setColorAt(this.n, this._c.set(color)); this.n++;
  }
  blob(x, y, z, r) { if (this.sn >= this.max) return; this._m.makeScale(r, 1, r).setPosition(x, y + 0.03, z); this.shadow.setMatrixAt(this.sn++, this._m); }
  end(showShadows) {
    this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.shadow.count = showShadows ? this.sn : 0; this.shadow.instanceMatrix.needsUpdate = true;
  }
}

// ---------- avatar ----------
export class CatAvatar {
  constructor(look, name, opts) {
    opts = opts || {};
    this.look = cleanLook(look); this.name = name || 'Gato'; this.isNPC = !!opts.npc; this.tagColor = opts.tagColor || '#ffffff';
    this.root = new THREE.Group();
    this.mat = makeCatMaterial(); this.u = this.mat.userData.u;
    this.mesh = new THREE.Mesh(buildCatGeometry(this.look), this.mat); this.mesh.castShadow = true;
    this.root.add(this.mesh);
    this.scale = opts.scale || 1; this.root.scale.setScalar(this.scale);
    this.h1 = new THREE.Vector3(); this.h2 = new THREE.Vector3(); this.handsVisible = true;
    this.t = Math.random() * 10; this.walk = 0; this.emote = 0; this.emoteT = 0; this.bubble = ''; this.bubbleT = 0; this.sub = opts.sub || '';
    this.speed = 0; this.grounded = true; this.blocking = false; this.headYaw = 0; this.headPitch = 0; this.flash = 0;
    this._tagKey = ''; this.tag = null;
    if (!opts.noTag) this._makeTag();
  }
  _makeTag() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 96; this.tagCanvas = c;
    const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
    this.tag.scale.set(1.3, 0.49, 1); this.tag.position.y = 1.62; this.tag.renderOrder = 5; this.root.add(this.tag); this.drawTag();
  }
  drawTag() {
    if (!this.tag) return;
    const key = this.name + '|' + this.sub + '|' + this.bubble + '|' + this.tagColor; if (key === this._tagKey) return; this._tagKey = key;
    const g = this.tagCanvas.getContext('2d'); g.clearRect(0, 0, 256, 96); g.textAlign = 'center'; g.textBaseline = 'middle';
    if (this.bubble) {
      g.font = 'bold 22px sans-serif'; let txt = this.bubble; if (txt.length > 22) txt = txt.slice(0, 21) + '…';
      const w = Math.min(250, g.measureText(txt).width + 22);
      g.fillStyle = 'rgba(255,255,255,0.94)'; roundRect(g, 128 - w / 2, 2, w, 36, 12); g.fill(); g.fillStyle = '#222'; g.fillText(txt, 128, 21);
    }
    g.font = 'bold 24px sans-serif'; const w = Math.min(250, g.measureText(this.name).width + 20);
    g.fillStyle = 'rgba(20,18,30,0.62)'; roundRect(g, 128 - w / 2, 42, w, 30, 10); g.fill();
    g.fillStyle = this.tagColor; g.fillText(this.name, 128, 58);
    if (this.sub) { g.font = 'bold 16px sans-serif'; g.fillStyle = this.isNPC ? '#ffd76a' : '#bfe6ff'; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 3; g.strokeText(this.sub, 128, 84); g.fillText(this.sub, 128, 84); }
    this.tag.material.map.needsUpdate = true;
  }
  setLook(look) { this.look = cleanLook(look); this.mesh.geometry.dispose(); this.mesh.geometry = buildCatGeometry(this.look); }
  setName(name, sub) { this.name = name; if (sub != null) this.sub = sub; this.drawTag(); }
  say(text, secs) { this.bubble = text; this.bubbleT = secs || 5; this.drawTag(); }
  setEmote(id) { this.emote = id; this.emoteT = 0; const e = EMOTES.find((x) => x.id === id); if (e && id !== 3 && id !== 4) this.say(e.icon, 2.5); }
  // anima; lod=true pula detalhes (gatos distantes)
  update(dt, lod) {
    this.t += dt; this.emoteT += dt;
    if (this.bubbleT > 0) { this.bubbleT -= dt; if (this.bubbleT <= 0) { this.bubble = ''; this.drawTag(); } }
    if (lod) return;
    const u = this.u, m = this.mesh, sp = Math.min(this.speed, 5);
    this.walk += dt * (4 + sp * 3.2) * (sp > 0.2 && this.grounded ? 1 : 0);
    let lL = 0, lR = 0, bob = 0, tilt = 0, sway = 0, yoff = 0, tail = Math.sin(this.t * 1.7) * 0.5, hy = this.headYaw, hp = this.headPitch;
    if (!this.grounded) { lL = 0.5; lR = -0.35; tail = Math.sin(this.t * 9) * 0.7; }
    else if (sp > 0.2) { const a = Math.sin(this.walk) * Math.min(0.9, 0.35 + sp * 0.2); lL = a; lR = -a; bob = Math.abs(Math.cos(this.walk)) * 0.035; tilt = -Math.min(0.2, sp * 0.04); }
    const e = this.emote, et = this.emoteT;
    if (e === 2) { sway = Math.sin(et * 7) * 0.22; bob = Math.abs(Math.sin(et * 7)) * 0.09; lL = Math.sin(et * 7) * 0.5; lR = -lL; tail = Math.sin(et * 10); hy += Math.sin(et * 3.5) * 0.4; }
    else if (e === 3) { yoff = -0.2; lL = lR = -1.35; tail = Math.sin(this.t * 1.2) * 0.4; }
    else if (e === 4) { yoff = -0.42; sway = 1.45; lL = lR = -0.3; tail = 0.2; hp = 0.2; }
    else if (e === 5) { bob = Math.abs(Math.sin(et * 16)) * 0.05; hp = -0.25 + Math.sin(et * 16) * 0.1; }
    else if (e === 8) { bob = Math.abs(Math.sin(et * 6)) * 0.3; lL = lR = 0.4; tail = Math.sin(et * 12); }
    else if (e === 9) { hp = 0.2; tail = Math.sin(et * 20) * 0.9; sway = Math.sin(et * 30) * 0.03; }
    else if (e === 7) { hp = -0.3; }
    if (this.blocking) { tilt = 0.12; hp += 0.1; }
    u.uLegs.value.set(lL, lR); u.uHead.value.set(clamp(hy, -1.2, 1.2), clamp(hp, -0.9, 0.9)); u.uTail.value = tail;
    m.position.y = bob + yoff; m.rotation.x = tilt; m.rotation.z = sway;
    if (this.flash > 0) { this.flash -= dt; const f = Math.max(0, this.flash) * 3; this.mat.emissive.setRGB(f, f * 0.25, f * 0.2); }
  }
  dispose() { this.mesh.geometry.dispose(); this.mat.dispose(); if (this.tag) { this.tag.material.map.dispose(); this.tag.material.dispose(); } if (this.root.parent) this.root.parent.remove(this.root); }
}
export function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
