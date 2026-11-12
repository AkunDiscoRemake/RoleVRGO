// Reduz a textura "light_01" do Kenney Particle Pack para 64x64 (assets/glow.png).
import { PNG } from 'pngjs'; import fs from 'node:fs';
const src = PNG.sync.read(fs.readFileSync(process.argv[2])); const N = 64, f = src.width / N; const out = new PNG({ width: N, height: N });
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let a = 0, n = 0; for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) { const o = ((Math.floor(y * f) + j) * src.width + Math.floor(x * f) + i) * 4; a += src.data[o + 3] * (src.data[o] / 255); n++; } const o = (y * N + x) * 4; out.data[o] = out.data[o + 1] = out.data[o + 2] = 255; out.data[o + 3] = Math.round(a / n); }
fs.writeFileSync(process.argv[3], PNG.sync.write(out));
