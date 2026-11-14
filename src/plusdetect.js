// Detector de "+" desenhado em papel (puro, sem dependências: roda no navegador e no Node para testes).
// Aceita qualquer estilo: grosso, fino, caneta colorida, contorno vazado, girado (inclusive "x"), torto à mão
// e "+" claro em papel escuro. Ideia: limiar adaptativo -> componentes conectados -> para cada mancha, a massa
// afastada do centro tem que se concentrar em 4 braços a 90° (forte em 4θ, fraca em 2θ, e os 4 setores cheios).
export function detectPlus(rgba, W, H, opt) {
  opt = opt || {}; const N = W * H, lum = new Float32Array(N), sat = new Float32Array(N);
  for (let i = 0, j = 0; i < N; i++, j += 4) { const r = rgba[j], g = rgba[j + 1], b = rgba[j + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b); lum[i] = 0.3 * r + 0.59 * g + 0.11 * b; sat[i] = mx > 0 ? (mx - mn) / mx : 0; }
  // média local por imagem integral (janela ~1/6 da largura)
  const ii = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += lum[y * W + x]; ii[(y + 1) * (W + 1) + x + 1] = ii[y * (W + 1) + x + 1] + row; } }
  const R = Math.max(4, Math.round(W / 12)), mean = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const x0 = Math.max(0, x - R), x1 = Math.min(W, x + R + 1), y0 = Math.max(0, y - R), y1 = Math.min(H, y + R + 1); mean[y * W + x] = (ii[y1 * (W + 1) + x1] - ii[y0 * (W + 1) + x1] - ii[y1 * (W + 1) + x0] + ii[y0 * (W + 1) + x0]) / ((x1 - x0) * (y1 - y0)); }
  let best = null;
  for (const inv of opt.inverted == null ? [false, true] : [!!opt.inverted]) {
    const bin = new Uint8Array(N);
    for (let i = 0; i < N; i++) { const m = mean[i], l = lum[i]; bin[i] = inv ? (l > m * 1.18 + 5 ? 1 : 0) : (l < m * 0.9 - 2 || (sat[i] > 0.38 && l < m * 0.97) ? 1 : 0); }
    const c = bestComponent(bin, W, H); if (c && (!best || c.score > best.score)) { best = c; best.inverted = inv; }
    if (best && best.score > 0.6) break;
  }
  return best;
}
function bestComponent(bin, W, H) {
  const N = W * H, lab = new Int32Array(N), stack = new Int32Array(N); let id = 0, best = null;
  for (let s = 0; s < N; s++) {
    if (!bin[s] || lab[s]) continue; id++; let sp = 0, n = 0; stack[sp++] = s; lab[s] = id; const px = [];
    while (sp) { const p = stack[--sp]; px.push(p); n++; const x = p % W, y = (p / W) | 0;
      if (x > 0 && bin[p - 1] && !lab[p - 1]) { lab[p - 1] = id; stack[sp++] = p - 1; } if (x < W - 1 && bin[p + 1] && !lab[p + 1]) { lab[p + 1] = id; stack[sp++] = p + 1; }
      if (y > 0 && bin[p - W] && !lab[p - W]) { lab[p - W] = id; stack[sp++] = p - W; } if (y < H - 1 && bin[p + W] && !lab[p + W]) { lab[p + W] = id; stack[sp++] = p + W; } }
    if (n < 30 || n > N * 0.3) continue;
    const c = shape(px, W, H); if (c && (!best || c.score > best.score)) best = c;
  }
  return best;
}
export function shape(px, W, H) {
  let sx = 0, sy = 0, x0 = W, x1 = 0, y0 = H, y1 = 0; for (const p of px) { const x = p % W, y = (p / W) | 0; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x0 === 0 || y0 === 0 || x1 === W - 1 || y1 === H - 1) return null; // cortado pela borda da imagem
  // centro: centro da caixa envolvente (mais estável que o centroide em "+" tortos)
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rs = [];
  for (const p of px) rs.push(Math.hypot(p % W - cx, ((p / W) | 0) - cy)); const sorted = rs.slice().sort((a, b) => a - b), rmax = sorted[Math.floor(sorted.length * 0.97)];
  if (rmax < 6) return null;
  // braços: só a massa longe do centro conta
  let c4 = 0, s4 = 0, c2 = 0, s2 = 0, wsum = 0; const ang = [];
  for (let k = 0; k < px.length; k++) { const r = rs[k]; if (r < rmax * 0.45) continue; const p = px[k], a = Math.atan2(((p / W) | 0) - cy, p % W - cx), w = r * r; c4 += w * Math.cos(4 * a); s4 += w * Math.sin(4 * a); c2 += w * Math.cos(2 * a); s2 += w * Math.sin(2 * a); wsum += w; ang.push([a, w]); }
  if (wsum <= 0) return null; const R4 = Math.hypot(c4, s4) / wsum, R2 = Math.hypot(c2, s2) / wsum, phi = Math.atan2(s4, c4) / 4;
  // os 4 setores (braços) precisam ter massa parecida
  const sec = [0, 0, 0, 0]; for (const [a, w] of ang) { let d = a - phi; d = ((d % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); const k = Math.round(d / (Math.PI / 2)) % 4, off = Math.abs(d - k * Math.PI / 2); if (Math.min(off, 2 * Math.PI - off) < 0.5) sec[k] += w; }
  const mn = Math.min(...sec) / (wsum / 4);
  // um "+" ocupa pouco da caixa (cantos vazios); quadrado/círculo cheios não passam
  const box = (x1 - x0 + 1) * (y1 - y0 + 1), fill = px.length / box, aspect = (x1 - x0 + 1) / (y1 - y0 + 1);
  if (shape.debug) shape.debug.push({ n: px.length, R4: +R4.toFixed(2), R2: +R2.toFixed(2), mn: +mn.toFixed(2), fill: +fill.toFixed(2), aspect: +aspect.toFixed(2) });
  if (R4 < 0.38 || R2 > 0.5 || mn < 0.35 || fill > 0.72 || aspect < 0.45 || aspect > 2.2) return null;
  const score = R4 * (1 - R2) * Math.min(1, mn) * Math.min(1, Math.sqrt(px.length) / 20);
  return { x: cx, y: cy, r: rmax, ang: phi, score, R4, R2, arms: mn, fill, n: px.length };
}
