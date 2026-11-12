import { emit } from './util.js';

// Rastreamento de mãos pela câmera do celular (MediaPipe Hand Landmarker), usado no modo VR Box/Cardboard.
// A biblioteca e o modelo só são baixados quando o jogador liga a opção. A detecção roda a ~12 Hz em
// vídeo de baixa resolução para poupar o aparelho; entre detecções as posições são suavizadas.
const LIB = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const TAN_H = Math.tan(33 * Math.PI / 180); // metade do campo de visão horizontal típico da câmera traseira

export const hands = {
  on: false, loading: false, status: 'desligado', data: [null, null], pinch: false, lm: null, video: null, last: 0, fps: 0, _pin: [false, false],
  async start() {
    if (this.on || this.loading) return; this.loading = true; this.status = 'pedindo câmera...'; emit('hands');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('câmera indisponível neste navegador');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 30 } }, audio: false });
      const v = this.video = document.createElement('video'); v.setAttribute('playsinline', ''); v.muted = true; v.srcObject = stream; await v.play();
      this.status = 'baixando MediaPipe...'; emit('hands');
      const mod = await (new Function('u', 'return import(u)'))(LIB + '/vision_bundle.mjs'); // import dinâmico (fora do bundle)
      const files = await mod.FilesetResolver.forVisionTasks(LIB + '/wasm');
      const opt = (delegate) => ({ baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      try { this.lm = await mod.HandLandmarker.createFromOptions(files, opt('GPU')); } catch (e) { this.lm = await mod.HandLandmarker.createFromOptions(files, opt('CPU')); }
      this.on = true; this.status = 'ativo'; emit('toast', '✋ Rastreamento de mãos ativo: mostre as mãos para a câmera', '#9cf09c');
    } catch (e) { this.status = 'erro: ' + (e && e.message ? e.message : e); this.stop(); emit('toast', 'Rastreamento de mãos indisponível: ' + (e && e.message ? e.message : e), '#ff9a8a'); }
    this.loading = false; emit('hands');
  },
  stop() { this.on = false; if (this.video && this.video.srcObject) this.video.srcObject.getTracks().forEach((t) => t.stop()); this.video = null; if (this.lm && this.lm.close) { try { this.lm.close(); } catch (e) { /* já fechado */ } } this.lm = null; this.data[0] = this.data[1] = null; this.pinch = false; if (this.status === 'ativo') this.status = 'desligado'; emit('hands'); },
  // chamado a cada quadro; devolve true quando o estado de "pinça" (gatilho) mudou
  tick(now) {
    if (!this.on || !this.lm || now - this.last < 80) return false; const v = this.video; if (!v || v.readyState < 2) return false;
    this.fps = this.fps * 0.8 + (1000 / Math.max(1, now - this.last)) * 0.2; this.last = now;
    let res; try { res = this.lm.detectForVideo(v, now); } catch (e) { return false; }
    const L = (res && res.landmarks) || [], asp = v.videoHeight / Math.max(1, v.videoWidth), found = [];
    for (const lm of L) {
      const cx = (lm[0].x + lm[5].x + lm[17].x) / 3, cy = (lm[0].y + lm[5].y + lm[17].y) / 3;
      const size = Math.hypot(lm[0].x - lm[9].x, (lm[0].y - lm[9].y) * asp); if (size < 0.02) continue;
      const z = Math.min(0.85, Math.max(0.18, 0.095 / (size * 2 * TAN_H))); // distância estimada pelo tamanho aparente da mão
      const pin = Math.hypot(lm[4].x - lm[8].x, (lm[4].y - lm[8].y) * asp) / size;
      // posição no espaço da câmera, ampliada 1.7x para as patas alcançarem o chão com o braço estendido
      found.push({ sx: cx, x: (cx - 0.5) * 2 * TAN_H * z * 1.7, y: -(cy - 0.5) * 2 * TAN_H * asp * z * 1.7 - 0.12, z: -z * 1.7, pin });
    }
    found.sort((a, b) => b.sx - a.sx); // mais à direita na imagem = mão direita (índice 0)
    if (found.length === 1 && found[0].sx < 0.5) found.unshift(null);
    let any = false;
    for (let i = 0; i < 2; i++) { const f = found[i]; if (!f) continue; const d = this.data[i] && now - this.data[i].t < 450 ? this.data[i] : (this.data[i] = { x: f.x, y: f.y, z: f.z, t: now });
      d.x += (f.x - d.x) * 0.6; d.y += (f.y - d.y) * 0.6; d.z += (f.z - d.z) * 0.5; d.t = now; this._pin[i] = this._pin[i] ? f.pin < 0.55 : f.pin < 0.33; if (this._pin[i]) any = true; }
    for (let i = 0; i < 2; i++) if (!found[i]) this._pin[i] = false;
    if (any !== this.pinch) { this.pinch = any; return true; } return false;
  }
};
