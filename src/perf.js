// "Thermal Controller": o navegador NÃO expõe sensores de temperatura, então a carga
// é inferida só por FPS / tempo de quadro (e heap JS quando disponível). Quando o
// desempenho cai, reduz resolução, distância de desenho, detalhes, partículas,
// sombras e taxa de rede; quando sobra folga por tempo suficiente, volta a subir.
const LEVELS = [
  { scale: 0.6, drawDist: 42, detail: false, detailDist: 0, particles: 0.25, shadows: 0, animDist: 10, netHz: 6, tagDist: 10 },
  { scale: 0.75, drawDist: 58, detail: true, detailDist: 16, particles: 0.5, shadows: 1, animDist: 18, netHz: 8, tagDist: 16 },
  { scale: 0.9, drawDist: 82, detail: true, detailDist: 28, particles: 1, shadows: 1, animDist: 28, netHz: 10, tagDist: 22 },
  { scale: 1.0, drawDist: 120, detail: true, detailDist: 45, particles: 1, shadows: 2, animDist: 45, netHz: 12, tagDist: 30 }
];
const PROFILES = { performance: { max: 1, fb: 0.75, name: 'Performance' }, balanced: { max: 2, fb: 0.9, name: 'Balanced' }, quality: { max: 3, fb: 1.0, name: 'Quality' } };
export const perf = Object.assign({
  profile: 'balanced', level: 2, auto: true, fps: 60, ms: 16.7, target: 60, load: 0, heapMB: 0, drops: 0,
  _acc: 0, _n: 0, _worst: 0, _t: 0, _good: 0, _need: 10, _cool: 0, _apply: null, status: 'estável',
  profiles: PROFILES,
  setProfile(p) { if (!PROFILES[p]) return; this.profile = p; this.level = Math.min(this.level, PROFILES[p].max); if (p === 'quality') this.level = PROFILES[p].max; this._need = 10; this.apply(); },
  fbScale() { return PROFILES[this.profile].fb; },
  apply() { Object.assign(this, LEVELS[this.level]); if (this._apply) this._apply(this); },
  onApply(fn) { this._apply = fn; },
  // chamado a cada quadro com dt em segundos
  tick(dt) {
    if (dt > 0.5) return; // aba em segundo plano / carregamento
    const ms = dt * 1000; this._acc += ms; this._n++; if (ms > this._worst) this._worst = ms; this._t += dt; this._cool -= dt;
    if (this._t < 1.5) return;
    const avg = this._acc / this._n; this.ms = avg; this.fps = 1000 / avg; const budget = 1000 / this.target;
    this.load = Math.min(1.5, avg / budget);
    const mem = self.performance && performance.memory; let memHigh = false;
    if (mem) { this.heapMB = Math.round(mem.usedJSHeapSize / 1048576); memHigh = mem.usedJSHeapSize > mem.jsHeapSizeLimit * 0.85; }
    this._acc = this._n = this._worst = this._t = 0;
    if (!this.auto) { this.status = 'manual'; return; }
    if ((avg > budget * 1.18 || memHigh) && this._cool <= 0) {
      if (this.level > 0) { this.level--; this.drops++; this._need = Math.min(120, this._need * 2); this._cool = 3; this.apply(); }
      this._good = 0; this.status = 'reduzindo carga';
    } else if (avg < budget * 1.05) {
      this._good += 1.5; this.status = 'estável';
      if (this._good >= this._need && this.level < PROFILES[this.profile].max) { this.level++; this._good = 0; this._cool = 3; this.apply(); this.status = 'subindo qualidade'; }
    } else { this._good = 0; this.status = 'no limite'; }
  }
}, LEVELS[2]);
