import * as THREE from 'three';
import { perf } from './perf.js';

// Partículas (1 draw call, textura do Kenney Particle Pack), textos flutuantes e rótulos em lote.
const MAXP = 180;
export class FX {
  constructor(scene) {
    this.scene = scene; this.n = 0;
    this.pos = new Float32Array(MAXP * 3); this.col = new Float32Array(MAXP * 3); this.vel = new Float32Array(MAXP * 3); this.life = new Float32Array(MAXP); this.grav = new Float32Array(MAXP);
    for (let i = 0; i < MAXP; i++) this.pos[i * 3 + 1] = -9999;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.tex = new THREE.TextureLoader().load('assets/glow.png');
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.34, map: this.tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    this.points.frustumCulled = false; this.points.renderOrder = 4; scene.add(this.points);
    this.texts = []; this._c = new THREE.Color(); this.next = 0;
    for (let i = 0; i < 6; i++) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 64; const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false })); s.scale.set(1.3, 0.325, 1); s.visible = false; s.renderOrder = 9; scene.add(s);
      this.texts.push({ s, c, t, life: 0 });
    }
  }
  burst(x, y, z, color, count, speed, grav) {
    count = Math.max(1, Math.round(count * perf.particles)); this._c.set(color);
    for (let k = 0; k < count; k++) {
      const i = this.next; this.next = (this.next + 1) % MAXP;
      const a = Math.random() * 6.283, u = Math.random() * 2 - 1, r = Math.sqrt(1 - u * u), sp = (speed || 2) * (0.4 + Math.random() * 0.6);
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; this.vel[i * 3] = Math.cos(a) * r * sp; this.vel[i * 3 + 1] = Math.abs(u) * sp + 0.5; this.vel[i * 3 + 2] = Math.sin(a) * r * sp;
      this.col[i * 3] = this._c.r; this.col[i * 3 + 1] = this._c.g; this.col[i * 3 + 2] = this._c.b; this.life[i] = 0.5 + Math.random() * 0.5; this.grav[i] = grav == null ? 5 : grav;
    }
  }
  text(x, y, z, str, color) {
    let o = this.texts[0]; for (const t of this.texts) if (t.life <= 0) { o = t; break; } else if (t.life < o.life) o = t;
    const g = o.c.getContext('2d'); g.clearRect(0, 0, 256, 64); g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText(str, 128, 32); g.fillStyle = color || '#fff'; g.fillText(str, 128, 32);
    o.t.needsUpdate = true; o.s.position.set(x, y, z); o.s.visible = true; o.s.material.opacity = 1; o.life = 1.1;
  }
  update(dt) {
    const P = this.pos, V = this.vel, L = this.life; let any = false;
    for (let i = 0; i < MAXP; i++) { if (L[i] <= 0) continue; any = true; L[i] -= dt; if (L[i] <= 0) { P[i * 3 + 1] = -9999; continue; } V[i * 3 + 1] -= this.grav[i] * dt; P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt; }
    if (any || this._was) { this.points.geometry.attributes.position.needsUpdate = true; this.points.geometry.attributes.color.needsUpdate = true; } this._was = any; this.points.visible = any;
    for (const t of this.texts) if (t.life > 0) { t.life -= dt; t.s.position.y += dt * 0.9; t.s.material.opacity = Math.min(1, t.life * 2.5); if (t.life <= 0) t.s.visible = false; }
  }
}

// Vários rótulos de texto em UM draw call (atlas em canvas + quads fixos, dupla face).
export class LabelBatch {
  constructor(scene) {
    this.scene = scene; this.items = [];
    this.canvas = document.createElement('canvas'); this.canvas.width = 1024; this.canvas.height = 512; // 4 x 8 células de 256x64
  }
  add(text, x, y, z, yaw, w, color, bg) { if (this.items.length < 32) this.items.push({ text, x, y, z, yaw, w: w || 2.4, color: color || '#fff', bg: bg || 'rgba(20,18,30,0.72)' }); }
  build() {
    if (!this.items.length) return;
    const n = this.items.length, pos = new Float32Array(n * 12), uv = new Float32Array(n * 8), idx = new Uint16Array(n * 6), g = this.canvas.getContext('2d');
    g.clearRect(0, 0, 1024, 512); g.textAlign = 'center'; g.textBaseline = 'middle';
    this.items.forEach((it, i) => {
      const cx = (i % 4) * 256, cy = Math.floor(i / 4) * 64; g.font = 'bold 30px sans-serif'; let fs = 30; const tw = g.measureText(it.text).width; if (tw > 236) { fs = Math.floor(30 * 236 / tw); g.font = 'bold ' + fs + 'px sans-serif'; }
      g.fillStyle = it.bg; g.fillRect(cx + 2, cy + 6, 252, 52); g.fillStyle = it.color; g.fillText(it.text, cx + 128, cy + 33);
      const hw = it.w / 2, hh = it.w / 8, c = Math.cos(it.yaw), s = Math.sin(it.yaw), o = i * 12;
      const P = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
      for (let k = 0; k < 4; k++) { pos[o + k * 3] = it.x + P[k][0] * c; pos[o + k * 3 + 1] = it.y + P[k][1]; pos[o + k * 3 + 2] = it.z - P[k][0] * s; }
      const u0 = cx / 1024, u1 = (cx + 256) / 1024, v0 = 1 - (cy + 64) / 512, v1 = 1 - cy / 512; uv.set([u0, v0, u1, v0, u1, v1, u0, v1], i * 8);
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const tex = new THREE.CanvasTexture(this.canvas); tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false })); this.mesh.frustumCulled = false; this.mesh.renderOrder = 3; this.scene.add(this.mesh);
  }
  dispose() { if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.map.dispose(); this.mesh.material.dispose(); this.mesh = null; } this.items.length = 0; }
}
