import * as THREE from 'three';
import { EYE, REACH, HAND_R, BODY_R, GRAVITY, WALK_SPEED, MAX_SPEED } from './config.js';
import { clamp, emit } from './util.js';

// Jogador local: Gorilla Locomotion adaptada ao controle 3DoF do Oculus Go.
// Só a ORIENTAÇÃO do controle é usada: a bolinha primária fica na ponta de um
// "braço invisível" que sai do ombro; a segunda bolinha é espelhada no plano
// sagital do corpo. Bolinha encostada em superfície = âncora: mover o controle
// desloca o corpo no sentido oposto (empurrar, escalar, impulsionar).
const V = () => new THREE.Vector3();
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
    this.ctrlDir = new THREE.Vector3(0, 0, -1); this.aimDir = new THREE.Vector3(0, 0, -1); this.aimPos = V(); this.ctrlQuat = new THREE.Quaternion(); this.prevDir = V(); this.flickUp = 0;
    this.bodyYaw = 0; this.headYaw = 0; this.headPitch = 0; this.side = 1; // 1 = controle na mão direita
    this.trigger = false; this.walkHeld = false; this.block = false; this.blockInput = false; this.iframes = 0; this.dodgeCd = 0; this.stamina = 100;
    this.frozen = false; this.fightZone = false; this.emoteWave = 0; this.guardHold = false;
    this.keys = {}; this.desktop = true; this.locked = false; this.padWas = false;
    this.onTrigger = null; this.onRelease = null; this.onMenu = null; this.onBack = null; // callbacks do jogo
    this.speedMul = 1; this.backWas = false;
    this.controllers = [];
    for (let i = 0; i < 2; i++) {
      const c = renderer.xr.getController(i); this.head.add(c); this.controllers.push(c);
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
      if (e.code === 'KeyQ') this.dodge(-1); if (e.code === 'KeyE') this.dodge(1);
      if (e.code === 'Space' && this.grounded && !this.frozen) { this.vel.y = 4.6; this.grounded = false; emit('jump'); }
      emit('key', e.code);
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
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
  forward(out) { return out.set(-Math.sin(this.headYaw), 0, -Math.cos(this.headYaw)); }
  headPos(out) { return this.camera.getWorldPosition(out); }

  _readInput(dt) {
    const xr = this.renderer.xr.isPresenting; this.desktop = !xr;
    this.rig.rotation.y = this.yaw; this.rig.updateMatrixWorld(true);
    if (!xr) { this.camera.rotation.set(this.pitch, 0, 0, 'YXZ'); this.camera.position.set(0, 0, 0); this.camera.updateMatrixWorld(true); }
    // cabeça
    const cam = xr ? this.renderer.xr.getCamera() : this.camera;
    if (xr) { cam.matrixWorld.decompose(_a, _q, _b); } else this.camera.getWorldQuaternion(_q);
    _e.setFromQuaternion(_q, 'YXZ'); this.headYaw = _e.y; this.headPitch = _e.x;
    let d = this.headYaw - this.bodyYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.bodyYaw += d * Math.min(1, dt * 6);
    // controle
    let pad = false, px = 0, py = 0;
    if (xr) {
      const c = this.active && this.active.userData.src ? this.active : this.controllers.find((k) => k.userData.src);
      if (c) {
        c.getWorldQuaternion(this.ctrlQuat);
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
      } else this.ctrlQuat.copy(_q);
    } else {
      this.ctrlQuat.copy(_q);
      this.blockKey = !!this.keys.KeyF;
    }
    this.ctrlDir.set(0, 0, -1).applyQuaternion(this.ctrlQuat);
    // mira: no VR é o "laser" do controle; no desktop é o centro da tela e as patas ficam um pouco abaixo
    if (xr) { this.aimDir.copy(this.ctrlDir); }
    else { this.aimDir.copy(this.ctrlDir); _e.set(clamp(this.pitch - 0.38, -1.55, 1.5), this.yaw, 0, 'YXZ'); this.ctrlDir.set(0, 0, -1).applyEuler(_e); }
    // "puxão" para cima do controle (usado na pesca)
    this.flickUp = (this.ctrlDir.y - this.prevDir.y) / Math.max(dt, 0.001); this.prevDir.copy(this.ctrlDir);
    // cliques do touchpad por zona: cima/centro = menu, lados = girar (ou esquiva em luta), baixo = bloquear
    if (pad && !this.padWas) {
      if (py > 0.45 && Math.abs(px) < 0.6) { /* bloqueio: tratado como hold */ }
      else if (Math.abs(px) > 0.5) { if (this.fightZone) this.dodge(px > 0 ? 1 : -1); else { this.yaw -= Math.sign(px) * Math.PI / 6; emit('turn'); } }
      else if (py < -0.45 && this.onBack) this.onBack(); // topo do touchpad = menu rápido
      else if (this.onMenu) this.onMenu();
    }
    this.padWas = pad;
    this.blockInput = !!(this.guardHold || this.blockKey);
  }

  update(dt, world) {
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
      if (this.block) { t.set(P.x - Math.sin(this.headYaw) * 0.36 + cb * 0.11 * s, P.y + EYE - 0.06, P.z - Math.cos(this.headYaw) * 0.36 - sb * 0.11 * s); }
      else if (i === 1 && this.emoteWave > 0) { t.set(P.x + cb * 0.3 * s + Math.sin(this.emoteWave * 12) * 0.12 * cb, P.y + EYE + 0.32, P.z - sb * 0.3 * s - Math.sin(this.emoteWave * 12) * 0.12 * sb); }
      else if (i === 0) t.addScaledVector(dir, REACH);
      else { t.x += mx * REACH; t.y += dir.y * REACH; t.z += mz * REACH; }
    }
    if (this.emoteWave > 0) this.emoteWave -= dt;
    if (this.desktop) this.camera.getWorldPosition(this.aimPos); else this.aimPos.copy(this.hands[0].target);

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
        vel.multiplyScalar(1.4 * (0.5 + this.speedMul * 0.5) / n); let s = vel.length(); if (s > MAX_SPEED) { vel.multiplyScalar(MAX_SPEED / s); s = MAX_SPEED; }
        if (s > 1.8) { if (vel.y < 1.6 && vel.y > -1) vel.y = 1.6 + s * 0.15; emit('fling', s); } // pulinho de gorila ao soltar
      }
      this.hist.length = 0;
      vel.y -= GRAVITY * dt;
      // andar: gatilho (direção do controle) ou WASD
      let wx = 0, wz = 0;
      if (!this.frozen) {
        if (this.walkHeld) { const l = Math.hypot(dir.x, dir.z); if (l > 0.2) { wx = dir.x / l; wz = dir.z / l; } }
        if (this.desktop) {
          const f = (this.keys.KeyW || this.keys.ArrowUp ? 1 : 0) - (this.keys.KeyS || this.keys.ArrowDown ? 1 : 0), r = (this.keys.KeyD || this.keys.ArrowRight ? 1 : 0) - (this.keys.KeyA || this.keys.ArrowLeft ? 1 : 0);
          if (f || r) { const c = Math.cos(this.yaw), s = Math.sin(this.yaw); wx = -s * f + c * r; wz = -c * f - s * r; const l = Math.hypot(wx, wz); wx /= l; wz /= l; }
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
    if (P.y < world.waterY - 0.55) { P.y += (world.waterY - 0.55 - P.y) * Math.min(1, dt * 8); if (vel.y < 0) vel.y *= 0.5; this.grounded = true; this.inWater = true; this.surfaceN.set(0, 1, 0); }
    // limites do mapa
    const lim = world.half - 1.5;
    if (P.x < -lim) { P.x = -lim; vel.x = 0; } else if (P.x > lim) { P.x = lim; vel.x = 0; }
    if (P.z < -lim) { P.z = -lim; vel.z = 0; } else if (P.z > lim) { P.z = lim; vel.z = 0; }
    if (P.y < -40) emit('fellOut');
    this.speed = Math.hypot(P.x - ox, P.z - oz) / Math.max(dt, 0.001);
    this.moved = Math.hypot(P.x - ox, P.y - oy, P.z - oz);
    // mãos ancoradas mantêm a posição; livres acompanham o corpo
    for (const h of this.hands) if (!h.touch && !h.grab) { h.pos.x += P.x - ox; h.pos.y += P.y - oy; h.pos.z += P.z - oz; }
  }
}
