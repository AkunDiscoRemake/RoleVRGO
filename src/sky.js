import * as THREE from 'three';
import { DAY_LENGTH } from './config.js';
import { clamp } from './util.js';
const PI = Math.PI; // three r155+: intensidades físicas (sem o fator PI embutido)

// Ciclo dia/noite sincronizado pelo relógio (igual para todos os jogadores).
export class Sky {
  constructor(scene) {
    this.scene = scene; this.night = 0; this.hour = 12;
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x8a7a60, 0.9); scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 0.9); scene.add(this.sun); scene.add(this.sun.target);
    this.sun.shadow.mapSize.set(1024, 1024); const c = this.sun.shadow.camera; c.left = c.bottom = -28; c.right = c.top = 28; c.near = 1; c.far = 120; this.sun.shadow.bias = -0.002;
    scene.fog = new THREE.Fog(0x8fd0f5, 20, 90); scene.background = new THREE.Color(0x8fd0f5);
    const n = 260, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, y = Math.random() * 0.9 + 0.08, r = Math.sqrt(1 - y * y); pos[i * 3] = Math.cos(a) * r * 300; pos[i * 3 + 1] = y * 300; pos[i * 3 + 2] = Math.sin(a) * r * 300; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0, depthWrite: false })); this.stars.frustumCulled = false; scene.add(this.stars);
    this.orb = new THREE.Mesh(new THREE.IcosahedronGeometry(9, 1), new THREE.MeshBasicMaterial({ color: 0xfff2b0, fog: false })); scene.add(this.orb);
    this._a = new THREE.Color(); this._b = new THREE.Color(); this._c = new THREE.Color();
  }
  update(nowMs, def, center, perf) {
    const t = ((nowMs / 1000) % DAY_LENGTH) / DAY_LENGTH; // 0 = nascer do sol
    const ang = t * Math.PI * 2, el = Math.sin(ang); this.hour = (t * 24 + 6) % 24;
    const day = clamp(el * 3 + 0.5, 0, 1), dusk = clamp(1 - Math.abs(el) * 3.2, 0, 1);
    this.night = def.indoor ? 1 : 1 - day;
    const col = this._a.setHex(def.sky[2]).lerp(this._b.setHex(def.sky[0]), day).lerp(this._c.setHex(def.sky[1]), dusk * 0.6);
    if (def.indoor) col.setHex(def.sky[0]);
    this.scene.background.copy(col); this.scene.fog.color.copy(col);
    const far = perf.drawDist * (def.fog || 1); this.scene.fog.near = far * 0.6; this.scene.fog.far = far;
    if (def.indoor) { this.hemi.intensity = 0.8 * PI; this.hemi.color.setHex(0xb0a8d0); this.hemi.groundColor.setHex(0x504840); this.sun.intensity = 0.25 * PI; this.sun.color.setHex(0xffc890); this.sun.position.set(center.x + 5, center.y + 30, center.z + 8); }
    else {
      this.hemi.intensity = (0.5 + day * 0.14) * PI; this.hemi.color.setHex(0xa8b8ff).lerp(this._b.setHex(0xffffff), day); this.hemi.groundColor.setHex(0x454a66).lerp(this._b.setHex(0x9a8a68), day);
      const moon = el < -0.05; const sx = Math.cos(ang) * (moon ? -1 : 1), sy = Math.abs(el) * 0.9 + 0.12, sz = 0.35;
      this.sun.intensity = (moon ? 0.2 : 0.14 + day * 0.36) * PI; this.sun.color.setHex(moon ? 0x8fa8ff : 0xffffff).lerp(this._b.setHex(0xff9a50), moon ? 0 : dusk * 0.7);
      this.sun.position.set(center.x + sx * 60, center.y + sy * 60, center.z + sz * 60);
      this.orb.position.set(center.x + sx * 260, center.y + sy * 260, center.z + sz * 260); this.orb.material.color.setHex(moon ? 0xdfe8ff : 0xfff2b0);
    }
    this.sun.target.position.copy(center);
    this.orb.visible = !def.indoor; this.stars.visible = !def.indoor && this.night > 0.3; this.stars.material.opacity = clamp((this.night - 0.3) * 2, 0, 1); this.stars.position.copy(center);
    this.sun.castShadow = perf.shadows === 2;
  }
}
