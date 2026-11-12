import { audioNodes } from './assets.js';
import { store } from './util.js';

// Música/ambiente de fundo gerada em tempo real com osciladores (sem arquivos):
// um "pad" de acordes lentos + sininhos em arpejo com eco. Cada mapa tem tom, escala e ritmo próprios.
const M = (root, scale, prog, bpm, bell, o) => Object.assign({ root, scale, prog, bpm, bell }, o || {});
const MAJ = [0, 2, 4, 7, 9], MIN = [0, 3, 5, 7, 10], LYD = [0, 2, 4, 6, 7, 9, 11], DOR = [0, 2, 3, 5, 7, 9, 10], PHR = [0, 1, 4, 5, 7, 8, 10];
const MOODS = {
  village: M(60, MAJ, [0, 5, 7, 5], 76, 0.45), forest: M(57, MIN, [0, 3, 7, 5], 60, 0.3), mine: M(50, MIN, [0, 0, 3, 5], 52, 0.18, { dark: 1 }),
  desert: M(52, PHR, [0, 1, 0, 5], 64, 0.3), snow: M(65, LYD, [0, 7, 2, 7], 58, 0.5), arena: M(50, DOR, [0, 5, 3, 7], 96, 0.35),
  castle: M(55, DOR, [0, 7, 5, 3], 68, 0.3), city: M(58, MAJ, [0, 9, 5, 7], 88, 0.4), island: M(67, MAJ, [0, 5, 0, 7], 84, 0.55),
  training: M(62, MAJ, [0, 7, 5, 7], 92, 0.4), aero: M(64, LYD, [0, 4, 9, 7], 92, 0.8, { bright: 1, bubbles: 1 })
};
export const music = {
  on: store.get('music', true), mood: null, t: 0, beat: 0, timer: null, gain: null, delay: null,
  start() {
    const n = audioNodes(); if (!n || this.timer) return; const ctx = n.ctx;
    this.gain = ctx.createGain(); this.gain.gain.value = this.on ? 0.5 : 0; this.gain.connect(n.master);
    this.delay = ctx.createDelay(1); this.delay.delayTime.value = 0.33; const fb = ctx.createGain(); fb.gain.value = 0.35; this.delay.connect(fb); fb.connect(this.delay); this.delay.connect(this.gain);
    this.t = ctx.currentTime + 0.3; this.timer = setInterval(() => this.tick(), 200);
  },
  setOn(v) { this.on = v; store.set('music', v); const n = audioNodes(); if (this.gain && n) this.gain.gain.setTargetAtTime(v ? 0.5 : 0, n.ctx.currentTime, 0.3); },
  setMap(id) { this.mood = MOODS[id] || MOODS.village; this.beat = 0; },
  note(midi) { return 440 * Math.pow(2, (midi - 69) / 12); },
  tick() {
    const n = audioNodes(); if (!n || !this.mood || !this.on || n.ctx.state !== 'running') { if (n) this.t = n.ctx.currentTime + 0.3; return; }
    const ctx = n.ctx, m = this.mood, spb = 60 / m.bpm;
    while (this.t < ctx.currentTime + 0.5) {
      const t = this.t, b = this.beat;
      if (b % 8 === 0) { const deg = m.prog[(b / 8) % m.prog.length]; for (const iv of [0, 7, m.bright ? 16 : 15, m.bright ? 23 : 19]) this.pad(m.root - 12 + deg + iv - (iv > 12 ? 12 : 0), t, spb * 8.4, m); }
      if (Math.random() < m.bell) { const sc = m.scale, deg = m.prog[Math.floor(b / 8) % m.prog.length]; this.bell(m.root + 12 + deg + sc[Math.floor(Math.random() * sc.length)] + (Math.random() < 0.3 ? 12 : 0), t, m); }
      if (m.bubbles && Math.random() < 0.22) this.bubble(t + Math.random() * spb * 0.5);
      this.t += spb / 2; this.beat++;
    }
  },
  pad(midi, t, dur, m) { const n = audioNodes(), ctx = n.ctx, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = this.note(midi); o2.frequency.value = this.note(midi) * 1.004; f.type = 'lowpass'; f.frequency.value = m.dark ? 500 : m.bright ? 1800 : 1100;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.045, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur); o.connect(f); o2.connect(f); f.connect(g); g.connect(this.gain); o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05); },
  bell(midi, t, m) { const n = audioNodes(), ctx = n.ctx, o = ctx.createOscillator(), g = ctx.createGain(); o.type = m.bright ? 'sine' : 'triangle'; o.frequency.value = this.note(midi); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(m.bright ? 0.09 : 0.06, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9); o.connect(g); g.connect(this.gain); g.connect(this.delay); o.start(t); o.stop(t + 1); },
  bubble(t) { const n = audioNodes(), ctx = n.ctx, o = ctx.createOscillator(), g = ctx.createGain(), f0 = 500 + Math.random() * 900; o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 2.2, t + 0.09); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11); o.connect(g); g.connect(this.gain); o.start(t); o.stop(t + 0.13); }
};
