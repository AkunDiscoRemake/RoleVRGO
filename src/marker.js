// ➕ Rastreamento por um "+" desenhado em papel, pela câmera do aparelho.
// VR Box / celular / PC (sem rastreamento de posição): o movimento real da cabeça em relação ao papel move o gato.
// Meta Quest (já rastreia posição sozinho): o "+" vira uma âncora que mantém o mundo alinhado ao papel (corrige a deriva).
// A câmera só é usada se o navegador liberar (no Quest depende da versão do navegador e da permissão de câmera).
import * as THREE from 'three';
import { detectPlus } from './plusdetect.js';
import { emit, store } from './util.js';

const W = 160, H = 120, _m = new THREE.Vector3(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _e = new THREE.Euler();
export const SIZES = [0.1, 0.15, 0.2, 0.3, 0.5]; // tamanho total do "+" (ponta a ponta), em metros
export const marker = {
  on: false, starting: false, seen: false, dist: 0, size: store.get('plusSize', 0.15), fov: store.get('plusFov', 62), err: '', mode: '',
  video: null, canvas: null, ctx: null, timer: 0, prev: null, sm: null, lost: 0, frames: 0, anchor: null, stable: 0, player: null, renderer: null, moved: 0,
  supported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); },
  status() { if (!this.on) return this.starting ? 'abrindo câmera...' : this.err || 'desligado'; return this.seen ? 'vendo o + a ' + this.dist.toFixed(2).replace('.', ',') + ' m' : 'procurando o +...'; },
  async toggle(player, renderer) { if (this.on || this.starting) { this.stop(); return ''; } return this.start(player, renderer); },
  async start(player, renderer) {
    this.player = player; this.renderer = renderer; this.err = '';
    if (!this.supported()) { this.err = 'sem câmera neste navegador'; return 'Este navegador não libera a câmera'; }
    this.starting = true;
    try {
      const st = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 30 } } });
      const v = this.video = document.createElement('video'); v.playsInline = true; v.muted = true; v.srcObject = st; await v.play();
      this.canvas = document.createElement('canvas'); this.canvas.width = W; this.canvas.height = H; this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
      this.on = true; this.starting = false; this.prev = null; this.sm = null; this.anchor = null; this.stable = 0; this.timer = setInterval(() => this.tick(), 50);
      store.set('plusOn', true); emit('toast', '➕ Câmera ligada: aponte para o + desenhado no papel', '#bfe6ff'); return '';
    } catch (e) { this.starting = false; this.err = /Permission|NotAllowed/i.test(e.name + e.message) ? 'permissão da câmera negada' : 'câmera indisponível'; return 'Não foi possível abrir a câmera (' + this.err + ')'; }
  },
  stop() { clearInterval(this.timer); this.timer = 0; if (this.video && this.video.srcObject) this.video.srcObject.getTracks().forEach((t) => t.stop()); this.video = null; this.on = false; this.starting = false; this.seen = false; store.set('plusOn', false); },
  cycleSize() { const i = SIZES.indexOf(this.size); this.size = SIZES[(i + 1) % SIZES.length]; store.set('plusSize', this.size); this.prev = null; this.sm = null; },
  calibrate() { this.prev = null; this.sm = null; this.anchor = null; this.stable = 0; emit('toast', '➕ Calibrado: este é o novo ponto de partida', '#9cf09c'); },
  // posição do "+" no espaço da câmera (metros; câmera olha para -Z)
  measure(d) { const f = (W / 2) / Math.tan(this.fov * Math.PI / 360), Z = f * (this.size / 2) / d.r; return _m.set((d.x - W / 2) / f * Z, -(d.y - H / 2) / f * Z, -Z); },
  tick() {
    const v = this.video; if (!v || v.readyState < 2) return; this.ctx.drawImage(v, 0, 0, W, H);
    const d = detectPlus(this.ctx.getImageData(0, 0, W, H).data, W, H);
    if (!d) { if (++this.lost > 6 && this.seen) { this.seen = false; this.prev = null; emit('plusSeen', false); } return; }
    this.lost = 0; if (!this.seen) { this.seen = true; emit('plusSeen', true); }
    const m = this.measure(d); this.sm = this.sm ? this.sm.lerp(m, 0.45) : m.clone(); this.dist = this.sm.length();
    const P = this.player, cam = P.camera; cam.getWorldQuaternion(_q); const xr = this.renderer && this.renderer.xr.isPresenting;
    const rel = _p.copy(this.sm).applyQuaternion(_q); // vetor câmera -> "+" no mundo
    if (xr) { // Quest: âncora. Guarda onde o "+" está no mundo e corrige a deriva devagar
      this.mode = 'âncora'; cam.getWorldPosition(_m); const mw = _m.add(rel);
      if (!this.anchor) { if (++this.stable > 12) { this.anchor = mw.clone(); emit('toast', '➕ Âncora fixada no papel', '#9cf09c'); } return; }
      const dx = mw.x - this.anchor.x, dz = mw.z - this.anchor.z; if (Math.hypot(dx, dz) > 0.12) { P.pos.x -= dx * 0.15; P.pos.z -= dz * 0.15; }
      return;
    }
    // VR Box / celular / PC: a cabeça se move em relação ao papel -> o gato anda junto
    this.mode = 'movimento'; _e.setFromQuaternion(_q, 'YXZ'); const yaw = _e.y;
    const cur = { x: -rel.x, y: -rel.y, z: -rel.z, yaw };
    if (this.prev && Math.abs(yaw - this.prev.yaw) < 0.25) {
      let dx = cur.x - this.prev.x, dz = cur.z - this.prev.z; const dd = Math.hypot(dx, dz);
      if (dd > 0.006 && dd < 0.35) { P.pos.x += dx; P.pos.z += dz; this.moved += dd; } // ignora tremida e saltos de detecção
    }
    this.prev = cur; this.frames++;
  }
};
