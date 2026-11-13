import * as THREE from 'three';
import { EYE, REACH, HAND_R, BODY_R, GRAVITY, WALK_SPEED, MAX_SPEED } from './config.js';
import { clamp, emit } from './util.js';

// Jogador local: Gorilla Locomotion adaptada ao controle 3DoF do Oculus Go.
// Só a ORIENTAÇÃO do controle é usada: a bolinha primária fica na ponta de um
// "braço invisível" que sai do ombro; a segunda bolinha é espelhada no plano
// sagital do corpo. Bolinha encostada em superfície = âncora: mover o controle
// desloca o corpo no sentido oposto (empurrar, escalar, impulsionar).
const V = () => new THREE.Vector3();
const _qpi = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI);
const _a = V(), _b = V(), _n = V(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
const UP = new THREE.Vector3(0, 1, 0);

export class Player {
  constructor(scene, camera, renderer) {
    this.scene = scene; this.camera = camera; this.renderer = renderer;
    this.rig = new THREE.Group(); this.head = new THREE.Group(); this.head.position.y = EYE;
    this.rig.add(this.head); this.head.add(camera); scene.add(this.rig);
    this.pos = this.rig.position; this.vel = V(); this.yaw = 0; this.pitch = 0;
    this.grounded = false; this.inWater = false; this.speed = 0; this.surfaceN = V();
    this.hands = [0, 1].map(() => ({ pos: V(), target: V(), prevT: V(), vel: V(), touch: false, grab: false, nearT: 0, speed: 0 }));
    this.hist = []; this.wasTouching = false;
    this.ctrlDir = new THREE.Vector3(0, 0, -1); this.aimDir = new THREE.Vector3(0, 0, -1); this.aimPos = V(); this.rawDir = V(); this.rawCtrl = new THREE.Vector3(0, 0, -1); this.ctrlQuat = new THREE.Quaternion(); this.prevDir = V(); this.flickUp = 0;
    this.bodyYaw = 0; this.headYaw = 0; this.headPitch = 0; this.side = 1; // 1 = controle na mão direita
    this.trigger = false; this.walkHeld = false; this.block = false; this.blockInput = false; this.iframes = 0; this.dodgeCd = 0; this.stamina = 100;
    this.frozen = false; this.fightZone = false; this.emoteWave = 0; this.guardHold = false;
    this.keys = {}; this.desktop = true; this.locked = false; this.padWas = false;
    this.onTrigger = null; this.onRelease = null; this.onMenu = null; this.onBack = null; // callbacks do jogo
    this.speedMul = 1; this.jumpMul = 1; this.gravMul = 1; this.fly = false; this.backWas = false; this.swimming = false; this.swimDist = 0;
    // VR Box / Cardboard (giroscópio do celular), gamepads/Joy-Cons, rastreamento de mãos e teleporte
    this.card = false; this.devQ = new THREE.Quaternion(); this.devOK = false; this._yaw0 = 0; this.gpMove = { x: 0, y: 0 }; this.gpAim = { x: 0, y: 0 }; this._gb = []; this._gbPrev = []; this.gpTrig = false; this.gpBlock = false; this.gpFound = false;
    this.handTrack = null; this.tracked = false; this.tpHeld = false; this.tpWas = false; this.tpCd = 0; this.padT = 0; this.padCenter = false; this.xrTp = false;
    this.tp = { show: false, valid: false, x: 0, y: 0, z: 0, n: 0, pts: new Float32Array(40 * 3) };
    this.viewMode = 1; this.viewYaw = 0; this.emoteId = 0; this.emoteTime = 0; // câmera: 1 = 1ª pessoa, 2 = 2ª (de frente), 3 = 3ª (por trás)
    this.controllers = []; this.grips = []; this.xhands = [];
    this.sixAny = false; this.six = [false, false]; this.sixPos = [new THREE.Vector3(), new THREE.Vector3()]; this.qPrev = {}; this._snap = false; this.questTp = false;
    for (let i = 0; i < 2; i++) {
      const c = renderer.xr.getController(i); this.head.add(c); this.controllers.push(c);
      const gr = renderer.xr.getControllerGrip(i); this.head.add(gr); this.grips.push(gr); // posição real (6DoF) no Meta Quest
      const hd = renderer.xr.getHand(i); this.head.add(hd); this.xhands.push(hd); // rastreamento de mãos do Quest
      c.addEventListener('selectstart', () => { this.active = c; this._press(); });
      c.addEventListener('selectend', () => this._release());
      c.addEventListener('connected', (e) => { c.userData.src = e.data; if (!this.active) this.active = c; if (e.data && e.data.handedness === 'left') this.side = -1; else if (e.data && e.data.handedness === 'right') this.side = 1; });
      c.addEventListener('disconnected', () => { c.userData.src = null; });
    }
    this.active = null;
    this._bindDesktop();
  }
  _bindDesktop() {
    const el = this.renderer.domElement;
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      this.keys[e.code] = true;
      if (e.code === 'Tab' || e.code === 'KeyM') { e.preventDefault(); if (this.onMenu) this.onMenu(); }
      if (e.code === 'KeyB' || e.key === 'BrowserBack' || e.key === 'GoBack') { e.preventDefault(); if (this.onBack) this.onBack(); }
      if (e.code === 'KeyV') this.cycleView();
      if (e.code === 'KeyQ') this.dodge(-1); if (e.code === 'KeyE') this.dodge(1);
      if (e.code === 'Space' && this.grounded && !this.frozen && !this.swimming) { this.vel.y = 4.6 * this.jumpMul; this.grounded = false; emit('jump'); }
      emit('key', e.code);
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    // toque na tela = gatilho (o botão do VR Box/Cardboard toca a tela)
    el.addEventListener('touchstart', (e) => { if (this.renderer.xr.isPresenting) return; e.preventDefault(); const t = e.touches[0]; this._tx = t.clientX; this._ty = t.clientY; this._press(); }, { passive: false });
    el.addEventListener('touchmove', (e) => { if (this.renderer.xr.isPresenting) return; e.preventDefault(); const t = e.touches[0]; if (!(this.card && this.devOK)) { this.yaw += (t.clientX - this._tx) * 0.005; this.pitch = clamp(this.pitch + (t.clientY - this._ty) * 0.005, -1.5, 1.5); } this._tx = t.clientX; this._ty = t.clientY; }, { passive: false }); // sem giroscópio: arrastar o dedo olha em volta
    el.addEventListener('touchend', (e) => { if (this.renderer.xr.isPresenting) return; e.preventDefault(); this._release(); }, { passive: false });
    el.addEventListener('mousedown', (e) => {
      if (this.renderer.xr.isPresenting) return;
      if (!this.locked && el.requestPointerLock) { el.requestPointerLock(); }
      if (e.button === 0) this._press(); else if (e.button === 2) this.guardHold = true;
    });
    addEventListener('mouseup', (e) => { if (this.renderer.xr.isPresenting) return; if (e.button === 0) this._release(); else if (e.button === 2) this.guardHold = false; });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === el; });
    addEventListener('mousemove', (e) => {
      if (!this.locked || this.renderer.xr.isPresenting) return;
      this.yaw -= e.movementX * 0.0024; this.pitch = clamp(this.pitch - e.movementY * 0.0024, -1.5, 1.5);
    });
  }
  _press() { this.trigger = true; if (this.onTrigger && this.onTrigger()) { this.consumed = true; return; } this.consumed = false; let g = false; for (const h of this.hands) if (h.touch || h.nearT > 0) { h.grab = true; g = true; } if (!g) this.walkHeld = true; else emit('grab'); }
  _release() { if (!this.trigger) return; this.trigger = false; this.walkHeld = false; for (const h of this.hands) h.grab = false; if (this.onRelease) this.onRelease(); }
  pulse(i, ms) { const s = this.active && this.active.userData.src; const gp = s && s.gamepad; const a = gp && gp.hapticActuators && gp.hapticActuators[0]; if (a && a.pulse) { try { a.pulse(i, ms); } catch (e) { /* sem vibração */ } } }
  teleport(x, y, z, yaw) { this.pos.set(x, y, z); this.vel.set(0, 0, 0); if (yaw != null) { this.yaw = yaw; } for (const h of this.hands) { h.touch = h.grab = false; h.pos.set(x, y + 0.6, z); h.prevT.copy(h.pos); } this.hist.length = 0; }
  dodge(dir) {
    if (this.dodgeCd > 0 || this.stamina < 20 || this.frozen) return;
    _a.set(dir, 0, 0).applyAxisAngle(UP, this.headYaw); this.vel.x = _a.x * 9; this.vel.z = _a.z * 9; if (this.grounded) this.vel.y = 1.5;
    this.iframes = 0.38; this.dodgeCd = 1.0; this.stamina -= 20; emit('dodge');
  }
  // direção de visão no plano
  // liga o modo VR Box: a cabeça segue o giroscópio/bússola do CELULAR (não o do controle)
  enableCardboard() {
    if (this.card) return; this.card = true;
    const zee = new THREE.Vector3(0, 0, 1), q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)), q0 = new THREE.Quaternion(), eu = new THREE.Euler(), qy = new THREE.Quaternion(), R = Math.PI / 180;
    addEventListener('deviceorientation', (e) => {
      if (e.alpha == null || !this.card) return; const o = ((screen.orientation && screen.orientation.angle) || window.orientation || 0) * R;
      eu.set(e.beta * R, e.alpha * R, -e.gamma * R, 'YXZ'); this.devQ.setFromEuler(eu).multiply(q1).multiply(q0.setFromAxisAngle(zee, -o));
      if (!this.devOK) { _e.setFromQuaternion(this.devQ, 'YXZ'); this._yaw0 = _e.y; this.devOK = true; }
      this.devQ.premultiply(qy.setFromAxisAngle(UP, -this._yaw0));
    });
  }
  recenter() { this.devOK = false; }
  // Gamepads / Joy-Cons pela Gamepad API: só botões e direcionais (nenhum giroscópio de controle é lido)
  _pollPads() {
    const gps = navigator.getGamepads ? navigator.getGamepads() : [], B = this._gb, prev = this._gbPrev; for (let i = 0; i < 18; i++) { prev[i] = B[i]; B[i] = false; }
    let mx = 0, my = 0, ax = 0, ay = 0, found = false, lone = [];
    for (let k = 0; k < gps.length; k++) { const gp = gps[k]; if (!gp || !gp.connected) continue; found = true;
      for (let i = 0; i < Math.min(18, gp.buttons.length); i++) if (gp.buttons[i] && gp.buttons[i].pressed) B[i] = true;
      if (gp.axes.length >= 4) { mx += gp.axes[0]; my += gp.axes[1]; ax += gp.axes[2]; ay += gp.axes[3]; } else if (gp.axes.length >= 2) lone.push(gp); }
    if (lone.length) { lone.sort((a, b) => (/\(R\)|right/i.test(a.id) ? 1 : 0) - (/\(R\)|right/i.test(b.id) ? 1 : 0)); mx += lone[0].axes[0]; my += lone[0].axes[1]; if (lone[1]) { ax += lone[1].axes[0]; ay += lone[1].axes[1]; } }
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : clamp(v, -1, 1));
    this.gpMove.x = dz(mx); this.gpMove.y = dz(my); this.gpAim.x += (dz(ax) - this.gpAim.x) * 0.5; this.gpAim.y += (dz(ay) - this.gpAim.y) * 0.5; this.gpFound = found; if (!found) return;
    const down = (i) => B[i] && !prev[i];
    const trig = !!(B[7] || B[0]); if (trig !== this.gpTrig) { this.gpTrig = trig; if (trig) this._press(); else this._release(); }
    this.gpBlock = !!B[6];
    if (down(1) && this.grounded && !this.frozen && !this.swimming) { this.vel.y = 4.6 * this.jumpMul; this.grounded = false; emit('jump'); }
    if (down(2)) this.cycleView();
    if (down(4)) { if (this.fightZone) this.dodge(-1); else this.yaw += Math.PI / 6; } if (down(5)) { if (this.fightZone) this.dodge(1); else this.yaw -= Math.PI / 6; }
    if (down(9) && this.onMenu) this.onMenu(); if (down(8) && this.onBack) this.onBack();
  }
  cycleView() { this.viewMode = this.viewMode % 3 + 1; emit('view', this.viewMode); }
  forward(out) { return out.set(-Math.sin(this.headYaw), 0, -Math.cos(this.headYaw)); }
  headPos(out) { return this.camera.getWorldPosition(out); }

  _readInput(dt) {
    const xr = this.renderer.xr.isPresenting; this.desktop = !xr;
    // posição da câmera conforme o modo de visão (no VR o deslocamento é fixo, para não enjoar)
    const vm = this.viewMode, H = this.head;
    if (vm === 1) { H.position.set(0, EYE, 0); H.rotation.y = 0; }
    else if (vm === 3) { const pc = xr ? -0.15 : this.pitch; H.position.set(0, Math.max(0.35, EYE + 0.45 - Math.sin(pc) * 3.0), Math.cos(pc) * 3.0); H.rotation.y = 0; }
    else { const pc = xr ? -0.1 : this.pitch; H.position.set(0, Math.max(0.35, EYE + 0.15 - Math.sin(pc) * 2.6), -Math.cos(pc) * 2.6); H.rotation.y = Math.PI; }
    if (this.camLift) H.position.y += this.camLift;
    // câmera externa: se algo estiver entre o gato e a câmera, ela se aproxima (não atravessa paredes)
    if (vm !== 1 && this._w) { const c = Math.cos(this.yaw), s = Math.sin(this.yaw), ox = H.position.z * s, oz = H.position.z * c, oy = H.position.y - EYE; let k = 1;
      for (let f = 0.2; f <= 1.001; f += 0.2) { _b.set(this.pos.x + ox * f, this.pos.y + EYE + oy * f, this.pos.z + oz * f); if (this._w.collide(_b, 0.22, _n)) { k = Math.max(0.12, f - 0.2); break; } }
      this.camK = k < (this.camK || 1) ? k : (this.camK || 1) + (k - (this.camK || 1)) * Math.min(1, dt * 4); H.position.z *= this.camK; H.position.y = EYE + oy * this.camK; } else this.camK = 1;
    this.rig.rotation.y = this.yaw; this.rig.updateMatrixWorld(true);
    if (!xr) { if (this.card && this.devOK) this.camera.quaternion.copy(this.devQ); else this.camera.rotation.set(this.pitch, 0, 0, 'YXZ'); this.camera.position.set(0, 0, 0); this.camera.updateMatrixWorld(true); }
    // cabeça
    const cam = xr ? this.renderer.xr.getCamera() : this.camera;
    if (xr) { cam.matrixWorld.decompose(_a, _q, _b); } else this.camera.getWorldQuaternion(_q);
    _e.setFromQuaternion(_q, 'YXZ'); const eX = _e.x; this.viewYaw = _e.y; this.headYaw = vm === 2 ? _e.y - Math.PI : _e.y; this.headPitch = vm === 1 ? _e.x : 0;
    this.rawDir.set(0, 0, -1).applyQuaternion(_q);
    let d = this.headYaw - this.bodyYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.bodyYaw += d * Math.min(1, dt * 6);
    // controle
    let pad = false, px = 0, py = 0;
    if (!xr) this._pollPads(); else { this.gpMove.x = this.gpMove.y = 0; this.gpBlock = false; }
    // Meta Quest (6DoF): cada pata segue a posição real do controle ou da mão rastreada
    this.sixAny = false; this.six[0] = this.six[1] = false; this.questTp = false;
    if (xr) for (let i = 0; i < 2; i++) {
      const src = this.controllers[i].userData.src; if (!src) continue; const slot = src.handedness === 'left' ? 1 : 0;
      if (src.hand) { const J = this.xhands[i].joints || {}, j = J['middle-finger-metacarpal'] || J['wrist']; if (j && j.visible !== false) { j.getWorldPosition(this.sixPos[slot]); this.six[slot] = true; } }
      else if (src.gripSpace && !(src.profiles || []).some((p) => /oculus-go|go-controller|generic-trigger-touchpad$/.test(p)) && this.grips[i].visible !== false) { this.grips[i].getWorldPosition(this.sixPos[slot]); this.six[slot] = true; }
    }
    this.sixAny = this.six[0] || this.six[1];
    if (xr && this.sixAny) {
      // analógico esquerdo anda, direito gira 30° (para frente = mira de teleporte), A pula, B menu, X menu rápido, Y câmera, os dois grips bloqueiam
      let lx = 0, ly = 0, rx = 0, ry = 0, gl = false, gr = false; const btn = {};
      for (const c of this.controllers) { const src = c.userData.src, gp = src && src.gamepad; if (!gp) continue; const B = gp.buttons, A = gp.axes, L = src.handedness === 'left', sx = A.length >= 4 ? A[2] : A[0] || 0, sy = A.length >= 4 ? A[3] : A[1] || 0;
        if (L) { lx = sx; ly = sy; gl = !!(B[1] && B[1].pressed); btn.x = !!(B[4] && B[4].pressed); btn.y = !!(B[5] && B[5].pressed); } else { rx = sx; ry = sy; gr = !!(B[1] && B[1].pressed); btn.a = !!(B[4] && B[4].pressed); btn.b = !!(B[5] && B[5].pressed); } }
      const dz = (v) => (Math.abs(v) < 0.2 ? 0 : v); this.gpMove.x = dz(lx); this.gpMove.y = dz(ly);
      if (Math.abs(rx) > 0.7 && !this._snap) { this._snap = true; if (this.fightZone) this.dodge(rx > 0 ? 1 : -1); else { this.yaw -= Math.sign(rx) * Math.PI / 6; emit('turn'); } } else if (Math.abs(rx) < 0.3) this._snap = false;
      this.questTp = ry < -0.6; this.guardHold = gl && gr;
      const down = (k) => btn[k] && !this.qPrev[k];
      if (down('a') && this.grounded && !this.frozen && !this.swimming) { this.vel.y = 4.6 * this.jumpMul; this.grounded = false; emit('jump'); }
      if (down('b') && this.onMenu) this.onMenu(); if (down('x') && this.onBack) this.onBack(); if (down('y')) this.cycleView();
      this.qPrev = btn;
      const c = this.active && this.active.userData.src ? this.active : this.controllers.find((k) => k.userData.src);
      if (c) { c.getWorldQuaternion(this.ctrlQuat); this.rawCtrl.set(0, 0, -1).applyQuaternion(this.ctrlQuat); if (vm === 2) this.ctrlQuat.premultiply(_qpi); } else { this.ctrlQuat.copy(_q); this.rawCtrl.copy(this.rawDir); }
    } else if (xr) {
      const c = this.active && this.active.userData.src ? this.active : this.controllers.find((k) => k.userData.src);
      if (c) {
        c.getWorldQuaternion(this.ctrlQuat); this.rawCtrl.set(0, 0, -1).applyQuaternion(this.ctrlQuat); if (vm === 2) this.ctrlQuat.premultiply(_qpi);
        const gp = c.userData.src.gamepad;
        if (gp) {
          const b = gp.buttons, ax = gp.axes;
          pad = !!((b[2] && b[2].pressed) || (b[3] && b[3].pressed));
          if (ax.length >= 4 && (Math.abs(ax[2]) > 0.01 || Math.abs(ax[3]) > 0.01)) { px = ax[2]; py = ax[3]; } else if (ax.length >= 2) { px = ax[0]; py = ax[1]; }
          this.guardHold = !!(b[1] && b[1].pressed) || (pad && py > 0.45 && Math.abs(px) < 0.6);
          // botão Back / botões extras (quando o navegador os expõe) abrem o menu rápido
          let back = false; for (let k = 4; k < b.length; k++) if (b[k] && b[k].pressed) back = true;
          if (back && !this.backWas && this.onBack) this.onBack(); this.backWas = back;
        }
      } else { this.ctrlQuat.copy(_q); this.rawCtrl.copy(this.rawDir); }
    } else {
      this.ctrlQuat.copy(_q);
      this.blockKey = !!this.keys.KeyF;
    }
    this.ctrlDir.set(0, 0, -1).applyQuaternion(this.ctrlQuat);
    // mira: no VR é o "laser" do controle; no desktop é o centro da tela e as patas ficam um pouco abaixo
    if (xr) { this.aimDir.copy(vm === 1 && !this.sixAny ? this.ctrlDir : this.rawCtrl); }
    else { this.aimDir.copy(this.rawDir); _e.set(clamp(eX - 0.38 - this.gpAim.y * 1.15, -1.55, 1.5), this.headYaw - this.gpAim.x * 0.9, 0, 'YXZ'); this.ctrlDir.set(0, 0, -1).applyEuler(_e); } // direcional direito do gamepad move as patas (sem giroscópio)
    // "puxão" para cima do controle (usado na pesca)
    this.flickUp = (this.ctrlDir.y - this.prevDir.y) / Math.max(dt, 0.001); this.prevDir.copy(this.ctrlDir);
    // cliques do touchpad por zona: cima/centro = menu, lados = girar (ou esquiva em luta), baixo = bloquear
    if (pad && !this.padWas) {
      if (py > 0.45 && Math.abs(px) < 0.6) { /* bloqueio: tratado como hold */ }
      else if (Math.abs(px) > 0.5) { if (this.fightZone) this.dodge(px > 0 ? 1 : -1); else { this.yaw -= Math.sign(px) * Math.PI / 6; emit('turn'); } }
      else if (py < -0.45 && this.onBack) this.onBack(); // topo do touchpad = menu rápido
      else { this.padCenter = true; this.padT = 0; } // centro: toque curto = menu, segurar = mira de teleporte
    }
    this.xrTp = false;
    if (this.padCenter) { if (pad) { this.padT += dt; if (this.padT > 0.3) this.xrTp = true; } else { this.padCenter = false; if (this.padT <= 0.3 && this.onMenu) this.onMenu(); } }
    this.padWas = pad;
    this.tpHeld = this.xrTp || this.questTp || (!xr && (!!this.keys.KeyT || !!this._gb[3] || !!this._gb[10] || !!this._gb[11]));
    this.blockInput = !!(this.guardHold || this.blockKey || this.gpBlock);
  }

  update(dt, world) {
    this._w = world;
    this._readInput(dt);
    const P = this.pos, vel = this.vel;
    this.dodgeCd -= dt; this.iframes -= dt;
    this.block = this.blockInput && this.stamina > 5 && !this.frozen;
    this.stamina = clamp(this.stamina + (this.block ? -6 : 14) * dt, 0, 100);

    // ---- alvos das mãos ----
    const sy = P.y + EYE - 0.22, cb = Math.cos(this.bodyYaw), sb = Math.sin(this.bodyYaw);
    const dir = this.ctrlDir;
    // direção espelhada no plano sagital do corpo
    const lx = dir.x * cb - dir.z * sb, lz = dir.x * sb + dir.z * cb; // para o espaço do corpo
    const mx = -lx * cb + lz * sb, mz = lx * sb + lz * cb;            // x invertido, de volta ao mundo
    for (let i = 0; i < 2; i++) {
      const h = this.hands[i], s = (i === 0 ? 1 : -1) * this.side, t = h.target;
      t.set(P.x + cb * 0.17 * s, sy, P.z - sb * 0.17 * s);
      if (this.six[i] && !this.emoteId) t.copy(this.sixPos[i]);
      else if (this.block) { t.set(P.x - Math.sin(this.headYaw) * 0.36 + cb * 0.11 * s, P.y + EYE - 0.06, P.z - Math.cos(this.headYaw) * 0.36 - sb * 0.11 * s); }
      else if (i === 1 && this.emoteWave > 0) { t.set(P.x + cb * 0.3 * s + Math.sin(this.emoteWave * 12) * 0.12 * cb, P.y + EYE + 0.32, P.z - sb * 0.3 * s - Math.sin(this.emoteWave * 12) * 0.12 * sb); }
      else if (this.emoteId) { const et = this.emoteTime, e = this.emoteId, sg = i === 0 ? 1 : -1; let u = 0.9, f = 0.18, sd = 0.36;
        if (e === 2) u = 0.9 + Math.sin(et * 7.5) * 0.35 * sg; else if (e === 8) { u = 1.3 + Math.abs(Math.sin(et * 6)) * 0.2; sd = 0.4; } else if (e === 10) { sd = 0.55; } else if (e === 11) { u = 0.5; f = 0.45; sd = 0.12; } else if (e === 12) { u = 0.8 + Math.round(Math.sin(et * 5) * 2) / 2 * 0.3 * sg; f = 0.3; } else if (e === 6) { u = 0.82; f = 0.34; sd = 0.07; } else if (e === 5) { u = 0.78; f = 0.28; sd = 0.14; }
        t.set(P.x + cb * sd * s - sb * f, P.y + u, P.z - sb * sd * s - cb * f); }
      else if (i === 0) t.addScaledVector(dir, REACH);
      else { t.x += mx * REACH; t.y += dir.y * REACH; t.z += mz * REACH; }
    }
    if (this.emoteWave > 0) this.emoteWave -= dt;
    if (this.desktop) this.camera.getWorldPosition(this.aimPos); else if (this.sixAny && this.active) this.active.getWorldPosition(this.aimPos); else if (this.viewMode === 1) this.aimPos.copy(this.hands[0].target); else { this.camera.getWorldPosition(this.aimPos); this.aimPos.y -= 0.25; }
    // a câmera externa não entra no chão
    if (this.viewMode !== 1) { this.camera.getWorldPosition(_b); const fl = world.heightAt(_b.x, _b.z) + 0.4; this.camLift = Math.max(0, (this.camLift || 0) + (fl - _b.y)) * 0.9; } else this.camLift = 0;
    if (this.emoteId) this.emoteTime += dt;
    // rastreamento de mãos pela câmera (MediaPipe): posições reais das mãos substituem os alvos (6DoF)
    this.tracked = false; const HT = this.handTrack;
    if (HT && HT.on && !this.block && !this.emoteId && !this.renderer.xr.isPresenting) { const now = performance.now(); this.camera.getWorldPosition(_b); this.camera.getWorldQuaternion(_q); let n = 0;
      for (let i = 0; i < 2; i++) { const d = HT.data[i]; if (!d || now - d.t > 450) continue; this.hands[i].target.set(d.x, d.y, d.z).applyQuaternion(_q).add(_b); n |= 1 << i; }
      if (n === 1 || n === 2) { const a = this.hands[n === 1 ? 0 : 1].target, o = this.hands[n === 1 ? 1 : 0].target, lx2 = (a.x - P.x) * cb - (a.z - P.z) * sb; o.set(a.x - 2 * lx2 * cb, a.y, a.z + 2 * lx2 * sb); }
      if (n) { this.tracked = true; _a.copy(this.hands[n & 1 ? 0 : 1].target).sub(_b); _a.y += 0.2; if (_a.lengthSq() > 0.01) this.ctrlDir.copy(_a.normalize()); } }
    // mira de teleporte: arco a partir da pata (ou do olhar); soltar teleporta
    const T = this.tp; this.tpCd -= dt; T.show = false;
    if (this.tpHeld && !this.frozen && this.tpCd <= 0) {
      const xr2 = this.renderer.xr.isPresenting; if (xr2 && this.viewMode === 1) { _a.copy(this.hands[0].target); _n.copy(this.ctrlDir); } else { _a.copy(this.aimPos); _n.copy(this.aimDir); }
      let vx = _n.x * 10, vy = _n.y * 10 + 1.5, vz = _n.z * 10; T.n = 0; T.valid = false; T.show = true;
      for (let k = 0; k < 40; k++) { T.pts[k * 3] = _a.x; T.pts[k * 3 + 1] = _a.y; T.pts[k * 3 + 2] = _a.z; T.n = k + 1; if (k > 1) { _b.copy(_a); if (world.collide(_b, 0.12, _q)) { if (_q.y > 0.6 && _b.y - 0.12 - P.y < 2.8 && !this.fightZone && !(world.swim ? false : _b.y < world.waterY)) { T.valid = true; } T.x = _b.x; T.y = _b.y - 0.12; T.z = _b.z; break; } } vy -= GRAVITY * 0.05; _a.x += vx * 0.05; _a.y += vy * 0.05; _a.z += vz * 0.05; }
    } else if (this.tpWas && T.valid && this.tpCd <= 0 && !this.frozen) { this.teleport(T.x, T.y + 0.05, T.z); this.tpCd = 0.5; T.valid = false; emit('teleported'); }
    this.tpWas = this.tpHeld;

    // ---- solver das mãos (âncoras) ----
    let touching = 0; _a.set(0, 0, 0);
    for (let i = 0; i < 2; i++) {
      const h = this.hands[i], t = h.target;
      h.vel.copy(t).sub(h.prevT).divideScalar(Math.max(dt, 0.001)); h.prevT.copy(t); h.speed = h.speed * 0.5 + h.vel.length() * 0.5;
      if (this.frozen) { h.touch = h.grab = false; h.pos.copy(t); continue; }
      if (h.grab) {
        if (h.pos.distanceToSquared(t) > 1.4 * 1.4) { h.grab = false; h.touch = false; h.pos.copy(t); continue; }
        _a.add(h.pos).sub(t); touching++; continue;
      }
      _b.copy(t); const hit = world.collide(_b, HAND_R, _n);
      if (hit) {
        if (!h.touch) { h.touch = true; h.pos.copy(_b); emit('handTouch', i, h); }
        else if (h.pos.distanceToSquared(t) > 0.7 * 0.7) { h.pos.copy(_b); } // braço esticou demais: escorrega
        _a.add(h.pos).sub(t); touching++; h.nearT = 0.15;
      } else {
        h.touch = false; h.pos.copy(t); h.nearT -= dt;
        _b.copy(t); _b.y -= 0.07; if (world.collide(_b, HAND_R + 0.05, _n)) h.nearT = 0.15;
      }
    }

    // ---- movimento do corpo ----
    const ox = P.x, oy = P.y, oz = P.z;
    if (touching > 0) {
      _a.divideScalar(touching);
      const l = _a.length(), maxStep = MAX_SPEED * 1.6 * dt; if (l > maxStep) _a.multiplyScalar(maxStep / l);
      P.add(_a);
      this.hist.push(_a.x / dt, _a.y / dt, _a.z / dt); if (this.hist.length > 18) this.hist.splice(0, 3);
      vel.set(0, 0, 0);
    } else {
      if (this.wasTouching && this.hist.length) { // soltou: impulso = média das velocidades recentes
        let n = this.hist.length / 3; vel.set(0, 0, 0);
        for (let i = 0; i < this.hist.length; i += 3) { vel.x += this.hist[i]; vel.y += this.hist[i + 1]; vel.z += this.hist[i + 2]; }
        vel.multiplyScalar(1.4 * this.jumpMul * (0.5 + this.speedMul * 0.5) / n); let s = vel.length(); if (s > MAX_SPEED) { vel.multiplyScalar(MAX_SPEED / s); s = MAX_SPEED; }
        if (s > 1.8) { if (vel.y < 1.6 && vel.y > -1) vel.y = 1.6 + s * 0.15; emit('fling', s); } // pulinho de gorila ao soltar
      }
      this.hist.length = 0;
      // natação (mapas com água funda): flutua até a superfície, braçadas com as patas e gatilho/WASD impulsionam em 3D
      const wasSwim = this.swimming; this.swimming = (!!world.swim && P.y < world.waterY - 0.3) || this.fly;
      if (this.swimming) {
        if (!wasSwim && !this.fly) emit('splash', vel.length());
        const deep = world.waterY - 0.78 - P.y; if (!this.fly) vel.y += (deep > 0 ? Math.min(1.9, 0.7 + deep) : -3) * dt;
        const dr = Math.exp(-1.7 * dt); vel.x *= dr; vel.y *= dr; vel.z *= dr;
        for (const h of this.hands) { if (h.speed < 1.4 || h.touch) continue; _a.copy(h.vel).sub(vel).multiplyScalar(-1); const fw = _a.dot(this.aimDir) < 0 ? 0.3 : 1; vel.addScaledVector(_a, 1.5 * fw * dt); }
        if (!this.frozen) {
          if (this.walkHeld) vel.addScaledVector(dir, 7 * this.speedMul * dt);
          if (this.desktop) { const f = (this.keys.KeyW ? 1 : 0) - (this.keys.KeyS ? 1 : 0), r = (this.keys.KeyD ? 1 : 0) - (this.keys.KeyA ? 1 : 0); if (f) vel.addScaledVector(this.rawDir, f * 8 * dt); if (r) { vel.x += Math.cos(this.yaw) * r * 7 * dt; vel.z -= Math.sin(this.yaw) * r * 7 * dt; } if (this.keys.Space) vel.y += 7 * dt; if (this.keys.KeyC) vel.y -= 7 * dt; }
        }
        const sv = vel.length(); if (sv > 4.2) vel.multiplyScalar(4.2 / sv);
        P.addScaledVector(vel, dt);
      } else {
      vel.y -= GRAVITY * this.gravMul * dt;
      // andar: gatilho (direção do controle) ou WASD
      let wx = 0, wz = 0;
      if (!this.frozen) {
        if (this.walkHeld) { const l = Math.hypot(dir.x, dir.z); if (l > 0.2) { wx = dir.x / l; wz = dir.z / l; } }
        if (this.desktop || this.sixAny) {
          const f = (this.keys.KeyW || this.keys.ArrowUp ? 1 : 0) - (this.keys.KeyS || this.keys.ArrowDown ? 1 : 0), r = (this.keys.KeyD || this.keys.ArrowRight ? 1 : 0) - (this.keys.KeyA || this.keys.ArrowLeft ? 1 : 0);
          const gf = f - this.gpMove.y, gr = r + this.gpMove.x;
          if (gf || gr) { const c = Math.cos(this.headYaw), s = Math.sin(this.headYaw); wx = -s * gf + c * gr; wz = -c * gf - s * gr; const l = Math.hypot(wx, wz); if (l > 1) { wx /= l; wz /= l; } }
        }
      }
      const sp = WALK_SPEED * this.speedMul * (this.block ? 0.45 : 1) * (this.inWater ? 0.55 : 1) * (this.keys.ShiftLeft ? 1.5 : 1);
      if (this.grounded) {
        const k = Math.min(1, dt * (wx || wz ? 10 : 2.6)); // sem comando de andar, o impulso desliza antes de parar
        if (this.iframes <= 0) { vel.x += (wx * sp - vel.x) * k; vel.z += (wz * sp - vel.z) * k; }
        if (this.surfaceN.y < 0.72 && this.surfaceN.y > 0) { vel.x += this.surfaceN.x * 9 * dt; vel.z += this.surfaceN.z * 9 * dt; } // escorrega em ladeira íngreme
      } else if (wx || wz) { vel.x += wx * 5 * dt; vel.z += wz * 5 * dt; const hs = Math.hypot(vel.x, vel.z); if (hs > MAX_SPEED) { vel.x *= MAX_SPEED / hs; vel.z *= MAX_SPEED / hs; } }
      // ladeiras muito íngremes não se sobem andando (é preciso escalar com as mãos)
      if (this.grounded && (wx || wz)) { const h0 = world.heightAt(P.x, P.z), h1 = world.heightAt(P.x + vel.x * 0.15, P.z + vel.z * 0.15); if (P.y - h0 < 0.2 && (h1 - h0) / (Math.hypot(vel.x, vel.z) * 0.15 + 1e-5) > 1.25) { vel.x *= 0.1; vel.z *= 0.1; } }
      P.addScaledVector(vel, dt);
      }
    }
    this.wasTouching = touching > 0;

    // ---- colisão do corpo ----
    this.grounded = false;
    _b.set(P.x, P.y + BODY_R, P.z);
    if (world.collide(_b, BODY_R, _n)) {
      P.set(_b.x, _b.y - BODY_R, _b.z);
      if (_n.y > 0.45) { this.grounded = true; this.surfaceN.copy(_n); if (vel.y < 0) { if (vel.y < -6) emit('land', -vel.y); vel.y = 0; } }
      else { const vn = vel.dot(_n); if (vn < 0) vel.addScaledVector(_n, -vn); }
    }
    _b.set(P.x, P.y + 0.78, P.z);
    if (world.collide(_b, 0.25, _n)) { P.x = _b.x; P.z = _b.z; P.y = _b.y - 0.78; const vn = vel.dot(_n); if (vn < 0) vel.addScaledVector(_n, -vn); }
    // água: boia
    this.inWater = false;
    if (world.swim) { this.inWater = P.y < world.waterY - 0.3; if (this.inWater && !this.swimming && touching === 0) this.swimming = true; }
    else if (P.y < world.waterY - 0.55) { P.y += (world.waterY - 0.55 - P.y) * Math.min(1, dt * 8); if (vel.y < 0) vel.y *= 0.5; this.grounded = true; this.inWater = true; this.surfaceN.set(0, 1, 0); }
    // limites do mapa
    const lim = world.half - 1.5;
    if (P.x < -lim) { P.x = -lim; vel.x = 0; } else if (P.x > lim) { P.x = lim; vel.x = 0; }
    if (P.z < -lim) { P.z = -lim; vel.z = 0; } else if (P.z > lim) { P.z = lim; vel.z = 0; }
    if (P.y < -40) emit('fellOut');
    this.speed = Math.hypot(P.x - ox, P.z - oz) / Math.max(dt, 0.001);
    this.moved = Math.hypot(P.x - ox, P.y - oy, P.z - oz); if (this.swimming && !this.fly) this.swimDist += this.moved; else if (touching > 0) this.swimming = false;
    // mãos ancoradas mantêm a posição; livres acompanham o corpo
    for (const h of this.hands) if (!h.touch && !h.grab) { h.pos.x += P.x - ox; h.pos.y += P.y - oy; h.pos.z += P.z - oz; }
  }
}
