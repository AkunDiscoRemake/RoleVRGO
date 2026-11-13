import * as THREE from 'three';
import { addPrim, hasModel } from './assets.js';
import { rng, fbm, noise2, clamp, smooth } from './util.js';

// Os 10 mapas. Cada build(w, E, r) monta terreno, cenário (modelos Kenney em lotes),
// colisores e registra entidades (NPCs, minérios, baús, portais, segredos...).
const PI = Math.PI, H = PI / 2;
let primsReady = false;
export function initPrims() {
  if (primsReady) return; primsReady = true;
  const b = new THREE.BoxGeometry(1, 1, 1); b.translate(0, 0.5, 0); addPrim('prim/box', b);
  const c = new THREE.CylinderGeometry(0.5, 0.5, 1, 10); c.translate(0, 0.5, 0); addPrim('prim/cyl', c);
  const k = new THREE.ConeGeometry(0.5, 1, 8); k.translate(0, 0.5, 0); addPrim('prim/cone', k);
  addPrim('prim/dome', new THREE.SphereGeometry(0.5, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2));
  const sp = new THREE.IcosahedronGeometry(0.5, 2); sp.translate(0, 0.5, 0); addPrim('prim/sphere', sp);
}
const T = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
function mix(c, a, b, t) { c[0] = a[0] + (b[0] - a[0]) * t; c[1] = a[1] + (b[1] - a[1]) * t; c[2] = a[2] + (b[2] - a[2]) * t; }
const C = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];

// ---------- peças reutilizáveis ----------
function box(w, x, z, sx, sy, sz, color, y, nocol) { return w.put('prim/box', x, z, { s: [sx, sy, sz], tint: T(color), y: y || 0, col: nocol ? null : 'box' }); }
function boxAbs(w, x, y, z, sx, sy, sz, color) { return w.put('prim/box', x, z, { s: [sx, sy, sz], tint: T(color), abs: y, col: 'box' }); }
function house(w, x, z, ry, o) {
  o = o || {}; const s = o.s || 4.5, fl = o.floors || 1, wd = o.wood, base = w.heightAt(x, z);
  const wall = wd ? 'town/wall-wood' : 'town/wall', door = wd ? 'town/wall-wood-door' : 'town/wall-door', win = wd ? 'town/wall-wood-window-glass' : 'town/wall-window-glass';
  for (let f = 0; f < fl; f++) for (let k = 0; k < 4; k++) w.put(k === 0 && f === 0 ? door : (k + f) % 2 ? win : f > 0 && k === 0 ? 'town/wall-window-shutters' : wall, x, z, { s, ry: ry + k * H, abs: base + f * s, tint: o.tint });
  w.put(o.roof || 'town/roof-high-point', x, z, { s, ry, abs: base + fl * s, tint: o.rtint });
  w.addBoxC(x, base - 1, z, s * 0.98, fl * s + 1, s * 0.98);
  w.addBoxC(x, base + fl * s, z, s * 0.8, s * 0.3, s * 0.8); w.addBoxC(x, base + fl * s, z, s * 0.45, s * 0.62, s * 0.45); w.addBoxC(x, base + fl * s, z, s * 0.15, s * 0.9, s * 0.15);
  if (o.chimney) w.put('town/chimney', x, z, { s, ry, abs: base + fl * s });
}
function tower(w, x, z, s, mids, roof, tint) {
  const base = w.heightAt(x, z); let y = base;
  w.put('castle/tower-square-base', x, z, { s, abs: y, tint }); y += 1.01 * s;
  for (let i = 0; i < mids; i++) { w.put(i % 2 ? 'castle/tower-square-mid-windows' : 'castle/tower-square-mid', x, z, { s, abs: y, tint }); y += 1.01 * s; }
  w.put('castle/tower-square-top', x, z, { s, abs: y, tint });
  w.addBoxC(x, base - 1, z, s, y - base + 1, s);
  if (roof) { w.put('castle/tower-square-roof', x, z, { s: s * 0.9, abs: y + 0.3 * s, tint }); w.addBoxC(x, y, z, s * 0.6, s * 1.2, s * 0.6); }
  else { for (let k = 0; k < 4; k++) { const a = k * H; w.addBoxC(x + Math.cos(a) * s * 0.46, y, z + Math.sin(a) * s * 0.46, k % 2 ? s : s * 0.08, s * 0.28, k % 2 ? s * 0.08 : s); } }
  return y; // altura do topo
}
function scatter(w, r, keys, n, o) {
  const a = o.area || [-w.half + 4, -w.half + 4, w.half - 4, w.half - 4]; let placed = 0, tries = 0;
  while (placed < n && tries++ < n * 12) {
    const x = a[0] + r() * (a[2] - a[0]), z = a[1] + r() * (a[3] - a[1]);
    if (o.ok && !o.ok(x, z)) continue;
    if (w.heightAt(x, z) < w.waterY + 0.15 && !o.water) continue;
    const s = o.s ? o.s[0] + r() * (o.s[1] - o.s[0]) : 1, key = keys[Math.floor(r() * keys.length)];
    const v = o.tv ? 1 - o.tv / 2 + r() * o.tv : 1;
    w.put(key, x, z, { s, ry: r() * PI * 2, col: o.col, cw: o.cw ? o.cw * s : undefined, cs: o.cs, detail: o.detail, tint: o.tv ? [v, v, v] : o.tint, y: o.y });
    placed++;
  }
}
function ring(n, R, fn, a0) { for (let i = 0; i < n; i++) { const a = (a0 || 0) + i / n * PI * 2; fn(Math.cos(a) * R, Math.sin(a) * R, a, i); } }
function lampPost(w, E, x, z, s) { s = s || 2.4; w.put('town/lantern', x, z, { s, col: 'trunk', cw: 0.12 }); E.lamp(x, w.heightAt(x, z) + 1.36 * s, z); }
function returnPortal(w, E, x, z) { E.portal('village', x, z); }
const NPC_LOOKS = {
  mimi: { fur: '#f5f1e8', fur2: '#e39ab0', pattern: 4, eyes: '#4aa3e0', hat: 3 }, bigode: { fur: '#8a8f98', fur2: '#f5f1e8', pattern: 1, eyes: '#e0b030', hat: 4 },
  ferreiro: { fur: '#3b3b45', fur2: '#8a8f98', pattern: 5, eyes: '#c86a2a', hat: 5 }, la: { fur: '#e8c27a', fur2: '#f5f1e8', pattern: 1, eyes: '#58c26a', hat: 0 },
  oficio: { fur: '#6b4a36', fur2: '#e8c27a', pattern: 3, eyes: '#e0b030', hat: 8 }, salvia: { fur: '#5d8f5a', fur2: '#f5f1e8', pattern: 1, eyes: '#e0b030', hat: 4 },
  pedrita: { fur: '#c9793d', fur2: '#3b3b45', pattern: 3, eyes: '#58c26a', hat: 5 }, tunel: { fur: '#8a8f98', fur2: '#3b3b45', pattern: 2, eyes: '#4aa3e0', hat: 5 },
  safira: { fur: '#e8c27a', fur2: '#6b4a36', pattern: 2, eyes: '#4aa3e0', hat: 7 }, floco: { fur: '#f5f1e8', fur2: '#b8b0d8', pattern: 0, eyes: '#4aa3e0', hat: 6 },
  garra: { fur: '#c9793d', fur2: '#f5f1e8', pattern: 3, eyes: '#e0b030', hat: 7 }, rei: { fur: '#f2a65a', fur2: '#f5f1e8', pattern: 1, eyes: '#58c26a', hat: 2 },
  cozinheira: { fur: '#f5f1e8', fur2: '#3b3b45', pattern: 4, eyes: '#c86a2a', hat: 0 }, carteiro: { fur: '#7fb7c9', fur2: '#f5f1e8', pattern: 5, eyes: '#e0b030', hat: 1 },
  fifi: { fur: '#e39ab0', fur2: '#f5f1e8', pattern: 1, eyes: '#9b6ad6', hat: 3 }, capitao: { fur: '#3b3b45', fur2: '#f5f1e8', pattern: 1, eyes: '#58c26a', hat: 7 },
  sensei: { fur: '#d9d9d9', fur2: '#3b3b45', pattern: 2, eyes: '#e0b030', hat: 0 }, mestre: { fur: '#6b4a36', fur2: '#f2a65a', pattern: 3, eyes: '#c86a2a', hat: 0 },
  guarda: { fur: '#8a8f98', fur2: '#3b3b45', pattern: 0, eyes: '#e0e0e0', hat: 5 }
};

export const MAPS = {
  // ======================= VILA =======================
  village: {
    name: 'Vila dos Bigodes', size: 150, surface: 'grass', sky: [0x8fd0f5, 0xffb27a, 0x0b1230], fog: 1,
    spawn: [0, 9, 0], build(w, E, r) {
      const pond = [42, 36];
      w.heightFn = (x, z) => {
        const d = Math.hypot(x, z); let h = (fbm(x * 0.05, z * 0.05, 3, 2) - 0.5) * 1.6 * smooth(clamp((d - 24) / 14, 0, 1));
        const pd = Math.hypot(x - pond[0], z - pond[1]); if (pd < 13) h -= smooth(1 - pd / 13) * 2.6;
        if (d > 60) h += Math.min(10, (d - 60) * (d - 60) * 0.045); return h;
      };
      const g1 = C(0x6fbf4f), g2 = C(0x58a844), path = C(0xd9c08a), sand = C(0xd8c890);
      w.buildGround(56, (x, z, h, c) => {
        const d = Math.hypot(x, z); mix(c, g1, g2, noise2(x * 0.15, z * 0.15, 9));
        if (d < 13 || (d < 24 && d > 17) || (Math.abs(Math.atan2(z, x) * 4 / PI % 1) < 0.07 && d < 40)) mix(c, c, path, 0.85);
        if (h < -0.6) mix(c, c, sand, 0.9);
      });
      w.addWater(-0.9, 0x3f9fd8);
      // praça
      w.put('town/fountain-round-detail', 0, 0, { s: 3.2, col: 'box', cs: 0.72, ch: 0.5 }); w.put('prim/cyl', 0, 0, { s: [0.9, 2.6, 0.9], tint: T(0xb9c2c8) }); w.addBoxC(0, 0, 0, 0.8, 2.6, 0.8);
      w.put('nature/statue_head', 0, 0, { s: 1.4, y: 2.6, ry: PI });
      ring(8, 14.5, (x, z) => lampPost(w, E, x, z), PI / 8);
      ring(8, 11, (x, z, a) => w.put('grave/bench', x, z, { s: 2, ry: -a + H, col: 'box' }), PI / 8);
      // portais para os outros mapas
      const dest = ['forest', 'mine', 'desert', 'snow', 'arena', 'castle', 'city', 'island', 'training', 'aero', 'dark', 'pool'];
      ring(12, 21.5, (x, z, a, i) => E.portal(dest[i], x, z), -H + PI / 10);
      // casas
      ring(10, 33, (x, z, a, i) => { const ry = Math.round(Math.atan2(z, -x) / H) * H; house(w, x, z, ry, { wood: i % 2, floors: 1 + (i % 3 === 0 ? 1 : 0), chimney: i % 2, s: 4.6, roof: i % 3 === 1 ? 'town/roof-point' : 'town/roof-high-point' }); }, 0.3);
      ring(7, 47, (x, z, a, i) => { if (Math.hypot(x - pond[0], z - pond[1]) < 16) return; const ry = Math.round(Math.atan2(z, -x) / H) * H; house(w, x, z, ry, { wood: (i + 1) % 2, s: 4.2 }); }, 0.9);
      // bancas e NPCs
      w.put('town/stall-green', -7, -15, { s: 3, ry: 0, col: 'box' }); w.put('town/stall-red', 7, -15, { s: 3, col: 'box' }); w.put('town/stall', 15, -5, { s: 3, ry: H, col: 'box' });
      w.put('survival/workbench-anvil', -15, -6, { s: 4, col: 'box' }); w.put('survival/workbench-grind', -16.5, -3.5, { s: 4, col: 'box' }); w.put('town/cart', 14, 6, { s: 2.6, ry: 0.6, col: 'box' });
      E.npc('mimi', 'Mimi', 'Guia da Vila', 0, 6, NPC_LOOKS.mimi, { quests: ['v1', 'v2'], yaw: 0, lines: ['Bem-vindo ao RoleVRGO! Aponte o controle para o chão e empurre para andar como um gorila.', 'Segure o gatilho encostado numa parede para agarrar e escalar.', 'Os anéis de pedra são portais. Cada um leva a um mapa diferente!', 'Clique no centro do touchpad para abrir o menu.'] });
      E.npc('la', 'Dona Lã', 'Mercearia', -7, -12.6, NPC_LOOKS.la, { shop: 'general', yaw: PI, lines: ['Petiscos fresquinhos! Recuperam a vida.', 'Eu compro tudo que você achar por aí.'] });
      E.npc('ferreiro', 'Brasa', 'Ferreiro', -13.4, -5, NPC_LOOKS.ferreiro, { shop: 'smith', quests: ['v4'], yaw: -H, lines: ['Uma picareta melhor quebra pedras mais duras.', 'Ouro e gemas só saem com ferramenta boa.'] });
      E.npc('bigode', 'Seu Bigode', 'Pescador', 37, 25, NPC_LOOKS.bigode, { shop: 'fisher', quests: ['v3'], yaw: 0.5, lines: ['Aponte para a água e aperte o gatilho para lançar a linha.', 'Quando a boia afundar, puxe o controle para cima!'] });
      E.npc('oficio', 'Mestre Ofício', 'Profissões', 7, -12.6, NPC_LOOKS.oficio, { prof: true, yaw: PI, lines: ['Toda pata tem um talento. Escolha uma profissão!', 'Você pode trocar de profissão quando quiser.'] });
      // lago e pesca
      E.fish(pond[0], pond[1], 9); w.put('pirate/structure-platform-dock-small', 36.5, 28.5, { s: 1.5, ry: 0.9, abs: -1.6, col: 'box' }); w.put('nature/canoe', 45, 40, { s: 3, abs: -0.95, ry: 1 });
      scatter(w, r, ['nature/lily_large'], 8, { area: [35, 29, 49, 43], water: 1, y: 0, s: [2, 3], ok: (x, z) => w.heightAt(x, z) < -1.2, detail: 1 });
      // horta e moinho
      for (let i = 0; i < 12; i++) { const x = -42 + (i % 4) * 2.2, z = 30 + Math.floor(i / 4) * 2.4; if (i % 3 === 0) E.collect('pumpkin', 'nature/crop_pumpkin', x, z, 2.2); else w.put(i % 2 ? 'nature/crops_cornStageD' : 'nature/crops_wheatStageB', x, z, { s: 2, detail: 1 }); }
      for (let i = 0; i < 6; i++) w.put('nature/fence_simple', -43.5 + i * 2, 28, { s: 2, ry: 0 });
      const mh = tower(w, -50, 24, 5, 2, false); w.put('town/windmill', -47.2, 24, { s: 3.2, abs: w.heightAt(-50, 24) + 11 }); E.secret('village', -50, mh + 0.5, 24, 2.2); E.chest('v_mill', -50, mh, 24, 2);
      // natureza
      const far = (x, z) => { const d = Math.hypot(x, z); return d > 26 && Math.hypot(x - pond[0], z - pond[1]) > 13 && !(d > 29 && d < 37) && !(d > 43.5 && d < 50.5); };
      scatter(w, r, ['nature/tree_default', 'nature/tree_oak', 'nature/tree_detailed', 'nature/tree_fat'], 70, { s: [3.6, 5.5], col: 'trunk', cw: 0.11, ok: (x, z) => far(x, z) && Math.hypot(x, z) > 38, tv: 0.25 });
      scatter(w, r, ['town/tree', 'town/tree-high-round'], 10, { s: [1.9, 2.4], col: 'trunk', cw: 0.14, ok: (x, z) => far(x, z) && Math.hypot(x, z) < 44 });
      scatter(w, r, ['nature/plant_bush', 'nature/plant_bushDetailed', 'nature/rock_smallA', 'nature/stump_round'], 60, { s: [1.5, 2.6], ok: far, detail: 1 });
      scatter(w, r, ['nature/flower_redA', 'nature/flower_yellowB', 'nature/flower_purpleC', 'nature/grass_large', 'nature/grass'], 170, { s: [2, 3], ok: (x, z) => Math.hypot(x, z) > 14 && Math.hypot(x, z) < 62, detail: 1 });
      for (let i = 0; i < 5; i++) { const a = r() * 6.28, d = 40 + r() * 16; E.ore(i < 3 ? 'stone' : 'copper', Math.cos(a) * d, Math.sin(a) * d); }
      E.chest('v_1', -27, null, 40, 0); E.chest('v_2', 55, null, -12, 0); E.chest('v_3', 12, null, 58, 1);
      E.sign('Lago dos Bigodes — pesca', 38, 2.6, 30); E.board(-4.5, 14.5, PI);
      for (let i = 0; i < 12; i++) { let x, z; do { const a = r() * 6.28, d = 38 + r() * 18; x = Math.cos(a) * d; z = Math.sin(a) * d; } while (!far(x, z) || w.heightAt(x, z) < 0); E.tree(x, z, i % 2 ? 'nature/tree_default' : 'nature/tree_oak'); }
    }
  },
  // ======================= FLORESTA =======================
  forest: {
    name: 'Floresta Sussurrante', size: 170, surface: 'grass', sky: [0x9fd8c8, 0xf5a86a, 0x06140f], fog: 0.75,
    spawn: [0, 60, 0], build(w, E, r) {
      const river = (x) => Math.sin(x * 0.045) * 22 - 8;
      w.heightFn = (x, z) => { let h = fbm(x * 0.022, z * 0.022, 21, 3) * 9 - 3; const rd = Math.abs(z - river(x)); if (rd < 9) h -= smooth(1 - rd / 9) * (3.2 + h * 0.6); const d = Math.hypot(x, z); if (d > 72) h += Math.min(10, (d - 72) * (d - 72) * 0.05); return h; };
      const g1 = C(0x4f9a45), g2 = C(0x3d7f3a), mud = C(0x7a6a4a);
      w.buildGround(60, (x, z, h, c) => { mix(c, g1, g2, noise2(x * 0.12, z * 0.12, 5)); if (h < -1.4) mix(c, c, mud, 0.85); });
      w.addWater(-1.9, 0x3d8fb0);
      returnPortal(w, E, 0, 66);
      const dry = (x, z) => Math.abs(z - river(x)) > 7 && Math.hypot(x, z - 60) > 8;
      scatter(w, r, ['nature/tree_pineTallA', 'nature/tree_pineDefaultA', 'nature/tree_pineRoundC', 'nature/tree_oak_dark', 'nature/tree_default', 'nature/tree_tall', 'nature/tree_thin'], 260, { s: [4.5, 8], col: 'trunk', cw: 0.085, ok: dry, tv: 0.3 });
      scatter(w, r, ['nature/tree_oak_fall', 'nature/tree_default_fall'], 24, { s: [4, 6], col: 'trunk', cw: 0.1, ok: dry });
      scatter(w, r, ['nature/rock_largeA', 'nature/rock_largeC', 'nature/rock_tallA', 'nature/rock_tallH', 'nature/stone_tallB'], 46, { s: [2.5, 6], col: 'box', cs: 0.7, ok: dry });
      scatter(w, r, ['nature/plant_bush', 'nature/plant_bushLarge', 'nature/plant_bushDetailed', 'nature/log', 'nature/stump_old', 'nature/log_stack'], 110, { s: [1.8, 3], ok: dry, detail: 1 });
      scatter(w, r, ['nature/grass_large', 'nature/grass', 'nature/flower_purpleC', 'nature/mushroom_tanTall'], 200, { s: [2, 3.2], ok: dry, detail: 1 });
      for (let i = 0; i < 26; i++) { let x, z; do { x = (r() - 0.5) * 140; z = (r() - 0.5) * 140; } while (!dry(x, z)); E.collect(i % 4 === 3 ? 'flower' : 'mushroom', i % 4 === 3 ? 'nature/flower_redA' : i % 2 ? 'nature/mushroom_red' : 'nature/mushroom_redGroup', x, z, 3.2); }
      for (let i = 0; i < 8; i++) { let x, z; do { x = (r() - 0.5) * 130; z = (r() - 0.5) * 130; } while (!dry(x, z)); E.collect('wood', 'survival/resource-wood', x, z, 4); }
      // pontes sobre o rio
      for (const bx of [-40, 4, 48]) { const bz = river(bx); for (let k = -3; k <= 3; k++) boxAbs(w, bx, -1.2 + (3 - Math.abs(k)) * 0.12, bz + k * 2.4, 3, 0.25, 2.5, 0x8a6a45); w.put('nature/fence_simple', bx - 1.5, bz, { s: 2, ry: H, abs: -0.6 }); }
      // acampamento
      w.put('nature/tent_detailedOpen', -30, 40, { s: 5, ry: 2.4, col: 'box', cs: 0.7 }); w.put('nature/campfire_stones', -26, 44, { s: 3 }); w.put('nature/campfire_logs', -26, 44, { s: 3 }); E.lamp(-26, w.heightAt(-26, 44) + 0.5, 44, 0xff8a30); w.put('nature/log', -23.5, 45.5, { s: 3.5, ry: 1, col: 'box' });
      E.npc('salvia', 'Sálvia', 'Herbalista', -27.5, 41.5, NPC_LOOKS.salvia, { quests: ['f1', 'f2'], shop: 'general', lines: ['A floresta guarda cogumelos, flores e lenha. É só encostar a pata.', 'Dizem que há uma casa no alto da árvore gigante, ao norte do rio.', 'As pedras grandes são ótimas para treinar escalada.'] });
      // árvore gigante com casa (segredo): troncos escaláveis em espiral
      const tx = 30, tz = -45, tb = w.heightAt(tx, tz);
      w.put('prim/cyl', tx, tz, { s: [5, 26, 5], tint: T(0x6a4a30), abs: tb - 1 }); w.addBoxC(tx, tb - 1, tz, 3.6, 26, 3.6);
      for (let i = 0; i < 16; i++) { const a = i * 0.8, y = tb + 1.2 + i * 1.45; boxAbs(w, tx + Math.cos(a) * 3.4, y, tz + Math.sin(a) * 3.4, 2.2, 0.35, 2.2, 0x8a6a45); }
      boxAbs(w, tx, tb + 25, tz, 11, 0.4, 11, 0x8a6a45); house(Object.assign(Object.create(w), { heightAt: () => tb + 25.4 }), tx, tz, 0, { wood: 1, s: 4 });
      w.put('nature/tree_fat', tx, tz, { s: [26, 14, 26], abs: tb + 22 });
      E.secret('forest', tx + 4, tb + 26, tz, 3); E.chest('f_tree', tx - 3.5, tb + 25.4, tz + 3.5, 2);
      for (let i = 0; i < 6; i++) { let x, z; do { x = (r() - 0.5) * 120; z = (r() - 0.5) * 120; } while (!dry(x, z)); E.ore(i < 2 ? 'copper' : i < 4 ? 'stone' : 'iron', x, z); }
      E.chest('f_1', -55, null, -30, 0); E.chest('f_2', 50, null, 35, 1); E.chest('f_3', -10, null, -62, 1); E.fish(4, river(4) + 5, 6);
      w.put('nature/statue_obelisk', -60, 10, { s: 5, col: 'box' }); E.sign('Ruínas antigas', -60, w.heightAt(-60, 10) + 5, 10); ring(6, 6, (x, z) => w.put('nature/statue_columnDamaged', -60 + x, 10 + z, { s: 4, col: 'box' }));
      E.chest('f_ruin', -60, null, 13, 1);
      E.enemy('ghost', -60, 16, true);
      for (let i = 0; i < 40; i++) { let x, z; do { x = (r() - 0.5) * 140; z = (r() - 0.5) * 140; } while (!dry(x, z)); E.tree(x, z, i % 3 ? 'nature/tree_default' : 'nature/tree_oak'); }
      for (let i = 0; i < 8; i++) { let x, z; do { x = (r() - 0.5) * 140; z = (r() - 0.5) * 140; } while (!dry(x, z) || Math.hypot(x, z - 60) < 28 || Math.hypot(x + 28, z - 42) < 16); E.enemy(i % 3 === 2 ? 'zombie' : 'ghost', x, z); }
    }
  },
  // ======================= MINA =======================
  mine: {
    name: 'Mina Profunda', size: 110, surface: 'stone', sky: [0x16141e, 0x16141e, 0x16141e], fog: 0.5, indoor: true,
    spawn: [0, 40, 0], build(w, E, r) {
      // caverna: corredores esculpidos por ruído; fora deles o "teto" desce como paredão
      const open = (x, z) => { const d = Math.hypot(x * 0.8, z); const n = fbm(x * 0.045 + 7, z * 0.045, 31, 2); return (n > 0.47 ? 1 : 0) || d < 14 || (Math.abs(x) < 5 && z > 0 && z < 46) ? 1 : 0; };
      const soft = (x, z) => (open(x, z) + open(x + 2, z) + open(x - 2, z) + open(x, z + 2) + open(x, z - 2)) / 5;
      w.heightFn = (x, z) => { const s = soft(x, z); const d = Math.hypot(x, z); return (1 - s) * 9 + (fbm(x * 0.1, z * 0.1, 4, 2) - 0.5) * 0.8 - smooth(clamp(1 - d / 40, 0, 1)) * 3 + (d > 50 ? Math.min(10, (d - 50) * 2) : 0); };
      const a = C(0x5a5560), b = C(0x47424d), top = C(0x2e2a33);
      w.buildGround(70, (x, z, h, c) => { mix(c, a, b, noise2(x * 0.3, z * 0.3, 2)); if (h > 3) mix(c, c, top, clamp((h - 3) / 5, 0, 1)); });
      returnPortal(w, E, 0, 44);
      const free = (x, z) => soft(x, z) > 0.9 && Math.hypot(x, z - 42) > 6;
      const pick = () => { const t = r(); return t < 0.26 ? 'stone' : t < 0.46 ? 'coal' : t < 0.63 ? 'copper' : t < 0.76 ? 'iron' : t < 0.85 ? 'silver' : t < 0.91 ? 'gold' : t < 0.95 ? 'quartz' : t < 0.975 ? 'amethyst' : t < 0.99 ? 'emerald' : t < 0.997 ? 'ruby' : 'diamond'; };
      let n = 0, tries = 0; while (n < 70 && tries++ < 4000) { const x = (r() - 0.5) * 96, z = (r() - 0.5) * 96; if (!free(x, z)) continue; const deep = Math.hypot(x, z) < 22; E.ore(deep && r() < 0.35 ? (r() < 0.5 ? 'quartz' : r() < 0.6 ? 'emerald' : r() < 0.8 ? 'amethyst' : r() < 0.93 ? 'gold' : 'diamond') : pick(), x, z); n++; }
      scatter(w, r, ['dungeon/wood-support'], 26, { s: [3.4, 3.6], ok: free, col: 'trunk', cw: 0.05 });
      scatter(w, r, ['dungeon/rocks', 'dungeon/stones', 'nature/rock_tallD', 'nature/stone_tallG', 'nature/stone_largeD'], 60, { s: [1.6, 3.4], ok: free, col: 'box', cs: 0.6, tint: [0.75, 0.72, 0.8] });
      scatter(w, r, ['dungeon/barrel', 'survival/box-large', 'plat/crate'], 22, { s: [1.6, 2.2], ok: free, col: 'box', detail: 1 });
      tries = 0; n = 0; while (n < 26 && tries++ < 2000) { const x = (r() - 0.5) * 92, z = (r() - 0.5) * 92; if (!free(x, z)) continue; w.put('grave/lantern-glass', x, z, { s: 2.2, y: 0 }); E.lamp(x, w.heightAt(x, z) + 0.6, z, 0xffb040); n++; }
      w.put('survival/workbench-anvil', 4.5, 36, { s: 4, col: 'box' }); w.put('survival/tool-pickaxe', 5.6, 37.6, { s: 5, ry: 1 });
      E.npc('pedrita', 'Pedrita', 'Chefe da Mina', 3.4, 38, NPC_LOOKS.pedrita, { quests: ['m1', 'm2'], shop: 'smith', yaw: -H, lines: ['Bata nas pedras coloridas com as patas — quanto mais rápido o golpe, mais dano.', 'Gemas raras ficam no fundo da caverna, lá embaixo.', 'Pedra dura demais? Compre uma picareta melhor.'] });
      E.npc('tunel', 'Túnel', 'Lanterneiro', -3.5, 20, NPC_LOOKS.tunel, { quests: ['m3'], yaw: H, lines: ['Sem carvão, sem lanternas. Sem lanternas... miau.', 'Os nós de minério reaparecem depois de um tempo, para todo mundo.'] });
      // câmara de cristal no centro (mais funda)
      ring(7, 6, (x, z) => E.ore(r() < 0.5 ? 'quartz' : 'amethyst', x, z)); E.chest('m_core', 0, null, 0, 2); E.secret('mine', 0, w.heightAt(0, 0) + 1, 0, 3);
      ring(5, 9.5, (x, z) => { w.put('plat/jewel', x, z, { s: [3, 6, 3], tint: [0.6, 0.9, 1.4] }); E.lamp(x, w.heightAt(x, z) + 1.4, z, 0x60c0ff); });
      E.chest('m_1', -30, null, -18, 1); E.chest('m_2', 28, null, -30, 1); E.chest('m_3', 34, null, 22, 0);
      E.enemy('orc', 0, 9, true);
      { let k = 0, tr = 0; while (k < 9 && tr++ < 3000) { const x = (r() - 0.5) * 90, z = (r() - 0.5) * 90; if (!free(x, z) || Math.hypot(x, z - 40) < 20) continue; E.enemy(k % 3 === 2 ? 'ghost' : 'orc', x, z); k++; } }
    }
  },
  // ======================= DESERTO =======================
  desert: {
    name: 'Deserto Dourado', size: 180, surface: 'sand', sky: [0xa8d8f8, 0xff9a5a, 0x10132e], fog: 1.1,
    spawn: [0, 70, 0], build(w, E, r) {
      const oa = [-45, 20];
      w.heightFn = (x, z) => { let h = Math.sin(x * 0.07 + Math.sin(z * 0.05) * 1.5) * 1.6 + fbm(x * 0.03, z * 0.03, 8, 2) * 5 - 2; const od = Math.hypot(x - oa[0], z - oa[1]); if (od < 16) h = h * (1 - smooth(1 - od / 16)) - smooth(1 - od / 16) * 2.2; const pd = Math.max(Math.abs(x - 35), Math.abs(z + 25)); if (pd < 26) h *= smooth(clamp((pd - 18) / 8, 0, 1)); const d = Math.hypot(x, z); if (d > 78) h += Math.min(10, (d - 78) * (d - 78) * 0.05); return h; };
      const s1 = C(0xe8c878), s2 = C(0xd9b060), gr = C(0x7ab850);
      w.buildGround(60, (x, z, h, c) => { mix(c, s1, s2, noise2(x * 0.1, z * 0.1, 3)); const od = Math.hypot(x - oa[0], z - oa[1]); if (od < 15) mix(c, c, gr, smooth(1 - od / 15) * 0.9); });
      w.addWater(-1.6, 0x35b0c8);
      returnPortal(w, E, 0, 76);
      // pirâmide em degraus (escalável) com segredo no topo
      const px = 35, pz = -25; for (let i = 0; i < 9; i++) { const s = 34 - i * 3.7; boxAbs(w, px, i * 2.4, pz, s, 2.4, s, i % 2 ? 0xd9b668 : 0xe2c276); }
      boxAbs(w, px, 21.6, pz, 1.2, 1.6, 1.2, 0xf2c230); E.secret('desert', px, 22.4, pz, 3); E.chest('d_pyr', px + 1.4, 21.6, pz + 1.4, 2); E.lamp(px, 23.6, pz, 0xffd040);
      ring(4, 23, (x, z) => { w.put('nature/statue_obelisk', px + x, pz + z, { s: 7, col: 'box' }); }, PI / 4);
      // oásis
      scatter(w, r, ['nature/tree_palmTall', 'nature/tree_palmBend', 'nature/tree_palmDetailedTall'], 18, { area: [oa[0] - 15, oa[1] - 15, oa[0] + 15, oa[1] + 15], s: [4, 6], col: 'trunk', cw: 0.07, ok: (x, z) => { const d = Math.hypot(x - oa[0], z - oa[1]); return d > 7 && d < 15; } });
      scatter(w, r, ['nature/plant_bushLarge', 'nature/grass_large', 'nature/flower_yellowB'], 40, { area: [oa[0] - 14, oa[1] - 14, oa[0] + 14, oa[1] + 14], s: [2, 3.2], detail: 1 });
      w.put('survival/tent-canvas', oa[0] + 11, oa[1] - 9, { s: 6, ry: -0.8, col: 'box', cs: 0.7 }); E.fish(oa[0], oa[1], 6);
      E.npc('safira', 'Safira', 'Caçadora de Tesouros', oa[0] + 9, oa[1] - 5.5, NPC_LOOKS.safira, { quests: ['d1', 'd2'], shop: 'general', lines: ['Vê os X no chão? Cave batendo com as patas!', 'A pirâmide esconde algo brilhante no topo.', 'Os cactos dão frutos, se você tiver coragem de encostar.'] });
      const out = (x, z) => Math.hypot(x - oa[0], z - oa[1]) > 17 && Math.max(Math.abs(x - px), Math.abs(z - pz)) > 20 && Math.hypot(x, z - 74) > 7;
      scatter(w, r, ['nature/cactus_tall', 'nature/cactus_short'], 70, { s: [3, 5.5], col: 'trunk', cw: 0.07, ok: out });
      scatter(w, r, ['survival/rock-sand-a', 'survival/rock-sand-b', 'pirate/rocks-sand-a', 'pirate/rocks-sand-b'], 40, { s: [1, 2.6], col: 'box', cs: 0.7, ok: out });
      scatter(w, r, ['nature/statue_columnDamaged', 'nature/statue_column', 'nature/statue_block'], 16, { s: [3, 5], col: 'box', ok: out });
      for (let i = 0; i < 14; i++) { let x, z; do { x = (r() - 0.5) * 150; z = (r() - 0.5) * 150; } while (!out(x, z)); E.dig(x, z); }
      for (let i = 0; i < 12; i++) { let x, z; do { x = (r() - 0.5) * 150; z = (r() - 0.5) * 150; } while (!out(x, z)); E.collect('cactusfruit', 'nature/cactus_short', x, z, 2.6); }
      for (let i = 0; i < 12; i++) { let x, z; do { x = (r() - 0.5) * 150; z = (r() - 0.5) * 150; } while (!out(x, z)); E.ore(i < 4 ? 'sunstone' : i < 8 ? 'gold' : 'copper', x, z); }
      E.chest('d_1', -60, null, -50, 1); E.chest('d_2', 62, null, 40, 0); E.chest('d_3', -20, null, -66, 1);
      E.enemy('skeleton', 8, -25, true);
      for (let i = 0; i < 8; i++) { let x, z; do { x = (r() - 0.5) * 150; z = (r() - 0.5) * 150; } while (!out(x, z) || Math.hypot(x, z - 74) < 26 || w.heightAt(x, z) < w.waterY + 0.3); E.enemy('skeleton', x, z); }
      // acampamento de caravana
      w.put('town/cart-high', 10, 62, { s: 2.8, ry: 0.4, col: 'box' }); w.put('survival/tent', 15, 66, { s: 6, col: 'box', cs: 0.7 }); w.put('nature/campfire_stones', 11, 67, { s: 3 }); E.lamp(11, w.heightAt(11, 67) + 0.5, 67, 0xff8a30);
    }
  },
  // ======================= MONTANHAS NEVADAS =======================
  snow: {
    name: 'Montanhas Nevadas', size: 190, surface: 'snow', sky: [0xc8e4f8, 0xf5b8a0, 0x0c1430], fog: 0.9,
    spawn: [0, 78, 0], build(w, E, r) {
      const peak = [0, -20];
      w.heightFn = (x, z) => { const d = Math.hypot(x - peak[0], z - peak[1]); let h = Math.max(0, 1 - d / 62); h = Math.pow(h, 1.35) * 62 + fbm(x * 0.05, z * 0.05, 12, 3) * 5 * clamp(d / 20, 0.15, 1) - 1.5; const st = Math.floor(h / 6) * 6; h = h * 0.55 + st * 0.45; const e = Math.hypot(x, z); if (e > 84) h += Math.min(10, (e - 84) * (e - 84) * 0.06); return h; };
      const sn = C(0xf4f8ff), sn2 = C(0xdde8f5), rock = C(0x7d8794);
      w.buildGround(72, (x, z, h, c) => { mix(c, sn, sn2, noise2(x * 0.1, z * 0.1, 6)); const e = 0.8, g = Math.hypot(w.heightFn(x + e, z) - w.heightFn(x - e, z), w.heightFn(x, z + e) - w.heightFn(x, z - e)) / (2 * e); if (g > 1.1) mix(c, c, rock, clamp((g - 1.1) * 1.4, 0, 0.95)); });
      returnPortal(w, E, 0, 84);
      const low = (x, z) => w.heightAt(x, z) < 14 && Math.hypot(x, z - 82) > 7;
      scatter(w, r, ['holiday/tree-snow-a', 'holiday/tree-snow-b', 'holiday/tree-snow-c', 'plat/tree-pine-snow', 'plat/tree-snow'], 150, { s: [2.4, 4.2], col: 'trunk', cw: 0.1, ok: low });
      scatter(w, r, ['holiday/rocks-large', 'holiday/rocks-medium'], 50, { s: [1, 2.2], col: 'box', cs: 0.7 });
      scatter(w, r, ['holiday/snow-pile', 'holiday/snow-bunker'], 40, { s: [1.5, 2.5], ok: low, detail: 1 });
      // vilarejo de cabanas
      const cab = (x, z, ry) => { house(w, x, z, ry, { wood: 1, s: 4.4, rtint: [1.5, 1.5, 1.6], chimney: 1 }); };
      cab(-14, 70, 0); cab(14, 70, PI); cab(-22, 58, 0); cab(22, 58, PI);
      w.put('holiday/snowman-hat', -5, 72, { s: 2.2, ry: 0.4, col: 'box' }); w.put('holiday/sled', 6, 73, { s: 2.4, ry: 1.2, col: 'box' }); w.put('holiday/tree-decorated-snow', 0, 62, { s: 3.4, col: 'trunk', cw: 0.2 });
      lampPost(w, E, -8, 66); lampPost(w, E, 8, 66); w.put('holiday/reindeer', 10, 60, { s: 2, ry: -0.6, col: 'box' });
      E.npc('floco', 'Floco', 'Guia da Montanha', 3, 68, NPC_LOOKS.floco, { quests: ['s1', 's2'], shop: 'winter', lines: ['O cume fica lá no alto. Só se chega escalando com as patas!', 'Agarre a rocha com o gatilho, puxe para baixo e solte para subir.', 'Cristais de gelo brilham azul nas encostas.'] });
      // rota de escalada: plataformas + cume
      for (let i = 0; i < 9; i++) { const a = -0.4 + i * 0.5, d = 44 - i * 4.6, x = peak[0] + Math.sin(a) * d, z = peak[1] + Math.cos(a) * d; boxAbs(w, x, w.heightAt(x, z) - 0.6, z, 4, 1.2, 4, 0x8a94a2); if (i % 3 === 1) E.chest('s_r' + i, x, w.heightAt(x, z) + 0.6, z, 1); if (i % 2 === 0) E.ore('ice', x + 2.6, z + 1); }
      const top = w.heightAt(peak[0], peak[1]); w.put('castle/flag-wide', peak[0], peak[1], { s: 5, abs: top }); E.secret('snow', peak[0], top + 1, peak[1], 4); E.chest('s_top', peak[0] + 2, top, peak[1] + 1, 2); E.lamp(peak[0], top + 4.6, peak[1], 0x90d0ff);
      for (let i = 0; i < 14; i++) { const a = r() * 6.28, d = 20 + r() * 34; E.ore(r() < 0.55 ? 'ice' : r() < 0.6 ? 'silver' : 'iron', peak[0] + Math.cos(a) * d, peak[1] + Math.sin(a) * d); }
      for (let i = 0; i < 16; i++) { let x, z; do { x = (r() - 0.5) * 160; z = (r() - 0.5) * 160; } while (!low(x, z)); E.collect('snowbell', 'nature/flower_purpleC', x, z, 3.4); }
      E.chest('s_1', -60, null, 50, 0); E.chest('s_2', 64, null, 30, 1);
      E.enemy('orc', 40, 44, true);
      for (let i = 0; i < 10; i++) { let x, z; do { x = (r() - 0.5) * 150; z = (r() - 0.5) * 150; } while (!low(x, z)); E.tree(x, z, 'plat/tree-pine-snow'); }
      for (let i = 0; i < 6; i++) { let x, z; do { x = (r() - 0.5) * 160; z = (r() - 0.5) * 160; } while (!low(x, z) || Math.hypot(x, z - 68) < 30); E.enemy(i % 3 === 0 ? 'ghost' : 'orc', x, z); } E.spring(-30, 62, 15); E.sign('Trampolim de neve!', -30, w.heightAt(-30, 62) + 2.2, 62);
    }
  },
  // ======================= ARENA =======================
  arena: {
    name: 'Arena dos Campeões', size: 110, surface: 'stone', sky: [0x9cc8f0, 0xf7a060, 0x150f2a], fog: 1,
    spawn: [0, 36, 0], build(w, E, r) {
      w.heightFn = (x, z) => { const d = Math.hypot(x, z); return d > 44 ? Math.min(10, (d - 44) * (d - 44) * 0.08) : 0; };
      const s1 = C(0xd8c49a), s2 = C(0xc9b287), ringc = C(0xb5553a), gr = C(0x78b050);
      w.buildGround(44, (x, z, h, c) => { const d = Math.hypot(x, z); mix(c, s1, s2, noise2(x * 0.2, z * 0.2, 1)); if (d < 12.2 && d > 11.4) mix(c, c, ringc, 1); if (d > 40) mix(c, c, gr, clamp((d - 40) / 4, 0, 1)); });
      returnPortal(w, E, 0, 41);
      // ringue central (zona de PvP) elevado
      w.put('prim/cyl', 0, 0, { s: [23, 0.5, 23], tint: T(0xe6d6b0), abs: 0 }); w.addBoxC(0, -1, 0, 16.2, 1.5, 16.2); w.addBoxC(0, -1, 0, 21.5, 1.5, 9); w.addBoxC(0, -1, 0, 9, 1.5, 21.5);
      E.zone('fight', 0, 0, 11.5);
      ring(12, 12.6, (x, z, a) => { w.put('arena/column', x, z, { s: 2.2, col: 'box', cs: 0.6 }); if (a % 1 < 0.6) E.lamp(x, 2.4, z, 0xffa040); });
      // arquibancadas em anel (degraus escaláveis)
      for (let t = 0; t < 4; t++) ring(28, 24 + t * 3, (x, z, a) => { if (Math.abs(Math.atan2(Math.sin(a - H), Math.cos(a - H))) < 0.25) return; boxAbs(w, x, 0, z, 5.2 + t * 0.6, 1.2 + t * 1.3, 5.2 + t * 0.6, t % 2 ? 0xc8b58c : 0xbba678); });
      ring(14, 37.5, (x, z, a) => { if (Math.abs(Math.atan2(Math.sin(a - H), Math.cos(a - H))) < 0.3) return; w.put('arena/banner', x, z, { s: 4, ry: -a - H, abs: 5.1 }); }, 0.2);
      w.put('arena/statue', -6, 30, { s: 3.4, ry: PI, col: 'box' }); w.put('arena/statue', 6, 30, { s: 3.4, ry: PI, col: 'box' }); w.put('arena/trophy', 0, 17, { s: 3, col: 'box' });
      w.put('arena/weapon-rack', -10, 19, { s: 3, ry: 0.5, col: 'box' }); w.put('dungeon/table', 10, 19, { s: 3, ry: -0.5, col: 'box' });
      E.npc('garra', 'Garra', 'Mestre de Arena', 3.5, 19.5, NPC_LOOKS.garra, { quests: ['a1', 'a2', 'a3'], shop: 'dojo', yaw: 0, lines: ['Dentro do anel vermelho vale tudo: soque com as patas!', 'Golpes rápidos e alternados fazem COMBO. Toque para baixo no touchpad para bloquear.', 'Clique nos lados do touchpad para esquivar.', 'Fora do ringue ninguém se machuca. Aqui é roleplay também!'] });
      E.board(-3.5, 19.5, 0); E.dummy(-17, 6); E.dummy(17, 6); E.dummy(-17, -6); E.dummy(17, -6);
      E.npc('mestre_arena', 'Mestre Bigodão', 'Sparring (NPC)', 0, -7.5, NPC_LOOKS.mestre, { spar: true, yaw: 0, lines: ['Entre no ringue e me acerte para começar o treino!'] });
      E.chest('a_1', -34, 5.1, 0, 1); E.chest('a_2', 34, 5.1, 0, 1); E.secret('arena', 0, 6.2, -34, 3);
    }
  },
  // ======================= CASTELO =======================
  castle: {
    name: 'Castelo Real', size: 150, surface: 'grass', sky: [0x90c0f0, 0xf0a070, 0x0a0f2a], fog: 1,
    spawn: [0, 62, 0], build(w, E, r) {
      w.heightFn = (x, z) => { const m = Math.max(Math.abs(x), Math.abs(z + 5)); let h = smooth(clamp((46 - m) / 12, 0, 1)) * 3; const mo = Math.abs(m - 40); if (mo < 5 && !(Math.abs(x) < 5 && z > 0)) h -= smooth(1 - mo / 5) * 4; h += (fbm(x * 0.04, z * 0.04, 14, 2) - 0.5) * 2 * clamp((m - 46) / 10, 0, 1); const d = Math.hypot(x, z); if (d > 66) h += Math.min(10, (d - 66) * (d - 66) * 0.05); return h; };
      const g1 = C(0x68b04c), g2 = C(0x579a42), st = C(0xb8b0a0), mud = C(0x6a7a55);
      w.buildGround(56, (x, z, h, c) => { const m = Math.max(Math.abs(x), Math.abs(z + 5)); mix(c, g1, g2, noise2(x * 0.14, z * 0.14, 4)); if (m < 31) mix(c, c, st, 0.8); if (Math.abs(x) < 3 && z > 0 && z < 60) mix(c, c, st, 0.8); if (h < -1) mix(c, c, mud, 0.8); });
      w.addWater(-1.6, 0x3d86b8);
      returnPortal(w, E, 0, 68);
      // muralha quadrada (lado 60) com passarela, 4 torres e portão
      const L = 30, cz = -5, S = 6;
      for (let i = -4; i <= 4; i++) {
        const p = i * S;
        for (const side of [0, 1, 2, 3]) {
          const gate = side === 0 && i === 0; const x = side === 0 || side === 2 ? p : side === 1 ? L : -L, z = side === 0 ? cz + L : side === 2 ? cz - L : cz + p;
          w.put(gate ? 'castle/wall-doorway' : 'castle/wall', x, z, { s: S, ry: side % 2 ? H : 0, abs: 3 });
          if (gate) { w.addBoxC(x - 2.4, 0, z, 1.2, 10.8, 3); w.addBoxC(x + 2.4, 0, z, 1.2, 10.8, 3); w.addBoxC(x, 7.6, z, 6, 3.2, 3); }
          else { w.addBoxC(x, 0, z, side % 2 ? 3 : S, 9.4, side % 2 ? S : 3); const ox = side === 1 ? 1.3 : side === 3 ? -1.3 : 0, oz = side === 0 ? 1.3 : side === 2 ? -1.3 : 0; w.addBoxC(x + ox, 9.4, z + oz, side % 2 ? 0.5 : S, 1.4, side % 2 ? S : 0.5); }
        }
      }
      let topY = 0; for (const [tx, tz] of [[-L, cz - L], [L, cz - L], [-L, cz + L], [L, cz + L]]) topY = tower(w, tx, tz, 8, 2, tx > 0);
      // torre de menagem (keep) com a torre mais alta
      const ky = tower(w, 0, -20, 12, 2, false); const hy = tower(Object.assign(Object.create(w), { heightAt: () => ky + 0.2 }), 0, -20, 6, 2, false);
      w.put('castle/flag-banner-long', 0, -13.9, { s: 4, abs: 14, ry: H }); w.put('castle/flag', 0, -20, { s: 5, abs: hy + 1.6 }); E.secret('castle', 0, hy + 2, -20, 4); E.chest('c_keep', 2, hy + 1.8, -20, 2);
      for (let i = 0; i < 10; i++) boxAbs(w, 7 + (i % 2) * 0.01, 3 + i * 1.9, -13 + i * 0.01 - (i > 5 ? (i - 5) * 2.4 : 0), 2.2, 0.4, 2.2, 0x8a7a66); // degraus para subir o keep
      boxAbs(w, -26.5, 3, 12, 3, 1.6, 3, 0x9a8f80); boxAbs(w, -26.5, 3, 15, 3, 3.2, 3, 0x9a8f80); boxAbs(w, -26.5, 3, 18, 3, 4.8, 3, 0x9a8f80); boxAbs(w, -26.5, 3, 21, 3, 6.4, 3, 0x9a8f80); // escada para a muralha
      // pátio
      w.put('town/fountain-round', 0, 8, { s: 2.6, col: 'box', cs: 0.75, ch: 0.6, abs: 3 }); for (const x of [-9, 9]) for (const z of [0, 12]) lampPost(w, E, x, z);
      w.put('castle/siege-catapult', -16, 12, { s: 3, ry: 0.6, col: 'box', cs: 0.7 }); w.put('castle/siege-ballista', 17, 14, { s: 3, ry: -2, col: 'box', cs: 0.7 }); w.put('arena/weapon-rack', 14, -6, { s: 3, ry: -H, col: 'box' });
      w.put('town/stall-red', -15, -8, { s: 3.2, ry: H, col: 'box' }); w.put('dungeon/table', -15, -2, { s: 3, col: 'box' }); w.put('dungeon/barrel', -17.5, 1, { s: 2, col: 'box' }); w.put('dungeon/pot', -13, 0.5, { s: 2 });
      E.dummy(15, 2);
      E.npc('rei', 'Rei Ronrom', 'Rei dos Gatos', 0, -11.5, NPC_LOOKS.rei, { quests: ['c1', 'c2'], yaw: 0, lines: ['Bem-vindo ao meu castelo, pequeno súdito peludo.', 'A torre mais alta guarda uma surpresa para quem tiver garras para subir.', 'Meus baús reabrem todos os dias. Sirva-se!'] });
      E.npc('cozinheira', 'Dona Sardinha', 'Cozinheira Real', -13, -5, NPC_LOOKS.cozinheira, { quests: ['c3'], shop: 'general', yaw: H, lines: ['O banquete de hoje é peixe. O de amanhã também.', 'Robalos mordem no lago da Vila e na Ilha.'] });
      E.npc('guarda', 'Sentinela', 'Guarda', 4.5, 28, NPC_LOOKS.guarda, { yaw: 0, wander: 0, lines: ['Alto lá! ...Ah, é só um gato. Pode passar.', 'Dá para andar por cima da muralha inteira.'] });
      E.chest('c_1', -24, 3, -28, 1); E.chest('c_2', 24, 12.4, -5, 1); E.chest('c_3', 26, 3, 20, 0);
      const outside = (x, z) => Math.max(Math.abs(x), Math.abs(z + 5)) > 48 && Math.hypot(x, z - 66) > 7;
      scatter(w, r, ['castle/tree-large', 'castle/tree-small', 'nature/tree_oak', 'nature/tree_default'], 90, { s: [3, 5], col: 'trunk', cw: 0.1, ok: outside });
      scatter(w, r, ['castle/rocks-large', 'nature/plant_bushDetailed', 'nature/flower_redA', 'nature/grass_large'], 90, { s: [2, 3], ok: outside, detail: 1 });
      for (let i = 0; i < 6; i++) { const a = r() * 6.28; E.ore(i < 3 ? 'iron' : 'stone', Math.cos(a) * 58, Math.sin(a) * 58 - 5); }
      E.fish(40, -5, 4);
      E.enemy('zombie', -56, -44, true);
      for (let i = 0; i < 10; i++) { let x, z; do { x = (r() - 0.5) * 130; z = (r() - 0.5) * 130; } while (!outside(x, z) || w.heightAt(x, z) < w.waterY + 0.3); E.tree(x, z, 'nature/tree_oak'); }
      for (let i = 0; i < 6; i++) { let x, z; do { x = (r() - 0.5) * 130; z = (r() - 0.5) * 130; } while (!outside(x, z) || Math.hypot(x, z - 62) < 22 || w.heightAt(x, z) < w.waterY + 0.3); E.enemy(i % 2 ? 'skeleton' : 'zombie', x, z); }
    }
  },
  // ======================= CIDADE =======================
  city: {
    name: 'Miaulópolis', size: 170, surface: 'stone', sky: [0x9ac4ee, 0xf59a70, 0x0c0f24], fog: 1,
    spawn: [0, 6, 0], build(w, E, r) {
      w.heightFn = (x, z) => { const d = Math.max(Math.abs(x), Math.abs(z)); return d > 74 ? Math.min(10, (d - 74) * (d - 74) * 0.08) : 0; };
      const road = C(0x4a4d55), walk = C(0xb0b3ba), line = C(0xe8d060), park = C(0x6ab850);
      const B = 24; const cell = (v) => ((v + B * 20 + B / 2) % B) - B / 2; // ruas a cada 24 m
      w.buildGround(68, (x, z, h, c) => { const ax = Math.abs(cell(x)), az = Math.abs(cell(z)); if (ax < 3.2 || az < 3.2) { c[0] = road[0]; c[1] = road[1]; c[2] = road[2]; if ((ax < 0.25 && az > 3.2) || (az < 0.25 && ax > 3.2)) mix(c, c, line, 0.9); } else { c[0] = walk[0]; c[1] = walk[1]; c[2] = walk[2]; } if (Math.abs(x) < 9 && Math.abs(z) < 9 && !(ax < 3.2 || az < 3.2)) mix(c, c, park, 1); });
      returnPortal(w, E, 0, -3);
      const blds = ['city/building-a', 'city/building-b', 'city/building-c', 'city/building-d', 'city/building-e', 'city/building-f', 'city/building-g', 'city/building-h', 'city/building-i', 'city/building-k', 'city/building-l'];
      const sky = ['city/building-skyscraper-a', 'city/building-skyscraper-b', 'city/building-skyscraper-c', 'city/building-skyscraper-e', 'city/building-m'];
      let tallest = null;
      for (let bx = -3; bx <= 2; bx++) for (let bz = -3; bz <= 2; bz++) {
        const cx = bx * B + B / 2, cz = bz * B + B / 2; if (Math.abs(cx) < 13 && Math.abs(cz) < 13) continue;
        const central = Math.abs(bx + 0.5) < 2 && Math.abs(bz + 0.5) < 2;
        if (central && r() < 0.5) { const k = sky[Math.floor(r() * sky.length)], s = 8.5 + r() * 2; const bb = w.put(k, cx, cz, { s, ry: Math.floor(r() * 4) * H, col: 'box' }); if (!tallest || bb.y1 > tallest.y1) tallest = Object.assign({ x: cx, z: cz }, bb); }
        else for (let q = 0; q < 4; q++) { const k = blds[Math.floor(r() * blds.length)], s = 6.2 + r() * 1.6, ox = (q % 2 ? 1 : -1) * 4.6, oz = (q < 2 ? 1 : -1) * 4.6; w.put(k, cx + ox, cz + oz, { s, ry: (q < 2 ? 0 : PI) + (r() < 0.3 ? H : 0), col: 'box', tv: 0 }); }
      }
      E.secret('city', tallest.x, tallest.y1 + 1, tallest.z, 5); E.chest('y_top', tallest.x + 1.5, tallest.y1, tallest.z, 2); E.lamp(tallest.x, tallest.y1 + 2, tallest.z, 0xff4060);
      // escada de incêndio (plataformas) até o topo do arranha-céu mais alto
      for (let y = 2.2, i = 0; y < tallest.y1; y += 2.3, i++) { const sx = tallest.x1 + 1.2, sz = tallest.z + ((i % 4) - 1.5) * 1.6; boxAbs(w, sx, y, sz, 2.2, 0.3, 2.2, 0x5a6270); }
      // praça central
      w.put('town/fountain-round-detail', 0, 6.5, { s: 2.2, col: 'box', cs: 0.75, ch: 0.6 }); scatter(w, r, ['town/tree', 'town/tree-high-round'], 8, { area: [-8.5, -8.5, 8.5, 8.5], s: [1.6, 2], col: 'trunk', cw: 0.13, ok: (x, z) => Math.abs(cell(x)) > 4 && Math.abs(cell(z)) > 4 && Math.hypot(x, z - 6.5) > 4 });
      for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) { if ((i + j) % 2) continue; const x = i * B + 4, z = j * B + 4; w.put('grave/lightpost-single', x, z, { s: 3.6, ry: (i * 3 + j) * H, col: 'trunk', cw: 0.05 }); E.lamp(x, 4.3, z, 0xfff0b0); }
      w.put('city/detail-parasol-a', -6, -6, { s: 5, col: 'trunk', cw: 0.03 }); w.put('city/detail-parasol-b', 6.5, -6.5, { s: 5, col: 'trunk', cw: 0.03 }); w.put('grave/bench', -6, -4.5, { s: 2.2, col: 'box' }); w.put('town/stall-green', 6.5, 4, { s: 3, ry: -H, col: 'box' });
      E.npc('carteiro', 'Selo', 'Carteiro', -5, 5, NPC_LOOKS.carteiro, { quests: ['y1', 'y2'], yaw: 2, lines: ['Encomendas espalhadas pela cidade inteira! Me ajuda?', 'Os prédios são ótimos para escalar. Agarre, puxe, solte!', 'Há uma escada de incêndio no arranha-céu mais alto.'] });
      E.npc('fifi', 'Fifi', 'Boutique de Chapéus', 5, 4, NPC_LOOKS.fifi, { shop: 'fashion', yaw: -H, lines: ['Um gato sem chapéu é só um gato. Com chapéu, é um ÍCONE.', 'Depois de comprar, vista no menu Perfil.'] });
      for (let i = 0; i < 12; i++) { const x = (Math.floor(r() * 6) - 3) * B + (r() < 0.5 ? 4.2 : -4.2), z = (Math.floor(r() * 6) - 3) * B + (r() - 0.5) * 14; E.collect('package', 'survival/box', x, z, 2.4); }
      E.chest('y_1', -62, null, -62, 1); E.chest('y_2', 60, null, 38, 0); E.chest('y_3', -38, null, 62, 1); E.spring(15.5, 15.5, 17); E.dummy(-8, 0);
    }
  },
  // ======================= ILHA =======================
  island: {
    name: 'Ilha do Tesouro', size: 190, surface: 'sand', swim: true, sky: [0x80d0f8, 0xffa070, 0x08122c], fog: 1.2,
    spawn: [0, 30, 0], build(w, E, r) {
      w.heightFn = (x, z) => { const d = Math.hypot(x, z * 1.15), a = Math.atan2(z, x); const rad = 52 + Math.sin(a * 3) * 7 + Math.sin(a * 5 + 1) * 4; let h = (rad - d) * 0.16; h = h > 0 ? Math.min(h, 2.2) + Math.pow(Math.max(0, 1 - Math.hypot(x + 14, z + 12) / 30), 2) * 13 + fbm(x * 0.06, z * 0.06, 9, 2) * 1.2 : Math.max(h, -5); const s = Math.hypot(x - 64, z - 30); if (s < 16) h = Math.max(h, (16 - s) * 0.14 - 1.3); return h; };
      const sand = C(0xf0dca0), gr = C(0x62b848), rock = C(0x8a8a80), sea = C(0xc8b888);
      w.buildGround(64, (x, z, h, c) => { if (h < 0.1) { c[0] = sea[0]; c[1] = sea[1]; c[2] = sea[2]; } else { mix(c, sand, gr, smooth(clamp((h - 1.2) / 1.4, 0, 1))); if (h > 8) mix(c, c, rock, clamp((h - 8) / 3, 0, 0.8)); } });
      w.addWater(-0.3, 0x2aa0d8, 3);
      returnPortal(w, E, 0, 36);
      const land = (x, z) => w.heightAt(x, z) > 0.5 && Math.hypot(x, z - 34) > 6;
      scatter(w, r, ['pirate/palm-bend', 'pirate/palm-straight', 'pirate/palm-detailed-bend', 'pirate/palm-detailed-straight'], 70, { s: [1.2, 2], col: 'trunk', cw: 0.22, ok: (x, z) => land(x, z) && w.heightAt(x, z) < 9 });
      scatter(w, r, ['pirate/rocks-a', 'pirate/rocks-b', 'pirate/rocks-sand-a'], 22, { s: [0.6, 1.4], col: 'box', cs: 0.65, water: 1, ok: (x, z) => w.heightAt(x, z) > -2.5 });
      scatter(w, r, ['pirate/grass-plant', 'pirate/patch-grass-foliage', 'nature/plant_bushLarge', 'nature/flower_yellowB'], 120, { s: [1, 2.4], ok: (x, z) => w.heightAt(x, z) > 1.6, detail: 1 });
      for (let i = 0; i < 22; i++) { const a = r() * 6.28, d = 40 + r() * 12, x = Math.cos(a) * d, z = Math.sin(a) * d / 1.15; if (w.heightAt(x, z) > 0.15 && w.heightAt(x, z) < 1.6) E.collect('shell', 'nature/rock_smallC', x, z, 1.6, [1.5, 1.2, 1.3]); }
      for (let i = 0; i < 12; i++) { let x, z; do { x = (r() - 0.5) * 100; z = (r() - 0.5) * 90; } while (!(w.heightAt(x, z) > 0.6 && w.heightAt(x, z) < 3)); E.dig(x, z); }
      // cais e vila pirata
      for (let i = 0; i < 7; i++) boxAbs(w, 0, 0.5, 46 + i * 3, 4, 0.35, 3, 0x9a7650); for (let i = 0; i < 4; i++) { boxAbs(w, -1.8, -3, 47 + i * 6, 0.4, 3.6, 0.4, 0x6a5038); boxAbs(w, 1.8, -3, 47 + i * 6, 0.4, 3.6, 0.4, 0x6a5038); }
      E.fish(0, 68, 7); w.put('pirate/boat-row-large', 6, 58, { s: 1.4, abs: -0.5, ry: 0.4 }); w.put('pirate/ship-pirate-large', -28, 78, { s: 1.6, abs: -1.2, ry: 1.2, col: 'box', cs: 0.55, ch: 0.2 });
      w.put('pirate/tower-watch', 12, 30, { s: 1.8, col: 'box', cs: 0.8 }); w.put('pirate/structure-roof', -10, 30, { s: 1.8, ry: 0 }); w.addBoxC(-10, w.heightAt(-10, 30) + 5.2, 30, 5.6, 0.9, 5.8);
      w.put('pirate/barrel', -8, 33, { s: 1, col: 'box' }); w.put('pirate/crate-bottles', -12, 33.5, { s: 1.1, col: 'box' }); w.put('pirate/cannon', 7, 40, { s: 1.3, ry: PI, col: 'box' }); w.put('pirate/flag-pirate-high', 4, 44, { s: 1.6, col: 'trunk', cw: 0.1 });
      lampPost(w, E, -4, 40); lampPost(w, E, 4, 36);
      E.npc('capitao', 'Capitão Garrafa', 'Pirata Aposentado', -10, 30, NPC_LOOKS.capitao, { quests: ['i1', 'i2', 'i3'], shop: 'fisher', lines: ['Arrr! Digo... miarrr!', 'Do cais se pesca o lendário Peixe-Lua. Dizem.', 'O naufrágio a leste guarda um tesouro no alto do mastro.'] });
      // naufrágio (segredo no mastro)
      w.put('pirate/ship-wreck', 64, 30, { s: 2, abs: -1.8, ry: 0.5, col: 'box', cs: 0.5, ch: 0.22 });
      for (let i = 0; i < 9; i++) boxAbs(w, 64 + Math.cos(i * 1.3) * 1.1, 3 + i * 1.9, 30 + Math.sin(i * 1.3) * 1.1, 1.5, 0.3, 1.5, 0x7a5c40);
      E.secret('island', 64, 21, 30, 3.5); E.chest('i_mast', 64.6, 18.5, 30.6, 2);
      // morro do vigia
      const hx = -14, hz = -12, hh = w.heightAt(hx, hz); w.put('pirate/tower-complete-small', hx, hz, { s: 1.5, col: 'box', cs: 0.8 }); E.chest('i_hill', hx + 4, null, hz, 1); E.lamp(hx, hh + 9.6, hz, 0xffc060);
      E.chest('i_1', 38, null, -20, 0); E.chest('i_2', -40, null, 14, 1);
      E.enemy('skeleton', -22, -2, true);
      for (let i = 0; i < 8; i++) { let x, z; do { x = (r() - 0.5) * 90; z = (r() - 0.5) * 80; } while (!(w.heightAt(x, z) > 1 && w.heightAt(x, z) < 6) || Math.hypot(x, z - 34) < 8); E.tree(x, z, 'nature/tree_palmTall'); }
      for (let i = 0; i < 5; i++) { let x, z; do { x = (r() - 0.5) * 100; z = (r() - 0.5) * 90; } while (!(w.heightAt(x, z) > 0.8) || Math.hypot(x, z - 33) < 24); E.enemy('skeleton', x, z); }
      for (let i = 0; i < 8; i++) { const a = r() * 6.28; const x = -14 + Math.cos(a) * 12, z = -12 + Math.sin(a) * 12; E.ore(i < 3 ? 'gold' : i < 6 ? 'copper' : 'silver', x, z); }
    }
  },
  // ======================= AERO PARAÍSO (Frutiger Aero) =======================
  aero: {
    name: 'Aero Paraíso', size: 190, surface: 'grass', sky: [0x4cc6ff, 0xffb8e6, 0x0c2a66], fog: 1.3, swim: true,
    spawn: [0, 64, 0], build(w, E, r) {
      // lago em anel bem fundo (dá para mergulhar) em volta de uma ilhota central; colinas verdes brilhantes ao redor
      w.heightFn = (x, z) => { const d = Math.hypot(x, z); let h = 1.2 + fbm(x * 0.03, z * 0.03, 41, 2) * 5 * smooth(clamp((d - 44) / 20, 0, 1)); const k = clamp((d - 9) / 31, 0, 1); if (d < 40) h = Math.min(h, 1.2 - Math.sin(k * PI) * 13 - (d < 9 ? 0 : 0.2)); if (d < 9) h = 1.4 + (9 - d) * 0.08; if (d > 84) h += Math.min(10, (d - 84) * (d - 84) * 0.06); return h; };
      const g1 = C(0x5fe03c), g2 = C(0x86f24e), sand = C(0xfaf6e6), sea = C(0xa8ecec), deep = C(0x4fb8d8);
      w.buildGround(64, (x, z, h, c) => { if (h < 0) mix(c, sea, deep, clamp(-h / 11, 0, 1)); else { mix(c, g1, g2, noise2(x * 0.09, z * 0.09, 8)); if (h < 1.1) mix(c, c, sand, clamp((1.1 - h) * 2.2, 0, 1)); } });
      w.addWater(0, 0x2ccbf2);
      returnPortal(w, E, 0, 72);
      const land = (x, z) => w.heightAt(x, z) > 1 && Math.hypot(x, z - 68) > 8, AQ = [0.72, 1.25, 1.45], WH = [1.25, 1.3, 1.35];
      // torres de vidro e cúpulas brancas brilhantes
      ring(6, 66, (x, z, a, i) => { if (Math.abs(x) < 14 && z > 0) return; w.put(['city/building-skyscraper-a', 'city/building-skyscraper-c', 'city/building-skyscraper-e'][i % 3], x, z, { s: 6 + (i % 3), ry: -a, col: 'box', tint: AQ }); }, 0.5);
      for (const [x, z, s] of [[-30, 56, 9], [32, 54, 8], [-58, 10, 11], [60, -14, 10], [0, -60, 13], [-40, -44, 8]]) { w.put('prim/dome', x, z, { s, tint: WH, y: -0.2 }); w.addBoxC(x, w.heightAt(x, z) - 1, z, s * 0.62, s * 0.36 + 1, s * 0.62); w.addBoxC(x, w.heightAt(x, z) - 1, z, s * 0.36, s * 0.46 + 1, s * 0.36); w.put('prim/sphere', x, z, { s: s * 0.16, tint: [0.4, 1.3, 1.6], y: s * 0.47 }); E.lamp(x, w.heightAt(x, z) + s * 0.55, z, 0x80e8ff); }
      // esferas brilhantes em pedestais, turbinas eólicas, painéis
      ring(8, 46, (x, z, a, i) => { w.put('prim/cyl', x, z, { s: [0.5, 1.6, 0.5], tint: WH, col: 'box' }); w.put('prim/sphere', x, z, { s: 1.5, tint: i % 2 ? [0.45, 1.35, 1.6] : [0.7, 1.6, 0.6], y: 1.6 }); E.lamp(x, w.heightAt(x, z) + 2.4, z, i % 2 ? 0x70e0ff : 0xa0ff80); }, 0.2);
      for (const [x, z] of [[-70, -40], [72, 30], [-66, 44], [50, -62]]) { const y = w.heightAt(x, z); w.put('prim/cyl', x, z, { s: [0.7, 18, 0.7], tint: WH, col: 'box' }); w.put('prim/sphere', x, z, { s: 1.6, tint: WH, abs: y + 17.3 }); for (let k = 0; k < 3; k++) { const a = k * 2.094 + x; boxAbs(w, x + Math.cos(a) * 3.6, y + 18 + Math.sin(a) * 3.6 - 0.2, z + 0.8, Math.abs(Math.cos(a)) * 6.6 + 0.6, Math.abs(Math.sin(a)) * 6.6 + 0.6, 0.25, 0xf4f8ff); } }
      for (let i = 0; i < 5; i++) boxAbs(w, -20 + i * 3.2, w.heightAt(-20, 78) + 0.5, 80, 3, 0.15, 5, 0x2a6ad8);
      // ponte de vidro até a ilhota central, com a grande esfera-fonte
      for (let i = 0; i < 10; i++) boxAbs(w, 0, 1.25, 41 - i * 3.3, 4, 0.3, 3.2, i % 2 ? 0x9fe8ff : 0xc8f6ff);
      w.put('town/fountain-round-detail', 0, 0, { s: 2.4, col: 'box', cs: 0.75, ch: 0.6 }); w.put('prim/sphere', 0, 0, { s: 3.2, tint: [0.5, 1.4, 1.7], y: 1.4 }); w.addBoxC(0, 1.4, 0, 2, 4.4, 2); E.lamp(0, 6.6, 0, 0x90f0ff);
      ring(6, 6.5, (x, z) => w.put('nature/tree_palmDetailedTall', x, z, { s: 4.2, col: 'trunk', cw: 0.07, tint: [0.9, 1.25, 0.9] }), 0.4);
      // natureza exuberante
      scatter(w, r, ['nature/tree_palmTall', 'nature/tree_palmBend', 'nature/tree_default', 'nature/tree_fat'], 80, { s: [4, 6.5], col: 'trunk', cw: 0.09, ok: (x, z) => land(x, z) && Math.hypot(x, z) > 43, tint: [0.9, 1.3, 0.85] });
      scatter(w, r, ['nature/flower_redA', 'nature/flower_yellowB', 'nature/flower_purpleC', 'nature/grass_large', 'nature/plant_bushDetailed'], 200, { s: [2.2, 3.6], ok: land, detail: 1, tint: [1.15, 1.25, 1.1] });
      // fundo do lago: corais, pérolas, cardumes, cúpula submersa secreta
      const under = (x, z) => w.heightAt(x, z) < -3;
      scatter(w, r, ['nature/rock_tallA', 'nature/rock_tallH', 'nature/stone_tallB', 'nature/plant_bushLarge', 'nature/plant_bushDetailed'], 90, { area: [-40, -40, 40, 40], s: [2, 4.5], water: 1, ok: under, tv: 0, tint: [1.7, 0.8, 1.1] });
      scatter(w, r, ['nature/rock_tallD', 'nature/plant_bush', 'nature/grass_large'], 70, { area: [-40, -40, 40, 40], s: [2, 4], water: 1, ok: under, tint: [0.7, 1.5, 1.3] });
      for (let i = 0; i < 26; i++) { let x, z; do { x = (r() - 0.5) * 76; z = (r() - 0.5) * 76; } while (!under(x, z)); E.collect('pearl', 'plat/jewel', x, z, 1.5, [2.2, 2.2, 2.4]); }
      for (let i = 0; i < 7; i++) { let x, z; do { x = (r() - 0.5) * 70; z = (r() - 0.5) * 70; } while (w.heightAt(x, z) > -8); E.collect('coral', 'nature/rock_smallA', x, z, 2.4, [2.2, 0.7, 1.2]); }
      const sx = -23, sz = -4, sy = w.heightAt(sx, sz); w.put('prim/dome', sx, sz, { s: 9, tint: [0.6, 1.3, 1.5], abs: sy - 0.3 }); E.secret('aero', sx, sy + 1.2, sz, 3.5); E.chest('z_dome', sx + 1, sy, sz + 1, 2); E.lamp(sx, sy + 3, sz, 0x80ffff);
      E.school(20, -5.5, 10, 9, 18); E.school(-12, -7, -22, 7, 14); E.school(6, -3, -24, 6, 12);
      E.chest('z_deep', 22, null, 8, 1); E.chest('z_1', -60, null, -20, 0); E.chest('z_2', 58, null, 44, 1); E.chest('z_3', 30, null, -66, 0);
      E.bubbles(80); E.rainbow(0, -78, 64); E.aero = true;
      // ilhas flutuantes com cachoeira (suba pelos trampolins ao lado)
      for (const [ix, iz, iy, key] of [[-50, 28, 20, 'z_sky1'], [50, -30, 27, 'z_sky2']]) {
        w.put('prim/sphere', ix, iz, { s: [15, 9, 15], tint: [0.75, 0.62, 0.5], abs: iy - 8.6 }); w.put('prim/cyl', ix, iz, { s: [13.4, 0.9, 13.4], tint: [0.5, 1.5, 0.45], abs: iy - 0.5 }); w.addBoxC(ix, iy - 5, iz, 9.6, 5.4, 9.6);
        const top = Object.assign(Object.create(w), { heightAt: () => iy + 0.4 });
        w.put('nature/tree_palmDetailedTall', ix - 2.5, iz + 1, { s: 4.5, abs: iy + 0.4, tint: [0.9, 1.3, 0.9] }); w.addBoxC(ix - 2.5, iy + 0.4, iz + 1, 0.5, 5, 0.5); w.put('prim/sphere', ix + 2.6, iz - 2, { s: 1.8, tint: [0.45, 1.35, 1.6], abs: iy + 0.6 }); E.lamp(ix + 2.6, iy + 2.6, iz - 2, 0x80f0ff);
        for (let k = 0; k < 10; k++) { const a = k * 0.63; w.put(['nature/flower_redA', 'nature/flower_yellowB', 'nature/flower_purpleC'][k % 3], ix + Math.cos(a) * 4, iz + Math.sin(a) * 4, { s: 3, abs: iy + 0.4, detail: 1 }); }
        E.chest(key, ix, iy + 0.4, iz + 2.4, 2); E.waterfall(ix + 5.6, iy + 0.2, iz, w.heightAt(ix + 6.5, iz), 3.4); E.spring(ix - 9.5, iz, Math.sqrt(2 * 9.2 * (iy + 5))); void top;
      }
      E.fish(0, 30, 9); E.spring(-12, 56, 16); E.spring(14, 52, 13); E.spring(46, 20, 20);
      for (let i = 0; i < 6; i++) { const a = r() * 6.28; E.ore('quartz', Math.cos(a) * 58, Math.sin(a) * 58); }
      E.npc('aqua', 'Aqua', 'Guia do Aero Paraíso', 5, 60, { fur: '#7fb7c9', fur2: '#f5f1e8', pattern: 1, eyes: '#4aa3e0', hat: 9, acc: 7 }, { quests: ['z1', 'z2', 'z3'], lines: ['Bem-vindo ao Aero Paraíso! Céu azul, grama brilhante e água cristalina.', 'O lago é fundo: mergulhe e nade. Dê braçadas com as patas ou segure o gatilho para ir na direção apontada.', 'No fundo há pérolas, corais e uma cúpula secreta.', 'Parado na água você flutua de volta à superfície.'] });
      E.npc('vista', 'Vista', 'Loja Cristal', -7, 59, { fur: '#f5f1e8', fur2: '#7fb7c9', pattern: 5, eyes: '#58c26a', hat: 0, acc: 1 }, { quests: ['z4'], shop: 'general', lines: ['Estoure as bolhas com as patas! Elas voltam logo.', 'Tudo aqui é brilhante, limpo e otimista. Como o futuro devia ser.', 'Os trampolins de vidro jogam você lá no alto.'] });
      E.sign('Lago Cristal — mergulhe!', 0, 3.4, 44);
      for (let i = 0; i < 8; i++) { let x, z; do { const a = r() * 6.28, d = 48 + r() * 14; x = Math.cos(a) * d; z = Math.sin(a) * d; } while (!land(x, z)); E.tree(x, z, 'nature/tree_palmTall'); } lampPost(w, E, -4, 66); lampPost(w, E, 4, 66);
    }
  },
  // ======================= REINO SOMBRIO (Dark Fantasy) =======================
  dark: {
    name: 'Reino Sombrio', size: 170, surface: 'stone', sky: [0x3a2252, 0x7a2438, 0x0a0614], fog: 0.6,
    spawn: [0, 70, PI], build(w, E, r) {
      const river = (x) => Math.sin(x * 0.05 + 1) * 16 + 30, DK = [0.4, 0.4, 0.56], DT = [0.42, 0.36, 0.5];
      w.heightFn = (x, z) => { let h = (fbm(x * 0.03, z * 0.03, 51, 3) - 0.42) * 10; const cd = Math.max(Math.abs(x), Math.abs(z + 24)); if (cd < 30) h = h * smooth(clamp((cd - 22) / 8, 0, 1)) + 1.5 * (1 - smooth(clamp((cd - 22) / 8, 0, 1)));
        const rd = Math.abs(z - river(x)); if (rd < 9) h -= smooth(1 - rd / 9) * (3.5 + Math.max(0, h) * 0.5); const sp = Math.hypot(x, z - 66); if (sp < 12) h *= smooth(clamp((sp - 6) / 6, 0, 1)); const d = Math.hypot(x, z); if (d > 74) h += Math.min(10, (d - 74) * (d - 74) * 0.06); return h; };
      const g1 = C(0x3d3a4a), g2 = C(0x2b2836), mud = C(0x3a2a35), path = C(0x5c5262);
      w.buildGround(64, (x, z, h, c) => { mix(c, g1, g2, noise2(x * 0.12, z * 0.12, 7)); if (Math.abs(x) < 3 && z > -4 && z < 68) mix(c, c, path, 0.85); if (h < -1) mix(c, c, mud, 0.8); });
      w.addWater(-1.4, 0x4a1a5a);
      returnPortal(w, E, 0, 76);
      // ponte de pedra sobre o rio sombrio
      const rz = river(0); for (let k = -4; k <= 4; k++) boxAbs(w, 0, -0.6 + (4 - Math.abs(k)) * 0.15, rz + k * 2.4, 3.6, 0.4, 2.5, 0x4a4252);
      for (const sx of [-1.9, 1.9]) for (let k = -4; k <= 4; k += 2) w.put('grave/lantern-candle', sx, rz + k * 2.4, { s: 2.2, abs: -0.1 + (4 - Math.abs(k)) * 0.15 });
      // castelo em ruínas
      const L = 20, cz = -24, S = 6;
      for (let i = -3; i <= 3; i++) for (const side of [0, 1, 2, 3]) {
        if ((i * 7 + side * 3) % 5 === 0 && !(side === 0 && i === 0)) continue; // trechos desmoronados
        const p = i * S, x = side === 0 || side === 2 ? p : side === 1 ? L : -L, z = side === 0 ? cz + L : side === 2 ? cz - L : cz + p, gate = side === 0 && i === 0, half = (i + side) % 3 === 0;
        w.put(gate ? 'castle/wall-doorway' : half ? 'castle/wall-half' : 'castle/wall', x, z, { s: S, ry: side % 2 ? H : 0, abs: 1.5, tint: DK });
        if (gate) { w.addBoxC(x - 2.4, 0, z, 1.2, 9.4, 3); w.addBoxC(x + 2.4, 0, z, 1.2, 9.4, 3); w.addBoxC(x, 6.1, z, 6, 3.2, 3); } else w.addBoxC(x, 0, z, side % 2 ? 3 : S, half ? 5 : 9.4, side % 2 ? S : 3);
      }
      tower(w, -L, cz + L, 7, 1, true, DK); tower(w, L, cz + L, 7, 2, false, DK); tower(w, L, cz - L, 7, 1, true, DK);
      const ky = tower(w, -L, cz - L, 8, 4, false, DK); w.put('castle/flag-banner-long', -L + 4.1, cz - L, { s: 4, abs: ky - 6, ry: H, tint: [0.6, 0.2, 0.25] });
      for (let i = 0; i < 16; i++) { const a = i * 0.78, y = 2 + i * 1.6; boxAbs(w, -L + Math.cos(a) * 5.6, y, cz - L + Math.sin(a) * 5.6, 2.2, 0.35, 2.2, 0x4a4252); } // escada em espiral até o alto da torre
      E.secret('dark', -L, ky + 0.6, cz - L, 3); E.chest('k_tower', -L + 1.5, ky, cz - L + 1, 2); E.lamp(-L, ky + 2.2, cz - L, 0xff3050);
      // sala do trono: altar, trono e cristal amaldiçoado
      boxAbs(w, 0, 1.5, cz - 8, 10, 0.6, 6, 0x3a3242); w.put('dungeon/chair', 0, cz - 9.5, { s: 5, abs: 2.1, ry: 0, col: 'box', tint: [0.6, 0.3, 0.35] });
      w.put('grave/altar-stone', 0, cz - 4.5, { s: 3, abs: 2.1, col: 'box', tint: DK }); w.put('prim/sphere', 0, cz - 4.5, { s: 1.3, abs: 3.6, tint: [1.6, 0.25, 0.35] }); E.lamp(0, 4.3, cz - 4.5, 0xff2040);
      for (const sx of [-6, 6]) for (const sz of [-14, -2]) { w.put('grave/fire-basket', sx, cz + sz, { s: 3, abs: 1.5 }); E.lamp(sx, 2.3, cz + sz, 0xff7a30); w.put('grave/column-large', sx * 1.4, cz + sz, { s: 4, abs: 1.5, col: 'trunk', cw: 0.3, tint: DK }); }
      E.chest('k_throne', 3.5, 2.1, cz - 10, 2); E.enemy('vampire', 0, cz - 2, true);
      // cemitério
      const gx = 44, gz = 8; for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { if (r() < 0.2) continue; w.put(['grave/gravestone-cross', 'grave/gravestone-round', 'grave/gravestone-broken', 'grave/gravestone-decorative'][Math.floor(r() * 4)], gx - 10 + i * 4, gz - 6 + j * 4, { s: 2.6, ry: (r() - 0.5) * 0.4, col: 'box', cs: 0.7, tint: DK }); }
      w.put('grave/crypt-large', gx, gz + 12, { s: 4, ry: PI, col: 'box', tint: DK }); w.put('grave/crypt-small', gx - 12, gz + 10, { s: 4, ry: PI, col: 'box', tint: DK }); w.put('grave/cross-column', gx + 12, gz - 10, { s: 4, col: 'box', tint: DK });
      for (let i = -3; i <= 3; i++) { w.put('grave/iron-fence', gx + i * 4, gz - 12, { s: 4, tint: DK }); w.put('grave/iron-fence', gx + i * 4, gz + 18, { s: 4, ry: PI, tint: DK }); }
      for (const [x, z] of [[gx - 8, gz], [gx + 8, gz + 4], [gx, gz - 4], [gx - 4, gz + 8]]) { w.put('grave/candle-multiple', x, z, { s: 3 }); E.lamp(x, w.heightAt(x, z) + 0.8, z, 0xffb050); }
      scatter(w, r, ['grave/pumpkin-carved', 'grave/pumpkin-tall-carved', 'grave/urn-round', 'grave/debris', 'grave/coffin'], 18, { area: [gx - 14, gz - 10, gx + 14, gz + 16], s: [2, 3] });
      E.chest('k_crypt', gx, null, gz + 7, 1); E.sign('Cemitério dos Bigodes Perdidos', gx, w.heightAt(gx, gz - 14) + 2.6, gz - 14);
      // floresta morta, rochas e ruínas
      const free = (x, z) => Math.max(Math.abs(x), Math.abs(z - cz)) > 30 && Math.hypot(x - gx, z - gz - 3) > 18 && Math.abs(z - river(x)) > 7 && Math.hypot(x, z - 66) > 10 && !(Math.abs(x) < 4 && z > 0);
      scatter(w, r, ['grave/pine', 'grave/pine-crooked', 'grave/pine-fall', 'grave/trunk-long'], 120, { s: [2.4, 4.2], col: 'trunk', cw: 0.08, ok: free, tint: DT });
      scatter(w, r, ['grave/rocks-tall', 'nature/rock_tallA', 'nature/stone_tallB', 'grave/stone-wall-damaged', 'grave/brick-wall'], 40, { s: [2.5, 5], col: 'box', cs: 0.7, ok: free, tint: DK });
      scatter(w, r, ['nature/mushroom_tanTall', 'nature/grass', 'grave/debris'], 90, { s: [2, 3], ok: free, detail: 1, tint: [0.7, 0.5, 0.9] });
      for (let k = 0; k < 12; k++) { const z = 62 - k * 6.5; if (Math.abs(z - river(0)) < 8) continue; for (const sx of [-4, 4]) if (k % 2) { w.put('grave/lightpost-single', sx, z, { s: 3.2, ry: sx > 0 ? PI : 0, col: 'trunk', cw: 0.05, tint: DK }); E.lamp(sx * 0.82, w.heightAt(sx, z) + 3.9, z, 0xb070ff); } }
      // acampamento da bruxa
      w.put('nature/campfire_stones', 7, 62, { s: 3 }); w.put('nature/campfire_logs', 7, 62, { s: 3 }); E.lamp(7, w.heightAt(7, 62) + 0.6, 62, 0x60ff90); w.put('nature/tent_detailedOpen', 13, 58, { s: 5, ry: -2.3, col: 'box', cs: 0.7, tint: [0.5, 0.35, 0.6] });
      E.npc('corvina', 'Corvina', 'Bruxa das Sombras', 9, 64, { fur: '#3b3b45', fur2: '#9b6ad6', pattern: 2, eyes: '#9b6ad6', hat: 8, acc: 5 }, { quests: ['k1', 'k2', 'k3'], shop: 'general', lines: ['Bem-vindo ao Reino Sombrio, gatinho. Daqui pra frente, nada é gentil.', 'O Conde Miaulácula guarda o trono do castelo em ruínas. Leve amigos.', 'No alto da torre mais alta há algo que brilha. Suba pela escada em espiral.', 'Cristais de ametista crescem perto das criptas. Eles adoram a escuridão.'] });
      // minérios amaldiçoados e inimigos
      for (let i = 0; i < 14; i++) { let x, z; do { x = (r() - 0.5) * 140; z = (r() - 0.5) * 140; } while (!free(x, z)); E.ore(i < 5 ? 'amethyst' : i < 8 ? 'ruby' : i < 11 ? 'silver' : 'coal', x, z); }
      const spawnE = (type, n, ok) => { for (let i = 0; i < n; i++) { let x, z, t = 0; do { x = (r() - 0.5) * 140; z = (r() - 0.5) * 140; } while (!ok(x, z) && t++ < 200); E.enemy(type, x, z); } };
      spawnE('ghost', 4, (x, z) => Math.hypot(x - gx, z - gz - 3) < 18); spawnE('skeleton', 4, (x, z) => Math.hypot(x - gx, z - gz - 3) < 22); spawnE('darkknight', 4, (x, z) => Math.max(Math.abs(x), Math.abs(z - cz)) < 18 && Math.hypot(x, z - cz + 6) > 6);
      spawnE('vampire', 3, free); spawnE('zombie', 3, free);
      E.chest('k_1', -56, null, 30, 1); E.chest('k_2', 58, null, -40, 1); E.chest('k_3', -40, null, -60, 0);
      E.sign('Castelo em Ruínas', 0, w.heightAt(0, -1) + 2.8, -1);
    }
  },
  // ======================= POOLROOMS =======================
  pool: {
    name: 'Poolrooms', size: 120, surface: 'stone', sky: [0xeaf6ff, 0xfff1e6, 0x9cc0d0], fog: 0.75, swim: true,
    spawn: [0, 0, 0], build(w, E, r) {
      const N = 7, CS = 16, O = -48, FL = 0, CE = 6.5, WT = 0.6;
      w.heightFn = (x, z) => { const d = Math.max(Math.abs(x), Math.abs(z)); return -4 + (d > 57 ? Math.min(14, (d - 57) * 4) : 0); };
      const tile = C(0x9fdde0), deep = C(0x6cc4cc);
      w.buildGround(48, (x, z, h, c) => { mix(c, tile, deep, 0.4 + noise2(x * 0.2, z * 0.2, 3) * 0.2); });
      w.addWater(0.25, 0xbff8f6, 1, 0.38);
      const TT = { [0xf2f7f6]: [1.2, 1.28, 1.28], [0xf8fbfa]: [1.3, 1.34, 1.34], [0xbfeee8]: [0.95, 1.25, 1.2], [0xfff2c4]: [1.3, 1.24, 1.0], [0xd6e8ff]: [1.08, 1.18, 1.32] };
      const pb = (x, y, z, sx, sy, sz, col) => w.put('prim/box', x, z, { s: [sx, sy, sz], tint: TT[col] || [1.2, 1.28, 1.28], abs: y, col: 'box' });
      const WH = 0xf2f7f6, CEIL = 0xf8fbfa, ACC = [0xbfeee8, 0xfff2c4, 0xf2f7f6, 0xf2f7f6, 0xd6e8ff];
      const cell = [];
      for (let i = 0; i < N; i++) { cell[i] = []; for (let j = 0; j < N; j++) { const spawn = i === 3 && j === 3, secret = i === 6 && j === 6; cell[i][j] = { cx: O + i * CS, cz: O + j * CS, pool: secret ? 'full' : spawn ? null : r() < 0.38 ? 'rect' : null, sky: spawn || r() < 0.12, col: ACC[Math.floor(r() * ACC.length)], pil: r() < 0.3, dive: r() < 0.25 }; } }
      cell[5][6].pool = 'east'; // piscina que encosta na parede da sala secreta (passagem submersa)
      // piso: caixas com topo em y = 0, deixando buracos onde há piscina (fundo em y = -4)
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const c = cell[i][j], x0 = c.cx - CS / 2, z0 = c.cz - CS / 2;
        let px0, px1, pz0, pz1;
        if (c.pool === 'full') { px0 = x0; px1 = x0 + CS; pz0 = z0; pz1 = z0 + CS; }
        else if (c.pool === 'east') { px0 = x0 + 5; px1 = x0 + CS; pz0 = z0 + 4; pz1 = z0 + CS - 4; }
        else if (c.pool) { const a = 3 + Math.floor(r() * 3), b = 3 + Math.floor(r() * 3); px0 = x0 + a; px1 = x0 + CS - b; pz0 = z0 + 3 + Math.floor(r() * 2); pz1 = z0 + CS - 3 - Math.floor(r() * 2); }
        const fb = (ax, az, bx, bz) => { if (bx - ax > 0.05 && bz - az > 0.05) pb((ax + bx) / 2, FL - 4.2, (az + bz) / 2, bx - ax, 4.2, bz - az, c.col); };
        if (!c.pool) fb(x0, z0, x0 + CS, z0 + CS);
        else { fb(x0, z0, x0 + CS, pz0); fb(x0, pz1, x0 + CS, z0 + CS); fb(x0, pz0, px0, pz1); fb(px1, pz0, x0 + CS, pz1); c.pr = [px0, pz0, px1, pz1];
          for (let k = 0; k < 2; k++) { const x = px0 + 1 + r() * (px1 - px0 - 2), z = pz0 + 1 + r() * (pz1 - pz0 - 2); E.collect('pearl', 'plat/jewel', x, z, 1.5, [2.2, 2.2, 2.4]); }
          if (c.dive && c.pool === 'rect') { const sx = px0 - 1.2, sz = (pz0 + pz1) / 2; for (let k = 0; k < 4; k++) pb(sx - 3 + k * 0.01, FL, sz - 3 + k * 1.2, 1.6, 0.6 * (k + 1), 1.2, WH); pb(sx, FL, sz + 1.6, 1.6, 2.6, 1.8, WH); } }
        // teto e luz fluorescente
        if (!c.sky) { pb(c.cx, CE, c.cz, CS, 0.5, CS, CEIL); for (const [ox, oz] of [[-4, -4], [4, 4], [-4, 4], [4, -4]]) { w.put('prim/box', c.cx + ox, c.cz + oz, { s: [2.6, 0.08, 0.5], abs: CE - 0.08, tint: [1.6, 1.6, 1.6] }); } E.lamp(c.cx, CE - 0.35, c.cz, 0xeaffff); }
        if (c.pil && !c.pool) for (const [ox, oz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) pb(c.cx + ox, FL, c.cz + oz, 1, CE, 1, WH);
      }
      // paredes entre salas: abertas, com porta ou com arco; bordas fechadas
      const wall = (x, z, len, alongX, mode, under) => { // mode: 'door' | 'solid'
        const y0 = under ? -1.2 : FL - 4.2, h = CE - y0;
        const seg = (a, b) => { if (b - a < 0.1) return; const m = (a + b) / 2, l = b - a; if (alongX) pb(x - len / 2 + m, y0, z, l, h, WT, WH); else pb(x, y0, z - len / 2 + m, WT, h, l, WH); };
        if (mode === 'solid') seg(0, len); else { const d = 3 + r() * (len - 10), dw = 4; seg(0, d); seg(d + dw, len); if (alongX) pb(x - len / 2 + d + dw / 2, 3.6, z, dw, CE - 3.6, WT, WH); else pb(x, 3.6, z - len / 2 + d + dw / 2, WT, CE - 3.6, dw, WH); }
      };
      for (let i = 0; i <= N; i++) for (let j = 0; j < N; j++) {
        const x = O - CS / 2 + i * CS, z = O + j * CS, edge = i === 0 || i === N, sec = (i === 6 && j === 6) || (i === 7 && j === 6);
        if (i === 6 && j === 6) { wall(x, z, CS, false, 'solid', true); continue; } // sala secreta: só se entra nadando por baixo
        if (edge || sec) { wall(x, z, CS, false, 'solid'); continue; } if (r() < 0.3) continue; wall(x, z, CS, false, 'door');
      }
      for (let j = 0; j <= N; j++) for (let i = 0; i < N; i++) {
        const x = O + i * CS, z = O - CS / 2 + j * CS, edge = j === 0 || j === N, sec = i === 6 && (j === 6 || j === 7);
        if (edge || sec) { wall(x, z, CS, true, 'solid'); continue; } if (r() < 0.3) continue; wall(x, z, CS, true, 'door');
      }
      // sala secreta: ilhota com estrela, baú e uma luz que pisca
      const sc = cell[6][6]; pb(sc.cx, FL - 4.2, sc.cz, 5, 4.6, 5, 0xfff2c4); E.secret('pool', sc.cx, 1.2, sc.cz, 2.5); E.chest('p_secret', sc.cx + 1.4, 0.4, sc.cz + 1.4, 3); E.lamp(sc.cx, CE - 1, sc.cz, 0xff8080);
      // sala inicial
      returnPortal(w, E, 4, 4); E.sign('Não se perca.', -3, 2.8, -6);
      E.npc('eco', 'Eco', 'Salva-vidas', -4, 3, { fur: '#f5f1e8', fur2: '#e05050', pattern: 5, eyes: '#4aa3e0', hat: 0, acc: 8 }, { quests: ['p1', 'p2', 'p3'], lines: ['Ah, outro gato. Há quanto tempo você está aqui? Eu perdi a conta.', 'As salas continuam. Sempre continuam. Os azulejos são todos iguais.', 'Dizem que há uma sala sem porta. Só se chega nadando por baixo da parede.', 'As piscinas são fundas. Pérolas descansam lá embaixo.'] });
      for (let k = 0; k < 6; k++) { const c = cell[Math.floor(r() * N)][Math.floor(r() * N)]; if (c.pool || c === cell[3][3]) continue; E.chest('p_' + k, c.cx + 3, 0, c.cz - 3, k % 3 === 0 ? 1 : 0); }
    }
  },
  // ======================= CAMPO DE TREINO =======================
  training: {
    name: 'Campo de Treino', size: 120, surface: 'grass', sky: [0x98d0f0, 0xf8b070, 0x0c1228], fog: 1,
    spawn: [0, 40, 0], build(w, E, r) {
      w.heightFn = (x, z) => { const d = Math.hypot(x, z); return d > 50 ? Math.min(10, (d - 50) * (d - 50) * 0.07) : 0; };
      const g1 = C(0x74c054), g2 = C(0x62ac48), dirt = C(0xc8a878);
      w.buildGround(40, (x, z, h, c) => { mix(c, g1, g2, ((Math.floor(x / 4) + Math.floor(z / 4)) & 1) * 0.6); if (Math.hypot(x + 24, z + 10) < 9.5 || (Math.abs(x) < 2.5 && z > -5)) mix(c, c, dirt, 0.9); });
      returnPortal(w, E, 0, 46);
      for (let i = -11; i <= 11; i++) { w.put('town/fence', i * 4, 50, { s: 4, ry: H }); w.put('town/fence', i * 4, -50, { s: 4, ry: -H }); w.put('town/fence', 50, i * 4, { s: 4, ry: PI }); w.put('town/fence', -50, i * 4, { s: 4, ry: 0 }); }
      // área de luta com bonecos e o Mestre (sparring NPC)
      E.zone('fight', -24, -10, 9); ring(10, 9.5, (x, z) => w.put('plat/fence-rope', -24 + x, -10 + z, { s: 2.4, ry: Math.atan2(x, z) + H, detail: 0 }));
      E.npc('mestre', 'Mestre Bigodão', 'Sparring (NPC)', -24, -13, NPC_LOOKS.mestre, { spar: true, lines: ['Me acerte dentro do círculo para começar!'] });
      for (let i = 0; i < 5; i++) E.dummy(-38 + i * 4.5, 14);
      E.npc('sensei', 'Sensei Patas', 'Instrutor', -4, 34, NPC_LOOKS.sensei, { quests: ['t1', 't2'], shop: 'dojo', yaw: 0.6, lines: ['IMPULSO: aponte para o chão, encoste as patas e varra o controle para trás.', 'ESCALADA: encoste na parede, segure o gatilho, puxe para baixo e solte.', 'CAMINHAR: gatilho no ar anda na direção apontada.', 'LUTA: golpes rápidos dão mais dano. Bloqueie com o touchpad para baixo.', 'A pista de obstáculos fica a leste. O sino no topo é a meta!'] });
      // pista de escalada: paredes crescentes, pilares, plataformas flutuantes até o sino
      const cx = 26; const hs = [1.2, 2.2, 3.4, 4.8];
      hs.forEach((h, i) => boxAbs(w, cx, 0, 30 - i * 7, 10, h, 2.5, i % 2 ? 0xd0864a : 0xe0a060));
      for (let i = 0; i < 7; i++) boxAbs(w, cx - 4 + (i % 2) * 8, 0, 0 - i * 3.4, 1.6, 5 + i * 0.9, 1.6, 0x6a8fd0);
      boxAbs(w, cx, 0, -30, 12, 12, 3, 0xb0b8c4); for (let i = 0; i < 14; i++) boxAbs(w, cx - 5 + ((i * 37) % 10), 1 + i * 0.8, -28.3, 0.7, 0.35, 0.5, [0xf05050, 0x50c060, 0x5080f0, 0xf0c040][i % 4]);
      for (let i = 0; i < 6; i++) boxAbs(w, cx + 8 + i * 0.01 + Math.sin(i * 1.7) * 3, 12.5 + i * 1.5, -30 + i * 4.2, 2.6, 0.4, 2.6, 0xf0c040);
      const by = 12.5 + 5 * 1.5 + 0.4, bz = -30 + 5 * 4.2, bx = cx + 8 + Math.sin(5 * 1.7) * 3; w.put('plat/flag', bx, bz, { s: 3, abs: by }); E.secret('training', bx, by + 1, bz, 2.5); E.chest('t_top', bx - 0.8, by, bz + 0.6, 1); E.lamp(bx, by + 3, bz, 0xffe060);
      E.spring(8, 14, 13); E.spring(12, 4, 18); E.sign('Trampolins', 10, 2.6, 10); E.sign('Pista de Obstáculos →', 14, 2.8, 34); E.sign('Ringue de Treino', -24, 3.2, 1);
      w.put('arena/weapon-rack', -8, 36, { s: 3, ry: 0.4, col: 'box' }); w.put('grave/hay-bale', -12, 30, { s: 3, col: 'box' }); w.put('grave/hay-bale', -14.5, 31, { s: 3, ry: 1, col: 'box' }); w.put('grave/hay-bale', -13, 30.5, { s: 3, abs: 1.1, col: 'box' });
      scatter(w, r, ['nature/tree_default', 'nature/tree_oak'], 30, { s: [4, 6], col: 'trunk', cw: 0.1, ok: (x, z) => Math.hypot(x, z) > 53 });
      for (let i = 0; i < 4; i++) E.ore('stone', 36 + i * 3, 40); E.chest('t_1', -42, null, -40, 0);
      for (let i = 0; i < 5; i++) E.tree(-40 + i * 5, 40, 'nature/tree_default');
      lampPost(w, E, -3, 44); lampPost(w, E, 3, 44); lampPost(w, E, -14, -2); lampPost(w, E, -34, -2);
    }
  }
};
export const MAP_ORDER = ['village', 'forest', 'mine', 'desert', 'snow', 'arena', 'castle', 'city', 'island', 'training', 'aero', 'dark', 'pool'];
export const MAP_ICONS = { village: '🏡', forest: '🌲', mine: '⛏', desert: '🏜', snow: '🏔', arena: '🥊', castle: '🏰', city: '🏙', island: '🏝', training: '🎯', aero: '🫧', dark: '🦇', pool: '🏊' };
export const PORTAL_COLORS = { village: 0x70e070, forest: 0x2f9e4f, mine: 0x8a70c0, desert: 0xf0c050, snow: 0xb8e8ff, arena: 0xf05a40, castle: 0xa0a8c0, city: 0x50a0f0, island: 0x30d0d0, training: 0xf0a040, aero: 0x60e8ff, dark: 0x9a2050, pool: 0x9ff0e8 };
export { hasModel };
