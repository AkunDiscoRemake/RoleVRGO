import { net } from './net.js';
import { audioNodes } from './assets.js';
import { emit, store, clamp } from './util.js';

// Chat de voz: WebRTC ponto a ponto entre os jogadores do mesmo mapa/sala. A combinação da
// conexão (oferta/resposta SDP) passa pelo canal do Supabase Realtime que o jogo já usa.
// O som é posicional: volume pela distância e lado (esquerda/direita) pela posição do gato.
// Ouvir vem ligado; o microfone só liga quando o jogador pede (e o navegador pede permissão).
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
const MAX_PEERS = 8, NEAR = 2.5, FAR = 28;

export const voice = {
  on: store.get('voiceOn', true), // ouvir/participar
  who: store.get('voiceWho', 0), // 0 todos, 1 só amigos e grupo
  mic: false, stream: null, track: null, peers: new Map(), level: 0, err: '', G: null,
  supported() { return !!(self.RTCPeerConnection && navigator.mediaDevices && navigator.mediaDevices.getUserMedia); },
  init(G) { this.G = G; },
  // jogadores com quem pode haver voz
  allowed(id, meta) {
    const G = this.G; if (!this.on || !meta || !meta.vc || (G && G.muted(id))) return false;
    if (this.who === 1) { const f = G.friends.find((x) => x.id === id && x.status === 'accepted'); const party = net.partyMembers.some((m) => m.id === id); if (!f && !party) return false; }
    return true;
  },
  setOn(v) { this.on = !!v; store.set('voiceOn', this.on); if (!this.on) { this.setMic(false); this.closeAll(); } emit('meta'); this.sync(); emit('voice'); },
  setWho(v) { this.who = clamp(v | 0, 0, 1); store.set('voiceWho', this.who); this.sync(); emit('voice'); },
  async setMic(v) {
    if (!v) { this.mic = false; if (this.stream) { for (const t of this.stream.getTracks()) t.stop(); } this.stream = null; this.track = null; this.peers.forEach((p) => { if (p.sender) p.sender.replaceTrack(null).catch(() => {}); }); emit('voice'); emit('meta'); return ''; }
    if (!this.supported()) return 'Este navegador não tem chat de voz';
    if (!this.on) this.setOn(true);
    try { this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }); }
    catch (e) { this.err = 'Microfone bloqueado: permita o acesso ao microfone no navegador'; emit('voice'); return this.err; }
    this.track = this.stream.getAudioTracks()[0]; this.mic = true; this.err = '';
    this.peers.forEach((p) => { if (p.sender) p.sender.replaceTrack(this.track).catch(() => {}); });
    // medidor do próprio microfone (para mostrar que está captando)
    const n = audioNodes(); if (n) { try { const src = n.ctx.createMediaStreamSource(this.stream), an = n.ctx.createAnalyser(); an.fftSize = 256; src.connect(an); this.myAn = an; } catch (e) { this.myAn = null; } }
    emit('voice'); emit('meta'); return '';
  },
  // ---------- conexões ----------
  // chamado quando a lista/estado dos jogadores muda: abre as conexões que faltam, fecha as que não valem mais
  sync() {
    const G = this.G; if (!G || !net.online) return;
    this.peers.forEach((p, id) => { const r = G.remotes.get(id); if (!r || !this.allowed(id, r.meta)) this.close(id); });
    if (!this.on) return;
    G.remotes.forEach((r, id) => { if (this.peers.has(id) || this.peers.size >= MAX_PEERS || !this.allowed(id, r.meta)) return; if (net.id < id) this._open(id, true); }); // o de id menor faz a oferta (evita as duas pontas oferecerem juntas)
  },
  _open(id, offer) {
    const pc = new RTCPeerConnection({ iceServers: ICE }), p = { id, pc, sender: null, audio: null, src: null, gain: null, pan: null, an: null, talk: 0, buf: null, t0: performance.now() };
    this.peers.set(id, p);
    const tr = pc.addTransceiver('audio', { direction: 'sendrecv' }); p.sender = tr.sender; if (this.track) p.sender.replaceTrack(this.track).catch(() => {});
    pc.ontrack = (ev) => this._play(p, ev.streams[0] || new MediaStream([ev.track]));
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed' || pc.connectionState === 'closed') { this.close(id); setTimeout(() => this.sync(), 4000); } };
    if (offer) (async () => { try { await pc.setLocalDescription(await pc.createOffer()); await this._gathered(pc); net.send('vc', { k: 'offer', to: id, sdp: pc.localDescription.sdp }); } catch (e) { this.close(id); } })();
    return p;
  },
  // espera os candidatos ICE (até 2,5 s) para mandar tudo numa mensagem só
  _gathered(pc) { return new Promise((res) => { if (pc.iceGatheringState === 'complete') return res(); const t = setTimeout(res, 2500); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } }); }); },
  async signal(e) {
    if (!e || e.to !== net.id || typeof e.sdp !== 'string' || e.sdp.length > 20000) return; const id = e.f, G = this.G, r = G && G.remotes.get(id);
    if (!r || !this.allowed(id, r.meta)) return;
    try {
      if (e.k === 'offer') { if (this.peers.has(id)) this.close(id); if (this.peers.size >= MAX_PEERS) return; const p = this._open(id, false); await p.pc.setRemoteDescription({ type: 'offer', sdp: e.sdp }); await p.pc.setLocalDescription(await p.pc.createAnswer()); await this._gathered(p.pc); net.send('vc', { k: 'answer', to: id, sdp: p.pc.localDescription.sdp }); }
      else if (e.k === 'answer') { const p = this.peers.get(id); if (p && p.pc.signalingState === 'have-local-offer') await p.pc.setRemoteDescription({ type: 'answer', sdp: e.sdp }); }
    } catch (err) { this.close(id); }
  },
  _play(p, stream) {
    const n = audioNodes(); if (!n || p.src) return; const ctx = n.ctx;
    // o Chrome só libera o áudio remoto para o WebAudio se o stream também estiver num <audio> (mudo)
    const a = new Audio(); a.srcObject = stream; a.muted = true; a.play().catch(() => {}); p.audio = a;
    p.src = ctx.createMediaStreamSource(stream); p.gain = ctx.createGain(); p.gain.gain.value = 0; p.an = ctx.createAnalyser(); p.an.fftSize = 256; p.buf = new Uint8Array(p.an.fftSize);
    p.pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    p.src.connect(p.an); p.src.connect(p.gain); if (p.pan) { p.gain.connect(p.pan); p.pan.connect(ctx.destination); } else p.gain.connect(ctx.destination);
  },
  close(id) { const p = this.peers.get(id); if (!p) return; this.peers.delete(id); try { p.pc.close(); } catch (e) { /* já fechado */ } if (p.src) { try { p.src.disconnect(); p.gain.disconnect(); if (p.pan) p.pan.disconnect(); } catch (e) { /* ok */ } } if (p.audio) { p.audio.srcObject = null; } const r = this.G && this.G.remotes.get(id); if (r) r.talking = false; },
  closeAll() { for (const id of Array.from(this.peers.keys())) this.close(id); },
  _lvl(an, buf) { an.getByteTimeDomainData(buf); let m = 0; for (let i = 0; i < buf.length; i += 4) { const v = Math.abs(buf[i] - 128); if (v > m) m = v; } return m / 128; },
  // por quadro: volume/lado conforme a posição dos gatos e quem está falando
  update(dt, camera) {
    const G = this.G; if (!G) return; this._t = (this._t || 0) + dt;
    if (this.myAn) { this._mb = this._mb || new Uint8Array(256); this.level = this.mic ? this._lvl(this.myAn, this._mb) : 0; }
    if (!this.peers.size) return; const n = audioNodes(); if (!n) return; const ctx = n.ctx;
    const cp = camera.getWorldPosition(this._cp || (this._cp = camera.position.clone())), q = camera.getWorldQuaternion(this._cq || (this._cq = camera.quaternion.clone()));
    const fx = -2 * (q.x * q.z + q.w * q.y), fz = -(1 - 2 * (q.x * q.x + q.y * q.y)); // direção para onde a câmera olha (plano xz)
    const check = this._t > 0.15; if (check) this._t = 0;
    this.peers.forEach((p, id) => { if (!p.gain) return; const r = G.remotes.get(id); if (!r || !r.has) { p.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1); return; }
      const dx = r.x - cp.x, dz = r.z - cp.z, d = Math.hypot(dx, dz, r.y + 0.9 - cp.y), vol = G.muted(id) ? 0 : d < NEAR ? 1 : d > FAR ? 0 : Math.pow(1 - (d - NEAR) / (FAR - NEAR), 1.6);
      p.gain.gain.setTargetAtTime(vol * 1.4, ctx.currentTime, 0.08);
      if (p.pan) { const l = Math.hypot(dx, dz) || 1, side = (fx * dz - fz * dx) / l; p.pan.pan.setTargetAtTime(clamp(side * 0.85, -1, 1), ctx.currentTime, 0.08); }
      if (check) { const lv = this._lvl(p.an, p.buf), talk = lv > 0.06 && vol > 0; if (talk !== !!r.talking) { r.talking = talk; emit('talking', id, talk); } } });
  }
};
