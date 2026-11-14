import * as THREE from 'three';
import { MAPS, MAP_ORDER, MAP_ICONS, PORTAL_COLORS } from './maps.js';
import { noise2, clamp, emit } from './util.js';
import { S } from './state.js';
import { play, modelGeometry, boing, whoosh } from './assets.js';

// Três mapas feitos com os kits novos da Kenney: Base Lunar (gravidade baixa, foguete e uma homenagem
// à Félicette), Minigolfe dos Gatos (minigame de 3 buracos) e Festival da Comida (comidas gigantes e trem).
const PI = Math.PI, H = PI / 2;
const T = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const C = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
function mix(c, a, b, t) { c[0] = a[0] + (b[0] - a[0]) * t; c[1] = a[1] + (b[1] - a[1]) * t; c[2] = a[2] + (b[2] - a[2]) * t; }
const box = (w, x, y, z, sx, sy, sz, color, col) => w.put('prim/box', x, z, { s: [sx, sy, sz], tint: T(color), abs: y, col: col ? 'box' : null });
const vcMat = () => new THREE.MeshLambertMaterial({ vertexColors: true });

// ======================= BASE LUNAR =======================
const CRATERS = [[24, 18, 9], [-30, -22, 12], [-8, -44, 7], [40, -30, 6], [-46, 26, 10], [10, 46, 5], [-52, -50, 8]];
const FEL = [-52, -50]; // a homenagem fica no fundo da cratera mais distante
function moonH(x, z) {
  let h = noise2(x * 0.04, z * 0.04, 3) * 2.2 + noise2(x * 0.15, z * 0.15, 2) * 0.4;
  for (const [cx, cz, r] of CRATERS) { const d = Math.hypot(x - cx, z - cz) / r; if (d < 1.5) h += d < 1 ? -2.4 * (1 - d * d) + 0.9 * d * d * d : 0.9 * Math.max(0, 1 - (d - 1) / 0.5) ** 2; }
  if (Math.hypot(x, z - 54) < 12) h *= 0.2; // pouso plano perto do portal
  return h;
}
MAPS.moon = {
  name: 'Base Lunar', size: 150, surface: 'stone', sky: [0x07081a, 0x07081a, 0x03030c], fog: 1.6, spawn: [0, 54, PI], grav: 0.38, skyT: 420, noWx: true, noClouds: true,
  build(w, E, r) {
    w.heightFn = moonH;
    const g1 = C(0x9a9aa2), g2 = C(0x7a7a84), dk = C(0x55555e);
    w.buildGround(72, (x, z, h, c) => { mix(c, g1, g2, noise2(x * 0.09, z * 0.09, 3)); if (h < -0.6) mix(c, c, dk, clamp((-0.6 - h) / 1.6, 0, 0.7)); });
    E.portal('village', 6, 60); E.sign('🌙 Base Lunar: a gravidade aqui é baixinha!', 0, 3.6, 48);
    // base: hangares, domos de vidro, antenas e geradores
    w.put('space/hangar_largeA', -14, 30, { s: 6, ry: H, col: 'box' }); w.put('space/hangar_largeA', 14, 30, { s: 6, ry: -H, col: 'box' });
    w.put('space/hangar_roundGlass', 0, 18, { s: 5, col: 'box', cs: 0.8 }); w.put('space/hangar_roundGlass', -26, 6, { s: 4, ry: 1, col: 'box', cs: 0.8 });
    w.put('space/satelliteDish_large', 22, 6, { s: 6, ry: -0.6, col: 'box', cs: 0.5 }); w.put('space/satelliteDish_large', -36, 40, { s: 5, ry: 2, col: 'box', cs: 0.5 });
    for (const [x, z, ry] of [[8, 24, 0], [-8, 24, PI], [30, 20, 1]]) w.put('space/machine_generator', x, z, { s: 4, ry, col: 'box' });
    for (const [x, z] of [[18, 40], [-20, 44], [34, -6], [-12, -12]]) w.put('space/barrels', x, z, { s: 4, ry: r() * 6, col: 'box' });
    w.put('space/desk_computer', 4, 14, { s: 4, ry: PI }); w.put('space/structure_detailed', -40, 0, { s: 6, col: 'box' }); w.put('space/structure_detailed', 44, 20, { s: 6, ry: 1, col: 'box' });
    // foguete montado na plataforma de lançamento + trampolim que "lança" o gato
    const rx = 34, rz = -20, ry0 = moonH(rx, rz); w.put('space/platform_large', rx, rz, { s: 6, abs: ry0, col: 'box', ch: 1 });
    let y = ry0 + 0.6; for (const [k, h] of [['space/rocket_baseA', 1.6], ['space/rocket_fuelA', 0.5], ['space/rocket_fuelA', 0.5], ['space/rocket_sidesA', 1.0], ['space/rocket_topA', 0.8]]) { w.put(k, rx, rz - 4, { s: 4, abs: y }); y += h * 4; }
    w.put('space/rocket_finsA', rx, rz - 4, { s: 4, abs: ry0 + 0.6 }); w.addBoxC(rx, ry0, rz - 4, 4, y - ry0, 4);
    E.spring(rx, rz + 3, 26); E.sign('🚀 Plataforma de lançamento', rx, ry0 + 4.2, rz + 7);
    // naves e rover estacionados
    w.put('space/craft_speederA', -20, -6, { s: 4, ry: 0.4, col: 'box' }); w.put('space/craft_racer', 6, -8, { s: 4, ry: -0.8, col: 'box' }); w.put('space/craft_cargoA', 44, 44, { s: 5, ry: 2.4, col: 'box' });
    w.put('space/rover', -4, 40, { s: 4, ry: 0.3, col: 'box' }); w.put('space/rover', 28, -46, { s: 4, ry: 2, col: 'box' });
    // pedras, crateras pequenas e meteoritos
    for (let i = 0; i < 60; i++) { const x = (r() * 2 - 1) * 68, z = (r() * 2 - 1) * 68; if (Math.hypot(x, z - 40) < 16) continue; const k = r(); w.put(k < 0.4 ? 'space/rocks_smallA' : k < 0.7 ? 'space/meteor' : k < 0.85 ? 'space/crater' : 'space/craterLarge', x, z, { s: 3 + r() * 4, ry: r() * 6, tint: [0.62, 0.6, 0.62], col: k > 0.4 && k < 0.7 ? 'box' : null, detail: k < 0.4 }); }
    // cristais lunares (dá para minerar)
    for (let i = 0; i < 9; i++) { const [cx, cz, cr] = CRATERS[i % CRATERS.length], a = r() * 6.28, x = cx + Math.cos(a) * cr * 0.4, z = cz + Math.sin(a) * cr * 0.4; if (Math.hypot(x - FEL[0], z - FEL[1]) < 4) continue; w.put(i % 2 ? 'space/rock_crystals' : 'space/rock_crystalsLargeA', x + 1.5, z + 1.5, { s: 3, ry: a, tint: i % 2 ? [0.7, 0.9, 1.4] : [1.2, 0.8, 1.5] }); E.ore(i % 3 ? 'quartz' : 'amethyst', x, z); }
    // astronautas e o alienígena Zorp
    w.put('space/astronautA', 10, 10, { s: 3, ry: 2.6 }); w.put('space/astronautB', -16, 14, { s: 3, ry: 0.5 }); w.put('space/alien', 46, -44, { s: 3.4, ry: -2.3 });
    E.sign('👽 Zorp diz: "MIAU?"', 46, moonH(46, -44) + 3.4, -41);
    E.npc('astro', 'Astronauta Lua', 'Comandante da base', -4, 46, { fur: '#d9d9d9', fur2: '#f5f1e8', pattern: 1, eyes: '#4aa3e0', hat: 11 }, { lines: ['Pule bem alto: aqui a gravidade é só 38% da Terra!', 'O trampolim do foguete te lança até as estrelas.', 'Os cristais azuis e roxos das crateras podem ser minerados.', 'Dizem que uma gata muito famosa descansa na cratera mais longe daqui...'] });
    // 🐈‍⬛ Homenagem à Félicette, a primeira (e única) gata a ir ao espaço (18/10/1963)
    const fy = moonH(FEL[0], FEL[1]); box(w, FEL[0], fy, FEL[1], 2.4, 0.8, 2.4, 0xd8d8e0, true); box(w, FEL[0], fy + 0.8, FEL[1], 1.8, 0.2, 1.8, 0xf2d06a);
    E.npc('felicette', 'Félicette', 'Primeira gata no espaço (1963)', FEL[0], FEL[1], { fur: '#2a2a32', fur2: '#f5f1e8', pattern: 1, eyes: '#e0b030', hat: 0 }, { fy: fy + 1, wander: 0, lines: ['Miau! Em 18 de outubro de 1963 eu voei até o espaço num foguete e voltei em segurança.', 'Fui a primeira gata a ir ao espaço. Até hoje sou a única!', 'Obrigada por vir me visitar aqui na Lua. 🌙', 'Os cientistas me chamavam de C 341. Os amigos, de Félicette.'] });
    E.sign('🐈‍⬛ Félicette — primeira gata no espaço (18/10/1963)', FEL[0], fy + 3.6, FEL[1] + 2.6); E.secret('moon_felicette', FEL[0], fy + 1, FEL[1], 4);
    E.lamp(FEL[0], fy + 2.2, FEL[1], 0xffe0a0); E.lamp(0, 3, 18, 0x9fe0ff); E.lamp(rx, ry0 + 3, rz, 0xff9a60);
    E.chest('moon_rocket', rx + 4, ry0 + 0.6, rz - 4, 2); E.chest('moon_base', 0, moonH(0, 18) + 0.1, 18, 1);
  },
  after(G, add) {
    const earth = add(new THREE.Mesh(new THREE.SphereGeometry(18, 24, 16), new THREE.MeshBasicMaterial({ color: 0x3a7ad8, fog: false }))); earth.position.set(-160, 120, -260);
    const land = add(new THREE.Mesh(new THREE.SphereGeometry(18.3, 12, 8, 0, 2.2, 0.6, 1.4), new THREE.MeshBasicMaterial({ color: 0x4caa58, fog: false }))); land.position.copy(earth.position);
    const sp = new Float32Array(900 * 3); for (let i = 0; i < 900; i++) { const a = Math.random() * PI * 2, b = Math.random() * 1.3 + 0.12, R = 280; sp[i * 3] = Math.cos(a) * Math.cos(b) * R; sp[i * 3 + 1] = Math.sin(b) * R; sp[i * 3 + 2] = Math.sin(a) * Math.cos(b) * R; }
    const stars = add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(sp, 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, fog: false }))); stars.frustumCulled = false; this.stars = stars;
    this.metT = 2; this.jumps = 0; G.modeLabel = '';
  },
  tick(dt, G) {
    if (!this.stars) return; const P = G.player; this.stars.position.copy(P.pos);
    this.metT -= dt; if (this.metT <= 0) { this.metT = 1.5 + Math.random() * 3; const a = Math.random() * PI * 2, x = P.pos.x + Math.cos(a) * 60, z = P.pos.z + Math.sin(a) * 60; for (let k = 0; k < 8; k++) G.fx.streak(x + k * 1.6, 70 - k * 1.2, z + k * 0.8, 8, -6, 4, 0xfff0c0, 1.4); }
    if (!P.grounded && P.vel.y > 9 && !this._big) { this._big = true; S.stat('moonJump'); } if (P.grounded) this._big = false;
  },
  amb() { return { wind: 0.05 }; }
};

// ======================= MINIGOLFE =======================
// cada buraco é um retângulo com bordas (a bola quica nelas) e obstáculos retangulares
const HOLES = [
  { n: 'Buraco 1 · Reta do Bigode', b: [-34, -8, -26, 30], tee: [-30, 26], cup: [-30, -4], obs: [[-31.5, 12, -28.5, 13]], par: 2 },
  { n: 'Buraco 2 · Moinho', b: [-10, -8, 6, 30], tee: [-2, 26], cup: [-2, -3], obs: [[-10, 16, -3, 17], [-1, 8, 6, 9], [-4, 1, 0, 2]], par: 3 },
  { n: 'Buraco 3 · Castelo dos Diamantes', b: [16, -8, 36, 30], tee: [26, 26], cup: [26, -3], obs: [[20, 18, 22, 20], [30, 18, 32, 20], [25, 10, 27, 12], [18, 4, 21, 5], [31, 4, 34, 5]], par: 3 }
];
const BR = 0.16;
MAPS.golf = {
  name: 'Minigolfe dos Gatos', size: 110, surface: 'grass', sky: [0x8fd0f5, 0xffc08a, 0x0b1230], fog: 1, spawn: [0, 44, PI],
  build(w, E, r) {
    w.heightFn = () => 0;
    const g1 = C(0x5cbf4a), g2 = C(0x4aa63c); w.buildGround(48, (x, z, h, c) => mix(c, g1, g2, noise2(x * 0.1, z * 0.1, 2)));
    E.portal('village', 8, 48); E.sign('⛳ Minigolfe dos Gatos', 0, 3.6, 40);
    HOLES.forEach((ho, i) => {
      const [x0, z0, x1, z1] = ho.b, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      box(w, cx, 0, cz, x1 - x0, 0.06, z1 - z0, i % 2 ? 0x3fd06a : 0x34c060);
      for (const [ax, az, bx, bz] of [[x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1]]) box(w, (ax + bx) / 2, 0, (az + bz) / 2, Math.max(0.3, bx - ax + 0.3), 0.35, Math.max(0.3, bz - az + 0.3), 0x9a6a3a);
      for (const o of ho.obs) box(w, (o[0] + o[2]) / 2, 0, (o[1] + o[3]) / 2, o[2] - o[0], 0.5, o[3] - o[1], 0xd8d0c0);
      w.put('golf/start', ho.tee[0], ho.tee[1], { s: [2.2, 0.5, 2.2], abs: 0.02 }); w.put('golf/flag-red', ho.cup[0] + 0.05, ho.cup[1], { s: 2.4, abs: 0.06 });
      E.sign(ho.n + ' · par ' + ho.par, cx, 2.4, z1 + 1.2);
    });
    w.put('golf/windmill', 3.2, 12.5, { s: 4, ry: -H, col: 'box', cs: 0.6 }); w.put('golf/castle', 26, 15, { s: 3.6, col: 'box', cs: 0.5 });
    w.put('golf/structure-windmill', -40, 10, { s: 6, ry: H, col: 'box', cs: 0.5 });
    for (let i = 0; i < 14; i++) { const a = r() * 6.28, d = 40 + r() * 10; w.put(r() < 0.5 ? 'nature/tree_oak' : 'nature/tree_default', Math.cos(a) * d, Math.sin(a) * d, { s: 3 + r() * 2, ry: r() * 6, col: 'trunk' }); }
    for (const [x, z] of [[-14, 36], [12, 36], [-38, 34], [40, 34]]) { w.put('fur/table', x, z, { s: 2.4, col: 'box' }); w.put('fur/chairCushion', x - 1.8, z, { s: 2.4, ry: H }); w.put('food/soda', x, z, { s: 2.2, abs: 0.8 }); }
    E.npc('caddie', 'Caddie Pipoca', 'Minigolfe', -8, 40, { fur: '#e8c27a', fur2: '#f5f1e8', pattern: 1, eyes: '#58c26a', hat: 4 }, { lines: ['Chegue perto da bolinha, SEGURE o gatilho para carregar a força e SOLTE para tacar!', 'Mire olhando para onde quer mandar a bola.', 'Buraco em 1 tacada? Isso vale uma conquista!', 'Faça os 3 buracos e veja seu placar no fim.'] });
    E.chest('golf_mill', 4, 0, 16, 1); E.secret('golf_castle', 26, 3.4, 15, 2.2);
  },
  after(G, add) {
    this.ball = add(new THREE.Mesh(new THREE.SphereGeometry(BR, 14, 10), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x333333 })));
    const cup = new THREE.CircleGeometry(0.26, 16); this.cups = HOLES.map((ho) => { const m = add(new THREE.Mesh(cup, new THREE.MeshBasicMaterial({ color: 0x101010 }))); m.rotation.x = -H; m.position.set(ho.cup[0], 0.075, ho.cup[1]); return m; });
    this.arrow = add(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 6), new THREE.MeshBasicMaterial({ color: 0xffe060 }))); this.arrow.visible = false;
    this.hole = 0; this.strokes = 0; this.scores = []; this.charge = -1; this.vx = this.vz = 0; this.inCup = 0; this.place(); G.modeLabel = '';
  },
  place() { const ho = HOLES[this.hole]; this.bx = ho.tee[0]; this.bz = ho.tee[1]; this.vx = this.vz = 0; this.strokes = 0; },
  near(G) { const p = G.player.pos; return Math.hypot(p.x - this.bx, p.z - this.bz) < 2.2 && p.y < 2; },
  press(G) { if (!this.ball || this.inCup > 0 || Math.hypot(this.vx, this.vz) > 0.3 || !this.near(G)) return false; this.charge = 0; play('click', 0.6); return true; },
  release(G) { if (this.charge < 0) return; const P = G.player, pw = 1.2 + Math.min(1, this.charge) * 8.5; this.charge = -1; this.arrow.visible = false;
    const yaw = P.headYaw != null ? P.headYaw : P.yaw; this.vx = -Math.sin(yaw) * pw; this.vz = -Math.cos(yaw) * pw; this.strokes++; play('punch', 0.7, 0, 1.4); G.fx.burst(this.bx, 0.2, this.bz, 0xffffff, 8, 1.5); },
  tick(dt, G) {
    if (!this.ball) return; const P = G.player, ho = HOLES[this.hole];
    if (this.charge >= 0) { this.charge += dt * 0.7; if (this.charge > 1.4) this.charge = 0; const k = Math.min(1, this.charge); const yaw = P.headYaw != null ? P.headYaw : P.yaw; this.arrow.visible = true; this.arrow.position.set(this.bx - Math.sin(yaw) * (0.6 + k), 0.25, this.bz - Math.cos(yaw) * (0.6 + k)); this.arrow.rotation.set(-H, 0, 0); this.arrow.rotation.set(0, 0, 0); this.arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))); this.arrow.scale.set(1, 1 + k * 2, 1); this.arrow.material.color.setHSL(0.33 - k * 0.33, 1, 0.55); }
    // física da bola (4 subpassos): atrito, quique nas bordas e obstáculos, buraco
    if (this.inCup > 0) { this.inCup -= dt; if (this.inCup <= 0) this.next(G); }
    else for (let s = 0; s < 4; s++) { const h = dt / 4; this.bx += this.vx * h; this.bz += this.vz * h; const sp = Math.hypot(this.vx, this.vz); if (sp > 0) { const f = Math.max(0, sp - 2.2 * h) / sp; this.vx *= f; this.vz *= f; }
      const [x0, z0, x1, z1] = ho.b; if (this.bx < x0 + BR) { this.bx = x0 + BR; this.vx = Math.abs(this.vx) * 0.8; } if (this.bx > x1 - BR) { this.bx = x1 - BR; this.vx = -Math.abs(this.vx) * 0.8; } if (this.bz < z0 + BR) { this.bz = z0 + BR; this.vz = Math.abs(this.vz) * 0.8; } if (this.bz > z1 - BR) { this.bz = z1 - BR; this.vz = -Math.abs(this.vz) * 0.8; }
      for (const o of ho.obs) { if (this.bx > o[0] - BR && this.bx < o[2] + BR && this.bz > o[1] - BR && this.bz < o[3] + BR) { const dl = this.bx - (o[0] - BR), dr = o[2] + BR - this.bx, dt2 = this.bz - (o[1] - BR), db = o[3] + BR - this.bz, m = Math.min(dl, dr, dt2, db); if (m === dl) { this.bx = o[0] - BR; this.vx = -Math.abs(this.vx) * 0.8; } else if (m === dr) { this.bx = o[2] + BR; this.vx = Math.abs(this.vx) * 0.8; } else if (m === dt2) { this.bz = o[1] - BR; this.vz = -Math.abs(this.vz) * 0.8; } else { this.bz = o[3] + BR; this.vz = Math.abs(this.vz) * 0.8; } if (sp > 1.5) play('wood', 0.3, 0, 1.6); } }
      // empurrão do corpo (sem contar tacada)
      const dx = this.bx - P.pos.x, dz = this.bz - P.pos.z, dd = Math.hypot(dx, dz); if (dd < 0.45 && P.pos.y < 1 && dd > 0.01) { this.bx = P.pos.x + dx / dd * 0.45; this.bz = P.pos.z + dz / dd * 0.45; const ps = Math.hypot(P.vel.x, P.vel.z); if (ps > 0.5) { this.vx += dx / dd * ps * 0.15; this.vz += dz / dd * ps * 0.15; } }
      const cd = Math.hypot(this.bx - ho.cup[0], this.bz - ho.cup[1]); if (cd < 0.24 && Math.hypot(this.vx, this.vz) < 4.5) { this.sink(G); break; } }
    this.ball.position.set(this.bx, this.inCup > 0 ? 0.0 : 0.06 + BR, this.bz);
    if (this.near(G) && this.charge < 0 && Math.hypot(this.vx, this.vz) < 0.3 && !this._hint) { this._hint = true; S.toast('⛳ Segure o gatilho para carregar e solte para tacar (mire olhando)', '#bfe6ff'); }
    G.modeLabel = '⛳ ' + ho.n + ' · tacadas: ' + this.strokes + ' · par ' + ho.par + (this.charge >= 0 ? '  ·  força ' + Math.round(Math.min(1, this.charge) * 100) + '%' : '');
  },
  sink(G) { const ho = HOLES[this.hole]; this.inCup = 1.6; this.vx = this.vz = 0; this.bx = ho.cup[0]; this.bz = ho.cup[1]; play('coin', 0.8); G.fx.burst(ho.cup[0], 0.4, ho.cup[1], 0xffe060, 30, 3, 3); G._confetti && G._confetti(20);
    const d = this.strokes - ho.par, nm = this.strokes === 1 ? '🏆 BURACO EM UMA!' : d <= -1 ? '🐦 Birdie!' : d === 0 ? '👍 Par!' : '+' + d + ' acima do par'; emit('banner', '⛳ ' + nm + ' (' + this.strokes + ' tacadas)', 3); if (this.strokes === 1) { S.stat('golfHio'); S.addCoins(50); } this.scores.push(this.strokes); S.addXp(15 + Math.max(0, 3 - d) * 10); },
  next(G) { this.hole++; if (this.hole >= HOLES.length) { const tot = this.scores.reduce((a, b) => a + b, 0), par = HOLES.reduce((a, h) => a + h.par, 0); emit('banner', '⛳ Fim! Total: ' + tot + ' tacadas (par ' + par + ')', 5); S.addCoins(tot <= par ? 80 : 30); S.stat('golfRounds'); if (tot <= par) S.stat('golfPar'); const b = S.d.best || (S.d.best = {}); if (!b.golf || tot < b.golf) { b.golf = tot; S.toast('🏅 Novo recorde no minigolfe: ' + tot, '#ffd76a'); } this.hole = 0; this.scores = []; }
    this.place(); const ho = HOLES[this.hole]; G.player.teleport(ho.tee[0] + 1.2, 0.3, ho.tee[1] + 1.4, 0); },
  amb() { return { wind: 0.2 }; }
};

// ======================= FESTIVAL DA COMIDA =======================
const TR = 62; // raio dos trilhos do trem
MAPS.food = {
  name: 'Festival da Comida', size: 150, surface: 'grass', sky: [0x8fd0f5, 0xffb27a, 0x0b1230], fog: 1, spawn: [0, 50, PI],
  build(w, E, r) {
    w.heightFn = (x, z) => noise2(x * 0.03, z * 0.03, 2) * 0.6;
    const g1 = C(0x7ccf5a), g2 = C(0x64b84a), pv = C(0xe8d2a8); w.buildGround(64, (x, z, h, c) => { mix(c, g1, g2, noise2(x * 0.1, z * 0.1, 2)); const d = Math.hypot(x, z); if (d < 30) mix(c, c, pv, clamp((30 - d) / 3, 0, 1)); if (Math.abs(d - TR) < 2.2) mix(c, c, C(0x8a7a6a), 0.8); });
    E.portal('village', 8, 54); E.sign('🍔 Festival da Comida', 0, 3.8, 42);
    // bolo gigante no centro + comidas gigantes pela praça
    w.put('food/cake-birthday', 0, 0, { s: 14, col: 'box', cs: 0.9 }); E.sign('🎂 Parabéns, RoleVRGO!', 0, 7.4, 5.2);
    const GI = [['food/burger', 16, 0, 12], ['food/donut-sprinkles', -16, 2, 20], ['food/ice-cream', 10, -18, 12], ['food/fries', -10, -18, 12], ['food/hot-dog', 20, 16, 10], ['food/cupcake', -20, 16, 10], ['food/sundae', -24, -6, 14], ['food/taco', 24, -6, 12], ['food/croissant', 0, -24, 12], ['food/carrot', 34, 30, 9], ['food/apple', -34, 30, 14], ['food/strawberry', 36, -32, 16], ['food/banana', -36, -32, 12], ['food/pumpkin', 0, 34, 10]];
    for (const [k, x, z, s] of GI) w.put(k, x, z, { s, ry: r() * 6, col: 'box', cs: 0.8 });
    E.secret('food_sundae', -24, 9.6, -6, 2.4); // no topo da taça de sorvete gigante
    // barraquinhas com comida no balcão
    const ST = ['town/stall', 'town/stall-red', 'town/stall-green'], FOOD = ['food/burger', 'food/pie', 'food/cupcake', 'food/sushi-salmon', 'food/donut-chocolate', 'food/waffle', 'food/sandwich', 'food/popsicle', 'food/lollypop', 'food/croissant', 'food/cup-coffee', 'food/hot-dog'];
    for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2 + 0.3, d = 44, x = Math.cos(a) * d, z = Math.sin(a) * d; if (Math.hypot(x - 8, z - 54) < 10) continue; const ry = -a - H; w.put(ST[i % 3], x, z, { s: 3, ry, col: 'box', cs: 0.8 }); for (let k = -1; k <= 1; k++) w.put(FOOD[(i * 3 + k + 12) % FOOD.length], x + Math.cos(a + H) * k * 1.1 - Math.cos(a) * 1.2, z + Math.sin(a + H) * k * 1.1 - Math.sin(a) * 1.2, { s: 2.2, abs: w.heightFn(x, z) + 1.25, ry: r() * 6 }); }
    // mesas de piquenique
    for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2, d = 33, x = Math.cos(a) * d, z = Math.sin(a) * d; w.put('fur/table', x, z, { s: 2.6, ry: -a, col: 'box' }); w.put('fur/chairCushion', x + Math.cos(a) * 1.9, z + Math.sin(a) * 1.9, { s: 2.5, ry: -a - H }); w.put(FOOD[i % FOOD.length], x, z, { s: 2, abs: w.heightFn(x, z) + 0.88 }); }
    // estacionamento
    const CARS = ['car/sedan', 'car/taxi', 'car/police', 'car/ambulance', 'car/van', 'car/firetruck', 'car/race', 'car/kart-oobi'];
    for (let i = 0; i < 8; i++) { const x = 48 + (i % 2) * 7, z = -14 + Math.floor(i / 2) * 6; w.put(CARS[i], x, z, { s: 1.6, ry: (i % 2 ? -H : H) + (r() - 0.5) * 0.1, col: 'box', cs: 0.9 }); }
    for (let i = 0; i < 6; i++) w.put('car/cone', 44, -16 + i * 5, { s: 2 });
    // trilhos em volta do festival
    const n = Math.round(2 * PI * TR / 2.2); for (let i = 0; i < n; i++) { const a = i / n * PI * 2; w.put('train/track', Math.cos(a) * TR, Math.sin(a) * TR, { s: [2.4, 1.4, 2.3], ry: -a, detail: true }); }
    E.npc('chef', 'Chef Bigodão', 'Festival da Comida', -6, 44, { fur: '#f5f1e8', fur2: '#c86a2a', pattern: 2, eyes: '#4aa3e0', hat: 10 }, { lines: ['Bem-vinde ao festival! Tudo aqui é gigante, até o bolo.', 'Cuidado com o trem: ele não freia para gatos!', 'Dizem que quem sobe no topo da taça de sorvete ganha um segredo.', 'Procure o petisco dourado escondido atrás do bolo!'] });
    E.collect('snackq', 'food/cupcake', -2, -9, 2.6, [1.6, 1.3, 0.4]); E.lamp(0, 7, 0, 0xffd890);
    E.chest('food_parking', 52, w.heightFn(52, 12), 12, 1);
  },
  after(G, add) {
    const mat = vcMat(); this.cars = ['train/train-locomotive-a', 'train/train-carriage-wood', 'train/train-carriage-box', 'train/train-carriage-wood'].map((k) => { const m = add(new THREE.Mesh(modelGeometry(k), mat)); m.scale.setScalar(2.4); m.castShadow = true; return m; });
    this.a = 0; this.whT = 3; this.hitCd = 0; G.modeLabel = '';
  },
  tick(dt, G) {
    if (!this.cars) return; const P = G.player, sp = 7 / TR; this.a += sp * dt; this.hitCd -= dt;
    this.cars.forEach((m, i) => { const a = this.a - i * 6.6 / TR, x = Math.cos(a) * TR, z = Math.sin(a) * TR; m.position.set(x, G.world.heightAt(x, z) + 0.2, z); m.rotation.y = -a; /* o modelo anda em +Z */
      if (this.hitCd <= 0 && Math.hypot(P.pos.x - x, P.pos.z - z) < 2.6 && P.pos.y < m.position.y + 3) { this.hitCd = 1.2; const d = Math.hypot(P.pos.x, P.pos.z) || 1, out = Math.hypot(P.pos.x, P.pos.z) > TR ? 1 : -1; P.vel.set(P.pos.x / d * 8 * out, 7, P.pos.z / d * 8 * out); P.grounded = false; boing(0.8); S.toast('🚂 Piuí! Saia dos trilhos!', '#ffd76a'); S.stat('trainHit'); } });
    this.whT -= dt; if (this.whT <= 0) { this.whT = 9 + Math.random() * 6; const d = Math.hypot(P.pos.x - this.cars[0].position.x, P.pos.z - this.cars[0].position.z); if (d < 60) play('whistle', clamp(1 - d / 60, 0.15, 0.7), 0, 0.8); }
  },
  amb() { return { wind: 0.15 }; }
};

for (const id of ['moon', 'golf', 'food']) if (MAP_ORDER.indexOf(id) < 0) MAP_ORDER.push(id);
Object.assign(MAP_ICONS, { moon: '🌙', golf: '⛳', food: '🍔' });
Object.assign(PORTAL_COLORS, { moon: 0xd0d0ff, golf: 0x60e060, food: 0xff9a50 });
