import * as THREE from 'three';
import { MAPS, MAP_ORDER, MAP_ICONS, PORTAL_COLORS } from './maps.js';
import { matU } from './world.js';
import { fbm, noise2, clamp, smooth, emit } from './util.js';
import { S } from './state.js';
import { play, chime, boing, whoosh, sizzle, rumble } from './assets.js';
import { CatAvatar, FUR_COLORS } from './cat.js';

// Três mapas novos com mecânicas próprias: Ilhas do Céu (parkour com cronômetro), Vulcão Ardente
// (lava que queima e erupções) e Neon City (cyberpunk com chuva, holograma e carros voadores).
const PI = Math.PI, H = PI / 2;
const T = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const C = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
function mix(c, a, b, t) { c[0] = a[0] + (b[0] - a[0]) * t; c[1] = a[1] + (b[1] - a[1]) * t; c[2] = a[2] + (b[2] - a[2]) * t; }
function boxA(w, x, y, z, sx, sy, sz, color, nocol) { return w.put('prim/box', x, z, { s: [sx, sy, sz], tint: T(color), abs: y, col: nocol ? null : 'box' }); }
const fmt = (s) => s.toFixed(1).replace('.', ',') + 's';
// junta várias caixas brilhantes (sem luz) numa malha só: 1 draw call para todos os neons
function glowMesh(list) {
  const pos = [], col = [], c = new THREE.Color();
  for (const b of list) { const g = new THREE.BoxGeometry(b[3], b[4], b[5]).toNonIndexed(); if (b[6]) g.rotateY(b[6]); g.translate(b[0], b[1], b[2]); const p = g.attributes.position.array; c.set(b[7]); for (let i = 0; i < p.length; i += 3) { pos.push(p[i], p[i + 1], p[i + 2]); col.push(c.r, c.g, c.b); } g.dispose(); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })); m.frustumCulled = false; return m;
}

// ======================= ILHAS DO CÉU =======================
const ISL = [[0, 0, 0, 9, 'start'], [0, -13, 0.4, 4.5], [7, -21, 0.8, 4.5], [16, -24, 1.2, 5, 'spring'], [22, -15, 6.2, 5, 'cp'], [29, -7, 6.6, 4.2], [32, 3, 7.0, 4.5, 'ring'], [27, 15, 7.4, 4.6, 'spring'], [16, 21, 12.4, 5, 'cp'], [6, 25, 12.8, 4.2], [-4, 24, 13.2, 4.4], [-12, 18, 13.6, 4.6, 'spring'], [-18, 8, 18.6, 5, 'cp'], [-16, -3, 19, 4.4, 'ring'], [-8, -12, 19.4, 6, 'finish']];
MAPS.sky = {
  name: 'Ilhas do Céu', size: 200, surface: 'grass', sky: [0x7fd4ff, 0xffd0a0, 0x10204a], fog: 1.3, spawn: [0, 3, 0],
  build(w, E, r) {
    w.heightFn = () => -40; // um "mar de nuvens" lá embaixo
    const c1 = C(0xffffff), c2 = C(0xd8d0ff); w.buildGround(20, (x, z, h, c) => mix(c, c1, c2, noise2(x * 0.03, z * 0.03, 5)));
    w.heightFn = (x, z) => (Math.hypot(x, z) < 8.6 ? 0 : -40); // o portal e o início ficam em cima da ilha de largada
    ISL.forEach((s, i) => { const [x, z, y, R, kind] = s, gold = kind === 'finish';
      w.put('prim/cyl', x, z, { s: [R * 2, 0.8, R * 2], abs: y - 0.8, tint: T(gold ? 0xffe070 : 0x7fd05a), col: 'box' });
      w.put('prim/cyl', x, z, { s: [R * 1.9, 0.3, R * 1.9], abs: y - 1.0, tint: T(0x8a6a45) }); w.put('prim/cyl', x, z, { s: [R * 1.6, 1.2, R * 1.6], abs: y - 2.2, tint: T(0x7a5a3c) });
      w.put('prim/cyl', x, z, { s: [R * 1.1, 1.4, R * 1.1], abs: y - 3.6, tint: T(0x8a8f98) }); w.put('prim/cyl', x, z, { s: [R * 0.5, 1.4, R * 0.5], abs: y - 5.0, tint: T(0x6f747c) });
      if (R >= 4.5 && kind !== 'finish') { w.put(['nature/tree_default', 'nature/tree_oak', 'nature/tree_fat'][i % 3], x + R * 0.45, z - R * 0.35, { s: 3.2, abs: y, col: 'trunk' }); w.put('nature/flower_redA', x - R * 0.4, z + R * 0.3, { s: 2.5, abs: y }); w.put('nature/flower_yellowB', x - R * 0.2, z + R * 0.5, { s: 2.5, abs: y }); }
      if (kind === 'spring') { const n = ISL[i + 1], dx = n[0] - x, dz = n[1] - z, l = Math.hypot(dx, dz); E.springs.push({ x: x + dx / l * (R - 1.4), z: z + dz / l * (R - 1.4), p: 12.5, fy: y }); }
      if (kind === 'cp') { w.put('castle/flag', x - R * 0.5, z + R * 0.5, { s: 2.6, abs: y, tint: [0.6, 1.4, 1.6] }); E.lamp(x - R * 0.5, y + 3, z + R * 0.5, 0x60e8ff); }
      if (gold) { for (const sx of [-1, 1]) boxA(w, x + sx * 2.6, y, z, 0.7, 4.6, 0.7, 0xffd040); boxA(w, x, y + 4.6, z, 6.0, 0.7, 0.9, 0xffd040); w.put('arena/trophy', x, z, { s: 3.2, abs: y, col: 'box' }); E.lamp(x, y + 5.6, z, 0xffe070); E.sign('🏆 CHEGADA', x, y + 6.4, z); }
    });
    E.portal('village', 0, 6.5); E.sign('🏁 Corrida nas Nuvens: chegue ao troféu!', 0, 3.2, -4.5); E.sign('🌀 Trampolins e anéis te lançam longe', 5, 2.6, -2);
    E.secret('sky1', 32, 9.5, 3, 2.2); E.secret('sky2', -18, 21.5, 8, 2.2); E.chest('sky_end', -6, 19.4, -15, 2);
    // ilhas decorativas soltas e balões
    for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2 + 0.4, d = 52 + (i % 3) * 10, x = Math.cos(a) * d, z = Math.sin(a) * d, y = -4 + (i % 4) * 7; w.put('prim/cyl', x, z, { s: [7, 0.8, 7], abs: y, tint: T(0x7fd05a) }); w.put('prim/cyl', x, z, { s: [5, 2.5, 5], abs: y - 2.5, tint: T(0x7a5a3c) }); w.put('nature/tree_tall', x, z, { s: 3.5, abs: y + 0.8 }); }
  },
  after(G, add) {
    this.race = { cp: 0, run: false, t0: 0 }; this.clouds = [];
    const cg = new THREE.IcosahedronGeometry(1, 1), cm = new THREE.InstancedMesh(cg, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x404858 }), 60); cm.frustumCulled = false; add(cm); this.cm = cm;
    for (let i = 0; i < 20; i++) { const a = Math.random() * PI * 2, d = 25 + Math.random() * 70; this.clouds.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: -14 + Math.random() * 40, s: 2.5 + Math.random() * 3, sp: 0.5 + Math.random() }); }
    // anéis de impulso (entre as ilhas marcadas com 'ring')
    this.rings = []; const tg = new THREE.TorusGeometry(1.6, 0.16, 8, 28);
    ISL.forEach((s, i) => { if (s[4] !== 'ring' || !ISL[i + 1]) return; const n = ISL[i + 1], dx = n[0] - s[0], dz = n[1] - s[1], l = Math.hypot(dx, dz), x = s[0] + dx / l * (s[3] + 1.9), z = s[1] + dz / l * (s[3] + 1.9), y = s[2] + 1.2;
      const m = add(new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xffd040, fog: false }))); m.position.set(x, y, z); m.rotation.y = Math.atan2(dx, dz); this.rings.push({ m, x, y, z, dx: dx / l, dz: dz / l, cd: 0 }); });
    G.modeLabel = this.best() ? '🏆 Recorde: ' + fmt(this.best()) : '🏁 Corrida nas Nuvens';
  },
  best() { return S.d.best && S.d.best.sky > 0 ? S.d.best.sky : null; },
  tick(dt, G) {
    const P = G.player, p = P.pos, R = this.race; if (!R) return; const _m = this._m || (this._m = new THREE.Matrix4()), now = G.time;
    // nuvens passando
    this.clouds.forEach((c, i) => { c.x += c.sp * dt; if (c.x > 100) c.x = -100; for (let k = 0; k < 3; k++) { _m.makeScale(c.s * (1 - k * 0.2), c.s * 0.55, c.s * (0.8 - k * 0.1)).setPosition(c.x + k * c.s * 0.9 - c.s, c.y + (k === 1 ? c.s * 0.3 : 0), c.z); this.cm.setMatrixAt(i * 3 + k, _m); } }); this.cm.instanceMatrix.needsUpdate = true;
    // anéis: giram e lançam quem passa por dentro
    for (const g of this.rings) { g.m.rotation.z += dt * 2; g.cd -= dt; if (g.cd <= 0 && Math.hypot(p.x - g.x, p.z - g.z) < 1.8 && Math.abs(p.y + 0.6 - g.y) < 1.8) { g.cd = 1; P.vel.set(g.dx * 11, 4.5, g.dz * 11); P.grounded = false; whoosh(0.7); G.fx.ring(g.x, g.y, g.z, 0xffd040, 2.4, false, g.m.quaternion, 0.5); G.fx.burst(g.x, g.y, g.z, 0xffe070, 16, 4, 0); } }
    const on = (i) => { const s = ISL[i]; return Math.hypot(p.x - s[0], p.z - s[1]) < s[3] + 0.3 && p.y > s[2] - 0.6 && p.y < s[2] + 2.2; };
    if (!R.run && R.cp === 0 && !on(0) && p.y > -2 && Math.hypot(p.x, p.z) > 9.5) { R.run = true; R.t0 = now; emit('banner', '⏱ Valendo! Chegue ao troféu', 2.5); play('confirm', 0.6); }
    if (on(0) && R.run && R.cp === 0) R.run = false; // voltou para a largada: zera
    ISL.forEach((s, i) => { if (s[4] === 'cp' && i > R.cp && on(i)) { R.cp = i; S.toast('🚩 Checkpoint!', '#60e8ff'); chime(i, 0.6); G.fx.burst(s[0], s[2] + 1.5, s[1], 0x60e8ff, 24, 3, 1); } });
    if (R.run && on(ISL.length - 1)) { const t = now - R.t0, b = this.best(); R.run = false; R.cp = 0; S.d.best = S.d.best || {};
      if (t < 8) { S.toast('Atalho detectado: o tempo não vale como recorde', '#ff9a8a'); }
      else if (!b || t < b) { S.d.best.sky = Math.round(t * 10) / 10; emit('banner', '🏆 NOVO RECORDE: ' + fmt(t) + '!', 5); S.addCoins(b ? 60 : 150); S.addXp(80); play('win', 0.8); } else { emit('banner', '🏁 Chegou! ' + fmt(t) + ' (recorde ' + fmt(b) + ')', 4); S.addCoins(20); S.addXp(30); play('quest', 0.7); }
      S.stat('skyRace'); G._confetti && G._confetti(40); S.touch(); }
    if (p.y < -12) { const s = ISL[R.cp]; P.teleport(s[0], s[2] + 0.4, s[1], P.yaw); S.toast('☁ Caiu nas nuvens! Voltando ao checkpoint', '#bfe6ff'); whoosh(0.5); }
    G.modeLabel = R.run ? '⏱ ' + fmt(now - R.t0) + (this.best() ? '  ·  recorde ' + fmt(this.best()) : '') : this.best() ? '🏆 Recorde: ' + fmt(this.best()) : '🏁 Corrida nas Nuvens';
  },
  amb() { return { wind: 0.8 }; }
};

// ======================= VULCÃO ARDENTE =======================
const LY = -0.3, RIVERS = [0.5, 2.6, 4.4];
const lavaMat = () => new THREE.ShaderMaterial({ uniforms: { uTime: matU.uTime }, vertexShader: 'varying vec3 vW;\nvoid main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: 'uniform float uTime;\nvarying vec3 vW;\nfloat h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\nfloat n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }\nvoid main(){ vec2 p = vW.xz * 0.16; float t = uTime * 0.12; float a = n(p + vec2(t, t * 0.7)) * 0.55 + n(p * 2.3 - vec2(t * 1.4, 0.0)) * 0.3 + n(p * 5.0 + t * 2.0) * 0.15; vec3 c = mix(vec3(0.3, 0.02, 0.0), vec3(1.0, 0.32, 0.02), smoothstep(0.3, 0.62, a)); c = mix(c, vec3(1.0, 0.88, 0.35), smoothstep(0.66, 0.8, a)); c *= 0.85 + 0.15 * sin(uTime * 2.0 + vW.x * 0.3 + vW.z * 0.2); gl_FragColor = vec4(c, 1.0); }' });
function volH(x, z) {
  const d = Math.hypot(x, z); let h = (fbm(x * 0.04, z * 0.04, 13, 3) - 0.45) * 3 + 1.2;
  if (d < 48) h = Math.max(h, 30 - d * 0.62); if (d < 8) h = 30 - 8 * 0.62 - (8 - d) * 0.9;
  if (d > 30) { const a = Math.atan2(z, x); for (const ra of RIVERS) { const aa = ra + Math.sin(d * 0.08) * 0.22; let da = Math.abs(((a - aa) % (2 * PI) + 3 * PI) % (2 * PI) - PI) * d; if (da < 5) h = Math.min(h, h - smooth(1 - da / 5) * (h - LY + 1.2)); } }
  if (d > 66) h += Math.min(12, (d - 66) * (d - 66) * 0.08); return h;
}
MAPS.volcano = {
  name: 'Vulcão Ardente', size: 160, surface: 'stone', sky: [0x8a3a22, 0xff7a3a, 0x140808], fog: 0.75, spawn: [0, 60, 0],
  build(w, E, r) {
    w.heightFn = volH;
    const b1 = C(0x5a4a44), b2 = C(0x463a36), ash = C(0x8a8078), glow = C(0xff6a20);
    w.buildGround(72, (x, z, h, c) => { mix(c, b1, b2, noise2(x * 0.12, z * 0.12, 3)); if (h > 14) mix(c, c, ash, clamp((h - 14) / 10, 0, 0.7)); if (h < 0.6) mix(c, c, glow, clamp((0.6 - h) / 1.2, 0, 0.85)); });
    E.portal('village', 0, 64); E.sign('🌋 Vulcão Ardente: não pise na lava!', 0, 3.4, 56);
    // pontes sobre os rios de lava
    for (const ra of RIVERS) { const d = 50, aa = ra + Math.sin(d * 0.08) * 0.22, x = Math.cos(aa) * d, z = Math.sin(aa) * d, ry = -aa; for (let k = -2; k <= 2; k++) { const px = x + Math.cos(aa + H) * k * 2.4, pz = z + Math.sin(aa + H) * k * 2.4; w.put('prim/box', px, pz, { s: [2.6, 0.4, 3.2], ry, abs: 1.1 - Math.abs(k) * 0.15, tint: T(0x5a3a2a), col: 'box' }); } E.lamp(Math.cos(aa + H) * 6.5 + x, 2.6, Math.sin(aa + H) * 6.5 + z, 0xff8030); }
    // colunas de basalto e espinhos de obsidiana
    for (let i = 0; i < 26; i++) { const a = r() * PI * 2, d = 32 + r() * 30, x = Math.cos(a) * d, z = Math.sin(a) * d, y = volH(x, z); if (y < 0.8) continue; const n = 3 + Math.floor(r() * 4); for (let k = 0; k < n; k++) { const ox = (r() - 0.5) * 2.2, oz = (r() - 0.5) * 2.2, hh = 1.5 + r() * 4.5; w.put('prim/cyl', x + ox, z + oz, { s: [0.9, hh, 0.9], abs: volH(x + ox, z + oz) - 0.2, tint: T(0x2e2a2c), col: 'box' }); } }
    for (let i = 0; i < 18; i++) { const a = r() * PI * 2, d = 20 + r() * 40, x = Math.cos(a) * d, z = Math.sin(a) * d, y = volH(x, z); if (y < 0.8) continue; w.put('prim/cone', x, z, { s: [1.6 + r(), 4 + r() * 5, 1.6 + r()], abs: y - 0.3, tint: [0.22, 0.14, 0.3], col: 'box', cs: 0.5 }); }
    // templo em ruínas no platô
    const tx = -40, tz = -26, ty = volH(tx, tz); boxA(w, tx, ty - 1, tz, 18, 1.4, 14, 0x4a2a24);
    for (let k = -2; k <= 2; k++) for (const sz of [-6, 6]) if ((k + sz) % 3) { const ch = 3 + ((k + 3) % 3) * 1.4; w.put('prim/cyl', tx + k * 3.8, tz + sz, { s: [1.1, ch, 1.1], abs: ty + 0.4, tint: [0.55, 0.32, 0.28], col: 'box' }); w.put('prim/box', tx + k * 3.8, tz + sz, { s: [1.5, 0.4, 1.5], abs: ty + 0.4 + ch, tint: [0.5, 0.3, 0.26] }); }
    boxA(w, tx, ty + 0.4, tz, 3, 1.4, 1.8, 0x5a2a22); w.put('prim/sphere', tx, tz, { s: 1.2, abs: ty + 2.2, tint: [2, 0.6, 0.2] }); E.lamp(tx, ty + 2.9, tz, 0xff5020);
    for (const sx of [-8, 8]) { w.put('prim/cyl', tx + sx, tz - 6, { s: [0.9, 1.1, 0.9], abs: ty + 0.4, tint: T(0x3a3030), col: 'box' }); w.put('prim/cone', tx + sx, tz - 6, { s: [0.8, 1.1, 0.8], abs: ty + 1.5, tint: [2, 0.7, 0.2] }); E.lamp(tx + sx, ty + 1.8, tz - 6, 0xff7a30); }
    E.enemy('darkknight', tx + 2, tz + 3, true); E.enemy('skeleton', 30, 30); E.enemy('skeleton', 36, -20); E.enemy('skeleton', -20, 40); E.enemy('darkknight', 44, 10);
    for (let i = 0; i < 10; i++) { const a = i * 0.63 + 0.3, d = 36 + (i % 3) * 7, x = Math.cos(a) * d, z = Math.sin(a) * d; if (volH(x, z) > 0.8) E.ores.push({ type: i % 3 ? 'ruby' : 'sunstone', x, z }); }
    E.chest('vol_rim', 6.5, volH(6.5, 1) , 1, 2); E.chest('vol_temple', tx - 3, ty + 0.4, tz + 2, 1); E.secret('vol', -7.5, 26.5, 0, 2.4);
    E.spring(-12, 50, 14); E.lamp(0, 22, 0, 0xff6a20);
  },
  after(G, add) {
    const lv = add(new THREE.Mesh(new THREE.PlaneGeometry(160, 160, 1, 1), lavaMat())); lv.rotation.x = -H; lv.position.y = LY; lv.renderOrder = 1;
    const cr = add(new THREE.Mesh(new THREE.CircleGeometry(6.6, 28), lavaMat())); cr.rotation.x = -H; cr.position.y = 19.4;
    this.balls = []; this.erT = 4; this.burnCd = 0; this.safe = new THREE.Vector3(0, 2, 60);
    const bm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.7, 1), new THREE.MeshBasicMaterial({ color: 0xff7a20, fog: false }), 14); bm.frustumCulled = false; bm.count = 14; add(bm); this.bm = bm; const z0 = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < 14; i++) bm.setMatrixAt(i, z0);
    G.modeLabel = '';
  },
  burn(G, why) {
    const P = G.player; if (this.burnCd > 0) return; this.burnCd = 0.9; S.hp = Math.max(0, S.hp - 18); emit('hp'); sizzle(0.8); play('thud', 0.5); G.burntT = Math.max(G.burntT || 0, 4);
    G.fx.burst(P.pos.x, P.pos.y + 0.5, P.pos.z, 0xff7a20, 26, 4, 3); const d = this.safe.clone().sub(P.pos); d.y = 0; d.normalize(); P.vel.set(d.x * 6, 9, d.z * 6); P.grounded = false;
    S.toast('🔥 ' + why + '! −18 de vida', '#ff9a50'); S.stat('lavaBurn'); if (S.hp <= 0) G._knockedOut(why === 'Lava' ? 'a lava 🔥' : 'uma bola de fogo 🔥');
  },
  tick(dt, G) {
    const P = G.player, p = P.pos, w = G.world; if (!this.bm) return; this.burnCd -= dt; const _m = this._m || (this._m = new THREE.Matrix4());
    const inLava = (w.heightAt(p.x, p.z) < LY + 0.1 && p.y < LY + 0.7) || (Math.hypot(p.x, p.z) < 6.4 && p.y < 20.3);
    if (inLava && S.hp > 0 && !G.pending) this.burn(G, 'Lava'); else if (P.grounded && !inLava) this.safe.copy(p);
    // erupções: estrondo e bolas de fogo em arco
    this.erT -= dt; if (this.erT <= 0) { this.erT = 7 + Math.random() * 6; const d = Math.hypot(p.x, p.z); rumble(clamp(1 - d / 110, 0.15, 0.9)); G.fx.burst(0, 22, 0, 0xff8030, 40, 9, 4);
      for (let k = 0; k < 6 && this.balls.length < 14; k++) { const a = Math.random() * PI * 2, sp = 5 + Math.random() * 9; this.balls.push({ x: 0, y: 21, z: 0, vx: Math.cos(a) * sp, vy: 15 + Math.random() * 8, vz: Math.sin(a) * sp }); } }
    const z0 = this._z0 || (this._z0 = new THREE.Matrix4().makeScale(0, 0, 0));
    for (let i = this.balls.length - 1; i >= 0; i--) { const b = this.balls[i]; b.vy -= 9.2 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; if (Math.random() < 0.6) G.fx.streak(b.x, b.y, b.z, (Math.random() - 0.5) * 0.6, 0.4, (Math.random() - 0.5) * 0.6, Math.random() < 0.5 ? 0xff5a10 : 0xffc040, 0.6);
      const gy = w.heightAt(b.x, b.z); if (b.y <= Math.max(gy, LY)) { G.fx.burst(b.x, Math.max(gy, LY) + 0.3, b.z, 0xff7a20, 22, 5, 5); G.fx.ring(b.x, Math.max(gy, LY) + 0.1, b.z, 0xff9a40, 3, true, null, 0.6); const dd = Math.hypot(b.x - p.x, b.z - p.z); if (dd < 30) play('thud', clamp(1 - dd / 30, 0.1, 0.8)); if (dd < 2.8 && Math.abs(p.y - gy) < 2.5) this.burn(G, 'Bola de fogo'); this.balls.splice(i, 1); } }
    for (let i = 0; i < 14; i++) { const b = this.balls[i]; if (b) { _m.makeScale(1, 1, 1).setPosition(b.x, b.y, b.z); this.bm.setMatrixAt(i, _m); } else this.bm.setMatrixAt(i, z0); } this.bm.instanceMatrix.needsUpdate = true;
  },
  amb(P) { const d = Math.hypot(P.pos.x, P.pos.z); return { lava: clamp(1.1 - d / 70, 0.35, 1), wind: 0.25 }; }
};

// ======================= NEON CITY =======================
const NEON = [0xff3cc8, 0x3cf0ff, 0xa060ff, 0xffe040, 0x40ff90, 0xff6a3c];
MAPS.neon = {
  name: 'Neon City', size: 150, surface: 'stone', sky: [0x1a0838, 0x6a18a0, 0x05020c], fog: 0.8, spawn: [0, 50, 0],
  build(w, E, r) {
    w.heightFn = (x, z) => { const d = Math.max(Math.abs(x), Math.abs(z)); return d > 66 ? Math.min(12, (d - 66) * (d - 66) * 0.1) : 0; };
    const asp = C(0x2a2838), road = C(0x1e1c2a), side = C(0x4a4858), lineY = C(0xc8a030), lineW = C(0x9a98b0);
    w.buildGround(96, (x, z, h, c) => { const mx = ((x % 28) + 42) % 28 - 14, mz = ((z % 28) + 42) % 28 - 14, rx = Math.abs(mx) < 4.5, rz = Math.abs(mz) < 4.5; mix(c, asp, asp, 0);
      if (rx || rz) { mix(c, road, road, 0); if ((rx && Math.abs(mx) < 0.18 && Math.abs(z * 0.5 % 2) < 1) || (rz && Math.abs(mz) < 0.18 && Math.abs(x * 0.5 % 2) < 1)) mix(c, c, lineY, 1); } else if (Math.abs(mx) < 6 || Math.abs(mz) < 6) mix(c, c, side, 1); else mix(c, c, C(0x343244), 1);
      if ((rx && Math.abs(Math.abs(mx) - 4.2) < 0.08) || (rz && Math.abs(Math.abs(mz) - 4.2) < 0.08)) mix(c, c, lineW, 0.7); });
    E.portal('village', 0, 56); E.sign('🌃 Neon City', 0, 3.6, 46);
    // prédios nos quarteirões (a praça central fica livre para o holograma)
    const blds = []; const keys = ['city/building-a', 'city/building-b', 'city/building-c', 'city/building-d', 'city/building-e', 'city/building-skyscraper-a', 'city/building-skyscraper-b', 'city/building-skyscraper-c'];
    for (let bx = -56; bx <= 56; bx += 28) for (let bz = -56; bz <= 56; bz += 28) { if (Math.abs(bx) < 1 && Math.abs(bz) < 1) continue; if (Math.abs(bx) < 1 && bz > 40) continue;
      for (let k = 0; k < 2; k++) { const ox = (k ? 4.5 : -4.5) * (Math.abs(bz) % 56 ? 1 : 1), x = bx + ox, z = bz + (k ? -3 : 3), key = keys[(Math.abs(bx * 7 + bz * 3 + k * 5)) % keys.length];
        const bb = w.put(key, x, z, { s: 6.5, ry: (k ? 0 : PI), col: 'box', tint: [0.42, 0.42, 0.6] }); if (bb) blds.push(bb); } }
    this._blds = blds;
    // praça: palco do holograma, máquinas de fliperama, bancos
    boxA(w, 0, 0, 0, 7, 0.6, 7, 0x3a3850); boxA(w, 0, 0.6, 0, 3.2, 0.5, 3.2, 0x4a4868);
    for (let i = 0; i < 4; i++) { const a = i * H + PI / 4; boxA(w, Math.cos(a) * 9, 0, Math.sin(a) * 9, 1.1, 1.9, 0.9, 0x2a2440); }
    for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; w.put('grave/bench', Math.cos(a) * 12.5, Math.sin(a) * 12.5, { s: 1.6, ry: -a + H, col: 'box', tint: [0.5, 0.5, 0.7] }); }
    { let n = 0; for (let t = -60; t <= 60; t += 20) { if (Math.abs(t) < 15) continue; for (const sd of [-5.6, 5.6]) for (const [x, z] of [[sd, t], [t, sd]]) { E.lamp(x, 3.2, z, NEON[n++ % NEON.length]); w.put('prim/cyl', x, z, { s: [0.15, 3.2, 0.15], tint: T(0x22202e) }); } } }
    // trampolins para chegar aos telhados
    for (const [x, z] of [[-14, 9], [14, -9], [9, 22], [-22, -14], [22, 36]]) E.spring(x, z, 16);
    E.npc('neon1', 'Cyber Mimi', 'Guia da Neon City', 6, 40, { fur: '#b8b0d8', fur2: '#3b3b45', pattern: 2, eyes: '#4aa3e0', hat: 7 }, { lines: ['Bem-vinde à Neon City! Os trampolins levam aos telhados.', 'Já viu o holograma da praça? Ele dança a noite toda.', 'Dizem que tem caixas perdidas nos telhados...'] });
    for (let i = 0; i < 8; i++) { const b = blds[(i * 5) % blds.length]; if (b) E.collect('package', 'survival/box', (b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, 2.4); }
    for (const c of E.collects) if (c.item === 'package') { const b = blds.find((q) => c.x >= q.x0 && c.x <= q.x1 && c.z >= q.z0 && c.z <= q.z1); if (b) c.fy = b.y1; }
    E.secret('neon', 0, 9.5, 0, 2.2); E.chest('neon_roof', 28 + 4.5, 0, 28 - 3, 1);
  },
  after(G, add) {
    if (this._holo) { this._holo.dispose(); this._holo = null; }
    const blds = this._blds || [], list = [], rnd = (() => { let s = 77; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    // faixas neon nas fachadas e no topo dos prédios
    for (const b of blds) { const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, wx = b.x1 - b.x0, wz = b.z1 - b.z0, top = b.y1, c = NEON[Math.floor(rnd() * NEON.length)];
      list.push([cx, top + 0.1, b.z0 - 0.02, wx, 0.18, 0.06, 0, c], [cx, top + 0.1, b.z1 + 0.02, wx, 0.18, 0.06, 0, c], [b.x0 - 0.02, top + 0.1, cz, 0.06, 0.18, wz, 0, c], [b.x1 + 0.02, top + 0.1, cz, 0.06, 0.18, wz, 0, c]);
      for (let k = 0; k < 2; k++) { const y = 2.5 + rnd() * (top - 4), c2 = NEON[Math.floor(rnd() * NEON.length)], side = Math.floor(rnd() * 4); if (side < 2) list.push([cx + (rnd() - 0.5) * wx * 0.5, y, side ? b.z1 + 0.03 : b.z0 - 0.03, wx * 0.35, 0.22, 0.06, 0, c2]); else list.push([side === 2 ? b.x0 - 0.03 : b.x1 + 0.03, y, cz + (rnd() - 0.5) * wz * 0.5, 0.06, 0.22, wz * 0.35, 0, c2]); } }
    for (let i = 0; i < 4; i++) { const a = i * H + PI / 4; list.push([Math.cos(a) * 9 - Math.sin(a) * 0.46, 1.25, Math.sin(a) * 9 + Math.cos(a) * 0.46 * 0, 0.8, 0.55, 0.05, -a + H, NEON[i]]); }
    list.push([0, 1.12, 0, 3.3, 0.06, 3.3, 0, 0x3cf0ff]);
    add(glowMesh(list));
    // letreiros com texto
    const signs = ['MIAU BAR', 'NEON CAT', '24H', 'RoleVRGO', 'ARCADE', 'RAMEN', 'HOTEL', 'PIXEL'];
    signs.forEach((txt, i) => { const b = blds[(i * 3 + 1) % blds.length]; if (!b) return; const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d'), col = '#' + NEON[i % NEON.length].toString(16).padStart(6, '0'); g.fillStyle = '#0a0612'; g.fillRect(0, 0, 256, 96); g.strokeStyle = col; g.lineWidth = 5; g.strokeRect(5, 5, 246, 86); g.font = 'bold 50px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = col; g.shadowBlur = 18; g.fillStyle = col; g.fillText(txt, 128, 50); g.fillStyle = '#fff'; g.shadowBlur = 4; g.fillText(txt, 128, 50);
      const tx = new THREE.CanvasTexture(c), m = add(new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.6), new THREE.MeshBasicMaterial({ map: tx, fog: false, side: THREE.DoubleSide }))); const front = i % 2; m.position.set((b.x0 + b.x1) / 2, 5 + (i % 3) * 3, front ? b.z1 + 0.06 : b.z0 - 0.06); });
    // holograma: gato gigante dançando, translúcido e azul
    const holo = this._holo = new CatAvatar({ fur: '#7fe8ff', fur2: '#ffffff', pattern: 1, eyes: '#ffffff', hat: 9, acc: 7 }, '', { noTag: true, scale: 3.4 }); holo.mat.transparent = true; holo.mat.opacity = 0.55; holo.mat.emissive.setHex(0x1a8aff); holo.mat.depthWrite = false; holo.mesh.castShadow = false; holo.root.position.set(0, 1.1, 0); holo.setEmote(2); G.scene.add(holo.root); add(holo.root);
    const ring = add(new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.06, 6, 40), new THREE.MeshBasicMaterial({ color: 0x3cf0ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }))); ring.rotation.x = H; ring.position.y = 1.3; this.ring = ring;
    const beam = add(new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 9, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x3cf0ff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }))); beam.position.y = 5.6; beam.renderOrder = 6;
    // carros voadores e holofotes
    const cm = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 0.7, 1.2), new THREE.MeshBasicMaterial({ fog: false }), 14); cm.frustumCulled = false; add(cm); this.cars = []; const col = new THREE.Color();
    for (let i = 0; i < 14; i++) { const lane = i % 4; this.cars.push({ x: -70 + (i * 37) % 140, lane, z: [-14, 14, -42, 42][lane] + (i % 2) * 1.6, y: 16 + (i % 5) * 2.2, sp: (lane % 2 ? -1 : 1) * (9 + (i % 3) * 3) }); cm.setColorAt(i, col.setHex(NEON[i % NEON.length])); } this.cm = cm;
    this.lights = []; for (const [x, z] of [[-30, -30], [32, 26], [-26, 34]]) { const g = new THREE.CylinderGeometry(0.3, 4, 40, 12, 1, true); g.translate(0, 20, 0); const m = add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xc8b0ff, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }))); m.position.set(x, 18, z); this.lights.push(m); }
    G.modeLabel = '';
  },
  tick(dt, G) {
    if (!this.cm) return; const t = G.time, _m = this._m || (this._m = new THREE.Matrix4()), q = this._q || (this._q = new THREE.Quaternion()), v = this._v || (this._v = new THREE.Vector3()), s1 = this._s || (this._s = new THREE.Vector3(1, 1, 1));
    if (this._holo) { const h = this._holo; h.root.rotation.y += dt * 0.5; h.root.position.y = 1.1 + Math.sin(t * 1.3) * 0.15; h.update(dt, false); h.mat.opacity = 0.45 + Math.sin(t * 9) * 0.05 + (Math.random() < 0.02 ? -0.3 : 0); } // falha de holograma de vez em quando
    this.ring.rotation.z += dt; this.ring.position.y = 1.3 + Math.sin(t * 2) * 0.3;
    this.cars.forEach((c, i) => { c.x += c.sp * dt; if (c.x > 75) c.x = -75; if (c.x < -75) c.x = 75; q.setFromAxisAngle(v.set(0, 1, 0), c.sp > 0 ? 0 : PI); _m.compose(v.set(c.x, c.y + Math.sin(t + i) * 0.3, c.z), q, s1); this.cm.setMatrixAt(i, _m); }); this.cm.instanceMatrix.needsUpdate = true;
    this.lights.forEach((m, i) => { m.rotation.z = Math.sin(t * 0.4 + i * 2) * 0.5; m.rotation.x = Math.cos(t * 0.33 + i) * 0.4; });
  },
  amb() { return { rain: 1, neon: 0.6, wind: 0.2 }; }
};

// registro: ordem, ícones e cores dos portais
for (const id of ['sky', 'volcano', 'neon']) if (MAP_ORDER.indexOf(id) < 0) MAP_ORDER.push(id);
Object.assign(MAP_ICONS, { sky: '☁️', volcano: '🌋', neon: '🌃' });
Object.assign(PORTAL_COLORS, { sky: 0xbfe8ff, volcano: 0xff6a20, neon: 0xff3cc8 });
