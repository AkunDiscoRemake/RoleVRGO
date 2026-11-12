import * as THREE from 'three';

// ---------- Modelos Kenney pré-processados (cores por vértice) ----------
let bin = null, index = null;
const geoCache = {};
export async function loadModels(onProgress) {
  const [j, b] = await Promise.all([
    fetch('assets/models.json').then((r) => r.json()),
    fetch('assets/models.bin').then((r) => r.arrayBuffer())
  ]);
  index = j; bin = b; if (onProgress) onProgress();
}
// registra uma primitiva procedural (caixa, cilindro...) como "modelo" para o batcher
export function addPrim(key, geo, rgb) {
  const g = geo.index ? geo.toNonIndexed() : geo; const p = g.attributes.position, n = g.attributes.normal, v = p.count;
  const pos = new Float32Array(p.array), nrm = new Int8Array(v * 3), col = new Uint8Array(v * 3), idx = new Uint16Array(v);
  for (let i = 0; i < v; i++) { nrm[i * 3] = n.getX(i) * 127; nrm[i * 3 + 1] = n.getY(i) * 127; nrm[i * 3 + 2] = n.getZ(i) * 127; col[i * 3] = rgb ? rgb[0] : 255; col[i * 3 + 1] = rgb ? rgb[1] : 255; col[i * 3 + 2] = rgb ? rgb[2] : 255; idx[i] = i; }
  g.computeBoundingBox(); const b = g.boundingBox;
  index[key] = { raw: { pos, nrm, col, idx, v, i: v, b: [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z] } };
}
export function hasModel(key) { return !!(index && index[key]); }
export function modelInfo(key) { return index[key]; }
// Devolve vistas cruas (sem cópia) para o batcher estático.
export function modelRaw(key) {
  const m = index[key]; if (!m) return null;
  if (m.raw) return m.raw;
  const pad4 = (n) => (n + 3) & ~3;
  let o = m.o;
  const pos = new Float32Array(bin, o, m.v * 3); o += m.v * 12;
  const nrm = new Int8Array(bin, o, m.v * 3); o += pad4(m.v * 3);
  const col = new Uint8Array(bin, o, m.v * 3); o += pad4(m.v * 3);
  const idx = new Uint16Array(bin, o, m.i);
  m.raw = { pos, nrm, col, idx, v: m.v, i: m.i, b: m.b };
  return m.raw;
}
// Geometria Three independente (para instancing e objetos dinâmicos).
export function modelGeometry(key) {
  if (geoCache[key]) return geoCache[key];
  const r = modelRaw(key); if (!r) return new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(r.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(r.nrm, 3, true));
  g.setAttribute('color', new THREE.BufferAttribute(r.col, 3, true));
  g.setIndex(new THREE.BufferAttribute(r.idx, 1));
  g.computeBoundingSphere();
  geoCache[key] = g;
  return g;
}

// ---------- Áudio (Kenney Audio, .ogg) ----------
const SOUNDS = {
  step_grass: ['footstep_grass_000', 'footstep_grass_001'], step_stone: ['footstep_concrete_000', 'footstep_concrete_001'],
  step_snow: ['footstep_snow_001', 'footstep_snow_003'], step_wood: ['footstep_wood_000', 'footstep_wood_002'],
  punch: ['impactPunch_medium_000', 'impactPunch_medium_002'], punch_heavy: ['impactPunch_heavy_000', 'impactPunch_heavy_004'],
  block: ['impactPlate_medium_000'], mine: ['impactMining_000', 'impactMining_001'], mine_break: ['impactGlass_heavy_000'],
  thud: ['impactSoft_medium_000', 'impactSoft_heavy_001'], wood: ['impactWood_medium_000'], bell: ['impactBell_heavy_000'],
  coin: ['handleCoins', 'handleCoins2'], chest: ['doorOpen_1'], pickup: ['handleSmallLeather'], cloth: ['cloth1'], book: ['bookFlip1'], dig: ['chop'],
  click: ['click_001'], hover: ['tick_001'], confirm: ['confirmation_001'], error: ['error_004'], open: ['open_001'], close: ['close_001'],
  splash: ['drop_002'], bite: ['pluck_001'], sel: ['select_001'], msg: ['bong_001'],
  levelup: ['jingles_STEEL00'], quest: ['jingles_PIZZI07'], ko: ['jingles_HIT00'], win: ['jingles_SAX07'], secret: ['jingles_NES00'], event: ['jingles_STEEL10'],
  portal: ['phaseJump1'], dodge: ['phaserUp1'], power: ['powerUp2'], heart: ['pepSound1']
};
let ctx = null, master = null;
const buffers = {};
export let audioVolume = 0.8;
export function audioInit() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = self.AudioContext || self.webkitAudioContext; if (!AC) return;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = audioVolume; master.connect(ctx.destination);
  const files = {};
  for (const k in SOUNDS) for (const f of SOUNDS[k]) files[f] = 1;
  Object.keys(files).forEach((f) => {
    fetch('assets/audio/' + f + '.ogg').then((r) => r.arrayBuffer()).then((ab) => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))
      .then((buf) => { buffers[f] = buf; }).catch(() => { /* som opcional */ });
  });
}
export function setVolume(v) { audioVolume = v; if (master) master.gain.value = v; }
// vol 0..1, pan -1..1, rate
export function play(name, vol, pan, rate) {
  if (!ctx || audioVolume <= 0) return;
  const list = SOUNDS[name]; if (!list) return;
  const buf = buffers[list[(Math.random() * list.length) | 0]]; if (!buf) return;
  const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate || (0.94 + Math.random() * 0.12);
  const g = ctx.createGain(); g.gain.value = vol == null ? 1 : vol;
  src.connect(g);
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(master); } else g.connect(master);
  src.start();
}
// som posicional simples (atenuação + pan) relativo à câmera
const _v = new THREE.Vector3();
export function playAt(name, pos, camera, vol) {
  if (!ctx) return;
  _v.copy(pos).sub(camera.getWorldPosition(new THREE.Vector3()));
  const d = _v.length(); if (d > 30) return;
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
  play(name, (vol == null ? 1 : vol) / (1 + d * d * 0.03), d > 0.01 ? _v.dot(right) / d : 0);
}
// Miado procedural (osciladores) — a Kenney não tem miados, então é sintetizado.
export function meow(vol, pitch) {
  if (!ctx || audioVolume <= 0) return;
  const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  const p = pitch || 1;
  o.type = 'sawtooth'; o.frequency.setValueAtTime(520 * p, t); o.frequency.linearRampToValueAtTime(880 * p, t + 0.12); o.frequency.exponentialRampToValueAtTime(430 * p, t + 0.5);
  f.type = 'bandpass'; f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(1900, t + 0.15); f.frequency.linearRampToValueAtTime(1000, t + 0.5); f.Q.value = 3;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35 * (vol || 1), t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 0.6);
}
export function purr(vol) {
  if (!ctx || audioVolume <= 0) return;
  const t = ctx.currentTime, o = ctx.createOscillator(), l = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
  o.type = 'triangle'; o.frequency.value = 55; l.frequency.value = 24; lg.gain.value = 0.25 * (vol || 1);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3 * (vol || 1), t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
  l.connect(lg); lg.connect(g.gain); o.connect(g); g.connect(master); o.start(t); l.start(t); o.stop(t + 1.05); l.stop(t + 1.05);
}
export const SOUND_FILES = SOUNDS;
