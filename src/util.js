export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export function angDiff(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
// ruído de valor 2D barato e determinístico
function h2(x, z, s) { let n = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(s, 982451653); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
export function noise2(x, z, seed) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = smooth(x - xi), fz = smooth(z - zi);
  const a = h2(xi, zi, seed), b = h2(xi + 1, zi, seed), c = h2(xi, zi + 1, seed), d = h2(xi + 1, zi + 1, seed);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
}
export function fbm(x, z, seed, oct) {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < (oct || 3); i++) { v += a * noise2(x * f, z * f, seed + i * 17); a *= 0.5; f *= 2; }
  return v;
}
export function uuid() {
  const b = new Uint8Array(16); (self.crypto || self.msCrypto).getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = []; for (let i = 0; i < 16; i++) h.push((b[i] + 256).toString(16).slice(1));
  return h.slice(0, 4).join('') + '-' + h.slice(4, 6).join('') + '-' + h.slice(6, 8).join('') + '-' + h.slice(8, 10).join('') + '-' + h.slice(10).join('');
}
export function randHex(n) { const b = new Uint8Array(n); self.crypto.getRandomValues(b); let s = ''; for (let i = 0; i < n; i++) s += (b[i] + 256).toString(16).slice(1); return s; }
export function dayKey(ms) { const d = new Date(ms || Date.now()); return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); }
export const store = {
  get(k, def) { try { const v = localStorage.getItem('rv_' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem('rv_' + k, JSON.stringify(v)); } catch (e) { /* armazenamento indisponível */ } }
};
// barramento de eventos do jogo
const subs = {};
export function on(ev, fn) { (subs[ev] = subs[ev] || []).push(fn); }
export function emit(ev, a, b, c) { const l = subs[ev]; if (l) for (let i = 0; i < l.length; i++) l[i](a, b, c); }
