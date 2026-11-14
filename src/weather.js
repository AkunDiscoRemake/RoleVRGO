import * as THREE from 'three';
import { net } from './net.js';
import { hashStr, clamp, emit } from './util.js';

// Clima e estações. O clima muda a cada 8 minutos e é calculado a partir do relógio da rede:
// todos da mesma sala/mapa veem o mesmo tempo, sem servidor. Cada mapa só tem climas que fazem sentido.
// Estações (Natal, Halloween, Ano Novo) vêm da data real do aparelho.
export const KINDS = {
  clear: { n: 'Céu limpo', i: '☀️', dark: 0, amb: '', fog: 0 },
  cloudy: { n: 'Nublado', i: '⛅', dark: 0.25, amb: '', fog: 0.1 },
  rain: { n: 'Chuva', i: '🌧️', dark: 0.58, amb: 'rain', fog: 0.25, wet: 1, snd: { rain: 0.9 } },
  storm: { n: 'Tempestade', i: '⛈️', dark: 0.8, amb: 'rain', fog: 0.35, wet: 1, bolt: 1, snd: { rain: 1, wind: 0.7 } },
  fog: { n: 'Neblina', i: '🌫️', dark: 0.18, amb: '', fog: 0.75, snd: { wind: 0.2 } },
  snow: { n: 'Nevasca', i: '🌨️', dark: 0.38, amb: 'snow', fog: 0.45, snd: { wind: 0.6 } },
  sand: { n: 'Tempestade de areia', i: '🌪️', dark: 0.6, amb: 'dust', fog: 0.85, tint: 0xc8a060, snd: { wind: 1 } }
};
// pesos por mapa (mapas fechados ou com clima próprio não entram)
const TABLE = {
  village: { clear: 5, cloudy: 3, rain: 2, storm: 1, fog: 1 }, forest: { clear: 4, cloudy: 2, rain: 3, storm: 1, fog: 2 }, desert: { clear: 7, cloudy: 1, sand: 3 },
  snow: { clear: 3, cloudy: 2, snow: 5, fog: 1 }, arena: { clear: 6, cloudy: 2, rain: 1 }, castle: { clear: 4, cloudy: 3, rain: 2, storm: 1, fog: 2 }, city: { clear: 4, cloudy: 3, rain: 3, storm: 1 },
  island: { clear: 6, cloudy: 2, rain: 2, storm: 1 }, training: { clear: 6, cloudy: 2, rain: 1 }, aero: { clear: 8, cloudy: 1, rain: 1 }, nuke: { clear: 2, cloudy: 3, fog: 3, storm: 1 }, sky: { clear: 6, cloudy: 3, fog: 1 }
};
const BLOCK = 8 * 60000;
export const weather = {
  kind: 'clear', k: 0, map: null, force: null, season: null, _last: '',
  seasonNow(d) { d = d || new Date(); const m = d.getMonth() + 1, day = d.getDate(); if ((m === 12 && day === 31) || (m === 1 && day === 1)) return 'newyear'; if (m === 12) return 'xmas'; if ((m === 10 && day >= 20) || (m === 11 && day <= 2)) return 'halloween'; return null; },
  pick(map, block) {
    const t = TABLE[map]; if (!t) return 'clear'; const tab = Object.assign({}, t);
    if (this.season === 'xmas' && map !== 'desert' && map !== 'aero' && map !== 'island') tab.snow = (tab.snow || 0) + 6; // Natal: neve em quase todo lugar
    if (this.season === 'halloween') tab.fog = (tab.fog || 0) + 4;
    let tot = 0; for (const k in tab) tot += tab[k]; let x = (hashStr(map + ':' + block) % 10000) / 10000 * tot; for (const k in tab) { x -= tab[k]; if (x <= 0) return k; } return 'clear';
  },
  // atualiza por quadro: tipo e intensidade (sobe/desce em ~25 s na troca)
  update(dt, map, def) {
    this.season = this.seasonNow(); const now = net.online ? net.now() : Date.now(), block = Math.floor(now / BLOCK), into = (now % BLOCK) / 1000;
    let want = def && (def.indoor || def.custom || def.home) ? 'clear' : this.force || this.pick(map, block);
    if (map !== this.map) { this.map = map; this.kind = want; this.k = want === 'clear' ? 0 : 1; this._last = map + want; return; }
    const next = this.force || this.pick(map, block + 1), fadeOut = (BLOCK / 1000 - into) < 25 && next !== want;
    if (want !== this.kind) { this.k = Math.max(0, this.k - dt / 6); if (this.k <= 0.01) { this.kind = want; } } else this.k = Math.min(1, this.k + dt / 25);
    if (fadeOut) this.k = Math.min(this.k, (BLOCK / 1000 - into) / 25);
    const key = map + this.kind; if (key !== this._last && this.k > 0.2) { this._last = key; if (this.kind !== 'clear') emit('toast', KINDS[this.kind].i + ' ' + KINDS[this.kind].n + ' chegando…', '#bfe6ff'); }
  },
  info() { return KINDS[this.kind] || KINDS.clear; },
  levels() { const i = this.info(); if (!i.snd || this.k <= 0.02) return null; const o = {}; for (const k in i.snd) o[k] = i.snd[k] * this.k; return o; },
  // parâmetros que o céu usa (cor acinzentada, quanto escurece e quanto de neblina)
  wx() { const i = this.info(), k = this.k; const o = this._wx || (this._wx = { c: new THREE.Color(), d: 0, fog: 0 }); o.c.setHex(i.tint || 0x6a7280); o.d = i.dark * k; o.fog = i.fog * k; return o; }
};

// decorações automáticas das datas comemorativas (a Vila ganha mais; nos outros mapas, só os NPCs se fantasiam)
export function decorate(season, id, w, E) {
  if (!season) return;
  const hat = season === 'xmas' ? 6 : season === 'halloween' ? 8 : 1;
  for (const n of E.npcs) if (n.look) n.look = Object.assign({}, n.look, { hat });
  if (id !== 'village') return;
  const R = 18.5, day = Math.floor(Date.now() / 86400000);
  if (season === 'xmas') {
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2, x = Math.cos(a) * R, z = Math.sin(a) * R; w.put('holiday/tree-decorated-snow', x, z, { s: 1.9, col: 'box', cs: 0.6 }); E.lamp(x, w.heightAt(x, z) + 4.6, z, [0xff4040, 0x40ff80, 0xffe040, 0x40a0ff][i % 4]); }
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, x = Math.cos(a) * 4.6, z = Math.sin(a) * 4.6, c = [[1.6, 0.3, 0.3], [0.3, 1.4, 0.4], [0.4, 0.6, 1.6], [1.6, 1.4, 0.3]][i % 4]; w.put('prim/box', x, z, { s: [0.6, 0.5, 0.6], ry: a, tint: c, col: 'box' }); }
    w.put('holiday/snowman-hat', 6, 9, { s: 1.4, col: 'box' }); w.put('holiday/sled', -6, 9, { s: 2.2, col: 'box' }); w.put('holiday/reindeer', -8, 10.5, { s: 2.2, col: 'box' });
    E.sign('🎄 Feliz Natal!', 0, 6.2, 7); E.chest('xmas' + day, 2.2, w.heightAt(2.2, 8) + 0.05, 8, 2);
  } else if (season === 'halloween') {
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + 0.1, x = Math.cos(a) * R, z = Math.sin(a) * R; w.put('grave/pumpkin-tall-carved', x, z, { s: 2.6, col: 'box' }); E.lamp(x, w.heightAt(x, z) + 1, z, 0xff8a20); }
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.5; w.put(i % 2 ? 'grave/gravestone-cross' : 'grave/gravestone-round', Math.cos(a) * 27, Math.sin(a) * 27, { s: 2.4, col: 'box', ry: -a }); }
    E.sign('🎃 Feliz Halloween!', 0, 6.2, 7); E.chest('hw' + day, 2.2, w.heightAt(2.2, 8) + 0.05, 8, 2);
  } else if (season === 'newyear') { E.sign('🎆 Feliz Ano Novo!', 0, 6.2, 7); }
}
