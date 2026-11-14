import * as THREE from 'three';
import { loadModels, audioInit, setVolume, play } from './assets.js';
import { Player } from './player.js';
import { G } from './game.js';
import { ui } from './ui.js';
import { net } from './net.js';
import { S } from './state.js';
import { perf } from './perf.js';
import { worldMat } from './world.js';
import { home } from './home.js';
import { voice } from './voice.js';
import { infect } from './infect.js';
import { weather } from './weather.js';
import { mounts } from './mounts.js';
import { jobs } from './jobs.js';
import { gp } from './gp.js';
import { CatAvatar, defaultLook, cleanLook, FUR_COLORS, EYE_COLORS, PATTERNS, AGES, PRESETS } from './cat.js'; // eslint-disable-line
import { store, emit, on } from './util.js';
import { touch } from './touch.js';
import { rec, downloadBlob, stamp } from './rec.js';
import { admin } from './admin.js';
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
function buildAngel() { // nível 100: escolher antes de começar se entra como Gato-Anjo (Keyboard Cat) ou com o seu gato normal
  const box = $('angelBox'), el = $('angel'); if (!box) return; const ok = S.d && S.d.level >= 100; box.style.display = ok ? 'block' : 'none'; if (!ok) return;
  const on = S.d.angel.got ? !!S.d.angel.on : !S.d.angel.pref || !!S.d.angel.on; el.innerHTML = '';
  [[1, '😇 Gato-Anjo (Keyboard Cat)'], [0, '🐱 Meu gato normal']].forEach(([v, n]) => { const b = document.createElement('button'); b.className = 'chip' + (+on === v ? ' on' : ''); b.textContent = n; b.onclick = () => { S.d.angel.on = v; S.d.angel.pref = 1; S.touch(); look.angel = v; setPreview(); buildAngel(); }; el.appendChild(b); });
  if (!!look.angel !== on) { look.angel = on ? 1 : 0; setPreview(); }
}
function buildLobby() {
  $('name').value = store.get('name', '') || 'Gato' + Math.floor(100 + Math.random() * 900);
  swatches($('fur'), FUR_COLORS, 'fur'); swatches($('fur2'), FUR_COLORS, 'fur2'); swatches($('eyes'), EYE_COLORS, 'eyes');
  const pt = $('pattern'); pt.innerHTML = ''; PATTERNS.forEach((p, i) => { const b = document.createElement('button'); b.className = 'chip' + (look.pattern === i ? ' on' : ''); b.textContent = p; b.onclick = () => { look.pattern = i; store.set('look', look); setPreview(); buildLobby(); }; pt.appendChild(b); });
  const ag = $('age'); if (ag) { ag.innerHTML = ''; AGES.forEach((n, i) => { const b = document.createElement('button'); b.className = 'chip' + ((look.age | 0) === i ? ' on' : ''); b.textContent = ['🐈 ', '🎒 ', '🍼 '][i] + n; b.onclick = () => { look.age = i; store.set('look', look); setPreview(); buildLobby(); }; ag.appendChild(b); }); }
  const pr = $('presets'); if (pr) { pr.innerHTML = ''; PRESETS.forEach((p) => { const b = document.createElement('button'); b.className = 'chip'; b.textContent = p.n; b.onclick = () => { look = cleanLook(Object.assign({}, p.look, { acc: look.acc || 0, hat: p.look.hat })); if (p.look.hat) { const sv = store.get('save', null); if (sv && sv.d && Array.isArray(sv.d.hats) && sv.d.hats.indexOf(p.look.hat) < 0) { sv.d.hats.push(p.look.hat); store.set('save', sv); } look._gift = p.look.hat; } store.set('look', look); setPreview(); buildLobby(); }; pr.appendChild(b); }); }
}
function drawRooms(list) {
  const el = $('rooms'), counts = net.roomCounts(); el.innerHTML = '';
  (list || []).forEach((r) => { const b = document.createElement('button'); b.className = 'room' + (chosen.code === r.code ? ' on' : ''); b.textContent = (r.permanent ? '★ ' : '') + r.name + ' — ' + (counts[r.code] || 0) + ' online'; b.onclick = () => { chosen = { code: r.code, name: r.name, pub: true }; drawRooms(list); }; el.appendChild(b); });
  if (!chosen.pub) { const b = document.createElement('button'); b.className = 'room on'; b.textContent = '🔒 ' + chosen.name + ' [' + chosen.code + ']'; el.appendChild(b); }
}
let roomList = [];
// ⛔ banido: tela cheia com motivo e prazo (no lobby e, se for banido jogando, na hora)
function showBan(b) {
  const until = b && b.until ? new Date(b.until) : null, el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(12,8,20,0.96);color:#fff;display:flex;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif;text-align:center;padding:24px';
  el.innerHTML = '<div style="max-width:520px"><div style="font-size:64px">⛔</div><h1 style="margin:8px 0 12px"></h1><p style="font-size:18px;color:#ffd0d0"></p><p style="font-size:16px;color:#c8c8e0"></p><p style="font-size:14px;color:#9a98b8;margin-top:20px"></p></div>';
  el.querySelector('h1').textContent = 'Você foi banido do RoleVRGO'; el.querySelectorAll('p')[2].textContent = 'Se você acha que foi um engano, fale com o admin.';
  el.querySelectorAll('p')[0].textContent = 'Motivo: ' + ((b && b.reason) || 'regras do jogo');
  el.querySelectorAll('p')[1].textContent = until ? 'Até ' + until.toLocaleString() : 'Banimento permanente';
  document.body.appendChild(el);
}
on('banned', (b) => { try { const s = renderer.xr.getSession && renderer.xr.getSession(); if (s) s.end(); } catch (e) { /* ok */ } net.leave(); net.online = false; player.frozen = true; showBan(b); });
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
    buildAngel();
    if (net.isAdmin) { admin.is = true; admin.ids.add(net.id); } admin.start(); refreshAdm();
    net.joinLobby(); on('lobby', () => { drawRooms(roomList); $('online').textContent = net.onlineCount() + ' gato(s) online agora'; });
    roomList = await net.rooms(); drawRooms(roomList);
    st.textContent = 'Conectado ✔  Seu código de amigo: ' + net.friendCode;
  } catch (e) {
    if (e && e.ban) { showBan(e.ban); return; }
    console.warn(e); S.load(saved ? saved.d : null); net.online = false; buildAngel();
    st.textContent = '⚠ Sem conexão com o servidor — modo solo offline (progresso salvo só neste aparelho).'; $('roomsBox').style.display = 'none';
  }
  $('play').disabled = false; $('card').disabled = false;
  if (navigator.xr && navigator.xr.isSessionSupported) navigator.xr.isSessionSupported('immersive-vr').then((ok) => { if (ok) { $('vr').disabled = false; $('vr').textContent = '🥽 Entrar em VR'; $('vr2').style.display = 'block'; } else $('vr').textContent = 'VR não disponível neste navegador'; }).catch(() => { $('vr').textContent = 'VR não disponível'; });
  else $('vr').textContent = 'VR não disponível neste navegador';
}
$('joinCode').onclick = async () => { const c = $('code').value.trim().toUpperCase(); if (!c || !net.online) return; try { const r = await net.roomGet(c); if (r) { chosen = { code: r.code, name: r.name, pub: r.is_public }; drawRooms(roomList); $('status').textContent = 'Sala encontrada: ' + r.name; } else $('status').textContent = 'Sala "' + c + '" não encontrada.'; } catch (e) { $('status').textContent = 'Erro ao buscar a sala.'; } };
$('newPriv').onclick = async () => { if (!net.online) return; try { const r = await net.rpc('rv_room_create', { p_name: 'Sala de ' + $('name').value, p_public: false }); chosen = { code: r.code, name: r.name, pub: false }; drawRooms(roomList); $('status').textContent = 'Sala privada criada! Código para os amigos: ' + r.code; } catch (e) { $('status').textContent = 'Não foi possível criar a sala.'; } };

// nome "hark" é reservado ao admin: pede a senha uma vez; depois o aparelho fica registrado no servidor
const isHark = () => /^hark/i.test(($('name').value || '').trim());
function refreshAdm() { $('admRow').style.display = isHark() && !admin.is ? 'block' : 'none'; }
$('name').addEventListener('input', refreshAdm);
async function gate() {
  if (!isHark() || admin.is) return true;
  const m = $('admMsg'); if (!net.online) { m.textContent = 'Sem conexão com o servidor: não dá para entrar como admin agora.'; return false; }
  const pw = $('admPw').value; if (!pw) { m.textContent = 'Digite a senha de admin, ou escolha outro nome.'; $('admPw').focus(); return false; }
  m.textContent = 'Conferindo...';
  try { const r = await admin.login(pw); if (r.ok) { m.textContent = '✔ Admin confirmado neste aparelho'; $('admPw').value = ''; return true; } m.textContent = r.wait ? 'Muitas tentativas. Espere 15 minutos.' : 'Senha incorreta.'; return false; }
  catch (e) { m.textContent = /rv_admin|PGRST202|schema cache/.test(e.message || '') ? 'O banco ainda não tem o admin (rode supabase/admin.sql).' : 'Erro: ' + (e.message || e); return false; }
}
function start() {
  if (started) return; started = true;
  S.name = ($('name').value || 'Gato').trim().slice(0, 16) || 'Gato'; if (look._gift != null) { if (S.d && S.d.hats.indexOf(look._gift) < 0) S.d.hats.push(look._gift); delete look._gift; } S.look = look; look.angel = (S.d.angel.got ? S.angelOn() : S.d.level >= 100 && !(S.d.angel.pref && !S.d.angel.on)) ? 1 : 0; store.set('name', S.name); store.set('look', look); store.set('room', chosen);
  $('lobby').style.display = 'none'; $('hint').style.display = 'block';
  audioInit(); setVolume(store.get('vol', 0.8)); player.side = store.get('side', player.side); const tm = store.get('turn', 30); player.smoothTurn = tm === 0; player.snapA = (tm || 30) * Math.PI / 180;
  perf.setProfile(store.get('profile', 'balanced'));
  G.room = chosen.code; G.roomName = chosen.name; G.roomPublic = chosen.pub;
  G.init(scene, camera, renderer, player); ui.init(scene, camera, player);
  on('map', (id) => music.setMap(id)); music.start();
  setTimeout(() => { if (!cardboard && !renderer.xr.isPresenting && touch.want()) { touch.init(player, canvas); $('hint').style.display = 'none'; S.toast('📱 Joystick à esquerda para andar · arraste a tela para olhar · toque rápido para usar · ⤒ pula', '#bfe6ff'); } }, 300);
  G.loadMap('village'); S.touch(); emit('saveNow'); S.streakCheck(); S.checkAccs(); S.angelCheck();
  if (net.online) { G.refreshFriends(); if (S.d.party) net.joinParty(S.d.party); }
  if (!(S.d.stats.fling > 0)) setTimeout(() => S.toast('Fale com a Mimi (❗) à sua frente. Menu: touchpad / tecla M', '#bfe6ff'), 1500);
}
async function enterVR() {
  if (!(await gate())) return;
  if (!navigator.xr) return;
  try {
    renderer.xr.setFramebufferScaleFactor(perf.fbScale());
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
    await renderer.xr.setSession(session); start(); audioInit(); music.start(); perf.apply();
    if (session.frameRate) perf.target = Math.min(72, session.frameRate);
    $('hint').style.display = 'none';
    session.addEventListener('end', () => { perf.target = 60; resize(); $('hint').style.display = 'block'; });
  } catch (e) { $('status').textContent = 'Não foi possível iniciar o VR: ' + e.message; }
}
$('play').onclick = async () => { if (await gate()) start(); }; $('vr').onclick = enterVR; $('vr2').onclick = enterVR;
// ---------- VR Box / Cardboard: tela dividida + giroscópio do celular (sem WebXR) ----------
let cardboard = false; const stereo = new THREE.StereoCamera(); stereo.eyeSep = 0.064;
async function enterCardboard() {
  if (!(await gate())) return;
  let noGyro = false;
  try { if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) { const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') noGyro = true; } } catch (e) { /* navegadores sem pedido de permissão */ }
  // tela cheia e trava de paisagem são opcionais: não esperamos por elas (alguns navegadores nunca respondem)
  const el = document.documentElement; try { const f = el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen ? el.webkitRequestFullscreen() : null; if (f && f.then) f.then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }).catch(() => {}); } catch (e) { /* tela cheia opcional */ }
  try { if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {}); } catch (e) { /* sem wake lock */ }
  cardboard = true; touch.show(false); player.enableCardboard(); if (!store.get('profile', null)) store.set('profile', 'performance');
  start(); $('hint').style.display = 'none'; $('vr2').style.display = 'none'; if ($('ht').checked) hands.start();
  setTimeout(() => S.toast('VR Box: toque na tela = gatilho · segure para andar · olhe para mirar', '#bfe6ff'), 2500);
  setTimeout(() => { if (noGyro || !player.devOK) S.toast('Sem sensor de movimento: arraste o dedo na tela para olhar', '#ff9a8a'); }, 6000);
}
$('card').onclick = enterCardboard;
self.RVcard = { exit() { cardboard = false; player.card = false; if (touch.want()) { touch.init(player, canvas); touch.show(true); } renderer.setScissorTest(false); resize(); if (document.exitFullscreen && document.fullscreenElement) document.exitFullscreen(); }, get on() { return cardboard; }, enter: enterCardboard };

// ---------- loop ----------
let photoReq = false, shotHud = null, comfortVig = store.get('vignette', true);
self.RVphoto = () => { if (renderer.xr.isPresenting) { S.toast('📸 Dentro do VR, use a captura de tela do próprio headset', '#ffd76a'); return; } photoReq = true; }; self.RVvig = (v) => { if (v != null) { comfortVig = v; store.set('vignette', v); } return comfortVig; };
const vig = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 22, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false })); m.position.z = -0.2; m.renderOrder = 998; m.visible = false; camera.add(m); return m; })();
let last = 0;
addEventListener('keydown', (e) => { if (e.code === 'KeyP' && started && !(e.target && e.target.tagName === 'INPUT') && !(ui.open && ui.page === 'kb')) self.RVphoto(); if (e.code === 'KeyR' && started && !(e.target && e.target.tagName === 'INPUT') && !(ui.open && ui.page === 'kb')) { const m = rec.toggle(canvas); if (m) S.toast(m, '#ff9a8a'); } });
renderer.setAnimationLoop((t, frame) => {
  const dt = Math.min(0.05, Math.max(0.001, (t - last) / 1000)); const raw = (t - last) / 1000; last = t;
  if (!started) { if (pcat) { pcat.root.rotation.y = Math.PI + Math.sin(t / 1400) * 0.9; pcat.speed = 1.2; pcat.update(dt); } pcam.aspect = innerWidth / innerHeight; pcam.updateProjectionMatrix(); renderer.render(pv, pcam); return; }
  perf.tick(raw);
  // resolução dinâmica dentro do VR (quando o navegador suporta viewport scaling)
  if (frame && renderer.xr.isPresenting) { const ref = renderer.xr.getReferenceSpace(), pose = ref && frame.getViewerPose(ref); if (pose) for (const v of pose.views) if (v.requestViewportScale) v.requestViewportScale(Math.max(0.5, perf.scale)); }
  if (hands.on && hands.tick(performance.now())) { if (hands.pinch) player._press(); else player._release(); }
  G.update(dt); ui.update(dt); rec.tick();
  // vinheta de conforto: escurece as bordas em movimento rápido (reduz enjoo no VR)
  { const want = comfortVig && (renderer.xr.isPresenting || cardboard) ? Math.min(0.85, Math.max(0, (player.speed - 2.4) / 4, player.wasTouching && player.speed > 1.5 ? 0.35 : 0, player.swimming ? 0.2 : 0)) : 0; vig.material.opacity += (want - vig.material.opacity) * Math.min(1, dt * 6); vig.visible = vig.material.opacity > 0.02; }
  const shot = photoReq; if (shot) { photoReq = false; shotHud = [ui.hud.visible, ui.cross.visible, G.laser.visible, vig.visible]; ui.hud.visible = false; ui.cross.visible = false; G.laser.visible = false; vig.visible = false; }
  if (cardboard && !renderer.xr.isPresenting) { // dois olhos lado a lado
    const w = canvas.width, h = canvas.height, hw = Math.floor(w / 2); if (camera.aspect !== hw / h) { camera.aspect = hw / h; camera.fov = 86; camera.updateProjectionMatrix(); }
    scene.updateMatrixWorld(); camera.updateMatrixWorld(); stereo.aspect = 1; stereo.update(camera); stereo.cameraL.projectionMatrix.copy(camera.projectionMatrix); stereo.cameraR.projectionMatrix.copy(camera.projectionMatrix);
    renderer.setScissorTest(true); renderer.setScissor(0, 0, hw / renderer.getPixelRatio(), h / renderer.getPixelRatio()); renderer.setViewport(0, 0, hw / renderer.getPixelRatio(), h / renderer.getPixelRatio()); renderer.render(scene, stereo.cameraL);
    renderer.setScissor(hw / renderer.getPixelRatio(), 0, hw / renderer.getPixelRatio(), h / renderer.getPixelRatio()); renderer.setViewport(hw / renderer.getPixelRatio(), 0, hw / renderer.getPixelRatio(), h / renderer.getPixelRatio()); renderer.render(scene, stereo.cameraR);
    renderer.setScissorTest(false);
  } else
  renderer.render(scene, camera);
  // SEGURANÇA: nada de desenhar visões extras no meio de um quadro de VR (alternar imagens pisca a tela e pode causar crise epiléptica).
  // Gravar vídeo e tirar foto só funcionam fora do VR; no headset use a captura do próprio aparelho.
  if (shot) { // foto: baixa o PNG do canvas (fora do VR)
    canvas.toBlob((b) => { if (b) { downloadBlob(b, 'rolevrgo-foto-' + stamp() + '.png'); S.toast('📸 Foto salva em Downloads', '#9cf09c'); play('click', 0.8); } else S.toast('Não foi possível salvar a foto', '#ff9a8a'); }, 'image/png');
    [ui.hud.visible, ui.cross.visible, G.laser.visible, vig.visible] = shotHud;
  }
});
on('look', () => { /* a cor das patas vem de S.look a cada quadro */ });
addEventListener('beforeunload', () => { net.leave(); });
player.handTrack = hands;
import('./maker.js').then(({ maker }) => { self.RV.maker = maker; const f = $('file'); if (f) f.onchange = () => { const file = f.files && f.files[0]; f.value = ''; if (!file) return; S.toast('Importando ' + file.name + '...', '#bfe6ff'); maker.importFile(file).then((e) => S.toast(e || 'Asset importado! Ele já está no pincel.', e ? '#ff9a8a' : '#9cf09c')).catch((e) => S.toast('Falha ao importar: ' + (e && e.message ? e.message : e), '#ff9a8a')); }; });
rec.isVR = () => renderer.xr.isPresenting; renderer.xr.addEventListener('sessionend', () => { if (!cardboard && touch.el) touch.show(true); }); on('openChat', () => { const t = prompt('Mensagem para a sala'); if (t && t.trim()) G.say(t.trim().slice(0, 60)); }); renderer.xr.addEventListener('sessionstart', () => { touch.show(false); if (rec.on) { rec.stop(); S.toast('⏹ Gravação parada: o gravador do jogo não funciona dentro do VR', '#ffd76a'); } });
self.RV = { touch, G, S, net, perf, player, ui, rec, music, hands, admin, home, voice, infect, weather, mounts, jobs, gp, CatAvatar, PRESETS }; // para depuração no console
boot();
