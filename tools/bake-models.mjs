// Bake dos modelos Kenney (GLB) -> assets/models.bin + assets/models.json
// Cada modelo vira geometria única com cores por vértice (a textura-paleta é
// amostrada aqui), para o jogo rodar com UM material e zero texturas de modelo.
// Uso: KENNEY_DIR=/caminho/para/kits node tools/bake-models.mjs [--info]
import { NodeIO } from '@gltf-transform/core';
import { KHRTextureTransform, KHRMaterialsUnlit } from '@gltf-transform/extensions';
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.env.KENNEY_DIR;
if (!root) { console.error('Defina KENNEY_DIR'); process.exit(1); }
const manifest = JSON.parse(fs.readFileSync(path.join(here, 'models.json'), 'utf8'));
const info = process.argv.includes('--info');
const io = new NodeIO().registerExtensions([KHRTextureTransform, KHRMaterialsUnlit]);
const kitDirs = {
  nature: 'nature-kit/Models/GLTF format', town: 'fantasy-town-kit/Models/GLB format',
  castle: 'castle-kit/Models/GLB format', city: 'city-kit-commercial/Models/GLB format',
  pirate: 'pirate-kit/Models/GLB format', survival: 'survival-kit/Models/GLB format',
  arena: 'mini-arena/Models/GLB format', holiday: 'holiday-kit/Models/GLB format',
  plat: 'platformer-kit/Models/GLB format', dungeon: 'mini-dungeon/Models/GLB format',
  grave: 'graveyard-kit/Models/GLB format'
};
const lin2srgb = (c) => Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)));
const texCache = new Map();
function decode(tex) {
  if (texCache.has(tex)) return texCache.get(tex);
  let img = null;
  try { img = PNG.sync.read(Buffer.from(tex.getImage())); } catch (e) { img = null; }
  texCache.set(tex, img);
  return img;
}
function mulMat(m, x, y, z, w) {
  return [m[0] * x + m[4] * y + m[8] * z + m[12] * w, m[1] * x + m[5] * y + m[9] * z + m[13] * w, m[2] * x + m[6] * y + m[10] * z + m[14] * w];
}

const chunks = []; const index = {}; let offset = 0;
for (const key of manifest) {
  const [kit, name] = key.split('/');
  const file = path.join(root, kitDirs[kit], name + '.glb');
  if (!fs.existsSync(file)) { console.error('FALTA', key); continue; }
  const doc = await io.read(file);
  const P = [], N = [], C = [], I = [];
  const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
  scene.traverse((node) => {
    const mesh = node.getMesh(); if (!mesh) return;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION'); if (!pos) continue;
      const nrm = prim.getAttribute('NORMAL'); const uv = prim.getAttribute('TEXCOORD_0'); const vc = prim.getAttribute('COLOR_0');
      const mat = prim.getMaterial();
      const f = mat ? mat.getBaseColorFactor() : [1, 1, 1, 1];
      const tex = mat ? mat.getBaseColorTexture() : null;
      const img = tex ? decode(tex) : null;
      const ti = tex ? mat.getBaseColorTextureInfo() : null;
      const tt = ti ? ti.getExtension('KHR_texture_transform') : null;
      const tOff = tt ? tt.getOffset() : [0, 0], tSc = tt ? tt.getScale() : [1, 1], tRot = tt ? tt.getRotation() : 0;
      const base = P.length / 3;
      const p = [0, 0, 0], n = [0, 0, 0], t = [0, 0], c = [1, 1, 1, 1];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, p); const w = mulMat(m, p[0], p[1], p[2], 1); P.push(w[0], w[1], w[2]);
        if (nrm) { nrm.getElement(i, n); const q = mulMat(m, n[0], n[1], n[2], 0); const l = Math.hypot(q[0], q[1], q[2]) || 1; N.push(q[0] / l, q[1] / l, q[2] / l); } else N.push(0, 1, 0);
        let r = lin2srgb(f[0]), g = lin2srgb(f[1]), b = lin2srgb(f[2]);
        if (img && uv) {
          uv.getElement(i, t);
          const su = t[0] * tSc[0], sv = t[1] * tSc[1], cr = Math.cos(tRot), sr = Math.sin(tRot);
          let u = cr * su + sr * sv + tOff[0], v = -sr * su + cr * sv + tOff[1];
          u -= Math.floor(u); v -= Math.floor(v);
          const x = Math.min(img.width - 1, Math.floor(u * img.width)), y = Math.min(img.height - 1, Math.floor(v * img.height));
          const o = (y * img.width + x) * 4;
          r = Math.round(img.data[o] * f[0]); g = Math.round(img.data[o + 1] * f[1]); b = Math.round(img.data[o + 2] * f[2]);
        }
        if (vc) { vc.getElement(i, c); r = Math.round(r * c[0]); g = Math.round(g * c[1]); b = Math.round(b * c[2]); }
        C.push(r, g, b);
      }
      const ind = prim.getIndices();
      if (ind) for (let i = 0; i < ind.getCount(); i++) I.push(base + ind.getScalar(i));
      else for (let i = 0; i < pos.getCount(); i++) I.push(base + i);
    }
  });
  const nv = P.length / 3;
  const bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) { bb[k] = Math.min(bb[k], P[i * 3 + k]); bb[k + 3] = Math.max(bb[k + 3], P[i * 3 + k]); }
  if (info) { console.log(key.padEnd(40), 'v', String(nv).padStart(5), 'tri', String(I.length / 3).padStart(5), 'bb', bb.map((v) => v.toFixed(2)).join(' ')); continue; }
  if (nv > 65535) { console.error('GRANDE DEMAIS', key); continue; }
  const pad4 = (n) => (n + 3) & ~3;
  const size = nv * 12 + pad4(nv * 3) + pad4(nv * 3) + pad4(I.length * 2);
  const buf = Buffer.alloc(size); let o = 0;
  for (let i = 0; i < P.length; i++) { buf.writeFloatLE(P[i], o); o += 4; }
  for (let i = 0; i < N.length; i++) buf.writeInt8(Math.max(-127, Math.min(127, Math.round(N[i] * 127))), o + i); o += pad4(nv * 3);
  for (let i = 0; i < C.length; i++) buf.writeUInt8(Math.max(0, Math.min(255, C[i])), o + i); o += pad4(nv * 3);
  for (let i = 0; i < I.length; i++) buf.writeUInt16LE(I[i], o + i * 2);
  index[key] = { o: offset, v: nv, i: I.length, b: bb.map((v) => +v.toFixed(3)) };
  chunks.push(buf); offset += size;
}
if (!info) {
  const out = path.join(here, '..', 'assets');
  fs.writeFileSync(path.join(out, 'models.bin'), Buffer.concat(chunks));
  fs.writeFileSync(path.join(out, 'models.json'), JSON.stringify(index));
  console.log('modelos:', Object.keys(index).length, 'bytes:', offset);
}
