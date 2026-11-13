import * as THREE from 'three';
import { loadModels, audioInit, setVolume, play } from './assets.js';
import { Player } from './player.js';
import { G } from './game.js';
import { ui } from './ui.js';
import { net } from './net.js';
import { S } from './state.js';
import { perf } from './perf.js';
import { worldMat } from './world.js';
import { CatAvatar, defaultLook, cleanLook, FUR_COLORS, EYE_COLORS, PATTERNS } from './cat.js';
import { store, emit, on } from './util.js';
import { rec } from './rec.js';
import { LANG, LANGS, setLang, translateDOM } from './i18n.js';
import { music } from './music.js';
import { hands } from './hands.js';

THREE.ColorManagement.enabled = false; // pipeline em espaço gama: mais leve no Adreno 530 do Oculus Go
const $ = (id) => document.getElementById(id);
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local');
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 400);
const player = new Player(scene, camera, renderer);
const basePR = Math.min(devicePixelRatio || 1, 2);
function resize() { if (renderer.xr.isPresenting) return; renderer.setPixelRatio(basePR * perf.scale); renderer.setSize(innerWidth, innerHeight, false); camera.fov = 72; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);

// aplica o nível de qualidade escolhido pelo controlador
let shadowsOn = false;
perf.onApply((p) => {
  resize(); camera.far = Math.max(380, p.drawDist * 3); camera.updateProjectionMatrix();
  const sh = p.shadows === 2; if (sh !== shadowsOn) { shadowsOn = sh; renderer.shadowMap.enabled = sh; worldMat.needsUpdate = true; scene.traverse((o) => { if (o.material && o.material.isMeshLambertMaterial) o.material.needsUpdate = true; }); }
  if (renderer.xr.isPresenting && renderer.xr.setFoveation) renderer.xr.setFoveation(p.level <= 1 ? 1 : 0.5);
});

// ---------- prévia do gato no lobby ----------
const pv = new THREE.Scene(); pv.background = new THREE.Color(0x2a2850); pv.add(new THREE.HemisphereLight(0xffffff, 0x554466, 3.2)); const pl = new THREE.DirectionalLight(0xffffff, 2.2); pl.position.set(2, 3, 4); pv.add(pl);
const pcam = new THREE.PerspectiveCamera(40, 1, 0.1, 20); pcam.position.set(0, 0.85, 3.4); pcam.lookAt(0, 0.62, 0);
let look = cleanLook(store.get('look', null) || defaultLook()); let pcat = null;
function setPreview() { if (pcat) { pv.remove(pcat.root); pcat.dispose(); } pcat = new CatAvatar(look, '', { noTag: true }); pcat.root.position.x = innerWidth > 800 ? 0.75 : 0; pcat.root.position.y = innerWidth > 800 ? 0 : 0.55; pv.add(pcat.root); }

// ---------- lobby (HTML) ----------
let started = false, chosen = store.get('room', { code: 'PRACA', name: 'Praça Central', pub: true });
function swatches(el, list, key) { el.innerHTML = ''; list.forEach((c) => { const b = document.createElement('button'); b.className = 'sw' + (look[key] === c ? ' on' : ''); b.style.background = c; b.onclick = () => { look[key] = c; store.set('look', look); setPreview(); swatches(el, list, key); }; el.appendChild(b); }); }
function buildLobby() {
  $('name').value = store.get('name', '') || 'Gato' + Math.floor(100 + Math.random() * 900);
  swatches($('fur'), FUR_COLORS, 'fur'); swatches($('fur2'), FUR_COLORS, 'fur2'); swatches($('eyes'), EYE_COLORS, 'eyes');
  const pt = $('pattern'); pt.innerHTML = ''; PATTERNS.forEach((p, i) => { const b = document.createElement('button'); b.className = 'chip' + (look.pattern === i ? ' on' : ''); b.textContent = p; b.onclick = () => { look.pattern = i; store.set('look', look); setPreview(); buildLobby(); }; pt.appendChild(b); });
}
function drawRooms(list) {
  const el = $('rooms'), counts = net.roomCounts(); el.innerHTML = '';
  (list || []).forEach((r) => { const b = document.createElement('button'); b.className = 'room' + (chosen.code === r.code ? ' on' : ''); b.textContent = (r.permanent ? '★ ' : '') + r.name + ' — ' + (counts[r.code] || 0) + ' online'; b.onclick = () => { chosen = { code: r.code, name: r.name, pub: true }; drawRooms(list); }; el.appendChild(b); });
  if (!chosen.pub) { const b = document.createElement('button'); b.className = 'room on'; b.textContent = '🔒 ' + chosen.name + ' [' + chosen.code + ']'; el.appendChild(b); }
}
let roomList = [];
async function boot() {
  translateDOM(document.body);
  const ls = $('lang'); LANGS.forEach((l) => { const o = document.createElement('option'); o.value = l[0]; o.textContent = l[1]; if (l[0] === LANG) o.selected = true; ls.appendChild(o); });
  ls.onchange = () => { setLang(ls.value); store.set('name', $('name').value); location.reload(); };
  buildLobby(); setPreview(); resize();
  const st = $('status');
  try { st.textContent = 'Carregando modelos (Kenney)...'; await loadModels(); } catch (e) { st.textContent = 'Erro ao carregar os modelos: ' + e.message; return; }
  st.textContent = 'Conectando ao servidor...';
  const saved = store.get('save', null);
  try {
    const prof = await net.init($('name').value, look);
    S.load(prof.data && Object.keys(prof.data).length ? prof.data : (saved ? saved.d : null));
    if (prof.name && !store.get('name', '')) $('name').value = prof.name;
    if (prof.look && prof.look.fur && !store.get('look', null)) { look = cleanLook(prof.look); buildLobby(); setPreview(); }
    net.joinLobby(); on('lobby', () => { drawRooms(roomList); $('online').textContent = net.onlineCount() + ' gato(s) online agora'; });
    roomList = await net.rooms(); drawRooms(roomList);
    st.textContent = 'Conectado ✔  Seu código de amigo: ' + net.friendCode;
  } catch (e) {
    console.warn(e); S.load(saved ? saved.d : null); net.online = false;
    st.textContent = '⚠ Sem conexão com o servidor — modo solo offline (progresso salvo só neste aparelho).'; $('roomsBox').style.display = 'none';
  }
  $('play').disabled = false; $('card').disabled = false;
  if (navigator.xr && navigator.xr.isSessionSupported) navigator.xr.isSessionSupported('immersive-vr').then((ok) => { if (ok) { $('vr').disabled = false; $('vr').textContent = '🥽 Entrar em VR'; $('vr2').style.display = 'block'; } else $('vr').textContent = 'VR não disponível neste navegador'; }).catch(() => { $('vr').textContent = 'VR não disponível'; });
  else $('vr').textContent = 'VR não disponível neste navegador';
}
$('joinCode').onclick = async () => { const c = $('code').value.trim().toUpperCase(); if (!c || !net.online) return; try { const r = await net.roomGet(c); if (r) { chosen = { code: r.code, name: r.name, pub: r.is_public }; drawRooms(roomList); $('status').textContent = 'Sala encontrada: ' + r.name; } else $('status').textContent = 'Sala "' + c + '" não encontrada.'; } catch (e) { $('status').textContent = 'Erro ao buscar a sala.'; } };
$('newPriv').onclick = async () => { if (!net.online) return; try { const r = await net.rpc('rv_room_create', { p_name: 'Sala de ' + $('name').value, p_public: false }); chosen = { code: r.code, name: r.name, pub: false }; drawRooms(roomList); $('status').textContent = 'Sala privada criada! Código para os amigos: ' + r.code; } catch (e) { $('status').textContent = 'Não foi possível criar a sala.'; } };

function start() {
  if (started) return; started = true;
  S.name = ($('name').value || 'Gato').trim().slice(0, 16) || 'Gato'; S.look = look; store.set('name', S.name); store.set('look', look); store.set('room', chosen);
  $('lobby').style.display = 'none'; $('hint').style.display = 'block';
  audioInit(); setVolume(store.get('vol', 0.8)); player.side = store.get('side', player.side);
  perf.setProfile(store.get('profile', 'balanced'));
  G.room = chosen.code; G.roomName = chosen.name; G.roomPublic = chosen.pub;
  G.init(scene, camera, renderer, player); ui.init(scene, camera, player);
  on('map', (id) => music.setMap(id)); music.start();
  G.loadMap('village'); S.touch(); emit('saveNow'); S.streakCheck(); S.checkAccs();
  if (net.online) { G.refreshFriends(); if (S.d.party) net.joinParty(S.d.party); }
  if (!(S.d.stats.fling > 0)) setTimeout(() => S.toast('Fale com a Mimi (❗) à sua frente. Menu: touchpad / tecla M', '#bfe6ff'), 1500);
}
async function enterVR() {
  if (!navigator.xr) return;
  try {
    renderer.xr.setFramebufferScaleFactor(perf.fbScale());
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
    await renderer.xr.setSession(session); start(); audioInit(); music.start(); perf.apply();
    if (session.frameRate) perf.target = Math.min(72, session.frameRate);
    $('hint').style.display = 'none';
    session.addEventListener('end', () => { perf.target = 60; resize(); $('hint').style.display = 'block'; });
  } catch (e) { $('status').textContent = 'Não foi possível iniciar o VR: ' + e.message; }
}
$('play').onclick = start; $('vr').onclick = enterVR; $('vr2').onclick = enterVR;
// ---------- VR Box / Cardboard: tela dividida + giroscópio do celular (sem WebXR) ----------
let cardboard = false; const stereo = new THREE.StereoCamera(); stereo.eyeSep = 0.064;
async function enterCardboard() {
  let noGyro = false;
  try { if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) { const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') noGyro = true; } } catch (e) { /* navegadores sem pedido de permissão */ }
  // tela cheia e trava de paisagem são opcionais: não esperamos por elas (alguns navegadores nunca respondem)
  const el = document.documentElement; try { const f = el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen ? el.webkitRequestFullscreen() : null; if (f && f.then) f.then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }).catch(() => {}); } catch (e) { /* tela cheia opcional */ }
  try { if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {}); } catch (e) { /* sem wake lock */ }
  cardboard = true; player.enableCardboard(); if (!store.get('profile', null)) store.set('profile', 'performance');
  start(); $('hint').style.display = 'none'; $('vr2').style.display = 'none'; if ($('ht').checked) hands.start();
  setTimeout(() => S.toast('VR Box: toque na tela = gatilho · segure para andar · olhe para mirar', '#bfe6ff'), 2500);
  setTimeout(() => { if (noGyro || !player.devOK) S.toast('Sem sensor de movimento: arraste o dedo na tela para olhar', '#ff9a8a'); }, 6000);
}
$('card').onclick = enterCardboard;
self.RVcard = { exit() { cardboard = false; player.card = false; renderer.setScissorTest(false); resize(); if (document.exitFullscreen && document.fullscreenElement) document.exitFullscreen(); }, get on() { return cardboard; }, enter: enterCardboard };

// ---------- loop ----------
let last = 0, recFlip = false; const recCam = new THREE.PerspectiveCamera(80, 16 / 9, 0.05, 400); scene.add(recCam);
addEventListener('keydown', (e) => { if (e.code === 'KeyR' && started && !(e.target && e.target.tagName === 'INPUT') && !(ui.open && ui.page === 'kb')) { const m = rec.toggle(canvas); if (m) S.toast(m, '#ff9a8a'); } });
renderer.setAnimationLoop((t, frame) => {
  const dt = Math.min(0.05, Math.max(0.001, (t - last) / 1000)); const raw = (t - last) / 1000; last = t;
  if (!started) { if (pcat) { pcat.root.rotation.y = Math.PI + Math.sin(t / 1400) * 0.9; pcat.speed = 1.2; pcat.update(dt); } pcam.aspect = innerWidth / innerHeight; pcam.updateProjectionMatrix(); renderer.render(pv, pcam); return; }
  perf.tick(raw);
  // resolução dinâmica dentro do VR (quando o navegador suporta viewport scaling)
  if (frame && renderer.xr.isPresenting) { const ref = renderer.xr.getReferenceSpace(), pose = ref && frame.getViewerPose(ref); if (pose) for (const v of pose.views) if (v.requestViewportScale) v.requestViewportScale(Math.max(0.5, perf.scale)); }
  if (hands.on && hands.tick(performance.now())) { if (hands.pinch) player._press(); else player._release(); }
  G.update(dt); ui.update(dt); rec.tick();
  if (cardboard && !renderer.xr.isPresenting) { // dois olhos lado a lado
    const w = canvas.width, h = canvas.height, hw = Math.floor(w / 2); if (camera.aspect !== hw / h) { camera.aspect = hw / h; camera.fov = 86; camera.updateProjectionMatrix(); }
    scene.updateMatrixWorld(); camera.updateMatrixWorld(); stereo.aspect = 1; stereo.update(camera); stereo.cameraL.projectionMatrix.copy(camera.projectionMatrix); stereo.cameraR.projectionMatrix.copy(camera.projectionMatrix);
    renderer.setScissorTest(true); renderer.setScissor(0, 0, hw / renderer.getPixelRatio(), h / renderer.getPixelRatio()); renderer.setViewport(0, 0, hw / renderer.getPixelRatio(), h / renderer.getPixelRatio()); renderer.render(scene, stereo.cameraL);
    renderer.setScissor(hw / renderer.getPixelRatio(), 0, hw / renderer.getPixelRatio(), h / renderer.getPixelRatio()); renderer.setViewport(hw / renderer.getPixelRatio(), 0, hw / renderer.getPixelRatio(), h / renderer.getPixelRatio()); renderer.render(scene, stereo.cameraR);
    renderer.setScissorTest(false);
  } else
  renderer.render(scene, camera);
  // gravando dentro do VR: o canvas da página não recebe a imagem dos olhos, então desenhamos nele uma visão extra (a cada 2 quadros)
  if (rec.on && renderer.xr.isPresenting && (recFlip = !recFlip)) {
    const rt = renderer.getRenderTarget(); renderer.xr.enabled = false; renderer.setRenderTarget(null);
    camera.getWorldPosition(recCam.position); camera.getWorldQuaternion(recCam.quaternion); recCam.aspect = canvas.width / canvas.height; recCam.updateProjectionMatrix();
    renderer.render(scene, recCam); renderer.xr.enabled = true; renderer.setRenderTarget(rt);
  }
});
on('look', () => { /* a cor das patas vem de S.look a cada quadro */ });
addEventListener('beforeunload', () => { net.leave(); });
player.handTrack = hands;
import('./maker.js').then(({ maker }) => { self.RV.maker = maker; const f = $('file'); if (f) f.onchange = () => { const file = f.files && f.files[0]; f.value = ''; if (!file) return; S.toast('Importando ' + file.name + '...', '#bfe6ff'); maker.importFile(file).then((e) => S.toast(e || 'Asset importado! Ele já está no pincel.', e ? '#ff9a8a' : '#9cf09c')).catch((e) => S.toast('Falha ao importar: ' + (e && e.message ? e.message : e), '#ff9a8a')); }; });
self.RV = { G, S, net, perf, player, ui, rec, music, hands }; // para depuração no console
boot();
