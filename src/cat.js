import * as THREE from 'three';
import { clamp } from './util.js';

// Gato low-poly procedural: UMA malha por gato; pernas, cabeça e cauda são
// animadas no vertex shader (atributos aPart/aPivot), então cada gato custa 1 draw call.
export const PATTERNS = ['Liso', 'Barriga clara', 'Siamês', 'Tigrado', 'Malhado', 'Meias'];
export const HATS = ['Nenhum', 'Cartola', 'Coroa', 'Laço', 'Chapéu de palha', 'Capacete de minerador', 'Gorro', 'Bandana pirata', 'Chapéu de mago', 'Auréola', 'Chapéu de chef', 'Quepe de policial', 'Capacete de bombeiro'];
export const FUR_COLORS = ['#f2a65a', '#3b3b45', '#f5f1e8', '#8a8f98', '#c9793d', '#6b4a36', '#e8c27a', '#b8b0d8', '#7fb7c9', '#e39ab0', '#5d8f5a', '#d9d9d9'];
export const EYE_COLORS = ['#58c26a', '#4aa3e0', '#e0b030', '#c86a2a', '#9b6ad6', '#e0e0e0'];
// idades para roleplay: tamanho geral e proporção da cabeça (filhote = cabeção fofo)
export const AGES = ['Adulto', 'Adolescente', 'Filhote'];
export const AGE_SCALE = [1, 0.8, 0.6], AGE_HEAD = [1, 1.12, 1.32], AGE_EYE = [1, 0.86, 0.68];
export const OUTFITS = ['Nenhuma', 'Suéter de flocos', 'Suéter listrado', 'Suéter natalino', 'Moletom', 'Camiseta', 'Vestido', 'Macacão', 'Jaleco', 'Uniforme escolar', 'Pijama', 'Avental de chef', 'Uniforme policial', 'Uniforme de bombeiro', 'Avental de vendedor'];
export const LASERS = [['Nenhum', null], ['Rosa', [255, 70, 220]], ['Azul', [70, 160, 255]], ['Verde', [90, 255, 120]], ['Vermelho', [255, 60, 60]], ['Dourado', [255, 215, 80]]];
// avatares prontos (o Trio da Ceia é um easter egg: os gatos natalinos de suéter e olhos de laser)
export const PRESETS = [
  { n: '🎄 Laranjinha da Ceia', egg: 1, look: { fur: '#e09a5a', fur2: '#f5f1e8', pattern: 3, eyes: '#e0b030', hat: 6, acc: 0, age: 0, outfit: 1, laser: 1 } },
  { n: '🎄 Frajola da Ceia', egg: 1, look: { fur: '#2a2a32', fur2: '#f5f1e8', pattern: 1, eyes: '#4aa3e0', hat: 6, acc: 0, age: 0, outfit: 2, laser: 2 } },
  { n: '🎄 Rajado da Ceia', egg: 1, look: { fur: '#9a968e', fur2: '#e8e4da', pattern: 3, eyes: '#58c26a', hat: 6, acc: 0, age: 0, outfit: 3, laser: 3 } },
  { n: '🍼 Filhote Laranja', look: { fur: '#f2a65a', fur2: '#f5f1e8', pattern: 1, eyes: '#4aa3e0', hat: 0, acc: 0, age: 2, outfit: 10, laser: 0 } },
  { n: '🍼 Filhote Siamês', look: { fur: '#f5f1e8', fur2: '#6b4a36', pattern: 2, eyes: '#4aa3e0', hat: 0, acc: 0, age: 2, outfit: 0, laser: 0 } },
  { n: '🎒 Adolescente Estudante', look: { fur: '#8a8f98', fur2: '#f5f1e8', pattern: 3, eyes: '#58c26a', hat: 0, acc: 0, age: 1, outfit: 9, laser: 0 } },
  { n: '🛹 Adolescente de Moletom', look: { fur: '#3b3b45', fur2: '#f5f1e8', pattern: 5, eyes: '#e0b030', hat: 0, acc: 0, age: 1, outfit: 4, laser: 0 } },
  { n: '👗 Mamãe Gata', look: { fur: '#e39ab0', fur2: '#f5f1e8', pattern: 1, eyes: '#9b6ad6', hat: 3, acc: 0, age: 0, outfit: 6, laser: 0 } },
  { n: '👔 Papai Gato', look: { fur: '#6b4a36', fur2: '#e8c27a', pattern: 4, eyes: '#c86a2a', hat: 0, acc: 0, age: 0, outfit: 4, laser: 0 } },
  { n: '🩺 Doutor Gato', look: { fur: '#d9d9d9', fur2: '#3b3b45', pattern: 4, eyes: '#4aa3e0', hat: 0, acc: 0, age: 0, outfit: 8, laser: 0 } },
  { n: '🧰 Gato Fazendeiro', look: { fur: '#c9793d', fur2: '#f5f1e8', pattern: 3, eyes: '#58c26a', hat: 4, acc: 0, age: 0, outfit: 7, laser: 0 } }
];
export const EMOTES = [
  { id: 1, name: 'Acenar', icon: '👋' }, { id: 2, name: 'Dançar', icon: '💃' }, { id: 3, name: 'Sentar', icon: '🪑' }, { id: 4, name: 'Dormir', icon: '💤' },
  { id: 5, name: 'Rir', icon: '😹' }, { id: 6, name: 'Coração', icon: '❤' }, { id: 7, name: 'Miar', icon: '🐱' }, { id: 8, name: 'Comemorar', icon: '🎉' }, { id: 9, name: 'Bravo', icon: '😾' },
  { id: 10, name: 'Girar', icon: '🌀' }, { id: 11, name: 'Reverência', icon: '🙇' }, { id: 12, name: 'Robô', icon: '🤖' }
];
export function defaultLook(seed) {
  const r = seed == null ? Math.random() : seed;
  return { fur: FUR_COLORS[Math.floor(r * FUR_COLORS.length) % FUR_COLORS.length], fur2: '#f5f1e8', pattern: Math.floor(r * 97) % PATTERNS.length, eyes: EYE_COLORS[Math.floor(r * 31) % EYE_COLORS.length], hat: 0 };
}
export function cleanLook(l) {
  const d = defaultLook(0.3); l = l || {};
  const hex = (v, f) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : f);
  return { fur: hex(l.fur, d.fur), fur2: hex(l.fur2, d.fur2), pattern: clamp(l.pattern | 0, 0, PATTERNS.length - 1), eyes: hex(l.eyes, d.eyes), hat: clamp(l.hat | 0, 0, HATS.length - 1), acc: clamp(l.acc | 0, 0, 11), age: clamp(l.age | 0, 0, 2), outfit: clamp(l.outfit | 0, 0, OUTFITS.length - 1), laser: clamp(l.laser | 0, 0, LASERS.length - 1), inf: l.inf ? 1 : 0, angel: l.angel ? 1 : 0 };
}

const _c = new THREE.Color();
function rgb(hex, mul) { _c.set(hex); const m = mul == null ? 1 : mul; return [Math.min(255, _c.r * 255 * m), Math.min(255, _c.g * 255 * m), Math.min(255, _c.b * 255 * m)]; }

class Builder {
  constructor(hs) { this.hs = hs || 1; this.pos = []; this.nrm = []; this.col = []; this.part = []; this.piv = []; this.idx = []; }
  add(geo, c, part, pivot, weight) {
    const g = geo.index ? geo.toNonIndexed() : geo; const p = g.attributes.position, n = g.attributes.normal, base = this.pos.length / 3;
    for (let i = 0; i < p.count; i++) {
      if (this.hs !== 1 && (part === 1 || part === 5)) { const k = this.hs; this.pos.push(pivot[0] + (p.getX(i) - pivot[0]) * k, pivot[1] + (p.getY(i) - pivot[1]) * k, pivot[2] + (p.getZ(i) - pivot[2]) * k); } else this.pos.push(p.getX(i), p.getY(i), p.getZ(i)); this.nrm.push(n.getX(i), n.getY(i), n.getZ(i)); this.col.push(c[0], c[1], c[2]);
      let w = weight == null ? (this.accW || 1) : weight; // accW = 2 marca acessórios/roupas (derretem no infectado)
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
  build(big) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.nrm), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(this.col), 3, true));
    g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(this.part), 2));
    g.setAttribute('aPivot', new THREE.BufferAttribute(new Float32Array(this.piv), 3));
    g.boundingSphere = big ? new THREE.Sphere(new THREE.Vector3(0, 1.5, -2), 6) : new THREE.Sphere(new THREE.Vector3(0, 0.6, 0), 1.1);
    return g;
  }
}

// O gato olha para -Z. Partes: 0 tronco, 1 cabeça, 2 perna esq., 3 perna dir., 4 cauda.
function sick(hex, k) { const c = rgb(hex); const m = k == null ? 0.55 : k; return '#' + [0, 1, 2].map((i) => Math.round(Math.min(255, (c[i] + ([125, 154, 90][i] - c[i]) * m) * 0.82)).toString(16).padStart(2, '0')).join(''); }
export const ANGEL_LOOK = { fur: '#e3a35e', fur2: '#f4e6cc', pattern: 3, eyes: '#b8a040', hat: 0, acc: 0, outfit: 0, laser: 0, age: 0 };
// asas e teclado do Gato-Anjo (malhas à parte para as asas baterem sem mexer no shader)
let _wingGeo = null, _kbGeo = null; const _angelMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x2a2418 });
function angelGeos() {
  if (_wingGeo) return; let b = new Builder();
  for (let i = 0; i < 5; i++) { const L = 0.5 - i * 0.07; b.box(L, 0.05, 0.11, L / 2, -i * 0.065, i * 0.012, i % 2 ? [236, 236, 244] : [255, 255, 255], 0, null, null, 0, -i * 0.13); }
  b.box(0.16, 0.05, 0.08, 0.5, 0.0, 0, [255, 236, 170], 0); _wingGeo = b.build(false);
  b = new Builder(); b.box(0.78, 0.06, 0.26, 0, 0, 0, [32, 32, 38], 0); b.box(0.72, 0.025, 0.13, 0, 0.04, 0.04, [248, 248, 248], 0);
  for (let i = 0; i < 13; i++) { if (i % 7 === 2 || i % 7 === 6) continue; b.box(0.03, 0.03, 0.07, -0.33 + i * 0.055, 0.06, 0.005, [20, 20, 22], 0); }
  b.box(0.18, 0.012, 0.07, -0.22, 0.04, -0.08, [70, 200, 120], 0); b.box(0.05, 0.03, 0.05, 0.25, 0.045, -0.08, [220, 70, 70], 0); _kbGeo = b.build(false);
}
export function buildCatGeometry(look, extra) {
  const burnt = !!(extra && extra.burnt); look = cleanLook(look); const angel = !!look.angel; if (angel) look = Object.assign({}, look, ANGEL_LOOK); // 😇 Gato-Anjo: sempre o laranja rajado de camisa azul do Keyboard Cat
  if (look.inf) look = Object.assign({}, look, { fur: sick(look.fur), fur2: sick(look.fur2, 0.4) }); // infectado: pelo doente
  const b = new Builder(AGE_HEAD[look.age]), pt = look.pattern, LZ = LASERS[look.laser][1];
  const fur = rgb(look.fur), dark = rgb(look.fur, 0.72), f2 = rgb(look.fur2), pink = [236, 140, 160], eye = rgb(look.eyes), black = [30, 28, 34];
  const legC = pt === 2 ? rgb(look.fur2, 0.55) : fur, pawC = pt === 1 || pt === 5 ? f2 : pt === 2 ? rgb(look.fur2, 0.45) : dark;
  const tailC = pt === 2 ? rgb(look.fur2, 0.55) : fur, earC = pt === 2 ? rgb(look.fur2, 0.55) : fur;
  const NECK = [0, 0.74, 0];
  // tronco
  b.box(0.36, 0.42, 0.28, 0, 0.53, 0, fur, 0);
  if (pt === 1) b.box(0.24, 0.3, 0.02, 0, 0.5, -0.145, f2, 0);
  if (pt === 3) for (let i = 0; i < 3; i++) b.box(0.37, 0.045, 0.2, 0, 0.42 + i * 0.11, 0.05, dark, 0);
  if (pt === 4) { b.box(0.16, 0.16, 0.02, 0.1, 0.6, 0.145, f2, 0); b.box(0.02, 0.18, 0.14, 0.185, 0.5, -0.02, rgb('#3b3b45'), 0); b.box(0.02, 0.14, 0.12, -0.185, 0.58, 0.04, f2, 0); }
  b.accW = 2; outfit(b, angel ? 15 : look.outfit); b.accW = 0;
  // coleira
  b.box(0.3, 0.035, 0.26, 0, 0.745, 0, [200, 60, 70], 0); b.box(0.05, 0.05, 0.03, 0, 0.72, -0.14, [240, 200, 60], 0);
  // cabeça
  b.box(0.44, 0.36, 0.36, 0, 0.94, -0.02, fur, 1, NECK);
  b.box(0.2, 0.12, 0.05, 0, 0.86, -0.21, pt === 1 || pt === 4 ? f2 : pt === 2 ? rgb(look.fur2, 0.5) : rgb(look.fur, 1.12), 1, NECK);
  b.box(0.05, 0.035, 0.02, 0, 0.9, -0.24, pink, 1, NECK);
  if (LZ) { // olhos de laser: olhos brilhando (parte 5 = acompanha a cabeça e não recebe sombra) + feixes
    b.box(0.09, 0.1, 0.02, -0.11, 0.99, -0.205, LZ, 5, NECK); b.box(0.09, 0.1, 0.02, 0.11, 0.99, -0.205, LZ, 5, NECK);
    for (const sx of [-1, 1]) { const L = 5, g = new THREE.BoxGeometry(0.035, 0.035, L); g.translate(0, 0, -L / 2); g.rotateX(0.42); g.rotateY(-sx * 0.32); g.translate(sx * 0.11, 0.99, -0.22); b.add(g, LZ, 5, NECK);
      const g2 = new THREE.BoxGeometry(0.012, 0.012, L); g2.translate(0, 0, -L / 2); g2.rotateX(0.42); g2.rotateY(-sx * 0.32); g2.translate(sx * 0.11, 0.99, -0.225); b.add(g2, [255, 255, 255], 5, NECK); }
  } else if (!look.inf) { b.box(0.075, 0.09, 0.02, -0.11, 0.99, -0.205, eye, 1, NECK); b.box(0.075, 0.09, 0.02, 0.11, 0.99, -0.205, eye, 1, NECK); }
  if (look.inf) { // ☢ sintomas: olhos brilhando em órbitas escuras, sobrancelhas de raiva, bocarra com dentes enormes, veias e baba tóxica
    const TOX = [70, 235, 35], DK = [22, 16, 22];
    for (const sx of [-1, 1]) { b.box(0.11, 0.12, 0.016, sx * 0.11, 0.985, -0.199, DK, 1, NECK); if (!LZ) b.box(0.075, 0.045, 0.02, sx * 0.11, 0.98, -0.21, TOX, 5, NECK); b.box(0.11, 0.028, 0.02, sx * 0.105, 1.055, -0.212, DK, 1, NECK, null, 0, sx * 0.45);
      b.box(0.012, 0.13, 0.012, sx * 0.2, 0.95, -0.2, [50, 95, 35], 1, NECK, null, 0, sx * 0.3); b.box(0.012, 0.09, 0.012, sx * 0.16, 1.07, -0.2, [50, 95, 35], 1, NECK, null, 0, -sx * 0.5); }
    b.box(0.26, 0.085, 0.022, 0, 0.86, -0.214, [70, 8, 18], 1, NECK);
    for (let i = 0; i < 7; i++) { const x = -0.11 + i * 0.0367, big = i === 1 || i === 5, L = big ? 0.22 : 0.1 + (i % 2) * 0.03; const g = new THREE.ConeGeometry(big ? 0.028 : 0.02, L, 4); g.rotateX(Math.PI); g.translate(x, 0.895 - L / 2, -0.23); b.add(g, [250, 248, 228], 1, NECK); }
    for (const sx of [-1, 1]) { const g = new THREE.ConeGeometry(0.022, 0.12, 4); g.translate(sx * 0.07, 0.84 + 0.06, -0.232); b.add(g, [245, 242, 220], 1, NECK); }
    b.box(0.016, 0.1, 0.016, 0.06, 0.76, -0.232, TOX, 5, NECK); b.box(0.014, 0.06, 0.014, -0.03, 0.78, -0.232, TOX, 5, NECK);
    b.box(0.06, 0.06, 0.012, 0.1, 0.6, -0.15, TOX, 5); b.box(0.045, 0.045, 0.012, -0.12, 0.48, -0.15, TOX, 5); b.box(0.012, 0.05, 0.05, 0.185, 0.55, 0.02, TOX, 5); b.box(0.05, 0.05, 0.012, -0.05, 0.62, 0.146, TOX, 5);
  }
  if (!LZ && !look.inf) { b.box(0.03, 0.075, 0.02, -0.11, 0.99, -0.215, black, 1, NECK); b.box(0.03, 0.075, 0.02, 0.11, 0.99, -0.215, black, 1, NECK); }
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
  b.accW = 2; const H = look.hat, top = 1.12;
  if (H === 1) { b.cyl(0.2, 0.2, 0.02, 10, 0, top + 0.01, -0.02, [28, 28, 34], 1, NECK); b.cyl(0.12, 0.12, 0.2, 10, 0, top + 0.11, -0.02, [28, 28, 34], 1, NECK); b.cyl(0.123, 0.123, 0.04, 10, 0, top + 0.05, -0.02, [190, 40, 50], 1, NECK); }
  else if (H === 2) { b.cyl(0.13, 0.12, 0.07, 8, 0, top + 0.035, -0.02, [245, 200, 50], 1, NECK); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; b.cone(0.035, 0.08, 4, Math.cos(a) * 0.1, top + 0.1, -0.02 + Math.sin(a) * 0.1, [245, 200, 50], 1, NECK); } b.box(0.04, 0.04, 0.02, 0, top + 0.04, -0.15, [220, 50, 70], 1, NECK); }
  else if (H === 3) { b.box(0.1, 0.09, 0.04, -0.08, top + 0.04, -0.02, [235, 90, 150], 1, NECK); b.box(0.1, 0.09, 0.04, 0.08, top + 0.04, -0.02, [235, 90, 150], 1, NECK); b.box(0.05, 0.05, 0.05, 0, top + 0.04, -0.02, [200, 60, 120], 1, NECK); }
  else if (H === 4) { b.cyl(0.3, 0.3, 0.015, 10, 0, top + 0.01, -0.02, [225, 195, 120], 1, NECK); b.cyl(0.13, 0.15, 0.1, 10, 0, top + 0.06, -0.02, [225, 195, 120], 1, NECK); b.cyl(0.152, 0.152, 0.03, 10, 0, top + 0.03, -0.02, [150, 90, 50], 1, NECK); }
  else if (H === 5) { b.cyl(0.19, 0.22, 0.1, 8, 0, top + 0.04, -0.02, [240, 190, 40], 1, NECK); b.box(0.07, 0.06, 0.05, 0, top + 0.05, -0.23, [255, 250, 200], 1, NECK); }
  else if (H === 6) { b.cyl(0.19, 0.22, 0.07, 8, 0, top + 0.03, -0.02, [245, 245, 245], 1, NECK); b.cone(0.18, 0.24, 8, 0, top + 0.18, -0.02, [200, 50, 60], 1, NECK); b.box(0.06, 0.06, 0.06, 0, top + 0.32, -0.02, [245, 245, 245], 1, NECK); }
  else if (H === 7) { b.box(0.45, 0.08, 0.37, 0, top - 0.02, -0.02, [190, 40, 50], 1, NECK); b.box(0.06, 0.12, 0.04, 0.2, top - 0.08, 0.17, [190, 40, 50], 1, NECK); }
  else if (H === 8) { b.cyl(0.27, 0.27, 0.015, 10, 0, top + 0.01, -0.02, [80, 60, 160], 1, NECK); b.cone(0.16, 0.36, 8, 0, top + 0.19, -0.02, [80, 60, 160], 1, NECK); b.box(0.05, 0.05, 0.02, 0, top + 0.1, -0.17, [245, 215, 80], 1, NECK); }
  else if (H === 10) { b.cyl(0.2, 0.2, 0.08, 10, 0, top + 0.04, -0.02, [245, 245, 248], 1, NECK); b.cyl(0.26, 0.2, 0.22, 10, 0, top + 0.19, -0.02, [250, 250, 252], 1, NECK); const g = new THREE.SphereGeometry(0.17, 8, 6); g.translate(0, top + 0.32, -0.02); b.add(g, [255, 255, 255], 1, NECK); }
  else if (H === 11) { b.cyl(0.2, 0.21, 0.12, 10, 0, top + 0.06, -0.02, [30, 40, 90], 1, NECK); b.cyl(0.23, 0.2, 0.06, 10, 0, top + 0.15, -0.02, [30, 40, 90], 1, NECK); b.box(0.3, 0.025, 0.14, 0, top + 0.01, -0.2, [20, 20, 26], 1, NECK); b.box(0.06, 0.06, 0.02, 0, top + 0.1, -0.215, [240, 200, 60], 1, NECK); }
  else if (H === 12) { b.cyl(0.21, 0.23, 0.17, 10, 0, top + 0.085, -0.02, [210, 40, 40], 1, NECK); b.cyl(0.3, 0.3, 0.025, 12, 0, top + 0.01, 0.0, [190, 30, 30], 1, NECK); b.box(0.1, 0.12, 0.03, 0, top + 0.1, -0.235, [245, 200, 60], 1, NECK); b.box(0.04, 0.2, 0.3, 0, top + 0.15, -0.02, [230, 50, 50], 1, NECK); }
  else if (H === 9) { const g = new THREE.TorusGeometry(0.13, 0.018, 4, 10); g.rotateX(Math.PI / 2); g.translate(0, top + 0.16, -0.02); b.add(g, [255, 235, 120], 1, NECK); }
  // acessórios conquistáveis
  const A = look.acc, gold = [245, 200, 50], white = [245, 245, 250];
  if (A === 1) { b.box(0.13, 0.08, 0.03, -0.11, 0.99, -0.225, [20, 20, 26], 1, NECK); b.box(0.13, 0.08, 0.03, 0.11, 0.99, -0.225, [20, 20, 26], 1, NECK); b.box(0.1, 0.02, 0.02, 0, 1.0, -0.225, [20, 20, 26], 1, NECK); b.box(0.02, 0.02, 0.2, -0.225, 1.0, -0.12, [20, 20, 26], 1, NECK); b.box(0.02, 0.02, 0.2, 0.225, 1.0, -0.12, [20, 20, 26], 1, NECK); }
  else if (A === 2) { b.box(0.4, 0.09, 0.32, 0, 0.75, 0, [220, 60, 60], 0); b.box(0.4, 0.03, 0.32, 0, 0.75, 0, white, 0); b.box(0.09, 0.26, 0.04, 0.1, 0.6, -0.17, [220, 60, 60], 0); b.box(0.09, 0.05, 0.045, 0.1, 0.5, -0.17, white, 0); }
  else if (A === 3) { b.box(0.09, 0.08, 0.03, -0.06, 0.73, -0.16, [200, 40, 60], 0); b.box(0.09, 0.08, 0.03, 0.06, 0.73, -0.16, [200, 40, 60], 0); b.box(0.04, 0.04, 0.04, 0, 0.73, -0.16, [120, 20, 40], 0); }
  else if (A === 4) { b.box(0.28, 0.3, 0.14, 0, 0.55, 0.2, [70, 130, 200], 0); b.box(0.2, 0.1, 0.03, 0, 0.5, 0.28, [240, 200, 60], 0); b.box(0.04, 0.3, 0.3, -0.13, 0.58, 0.02, [50, 90, 150], 0); b.box(0.04, 0.3, 0.3, 0.13, 0.58, 0.02, [50, 90, 150], 0); }
  else if (A === 5) { b.box(0.4, 0.5, 0.03, 0, 0.48, 0.17, [200, 40, 50], 0, null, null, 0.12); b.box(0.42, 0.05, 0.3, 0, 0.75, 0.01, [200, 40, 50], 0); b.box(0.06, 0.06, 0.03, 0, 0.74, -0.15, gold, 0); }
  else if (A === 6) { b.box(0.04, 0.14, 0.02, -0.03, 0.66, -0.15, [60, 100, 220], 0, null, null, 0, 0.3); b.box(0.04, 0.14, 0.02, 0.03, 0.66, -0.15, [220, 60, 60], 0, null, null, 0, -0.3); b.cyl(0.055, 0.055, 0.02, 8, 0, 0.56, -0.155, gold, 0); }
  else if (A === 7) { for (const sx of [-1, 1]) { const g1 = new THREE.SphereGeometry(0.16, 6, 5); g1.scale(1, 1.4, 0.25); g1.translate(sx * 0.22, 0.68, 0.2); b.add(g1, [190, 240, 255], 0, [0, 0, 0]); const g2 = new THREE.SphereGeometry(0.1, 6, 5); g2.scale(1, 1.2, 0.25); g2.translate(sx * 0.2, 0.46, 0.2); b.add(g2, [230, 250, 255], 0, [0, 0, 0]); } }
  else if (A === 8) { b.box(0.34, 0.12, 0.04, 0, 0.99, -0.225, [60, 190, 230], 1, NECK); b.box(0.36, 0.14, 0.02, 0, 0.99, -0.215, [240, 200, 40], 1, NECK); b.cyl(0.025, 0.025, 0.34, 6, 0.25, 1.08, -0.1, [240, 200, 40], 1, NECK); b.cyl(0.035, 0.035, 0.05, 6, 0.25, 1.26, -0.1, [240, 90, 60], 1, NECK); }
  else if (A === 9) { const g = new THREE.TorusGeometry(0.36, 0.03, 4, 12); g.rotateX(Math.PI / 2); g.translate(0, 0.5, 0); b.add(g, [255, 225, 90], 0, [0, 0, 0]); const g2 = new THREE.TorusGeometry(0.3, 0.02, 4, 12); g2.rotateX(Math.PI / 2); g2.translate(0, 0.28, 0); b.add(g2, [255, 240, 150], 0, [0, 0, 0]); }
  else if (A === 10) { for (let i = 0; i < 9; i++) { const a = -1.9 + i * 0.475; b.box(0.045, 0.045, 0.045, Math.sin(a) * 0.19, 0.71 - Math.cos(a) * 0.03, -Math.cos(a) * 0.16, white, 0); } }
  else if (A === 11) { b.cone(0.05, 0.2, 5, -0.2, 1.2, -0.12, [150, 30, 40], 1, NECK); b.cone(0.05, 0.2, 5, 0.2, 1.2, -0.12, [150, 30, 40], 1, NECK); }
  b.accW = 0;
  if (angel) { const g = new THREE.TorusGeometry(0.15, 0.022, 5, 16); g.rotateX(Math.PI / 2); g.translate(0, 1.36, -0.02); b.add(g, [255, 232, 120], 5, NECK); } // auréola brilhante
  if (burnt) { // ⚡ torrado: pelo arrepiado em espetos, olhos arregalados e brancos, fumacinha preta na boca
    const SOOT = [40, 34, 30], W = [255, 255, 250];
    for (let i = 0; i < 11; i++) { const a = -1.2 + i * 0.24, g = new THREE.ConeGeometry(0.035, 0.16 + (i % 3) * 0.05, 4); g.rotateZ(-a * 0.9); g.translate(Math.sin(a) * 0.2, 1.16 + Math.cos(a) * 0.05, -0.02 + ((i % 2) - 0.5) * 0.12); b.add(g, SOOT, 1, NECK); }
    for (const sx of [-1, 1]) { const g = new THREE.ConeGeometry(0.04, 0.14, 4); g.rotateZ(sx * 1.3); g.translate(sx * 0.27, 0.95, 0); b.add(g, SOOT, 1, NECK); const g2 = new THREE.ConeGeometry(0.035, 0.12, 4); g2.rotateZ(sx * 1.4); g2.translate(sx * 0.24, 0.55, 0); b.add(g2, SOOT, 0, [0, 0, 0]); }
    for (const sx of [-1, 1]) { b.box(0.1, 0.11, 0.02, sx * 0.11, 0.99, -0.213, W, 5, NECK); b.box(0.026, 0.026, 0.02, sx * 0.11, 0.99, -0.226, [20, 20, 20], 5, NECK); }
    b.box(0.08, 0.05, 0.02, 0, 0.86, -0.222, [25, 20, 20], 1, NECK);
  }
  return b.build(!!LZ);
}

// roupas (presas ao tronco; macacão e pijama cobrem as pernas também)
function outfit(b, o) {
  if (!o) return;
  const W = [245, 245, 248], R = [200, 40, 52], Gn = [36, 132, 70], HL = [-0.1, 0.34, 0], HR = [0.1, 0.34, 0];
  const body = (c, top, bot) => { const t = top || 0.74, bo = bot || 0.32, h = t - bo; b.box(0.39, h, 0.31, 0, bo + h / 2, 0, c, 0); };
  const band = (c, y) => b.box(0.4, 0.045, 0.32, 0, y, 0, c, 0);
  const legs = (c, y0) => { const yy = y0 == null ? 0.1 : y0, h = 0.34 - yy; b.box(0.145, h, 0.165, -0.1, yy + h / 2, 0, c, 2, HL); b.box(0.145, h, 0.165, 0.1, yy + h / 2, 0, c, 3, HR); };
  if (o === 1) { body(R); band(W, 0.73); band(W, 0.345); // suéter vermelho com flocos brancos
    for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) { const x = -0.135 + i * 0.09 + (r ? 0.045 : 0), y = 0.47 + r * 0.13; if (x > 0.17) continue; b.box(0.05, 0.015, 0.01, x, y, -0.158, W, 0); b.box(0.015, 0.05, 0.01, x, y, -0.158, W, 0); b.box(0.05, 0.015, 0.01, x, y, 0.158, W, 0); } }
  else if (o === 2) { body(Gn); band(R, 0.73); band([20, 70, 40], 0.345); for (let i = 0; i < 3; i++) { b.box(0.3, 0.045, 0.012, -0.03 + (i - 1) * 0.05, 0.43 + i * 0.12, -0.158, R, 0, null, null, 0, 0.55); b.box(0.3, 0.045, 0.012, 0.03 - (i - 1) * 0.05, 0.43 + i * 0.12, 0.158, R, 0, null, null, 0, -0.55); } }
  else if (o === 3) { body(R); band(Gn, 0.73); band(Gn, 0.345); for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2) b.box(0.085, 0.09, 0.012, -0.135 + i * 0.09, 0.44 + j * 0.1, -0.158, Gn, 0); b.box(0.06, 0.06, 0.016, 0.09, 0.64, -0.16, [250, 225, 120], 0, null, null, 0, 0.785); }
  else if (o === 4) { body([90, 110, 150]); band([70, 85, 120], 0.345); b.box(0.22, 0.09, 0.012, 0, 0.45, -0.158, [70, 85, 120], 0); b.box(0.34, 0.16, 0.08, 0, 0.74, 0.15, [90, 110, 150], 0); b.box(0.012, 0.12, 0.01, -0.04, 0.66, -0.158, W, 0); b.box(0.012, 0.12, 0.01, 0.04, 0.66, -0.158, W, 0); }
  else if (o === 5) { body([90, 190, 230], 0.74, 0.5); b.box(0.12, 0.08, 0.012, 0, 0.62, -0.158, [255, 230, 120], 0); }
  else if (o === 6) { body([240, 120, 170], 0.74, 0.5); b.box(0.5, 0.2, 0.42, 0, 0.42, 0, [240, 120, 170], 0); b.box(0.52, 0.04, 0.44, 0, 0.33, 0, W, 0); b.box(0.4, 0.04, 0.32, 0, 0.52, 0, W, 0); }
  else if (o === 7) { const J = [60, 100, 170]; b.box(0.39, 0.22, 0.31, 0, 0.43, 0, J, 0); b.box(0.24, 0.16, 0.012, 0, 0.6, -0.158, J, 0); b.box(0.04, 0.22, 0.32, -0.12, 0.62, 0, J, 0); b.box(0.04, 0.22, 0.32, 0.12, 0.62, 0, J, 0); b.box(0.03, 0.03, 0.01, -0.1, 0.66, -0.165, [240, 200, 60], 0); b.box(0.03, 0.03, 0.01, 0.1, 0.66, -0.165, [240, 200, 60], 0); legs(J, 0.12); }
  else if (o === 8) { body(W, 0.74, 0.26); b.box(0.012, 0.42, 0.01, 0, 0.5, -0.158, [200, 200, 210], 0); b.box(0.07, 0.07, 0.012, 0.1, 0.62, -0.16, [80, 160, 230], 0); b.box(0.02, 0.06, 0.01, 0.1, 0.62, -0.168, [230, 60, 60], 0); b.box(0.06, 0.02, 0.01, 0.1, 0.62, -0.168, [230, 60, 60], 0); }
  else if (o === 9) { body([40, 50, 100]); band(W, 0.73); b.box(0.045, 0.2, 0.012, 0, 0.6, -0.16, [200, 40, 52], 0); b.box(0.07, 0.06, 0.012, -0.1, 0.62, -0.158, [255, 215, 80], 0); }
  else if (o === 11) { body(W); b.box(0.3, 0.36, 0.012, 0, 0.47, -0.16, [250, 250, 252], 0); for (let i = 0; i < 3; i++) for (const sx of [-0.07, 0.07]) b.box(0.025, 0.025, 0.01, sx, 0.68 - i * 0.07, -0.168, [60, 60, 70], 0); b.box(0.42, 0.03, 0.33, 0, 0.42, 0, [60, 60, 70], 0); }
  else if (o === 12) { const N = [36, 48, 110]; body(N); b.box(0.4, 0.04, 0.32, 0, 0.42, 0, [20, 20, 26], 0); b.box(0.06, 0.04, 0.01, 0, 0.42, -0.165, [220, 200, 120], 0); b.box(0.07, 0.08, 0.012, -0.09, 0.62, -0.16, [240, 200, 60], 0); b.box(0.12, 0.03, 0.31, -0.2, 0.72, 0, [240, 200, 60], 0); b.box(0.12, 0.03, 0.31, 0.2, 0.72, 0, [240, 200, 60], 0); legs(N, 0.1); }
  else if (o === 13) { const R = [150, 110, 60], Y = [240, 230, 60]; body(R, 0.74, 0.28); band(Y, 0.4); band([200, 200, 200], 0.43); band(Y, 0.6); b.box(0.04, 0.3, 0.012, -0.05, 0.56, -0.162, [40, 40, 40], 0); legs(R, 0.08); b.box(0.15, 0.045, 0.17, -0.1, 0.22, 0, Y, 2, HL); b.box(0.15, 0.045, 0.17, 0.1, 0.22, 0, Y, 3, HR); }
  else if (o === 14) { const G2 = [60, 150, 80]; b.box(0.32, 0.4, 0.012, 0, 0.5, -0.16, G2, 0); b.box(0.36, 0.03, 0.33, 0, 0.6, 0, G2, 0); b.box(0.14, 0.08, 0.014, 0, 0.42, -0.168, [40, 110, 60], 0); b.box(0.05, 0.05, 0.01, 0.09, 0.62, -0.168, [255, 230, 120], 0); }
  else if (o === 15) { const B = [140, 205, 235], D = [40, 110, 130]; body(B, 0.74, 0.3); // camisa azul-clara do Keyboard Cat, com listras escuras e gola
    for (const sx of [-1, 1]) { b.box(0.012, 0.3, 0.012, sx * 0.07, 0.5, -0.16, D, 0); b.box(0.09, 0.14, 0.17, sx * 0.235, 0.63, -0.02, B, 0); b.box(0.095, 0.02, 0.175, sx * 0.235, 0.565, -0.02, D, 0); b.box(0.12, 0.05, 0.02, sx * 0.07, 0.725, -0.165, B, 0, null, null, 0, sx * 0.5); }
    b.box(0.4, 0.02, 0.32, 0, 0.44, 0, D, 0); }
  else if (o === 10) { const P = [170, 200, 255]; body(P); for (let i = 0; i < 4; i++) b.box(0.4, 0.03, 0.32, 0, 0.38 + i * 0.1, 0, [255, 255, 255], 0); legs(P, 0.1); }
}

function makeCatMaterial() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  const u = { uLegs: { value: new THREE.Vector2() }, uHead: { value: new THREE.Vector2() }, uTail: { value: 0 }, uInfect: { value: 0 }, uTime: { value: 0 }, uBurnt: { value: 0 } };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uLegs = u.uLegs; sh.uniforms.uHead = u.uHead; sh.uniforms.uTail = u.uTail; sh.uniforms.uInfect = u.uInfect; sh.uniforms.uTime = u.uTime; sh.uniforms.uBurnt = u.uBurnt;
    sh.vertexShader = 'attribute vec2 aPart;\nvarying float vGlow;\nvarying float vMelt;\nuniform float uInfect;\nuniform float uTime;\nattribute vec3 aPivot;\nuniform vec2 uLegs;\nuniform vec2 uHead;\nuniform float uTail;\n' + sh.vertexShader.replace('#include <begin_vertex>', [
      '#include <begin_vertex>',
      'vGlow = step(4.5, aPart.x);',
      'float accM = step(1.5, aPart.y) * uInfect; vMelt = accM;',
      'if (accM > 0.0) { float dr = 0.5 + 0.5 * sin(transformed.x * 37.0 + transformed.z * 23.0); transformed.y -= accM * (0.03 + dr * dr * 0.15) * (0.65 + 0.35 * sin(uTime * 1.3 + transformed.x * 9.0)); transformed.xz += accM * 0.04 * vec2(sin(transformed.y * 29.0 + uTime * 2.1), cos(transformed.y * 23.0 + uTime * 1.7)); }',
      'vec3 pv = transformed - aPivot;',
      'if (aPart.x > 0.5) {',
      '  if (aPart.x < 1.5 || aPart.x > 4.5) { float c = cos(uHead.y), s = sin(uHead.y); pv = vec3(pv.x, pv.y * c - pv.z * s, pv.y * s + pv.z * c); c = cos(uHead.x); s = sin(uHead.x); pv = vec3(pv.x * c + pv.z * s, pv.y, -pv.x * s + pv.z * c); }',
      '  else if (aPart.x < 3.5) { float a = aPart.x < 2.5 ? uLegs.x : uLegs.y; float c = cos(a), s = sin(a); pv = vec3(pv.x, pv.y * c - pv.z * s, pv.y * s + pv.z * c); }',
      '  else { float a = uTail * aPart.y; float c = cos(a), s = sin(a); pv = vec3(pv.x * c + pv.z * s, pv.y, -pv.x * s + pv.z * c); }',
      '}',
      'transformed = pv + aPivot;'
    ].join('\n'));
  };
  m.customProgramCacheKey = () => 'rvcat';
  const prev = m.onBeforeCompile; m.onBeforeCompile = (sh) => { prev(sh); sh.fragmentShader = 'varying float vGlow;\nvarying float vMelt;\nuniform float uInfect;\nuniform float uBurnt;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight = mix(outgoingLight, vec3(dot(outgoingLight, vec3(0.3, 0.5, 0.2))) * vec3(0.32, 0.27, 0.24), uBurnt);\noutgoingLight = mix(outgoingLight, outgoingLight * vec3(0.5, 1.0, 0.3) + vec3(0.03, 0.08, 0.0), vMelt * 0.85);\noutgoingLight = mix(outgoingLight, vColor * 1.5 + 0.12, vGlow);\nfloat rim = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 3.0);\noutgoingLight += rim * (1.0 - vGlow) * mix(vec3(0.3, 0.285, 0.255), vec3(0.2, 0.6, 0.08), uInfect);\n#include <opaque_fragment>'); }; // contorno de luz: destaca os gatos em qualquer cenário
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
    this.extra = {}; this.mesh = new THREE.Mesh(buildCatGeometry(this.look), this.mat); this.mesh.castShadow = !this.look.laser;
    this.root.add(this.mesh);
    this.baseScale = opts.scale || 1; this.scale = this.baseScale * AGE_SCALE[this.look.age] * (this.look.inf ? 1.1 : 1); this.root.scale.setScalar(this.scale);
    this.h1 = new THREE.Vector3(); this.h2 = new THREE.Vector3(); this.handsVisible = true;
    this.t = Math.random() * 10; this.walk = 0; this.emote = 0; this.emoteT = 0; this.bubble = ''; this.bubbleT = 0; this.sub = opts.sub || '';
    this.speed = 0; this.grounded = true; this.blocking = false; this.headYaw = 0; this.headPitch = 0; this.flash = 0;
    this._tagKey = ''; this.tag = null; this._angel();
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
  setBurnt(v) { v = !!v; if (!!this.extra.burnt === v) return; this.extra.burnt = v; this.mesh.geometry.dispose(); this.mesh.geometry = buildCatGeometry(this.look, this.extra); }
  _angel() {
    const want = !!this.look.angel; if (!!this.angel === want) return;
    if (!want) { this.root.remove(this.angel.g); this.angel = null; return; }
    angelGeos(); const g = new THREE.Group(), W = []; for (const sx of [-1, 1]) { const piv = new THREE.Group(); piv.position.set(sx * 0.13, 0.66, 0.16); const m = new THREE.Mesh(_wingGeo, _angelMat); m.scale.set(sx * 1.25, 1.25, 1.25); m.frustumCulled = false; piv.add(m); g.add(piv); W.push(piv); }
    const kb = new THREE.Mesh(_kbGeo, _angelMat); kb.position.set(0, 0.5, -0.42); kb.rotation.x = -0.35; kb.frustumCulled = false; g.add(kb);
    this.angel = { g, W, kb }; this.root.add(g);
  }
  setLook(look) { this.look = cleanLook(look); this.mesh.geometry.dispose(); this.mesh.geometry = buildCatGeometry(this.look, this.extra); this.mesh.castShadow = !this.look.laser; this.scale = this.baseScale * AGE_SCALE[this.look.age] * (this.look.inf ? 1.1 : 1); this.root.scale.setScalar(this.scale); this._angel(); }
  setName(name, sub) { this.name = name; if (sub != null) this.sub = sub; this.drawTag(); }
  say(text, secs) { this.bubble = text; this.bubbleT = secs || 5; this.drawTag(); }
  setEmote(id) { this.emote = id; this.emoteT = 0; const e = EMOTES.find((x) => x.id === id); if (e && id !== 3 && id !== 4) this.say(e.icon, 2.5); }
  // anima; lod=true pula detalhes (gatos distantes)
  // Animação procedural estilo "desenho animado": cada pose é um alvo e o corpo
  // persegue o alvo com suavização (transições sem tranco), com esticar/achatar
  // em pulos e aterrissagens, gingado ao andar, respiração e olhar em volta parado.
  update(dt, lod) {
    this.t += dt; this.emoteT += dt;
    if (this.bubbleT > 0) { this.bubbleT -= dt; if (this.bubbleT <= 0) { this.bubble = ''; this.drawTag(); } }
    const py = this.root.position.y, vyNow = (py - (this._ly == null ? py : this._ly)) / Math.max(dt, 0.001); this._ly = py; this.vy = (this.vy || 0) + (vyNow - (this.vy || 0)) * Math.min(1, dt * 12);
    this.u.uTime.value = this.t; { const iv = this.u.uInfect.value, tg = this.look.inf ? 1 : 0; if (iv !== tg) this.u.uInfect.value = Math.abs(tg - iv) < 0.01 ? tg : iv + (tg - iv) * Math.min(1, dt * 0.8); } { const bv = this.u.uBurnt.value, bt = this.extra.burnt ? 1 : 0; if (bv !== bt) this.u.uBurnt.value = Math.abs(bt - bv) < 0.01 ? bt : bv + (bt - bv) * Math.min(1, dt * (bt ? 12 : 0.6)); } // derretimento progressivo
    if (this.angel) { const A = this.angel, f = this.grounded ? 4.5 : 8, a = Math.sin(this.t * f); A.W.forEach((w, i) => { const sx = i ? 1 : -1; w.rotation.set(0, sx * 0.55, sx * (0.2 + a * 0.6)); }); A.kb.position.y = 0.5 + Math.sin(this.t * 2.2) * 0.03; }
    if (lod) return;
    const u = this.u, m = this.mesh, sp = Math.min(this.speed, 6), t = this.t, P = this.pose || (this.pose = { lL: 0, lR: 0, bob: 0, tilt: 0, sway: 0, yoff: 0, tail: 0, hy: 0, hp: 0, tw: 0, sy: 0 });
    // aterrissagem: mola amortecida de achatar/esticar
    if (this.grounded && this._wasG === false) this.sqV = -Math.min(4.5, 1.2 + Math.abs(this._airVy || 0) * 0.35);
    if (!this.grounded) this._airVy = this.vy; this._wasG = this.grounded;
    this.sqV = (this.sqV || 0) + (-(this.sq || 0) * 220 - (this.sqV || 0) * 16) * dt; this.sq = (this.sq || 0) + this.sqV * dt;
    const moving = sp > 0.25 && this.grounded;
    this.walk += dt * (5 + sp * 3.4) * (moving ? 1 : 0);
    let lL = 0, lR = 0, bob = 0, tilt = 0, sway = 0, yoff = 0, tw = 0, sy = Math.sin(t * 2.1) * 0.014, tail = Math.sin(t * 1.7) * 0.5, hy = this.headYaw + Math.sin(t * 0.55 + this.walk) * 0.1 * (moving ? 0 : 1), hp = this.headPitch;
    if (!this.grounded) {
      if (this.vy > 0.6) { lL = -0.95; lR = -0.55; sy = 0.11; tilt = -0.12; hp -= 0.15; } // subindo: pernas encolhidas, corpo esticado
      else { const f = Math.sin(t * 15) * 0.3; lL = 0.45 + f; lR = -0.35 - f; sy = 0.06; tilt = 0.14; hp += 0.12; } // caindo: pernas pedalando
      tail = Math.sin(t * 10) * 0.8;
    } else if (moving) {
      const run = Math.min(1, sp / 4.5), w = this.walk, a = Math.sin(w) * (0.45 + run * 0.55);
      lL = a; lR = -a; bob = Math.abs(Math.cos(w)) * (0.04 + run * 0.05); sway = Math.sin(w) * (0.07 - run * 0.02); tw = Math.sin(w) * 0.13;
      tilt = -(0.05 + run * 0.24); hp += 0.04 + run * 0.14 + Math.cos(w * 2) * 0.03; tail = Math.sin(w) * 0.7; sy = Math.cos(w * 2) * 0.02;
    }
    const e = this.emote, et = this.emoteT, k = Math.min(1, et * 4);
    if (e === 1) { sway = -0.1 * k; hy += 0.25 * k; hp -= 0.1 * k; }
    else if (e === 2) { const b = et * 7.5; sway = Math.sin(b) * 0.26; tw = Math.sin(b * 0.5) * 0.5; bob = Math.abs(Math.sin(b)) * 0.11; lL = Math.max(0, Math.sin(b)) * -0.8; lR = Math.max(0, -Math.sin(b)) * -0.8; tail = Math.sin(b * 1.5); hy += Math.sin(b * 0.5) * 0.5; sy = Math.sin(b * 2) * 0.05; }
    else if (e === 3) { yoff = -0.2 * k; lL = lR = -1.35 * k; tail = Math.sin(t * 1.2) * 0.4; tilt = 0.05; }
    else if (e === 4) { yoff = -0.42 * k; sway = 1.45 * k; lL = lR = -0.3; tail = 0.2; hp = 0.2; sy = Math.sin(t * 1.3) * 0.04; }
    else if (e === 5) { bob = Math.abs(Math.sin(et * 16)) * 0.05; hp = -0.3 + Math.sin(et * 16) * 0.1; tilt = 0.12; sy = Math.sin(et * 16) * 0.04; tail = Math.sin(et * 8) * 0.8; }
    else if (e === 6) { sway = Math.sin(et * 3) * 0.12; hp = -0.12; bob = 0.02; tail = Math.sin(et * 5) * 0.9; }
    else if (e === 7) { hp = -0.35 * k; sy = 0.05 * Math.sin(Math.min(1, et * 2) * Math.PI); tail = 0.6; }
    else if (e === 8) { const j = Math.abs(Math.sin(et * 6)); bob = j * 0.34; lL = lR = -0.6 * j; sy = (j - 0.5) * 0.16; tw = Math.sin(et * 3) * 0.3; tail = Math.sin(et * 12); hp = -0.2; }
    else if (e === 9) { hp = 0.22; tilt = -0.1; tail = Math.sin(et * 20) * 0.9; sway = Math.sin(et * 30) * 0.03; const st = Math.sin(et * 9); lL = st > 0.6 ? -0.7 : 0; bob = st > 0.6 ? 0.03 : 0; }
    else if (e === 10) { tw = et * 9; bob = Math.abs(Math.sin(et * 9)) * 0.08; sy = 0.05; tail = 1.1; }
    else if (e === 11) { const b = Math.sin(Math.min(1, et / 1.6) * Math.PI); tilt = -0.95 * b; hp = 0.3 * b; lL = lR = 0.12 * b; }
    else if (e === 12) { const q = (v) => Math.round(v * 2) / 2, b = et * 5; sway = q(Math.sin(b)) * 0.2; tw = q(Math.sin(b * 0.5)) * 0.6; hy += q(Math.sin(b * 0.7)) * 0.7; lL = q(Math.sin(b)) * 0.5; lR = -lL; bob = Math.abs(q(Math.sin(b * 2))) * 0.04; tail = q(Math.sin(b)) * 0.8; }
    if (this.look.inf) { tilt += 0.16; hp += 0.1; const tw2 = Math.sin(t * 23) * Math.sin(t * 3.1); if (tw2 > 0.8) { hy += Math.sin(t * 61) * 0.6; hp -= 0.3; } sway += Math.sin(t * 17) * 0.03; } // infectado: curvado e com espasmos
    if (this.blocking) { tilt = 0.14; hp += 0.12; yoff -= 0.05; lL = 0.25; lR = -0.25; }
    if (this.flash > 0.15) { tilt += 0.25; hp -= 0.3; } // recuo ao levar golpe
    const f = 1 - Math.exp(-dt * 20), g = 1 - Math.exp(-dt * 10);
    P.lL += (lL - P.lL) * f; P.lR += (lR - P.lR) * f; P.bob += (bob - P.bob) * f; P.sway += (sway - P.sway) * f; P.tail += (tail - P.tail) * f; P.sy += (sy - P.sy) * f;
    P.tilt += (tilt - P.tilt) * g; P.yoff += (yoff - P.yoff) * g; P.hy += (hy - P.hy) * f; P.hp += (hp - P.hp) * f; if (e === 10) P.tw = tw; else P.tw += (tw - P.tw) * f;
    u.uLegs.value.set(P.lL, P.lR); u.uHead.value.set(clamp(P.hy, -1.2, 1.2), clamp(P.hp, -0.9, 0.9)); u.uTail.value = P.tail;
    const s = clamp(P.sy + this.sq, -0.4, 0.4);
    m.position.y = P.bob + P.yoff; m.rotation.set(P.tilt, P.tw, P.sway); m.scale.set(1 - s * 0.5, 1 + s, 1 - s * 0.5);
    if (this.flash > 0) { this.flash -= dt; const fl = Math.max(0, this.flash) * 3; this.mat.emissive.setRGB(fl, fl * 0.25, fl * 0.2); }
  }
  // posições procedurais das duas patas flutuantes (NPCs e emotes): balançam ao andar, sobem ao pular, dançam...
  procHands(a, b) {
    const p = this.root.position, yaw = this.root.rotation.y, c = Math.cos(yaw), s = Math.sin(yaw), t = this.t, e = this.emote, et = this.emoteT, sc = this.scale;
    let f1 = 0.1, f2 = 0.1, u1 = 0.52, u2 = 0.52, sd = 0.3;
    const sw = Math.sin(this.walk) * Math.min(0.32, this.speed * 0.12);
    if (!this.grounded) { u1 = u2 = this.vy > 0.6 ? 0.95 : 1.1; sd = 0.38; }
    else if (this.speed > 0.25) { f1 += sw; f2 -= sw; u1 += Math.abs(sw) * 0.25; u2 += Math.abs(sw) * 0.25; }
    else { u1 += Math.sin(t * 2.1) * 0.02; u2 += Math.sin(t * 2.1 + 0.6) * 0.02; }
    if (e === 1) { u2 = 1.32; sd = 0.34 + Math.sin(et * 12) * 0.1; }
    else if (e === 2) { u1 = 0.9 + Math.sin(et * 7.5) * 0.35; u2 = 0.9 - Math.sin(et * 7.5) * 0.35; sd = 0.36; f1 = f2 = 0.18; }
    else if (e === 3) { u1 = u2 = 0.42; f1 = f2 = 0.26; sd = 0.18; }
    else if (e === 4) { u1 = u2 = 0.12; }
    else if (e === 5) { u1 = u2 = 0.78; f1 = f2 = 0.28; sd = 0.14; }
    else if (e === 6) { u1 = u2 = 0.82; f1 = f2 = 0.34; sd = 0.07; }
    else if (e === 8) { u1 = u2 = 1.3 + Math.abs(Math.sin(et * 6)) * 0.2; sd = 0.4; }
    else if (e === 9) { u1 = u2 = 0.62; f1 = f2 = 0.3; sd = 0.26 + Math.sin(et * 30) * 0.02; }
    else if (e === 10) { u1 = u2 = 0.9; sd = 0.55; }
    else if (e === 11) { u1 = u2 = 0.5; f1 = f2 = 0.45; sd = 0.12; }
    else if (e === 12) { const q = Math.round(Math.sin(et * 5) * 2) / 2; u1 = 0.8 + q * 0.3; u2 = 0.8 - q * 0.3; f1 = f2 = 0.3; }
    if (this.blocking) { u1 = u2 = 0.95; f1 = f2 = 0.36; sd = 0.11; }
    const y = p.y + (this.pose ? this.pose.bob + this.pose.yoff : 0);
    a.set(p.x + (c * sd - s * f1) * sc, y + u1 * sc, p.z + (-s * sd - c * f1) * sc); b.set(p.x + (-c * sd - s * f2) * sc, y + u2 * sc, p.z + (s * sd - c * f2) * sc);
  }
  dispose() { this.mesh.geometry.dispose(); this.mat.dispose(); if (this.tag) { this.tag.material.map.dispose(); this.tag.material.dispose(); } if (this.root.parent) this.root.parent.remove(this.root); }
}
export function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
