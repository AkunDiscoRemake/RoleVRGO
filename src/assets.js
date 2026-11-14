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
export function modelKeys() { return Object.keys(index).filter((k) => k.indexOf('asset:') !== 0); }
export function addRaw(key, raw) { index[key] = { raw }; delete geoCache[key]; }
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
  g.userData.shared = true; geoCache[key] = g;
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
  glass: ['glass_001', 'glass_003', 'glass_005'],
  portal: ['phaseJump1'], dodge: ['phaserUp1'], power: ['powerUp2'], heart: ['pepSound1']
};
let ctx = null, master = null, lp = null, noiseBuf = null; const loops = {};
const buffers = {};
export let audioVolume = 0.8;
export function audioInit() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = self.AudioContext || self.webkitAudioContext; if (!AC) return;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = audioVolume; lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000; master.connect(lp); lp.connect(ctx.destination);
  const files = {};
  for (const k in SOUNDS) for (const f of SOUNDS[k]) files[f] = 1;
  Object.keys(files).forEach((f) => {
    fetch('assets/audio/' + f + '.ogg').then((r) => r.arrayBuffer()).then((ab) => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))
      .then((buf) => { buffers[f] = buf; }).catch(() => { /* som opcional */ });
  });
}
export function audioNodes() { return ctx ? { ctx, master } : null; }
// estouro de bolha procedural
export function pop(vol, size) { if (!ctx || audioVolume <= 0) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), f0 = (600 + Math.random() * 500) / (0.6 + (size || 0.6)); o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 2.6, t + 0.07); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3 * (vol || 1), t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.12); }
// --- efeitos procedurais (WebAudio) usados principalmente no Aero Paraíso ---
// abafa todo o som quando a cabeça está debaixo d'água
export function setUnder(on) { if (lp) lp.frequency.setTargetAtTime(on ? 520 : 20000, ctx.currentTime, 0.12); }
function noise() { if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } return noiseBuf; }
// laços de ambiente por ruído filtrado: water (marolas), fall (cachoeira), under (ronco submarino). níveis 0..1
export function ambience(levels) {
  if (!ctx) return;
  const defs = { water: ['bandpass', 520, 0.6, 0.11], fall: ['highpass', 900, 0.4, 0.2], under: ['lowpass', 160, 0.8, 0.3], wind: ['bandpass', 360, 0.9, 0.16], hum: ['lowpass', 120, 6, 0.06], lava: ['lowpass', 95, 3, 0.32], rain: ['highpass', 2400, 0.5, 0.12], neon: ['bandpass', 120, 18, 0.05] };
  for (const k in defs) { const want = audioVolume > 0 ? (levels[k] || 0) : 0; let L = loops[k];
    if (!L) { if (want <= 0.001) continue; const d = defs[k], src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); src.buffer = noise(); src.loop = true; src.playbackRate.value = k === 'under' ? 0.5 : 1; f.type = d[0]; f.frequency.value = d[1]; f.Q.value = d[2]; g.gain.value = 0; src.connect(f); f.connect(g); g.connect(master);
      if (k === 'wind') { const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.09; lg.gain.value = 180; lfo.connect(lg); lg.connect(f.frequency); lfo.start(); }
      if (k === 'lava') { const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.7; lg.gain.value = 40; lfo.connect(lg); lg.connect(f.frequency); lfo.start(); } // borbulhar
      if (k === 'water') { const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.23; lg.gain.value = 260; lfo.connect(lg); lg.connect(f.frequency); lfo.start(); }
      src.start(); L = loops[k] = { g, max: d[3] }; }
    if (Math.abs((L.last == null ? -1 : L.last) - want) > 0.02) { L.last = want; L.g.gain.setTargetAtTime(want * L.max, ctx.currentTime, 0.25); } }
}
// efeitos novos (procedurais, sem arquivos): boing do trampolim, whoosh do anel, chiado da lava, estrondo de erupção
export function boing(vol) { if (!ctx || audioVolume <= 0) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(620, t + 0.12); o.frequency.exponentialRampToValueAtTime(320, t + 0.35); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime((vol || 0.5) * 0.5, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.42); }
export function whoosh(vol) { if (!ctx || audioVolume <= 0) return; const t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2600, t + 0.35); f.frequency.exponentialRampToValueAtTime(600, t + 0.6); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime((vol || 0.5) * 0.9, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + 0.62); }
export function sizzle(vol) { if (!ctx || audioVolume <= 0) return; const t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise(); f.type = 'highpass'; f.frequency.value = 3200; g.gain.setValueAtTime((vol || 0.5) * 0.6, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + 0.92); }
export function rumble(vol) { if (!ctx || audioVolume <= 0) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(42, t); o.frequency.exponentialRampToValueAtTime(28, t + 1.4); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime((vol || 0.5) * 0.7, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5); o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 1.55); thunder((vol || 0.5) * 0.5); }
// sirene (duas notas) e apito para o roleplay de profissões
export function siren(vol) { if (!ctx || audioVolume <= 0) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; for (let i = 0; i < 4; i++) { o.frequency.setValueAtTime(i % 2 ? 620 : 820, t + i * 0.35); } g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime((vol || 0.4) * 0.12, t + 0.03); g.gain.setValueAtTime((vol || 0.4) * 0.12, t + 1.35); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.45); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400; o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 1.5); }
export function whistle(vol) { if (!ctx || audioVolume <= 0) return; const t = ctx.currentTime, o = ctx.createOscillator(), l = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = 2900; l.frequency.value = 38; lg.gain.value = 160; l.connect(lg); lg.connect(o.frequency); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime((vol || 0.5) * 0.35, t + 0.02); g.gain.setValueAtTime((vol || 0.5) * 0.35, t + 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55); o.connect(g); g.connect(master); o.start(t); l.start(t); o.stop(t + 0.6); l.stop(t + 0.6); }
// trovão: ruído grave com estrondo e rolagem
export function thunder(vol) { if (!ctx || audioVolume <= 0) return; const t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise(); s.playbackRate.value = 0.35; f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(90, t + 2.8); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9 * (vol || 1), t + 0.05); g.gain.exponentialRampToValueAtTime(0.25 * (vol || 1), t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2); s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + 3.3); }
// sininho de vidro (pérolas, segredos, bolhas grandes)
// 🎹 teclado do Gato-Anjo: uma melodia curtinha e animada (original) num timbre de órgão eletrônico
export function keyboardTune(vol) { if (!ctx || audioVolume <= 0) return; const t0 = ctx.currentTime + 0.05, v = 0.09 * (vol == null ? 1 : vol), N = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const mel = [[72, 0, 1], [76, 1, 1], [79, 2, 1], [84, 3, 2], [83, 5, 1], [79, 6, 1], [81, 7, 2], [77, 9, 1], [81, 10, 1], [84, 11, 1], [86, 12, 2], [84, 14, 2]], bass = [[48, 0, 4], [43, 4, 4], [53, 8, 4], [48, 12, 4]], st = 0.13;
  const note = (m, at, d, type, a) => { const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), t = t0 + at * st, e = t + d * st; o.type = type; o2.type = 'square'; o.frequency.value = N(m); o2.frequency.value = N(m) * 2.003; const g2 = ctx.createGain(); g2.gain.value = 0.18; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a, t + 0.012); g.gain.setValueAtTime(a * 0.7, e - 0.02); g.gain.exponentialRampToValueAtTime(0.0001, e + 0.08); o.connect(g); o2.connect(g2); g2.connect(g); g.connect(master); o.start(t); o2.start(t); o.stop(e + 0.1); o2.stop(e + 0.1); };
  for (const [m, a, d] of mel) note(m, a, d, 'square', v); for (const [m, a, d] of bass) note(m, a, d, 'triangle', v * 1.4); }
export function chime(step, vol) { if (!ctx || audioVolume <= 0) return; const t = ctx.currentTime, notes = [1318.5, 1568, 1760, 2093, 2637, 3136]; for (let i = 0; i < 3; i++) { const o = ctx.createOscillator(), g = ctx.createGain(), f = notes[((step || 0) + i * 2) % notes.length]; o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + i * 0.07); g.gain.exponentialRampToValueAtTime(0.16 * (vol || 1), t + i * 0.07 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.9); o.connect(g); g.connect(master); o.start(t + i * 0.07); o.stop(t + i * 0.07 + 1); } }
// espirro d'água sintetizado: ruído com filtro descendo
export function splashSfx(vol) { if (!ctx || audioVolume <= 0) return; const t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise(); f.type = 'lowpass'; f.frequency.setValueAtTime(5000, t); f.frequency.exponentialRampToValueAtTime(350, t + 0.55); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * (vol || 1), t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7); s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + 0.75); }
// assobio de golfinho
export function chirp(vol) { if (!ctx || audioVolume <= 0) return; const t = ctx.currentTime; for (let i = 0; i < 2; i++) { const o = ctx.createOscillator(), g = ctx.createGain(), t0 = t + i * 0.16; o.type = 'sine'; o.frequency.setValueAtTime(1500, t0); o.frequency.exponentialRampToValueAtTime(3400, t0 + 0.08); o.frequency.exponentialRampToValueAtTime(2100, t0 + 0.14); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.12 * (vol || 1), t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15); o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.17); } }
let recDest = null;
export function audioStream() { if (!ctx || !ctx.createMediaStreamDestination) return null; if (!recDest) { recDest = ctx.createMediaStreamDestination(); master.connect(recDest); } return recDest.stream; }
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
const _cp = new THREE.Vector3(), _cq = new THREE.Quaternion(), _cr = new THREE.Vector3();
export function playAt(name, pos, camera, vol) {
  if (!ctx) return;
  _v.copy(pos).sub(camera.getWorldPosition(_cp));
  const d = _v.length(); if (d > 30) return;
  const right = _cr.set(1, 0, 0).applyQuaternion(camera.getWorldQuaternion(_cq));
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
