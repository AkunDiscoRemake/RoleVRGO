import { emit } from './util.js';
import { audioStream } from './assets.js';

// Gravação de vídeo do jogo: MediaRecorder sobre o canvas (+ áudio do jogo).
// Ao parar, o arquivo .webm é baixado pelo navegador (pasta Downloads).
export const rec = {
  on: false, t0: 0, mr: null, chunks: [], max: 180,
  supported() { return typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream; },
  seconds() { return this.on ? (performance.now() - this.t0) / 1000 : 0; },
  start(canvas) {
    if (this.on) return ''; if (!this.supported()) return 'Este navegador não permite gravar';
    try {
      const stream = canvas.captureStream(30); const a = audioStream(); if (a) a.getAudioTracks().forEach((t) => stream.addTrack(t));
      const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']; let type = ''; for (const t of types) if (MediaRecorder.isTypeSupported(t)) { type = t; break; }
      const mr = this.mr = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 3500000 } : undefined); this.chunks = []; this.ext = type.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
      mr.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
      mr.onstop = () => { const blob = new Blob(this.chunks, { type: mr.mimeType || 'video/webm' }); this.chunks = []; const d = new Date(), p = (n) => String(n).padStart(2, '0'); const name = 'rolevrgo-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + '.' + this.ext;
        const url = URL.createObjectURL(blob), a2 = document.createElement('a'); a2.href = url; a2.download = name; a2.style.display = 'none'; document.body.appendChild(a2); a2.click(); setTimeout(() => { URL.revokeObjectURL(url); a2.remove(); }, 4000);
        emit('toast', '🎬 Vídeo salvo em Downloads: ' + name + ' (' + (blob.size / 1048576).toFixed(1) + ' MB)', '#9cf09c'); emit('rec'); };
      mr.start(1000); this.on = true; this.t0 = performance.now(); emit('toast', '⏺ Gravando... (máx. 3 min)', '#ff8a8a'); emit('rec'); return '';
    } catch (e) { this.on = false; return 'Não foi possível gravar: ' + e.message; }
  },
  stop() { if (!this.on) return; this.on = false; try { this.mr.stop(); } catch (e) { /* já parou */ } emit('rec'); },
  toggle(canvas) { if (this.on) { this.stop(); return ''; } return this.start(canvas); },
  tick() { if (this.on && this.seconds() > this.max) this.stop(); }
};
