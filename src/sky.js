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
    // cúpula com degradê (zênite -> horizonte), 1 draw call
    const dg = new THREE.SphereGeometry(330, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.62); dg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(dg.attributes.position.count * 3), 3));
    this.dome = new THREE.Mesh(dg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })); this.dome.renderOrder = -10; this.dome.frustumCulled = false; scene.add(this.dome);
    // nuvens low-poly instanciadas, 1 draw call
    const parts = []; for (const [x, y, z, r] of [[0, 0, 0, 1], [1.1, -0.1, 0.2, 0.75], [-1.05, -0.12, -0.1, 0.7], [0.3, 0.35, -0.3, 0.6], [-0.4, 0.1, 0.5, 0.55]]) { const g = new THREE.IcosahedronGeometry(r, 0); g.scale(1, 0.55, 1); g.translate(x, y, z); parts.push(g); }
    let nv = 0; for (const g of parts) nv += g.attributes.position.count; const cp = new Float32Array(nv * 3); let o = 0; for (const g of parts) { cp.set(g.attributes.position.array, o); o += g.attributes.position.count * 3; g.dispose(); }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(cp, 3)); cg.computeVertexNormals();
    this.clouds = new THREE.InstancedMesh(cg, new THREE.MeshLambertMaterial({ fog: false, flatShading: false, emissive: 0x222222 }), 16); this.clouds.frustumCulled = false; this.clouds.castShadow = false; scene.add(this.clouds);
    this.cl = []; for (let i = 0; i < 16; i++) this.cl.push({ a: Math.random() * 6.283, r: 90 + Math.random() * 170, y: 55 + Math.random() * 45, s: 9 + Math.random() * 14, v: 0.004 + Math.random() * 0.006 });
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.TextureLoader().load('assets/glow.png'), color: 0xfff0b0, transparent: true, opacity: 0.85, fog: false, depthWrite: false, blending: THREE.AdditiveBlending })); this.glow.scale.set(120, 120, 1); this.glow.renderOrder = -9; scene.add(this.glow);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3(); this._top = new THREE.Color(); this.domeT = 0;
    this._a = new THREE.Color(); this._b = new THREE.Color(); this._c = new THREE.Color();
  }
  update(nowMs, def, center, perf, under) {
    const t = ((nowMs / 1000) % DAY_LENGTH) / DAY_LENGTH; // 0 = nascer do sol
    const ang = t * Math.PI * 2, el = Math.sin(ang); this.hour = (t * 24 + 6) % 24;
    const day = clamp(el * 3 + 0.5, 0, 1), dusk = clamp(1 - Math.abs(el) * 3.2, 0, 1);
    this.night = def.indoor ? 1 : 1 - day;
    const col = this._a.setHex(def.sky[2]).lerp(this._b.setHex(def.sky[0]), day).lerp(this._c.setHex(def.sky[1]), dusk * 0.6);
    if (def.indoor) col.setHex(def.sky[0]);
    const wx = !def.indoor && this.wx && this.wx.d > 0 ? this.wx : null; if (wx) col.lerp(wx.c, wx.d); // clima: céu acinzentado
    this.scene.background.copy(col); this.scene.fog.color.copy(col);
    const far = perf.drawDist * (def.fog || 1); this.scene.fog.near = far * 0.6; this.scene.fog.far = far; if (wx) { this.scene.fog.near *= 1 - wx.fog * 0.85; this.scene.fog.far *= 1 - wx.fog * 0.6; }
    if (def.indoor) { this.hemi.intensity = 0.8 * PI; this.hemi.color.setHex(0xb0a8d0); this.hemi.groundColor.setHex(0x504840); this.sun.intensity = 0.25 * PI; this.sun.color.setHex(0xffc890); this.sun.position.set(center.x + 5, center.y + 30, center.z + 8); }
    else {
      this.hemi.intensity = (0.5 + day * 0.14) * PI; this.hemi.color.setHex(0xa8b8ff).lerp(this._b.setHex(0xffffff), day); this.hemi.groundColor.setHex(0x454a66).lerp(this._b.setHex(0x9a8a68), day);
      const moon = el < -0.05; const sx = Math.cos(ang) * (moon ? -1 : 1), sy = Math.abs(el) * 0.9 + 0.12, sz = 0.35;
      this.sun.intensity = (moon ? 0.2 : 0.14 + day * 0.36) * PI; this.sun.color.setHex(moon ? 0x8fa8ff : 0xffffff).lerp(this._b.setHex(0xff9a50), moon ? 0 : dusk * 0.7);
      this.sun.position.set(center.x + sx * 60, center.y + sy * 60, center.z + sz * 60);
      this.orb.position.set(center.x + sx * 260, center.y + sy * 260, center.z + sz * 260); this.orb.material.color.setHex(moon ? 0xdfe8ff : 0xfff2b0);
    }
    if (wx) { this.hemi.intensity *= 1 - wx.d * 0.45; this.sun.intensity *= 1 - wx.d * 0.8; }
    this.clouds.material.color.setScalar(wx ? 1 - wx.d * 0.6 : 1); // nuvens carregadas no mau tempo
    this.sun.target.position.copy(center);
    this.orb.visible = !def.indoor && !(wx && wx.d > 0.35); this.stars.visible = !def.indoor && this.night > 0.3; this.stars.material.opacity = clamp((this.night - 0.3) * 2, 0, 1); this.stars.position.copy(center);
    this.sun.castShadow = perf.shadows === 2;
    if (under) { col.setHex(0x1a9ac8).multiplyScalar(0.55 + day * 0.45); this.scene.background.copy(col); this.scene.fog.color.copy(col); this.scene.fog.near = 1; this.scene.fog.far = 36; }
    // cúpula: recolore ~2x por segundo
    this.dome.visible = !def.indoor && !under; this.dome.position.set(center.x, center.y - 20, center.z);
    this.domeT -= 1; if (this.dome.visible && this.domeT <= 0) { this.domeT = 30; const top = this._top.copy(col).multiplyScalar(0.55); top.b = Math.min(1, top.b * 1.35 + 0.04); const C = this.dome.geometry.attributes.color, Pp = this.dome.geometry.attributes.position; for (let i = 0; i < C.count; i++) { const k = Math.pow(clamp(Pp.getY(i) / 330, 0, 1), 0.6); C.setXYZ(i, col.r + (top.r - col.r) * k, col.g + (top.g - col.g) * k, col.b + (top.b - col.b) * k); } C.needsUpdate = true; }
    // nuvens: giram devagar em volta do jogador
    const cv = !def.indoor && perf.level >= 1; this.clouds.visible = cv; this.glow.visible = !def.indoor && perf.level >= 1;
    if (cv) { const tt = nowMs / 1000; for (let i = 0; i < this.cl.length; i++) { const c = this.cl[i], a = c.a + tt * c.v; this._m.compose(this._p.set(center.x + Math.cos(a) * c.r, c.y, center.z + Math.sin(a) * c.r), this._q, this._s.set(c.s, c.s * 0.7, c.s)); this.clouds.setMatrixAt(i, this._m); } this.clouds.instanceMatrix.needsUpdate = true; this.clouds.material.color.copy(this._b.setHex(0x9098b8).lerp(this._c.setHex(0xffffff), day)).lerp(this._c.setHex(0xffb890), dusk * 0.5); this.clouds.material.emissive.setScalar(0.1 + day * 0.12); }
    if (this.glow.visible) { this.glow.position.copy(this.orb.position); this.glow.material.color.copy(this.orb.material.color); this.glow.material.opacity = (0.55 + dusk * 0.35) * (wx ? 1 - wx.d : 1); }
  }
}
