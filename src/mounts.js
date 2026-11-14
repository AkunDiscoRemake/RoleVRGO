import * as THREE from 'three';
import { S } from './state.js';
import { emit } from './util.js';
import { play, boing } from './assets.js';

// Montarias: o gato monta num bicho/veículo que anda mais rápido (alguns voam). Os outros jogadores
// veem a sua montaria (vai no "meta" da rede). Compradas com moedas; o Dragãozinho exige nível 20.
export const MOUNTS = [
  { id: 'none', n: 'A pé', d: 'Sem montaria' },
  { id: 'gatao', n: 'Gatão', price: 600, speed: 1.7, h: 1.2, kind: 'cat', scale: 1.9, look: { fur: '#e8c27a', fur2: '#f5f1e8', pattern: 1, eyes: '#58c26a', hat: 0 }, d: '+70% de velocidade' },
  { id: 'skate', n: 'Skate Aero', price: 1200, speed: 2.1, h: 0.16, kind: 'skate', d: '+110% de velocidade, com luz neon' },
  { id: 'tigre', n: 'Tigre', price: 1800, speed: 1.95, h: 1.3, kind: 'cat', scale: 2.05, look: { fur: '#f08a2a', fur2: '#f5f1e8', pattern: 3, eyes: '#e0b030', hat: 0 }, d: '+95% de velocidade' },
  { id: 'pantera', n: 'Pantera Neon', price: 3500, speed: 2.15, h: 1.3, kind: 'cat', scale: 2.05, look: { fur: '#22222a', fur2: '#3cf0ff', pattern: 5, eyes: '#3cf0ff', hat: 0, laser: 2 }, d: '+115% de velocidade e olhos de laser' },
  { id: 'nuvem', n: 'Nuvem Voadora', price: 4500, speed: 1.6, h: 0.45, kind: 'cloud', fly: true, d: 'VOA! Espaço sobe, C desce (no VR: aponte e segure o gatilho)' },
  { id: 'dragao', n: 'Dragãozinho', price: 9000, level: 20, speed: 2.05, h: 1.0, kind: 'dragon', fly: true, d: 'VOA rápido! Precisa do nível 20' }
];
export const MOUNT_BY = {}; for (const m of MOUNTS) MOUNT_BY[m.id] = m;

function mat(c, e) { return new THREE.MeshLambertMaterial({ color: c, emissive: e || 0x000000 }); }
function bx(g, w, h, d, x, y, z, m) { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); g.add(me); return me; }
// monta o visual de cada tipo; update(dt, velocidade, voando) anima
export function buildRig(m) {
  const root = new THREE.Group(), mats = [];
  const M = (c, e) => { const k = mat(c, e); mats.push(k); return k; };
  if (m.kind === 'cat') { // felino de quatro patas: corpo deitado, patas que alternam, cabeça, cauda e listras
    const L = m.look, fur = M(L.fur), f2 = M(L.fur2), dk = M(new THREE.Color(L.fur).multiplyScalar(0.55).getHex()), eye = M(L.eyes, L.laser ? L.eyes : 0x202020), pink = M(0xec8ca0), glow = L.laser ? M(L.fur2, L.fur2) : null;
    const s = new THREE.Group(); s.scale.setScalar(m.scale / 1.9); root.add(s);
    bx(s, 0.72, 0.62, 1.55, 0, 0.98, 0, fur); bx(s, 0.6, 0.12, 1.3, 0, 0.66, 0, f2);
    const head = new THREE.Group(); head.position.set(0, 1.28, -0.95); s.add(head); bx(head, 0.66, 0.56, 0.56, 0, 0, -0.1, fur); bx(head, 0.34, 0.2, 0.18, 0, -0.12, -0.42, f2); bx(head, 0.1, 0.07, 0.04, 0, -0.04, -0.52, pink);
    for (const sx of [-0.17, 0.17]) { bx(head, 0.13, 0.12, 0.04, sx, 0.08, -0.39, eye); if (!L.laser) bx(head, 0.05, 0.1, 0.04, sx, 0.08, -0.41, M(0x1a1a1a)); const e2 = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.24, 4), fur); e2.position.set(sx * 1.25, 0.36, -0.08); e2.rotation.y = Math.PI / 4; head.add(e2); }
    const legs = []; for (const [sx, sz] of [[-0.24, -0.55], [0.24, -0.55], [-0.24, 0.55], [0.24, 0.55]]) { const piv = new THREE.Group(); piv.position.set(sx, 0.8, sz); bx(piv, 0.24, 0.8, 0.26, 0, -0.4, 0, fur); bx(piv, 0.28, 0.12, 0.32, 0, -0.76, -0.03, L.pattern === 1 || L.pattern === 5 ? f2 : dk); s.add(piv); legs.push(piv); }
    const tail = new THREE.Group(); tail.position.set(0, 1.1, 0.78); s.add(tail); bx(tail, 0.14, 0.14, 0.6, 0, 0.12, 0.28, fur); bx(tail, 0.13, 0.4, 0.13, 0, 0.42, 0.56, L.pattern === 3 ? dk : fur);
    if (L.pattern === 3 || L.pattern === 5) for (let i = 0; i < 4; i++) bx(s, 0.74, 0.08, 0.14, 0, 1.15, -0.5 + i * 0.32, glow || dk); // listras (neon na pantera)
    bx(s, 0.5, 0.08, 0.6, 0, 1.3, 0.1, M(0x8a3a2a)); bx(s, 0.54, 0.04, 0.64, 0, 1.33, 0.1, M(0xffd040)); // sela
    let ph = 0;
    return { root, update(dt, sp, air) { const run = Math.min(1, sp / 6); ph += dt * (4 + sp * 1.6) * (sp > 0.3 ? 1 : 0); const a = Math.sin(ph) * 0.7 * run;
      legs[0].rotation.x = a; legs[3].rotation.x = a; legs[1].rotation.x = -a; legs[2].rotation.x = -a; if (air) legs.forEach((l, i) => { l.rotation.x = i < 2 ? -0.7 : 0.7; });
      s.position.y = Math.abs(Math.sin(ph)) * 0.06 * run; s.rotation.x = air ? -0.12 : -run * 0.05; tail.rotation.x = Math.sin(ph * 0.5 + performance.now() / 500) * 0.3; head.rotation.y = Math.sin(performance.now() / 1300) * 0.12; },
      dispose() { root.traverse((o) => o.geometry && o.geometry.dispose()); mats.forEach((k) => k.dispose()); if (root.parent) root.parent.remove(root); } };
  }
  if (m.kind === 'skate') {
    const deck = M(0xff3cc8), wheel = M(0x2a2a34), trim = M(0x3cf0ff, 0x1a7090); bx(root, 0.46, 0.06, 1.2, 0, 0.13, 0, deck); bx(root, 0.48, 0.02, 1.22, 0, 0.1, 0, trim);
    for (const sx of [-0.17, 0.17]) for (const sz of [-0.4, 0.4]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 10), wheel); w.rotation.z = Math.PI / 2; w.position.set(sx, 0.06, sz); root.add(w); }
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.6), new THREE.MeshBasicMaterial({ color: 0x3cf0ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.02; root.add(glow); mats.push(glow.material);
    return { root, update(dt, sp) { root.rotation.z = Math.sin(performance.now() / 300) * 0.03 * Math.min(1, sp); glow.material.opacity = 0.25 + Math.min(0.3, sp * 0.04); }, dispose() { root.traverse((o) => o.geometry && o.geometry.dispose()); mats.forEach((k) => k.dispose()); if (root.parent) root.parent.remove(root); } };
  }
  if (m.kind === 'cloud') {
    const w = M(0xffffff, 0x5a6878), g = new THREE.IcosahedronGeometry(1, 1), puffs = [[0, 0.25, 0, 0.55], [0.42, 0.22, 0.15, 0.4], [-0.42, 0.22, -0.1, 0.42], [0.1, 0.3, 0.5, 0.38], [-0.1, 0.28, -0.5, 0.4], [0, 0.45, 0, 0.36]];
    for (const p of puffs) { const s = new THREE.Mesh(g, w); s.position.set(p[0], p[1], p[2]); s.scale.set(p[3], p[3] * 0.7, p[3]); root.add(s); }
    return { root, update(dt) { const t = performance.now() / 1000; root.children.forEach((c, i) => { c.position.y = puffs[i][1] + Math.sin(t * 2 + i) * 0.04; }); }, dispose() { g.dispose(); mats.forEach((k) => k.dispose()); if (root.parent) root.parent.remove(root); } };
  }
  // dragãozinho: corpo, pescoço, cabeça com chifres, cauda e asas que batem
  const body = M(0x3aa860), belly = M(0xb8e070), dark = M(0x1f6a3a), horn = M(0xf0e0b0), eye = M(0xffe040, 0xffa000);
  const s = new THREE.Group(); s.scale.setScalar(1.25); root.add(s);
  bx(s, 0.6, 0.5, 1.1, 0, 0.55, 0, body); bx(s, 0.5, 0.12, 0.9, 0, 0.3, 0, belly); bx(s, 0.28, 0.28, 0.45, 0, 0.82, -0.62, body); const head = bx(s, 0.42, 0.34, 0.46, 0, 1.0, -0.92, body);
  bx(s, 0.3, 0.14, 0.2, 0, 0.92, -1.2, dark); bx(s, 0.07, 0.07, 0.03, -0.13, 1.06, -1.16, eye); bx(s, 0.07, 0.07, 0.03, 0.13, 1.06, -1.16, eye);
  for (const sx of [-0.12, 0.12]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 5), horn); c.position.set(sx, 1.25, -0.82); c.rotation.x = 0.4; s.add(c); }
  bx(s, 0.3, 0.26, 0.5, 0, 0.55, 0.72, body); bx(s, 0.2, 0.18, 0.45, 0, 0.5, 1.15, body); bx(s, 0.12, 0.12, 0.35, 0, 0.47, 1.5, dark);
  for (let i = 0; i < 4; i++) bx(s, 0.04, 0.12, 0.12, 0, 0.88, -0.2 + i * 0.28, dark);
  for (const sx of [-0.2, 0.2]) for (const sz of [-0.35, 0.35]) bx(s, 0.16, 0.32, 0.16, sx, 0.16, sz, dark);
  const wings = []; for (const sx of [-1, 1]) { const piv = new THREE.Group(); piv.position.set(sx * 0.3, 0.75, -0.05); bx(piv, 1.1, 0.04, 0.75, sx * 0.55, 0, 0, dark); bx(piv, 0.9, 0.05, 0.08, sx * 0.45, 0.02, -0.36, body); s.add(piv); wings.push([piv, sx]); }
  return { root, update(dt, sp, air) { const t = performance.now() / 1000, f = air ? 7 : 2; wings.forEach(([p, sx]) => { p.rotation.z = sx * (Math.sin(t * f) * (air ? 0.55 : 0.12) + 0.15); }); head.rotation.y = Math.sin(t * 1.3) * 0.15; s.position.y = air ? Math.sin(t * f) * 0.05 : 0; }, dispose() { root.traverse((o) => o.geometry && o.geometry.dispose()); mats.forEach((k) => k.dispose()); if (root.parent) root.parent.remove(root); } };
}

export const mounts = {
  rig: null, rigId: '', rented: null, G: null,
  init(G) { this.G = G; },
  owned(id) { return id === 'none' || (S.d.mounts || []).indexOf(id) >= 0; },
  // montaria atual (null = a pé). Na Infecção Nuclear não vale montar.
  cur() { const G = this.G; if (G && G.mapId === 'nuke') return null; const id = this.rented || S.d.mount; const m = MOUNT_BY[id]; return m && m.id !== 'none' && (this.rented || this.owned(id)) ? m : null; },
  height() { const m = this.cur(); return m ? m.h : 0; },
  flying() { const m = this.cur(); return !!(m && m.fly); },
  buy(id) { const m = MOUNT_BY[id]; if (!m || id === 'none') return ''; S.d.mounts = S.d.mounts || ['none'];
    if (S.d.mounts.indexOf(id) < 0) { if (m.level && S.d.level < m.level) return 'Precisa do nível ' + m.level; const pr = S.buyPrice ? S.buyPrice(m.price) : m.price; if (S.d.coins < pr) return 'Faltam ' + (pr - S.d.coins) + ' moedas'; S.d.coins -= pr; S.d.mounts.push(id); emit('coins'); play('coin', 0.7); S.toast('🐎 Nova montaria: ' + m.n + '!', '#ffd76a'); }
    return this.ride(id); },
  ride(id) { if (!this.owned(id)) return 'Você ainda não tem essa montaria'; this.rented = null; S.d.mount = id; S.touch(); emit('meta'); emit('mount'); if (id !== 'none') { boing(0.5); S.toast('🐎 Montado: ' + MOUNT_BY[id].n, '#9cf09c'); } return ''; },
  dismount() { this.rented = null; S.d.mount = 'none'; S.touch(); emit('meta'); emit('mount'); },
  toggle() { if (this.cur()) { this.last = S.d.mount; this.dismount(); S.toast('🚶 Desmontou', '#bfe6ff'); } else { const id = this.last && this.owned(this.last) ? this.last : (S.d.mounts || []).filter((x) => x !== 'none').pop(); if (id) this.ride(id); else S.toast('Você ainda não tem montaria (Menu rápido > 🐾 > Montarias)', '#ff9a8a'); } },
  rent(id) { if (this.cur()) return; this.rented = id; emit('meta'); emit('mount'); boing(0.5); S.toast('🐎 Montaria emprestada: ' + MOUNT_BY[id].n + ' (só neste mapa)', '#9cf09c'); },
  // por quadro: monta/atualiza o visual seu e dos outros jogadores
  update(dt) {
    const G = this.G, P = G.player, m = this.cur(), id = m ? m.id : '';
    if (id !== this.rigId) { if (this.rig) this.rig.dispose(); this.rig = id ? buildRig(m) : null; this.rigId = id; if (this.rig) G.scene.add(this.rig.root); }
    if (this.rig) { this.rig.root.position.copy(P.pos); this.rig.root.rotation.y = P.bodyYaw; this.rig.update(dt, P.speed, !P.grounded && (m.fly || P.vel.y > 1)); if (m.fly && !P.grounded && P.speed > 1 && Math.random() < 0.3) G.fx.streak(P.pos.x, P.pos.y + 0.3, P.pos.z, 0, -0.5, 0, m.kind === 'dragon' ? 0x80ff90 : 0xffffff, 0.5); }
    G.remotes.forEach((r) => { const rm = MOUNT_BY[r.meta && r.meta.mount] || null, rid = rm && rm.id !== 'none' && G.mapId !== 'nuke' ? rm.id : '';
      if (rid !== (r.mountId || '')) { if (r.mountRig) r.mountRig.dispose(); r.mountRig = rid ? buildRig(rm) : null; r.mountId = rid; r.mountH = rid ? rm.h : 0; if (r.mountRig) G.scene.add(r.mountRig.root); }
      if (r.mountRig) { const p = r.av.root.position; r.mountRig.root.visible = r.av.root.visible; r.mountRig.root.position.set(p.x, p.y - r.mountH, p.z); r.mountRig.root.rotation.y = r.av.root.rotation.y; if (r.near) r.mountRig.update(dt, r.av.speed, !r.av.grounded); } });
  },
  drop(r) { if (r && r.mountRig) { r.mountRig.dispose(); r.mountRig = null; r.mountId = ''; } }
};
