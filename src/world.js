import * as THREE from 'three';
import { modelRaw } from './assets.js';

// Material único para todo o cenário estático (cores por vértice, sem texturas).
export const worldMat = new THREE.MeshLambertMaterial({ vertexColors: true });
let groundTex = null;
function detailTexture() {
  if (groundTex) return groundTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const id = g.createImageData(64, 64);
  let s = 1234567;
  for (let i = 0; i < 64 * 64; i++) { s = (Math.imul(s, 1103515245) + 12345) | 0; const v = 222 + ((s >>> 16) & 15) + (((i % 64) ^ ((i / 64) | 0)) & 8 ? 6 : 0); id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = Math.min(255, v); id.data[i * 4 + 3] = 255; }
  g.putImageData(id, 0, 0);
  groundTex = new THREE.CanvasTexture(c); groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping; groundTex.magFilter = THREE.NearestFilter;
  return groundTex;
}
const groundMat = new THREE.MeshLambertMaterial({ vertexColors: true });
// Uniformes compartilhados: uGloss liga o acabamento "Frutiger Aero" (borda luminosa + reflexo especular),
// uCaust liga as cáusticas animadas no fundo do lago.
export const matU = { uTiles: { value: 0 }, uGloss: { value: 0 }, uTime: { value: 0 }, uWaterY: { value: -100 }, uCaust: { value: 0 } };
export function glossify(mat, key, ground) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGloss = matU.uGloss; sh.uniforms.uTiles = matU.uTiles; sh.uniforms.uTime = matU.uTime; sh.uniforms.uWaterY = matU.uWaterY; sh.uniforms.uCaust = matU.uCaust;
    sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvWp = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif');
    sh.fragmentShader = 'uniform float uGloss;\nuniform float uTiles;\nuniform float uTime;\nuniform float uWaterY;\nuniform float uCaust;\nvarying vec3 vWp;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', [
      'if (uTiles > 0.0) {', // azulejos procedurais (Poolrooms): rejunte pelo plano dominante da superfície
      '  vec3 tn = abs(normalize(cross(dFdx(vWp), dFdy(vWp))));',
      '  vec2 tuv = tn.y > 0.5 ? vWp.xz : (tn.x > 0.5 ? vWp.zy : vWp.xy);',
      '  vec2 tf = fract(tuv / 0.5); float tl = max(step(tf.x, 0.05), step(tf.y, 0.05));',
      '  float th = fract(sin(dot(floor(tuv / 0.5), vec2(12.9898, 78.233))) * 43758.5453);',
      '  outgoingLight *= (1.0 - tl * 0.22 * uTiles) * (0.97 + th * 0.05);',
      '}',
      'if (uGloss > 0.0) {',
      '  vec3 gn = normalize(vNormal); vec3 gv = normalize(vViewPosition);',
      '  float gf = pow(1.0 - clamp(dot(gn, gv), 0.0, 1.0), 3.0);',
      '  vec3 gr = reflect(-gv, gn); float gs = pow(max(gr.y * 0.75 + gr.z * 0.3, 0.0), 22.0);',
      '  outgoingLight += uGloss * (gf * vec3(0.45, 0.8, 1.0) * ' + (ground ? '0.25' : '0.6') + ' + vec3(gs) * ' + (ground ? '0.12' : '0.55') + ');',
      '}',
      'if (uCaust > 0.0 && vWp.y < uWaterY) {',
      '  float cd = clamp((uWaterY - vWp.y) * 0.25, 0.0, 1.0);',
      '  float c1 = sin(vWp.x * 1.3 + uTime * 1.1 + sin(vWp.z * 0.9 + uTime * 0.7) * 1.6); float c2 = sin(vWp.z * 1.5 - uTime * 1.3 + sin(vWp.x * 1.1 - uTime * 0.5) * 1.4);',
      '  float ca = pow(clamp(1.0 - abs(c1 + c2) * 0.5, 0.0, 1.0), 8.0);',
      '  outgoingLight += uCaust * cd * ca * vec3(0.3, 0.5, 0.55);',
      '}',
      '#include <opaque_fragment>'].join('\n'));
  };
  mat.customProgramCacheKey = () => key;
}
glossify(worldMat, 'rvworld', false); glossify(groundMat, 'rvground', true);

const CH = 32; // tamanho do chunk (m)
const CELL = 4; // célula da grade de colisão (m)

export class World {
  constructor(scene, size) {
    this.scene = scene; this.size = size; this.half = size / 2;
    this.group = new THREE.Group(); scene.add(this.group);
    this.heightFn = () => 0;
    this.boxes = []; // 6 floats por caixa
    this.grid = null; this.gw = Math.ceil(size / CELL) + 2;
    this.chunks = new Map(); this.buildQueue = [];
    this.waterY = -100; this.surface = 'grass';
    this.extra = []; // objetos descartáveis extras
    this.dyn = []; // caixas dinâmicas (objetos colocados pelos jogadores): [x0,y0,z0,x1,y1,z1]
  }
  heightAt(x, z) { return this.heightFn(x, z); }

  // ---------- colisores ----------
  addBox(x0, y0, z0, x1, y1, z1) { this.boxes.push(x0, y0, z0, x1, y1, z1); return this.boxes.length / 6 - 1; }
  // caixa centrada (cx, base y, cz) com largura/altura/profundidade
  addBoxC(cx, y, cz, w, h, d) { return this.addBox(cx - w / 2, y, cz - d / 2, cx + w / 2, y + h, cz + d / 2); }
  buildGrid() {
    const gw = this.gw, cells = new Array(gw * gw);
    const B = this.boxes = new Float32Array(this.boxes);
    for (let i = 0; i < B.length / 6; i++) {
      const cx0 = Math.max(0, Math.floor((B[i * 6] + this.half) / CELL)), cx1 = Math.min(gw - 1, Math.floor((B[i * 6 + 3] + this.half) / CELL));
      const cz0 = Math.max(0, Math.floor((B[i * 6 + 2] + this.half) / CELL)), cz1 = Math.min(gw - 1, Math.floor((B[i * 6 + 5] + this.half) / CELL));
      for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) { const k = cz * gw + cx; (cells[k] = cells[k] || []).push(i); }
    }
    this.grid = cells;
  }
  // Resolve uma esfera contra terreno + caixas. Altera p; devolve true se tocou. out recebe a normal.
  collide(p, r, out) {
    let hit = false; let nx = 0, ny = 0, nz = 0;
    const B = this.boxes, gw = this.gw, half = this.half;
    for (let pass = 0; pass < 2; pass++) {
      let any = false;
      const cx0 = Math.max(0, Math.floor((p.x - r + half) / CELL)), cx1 = Math.min(gw - 1, Math.floor((p.x + r + half) / CELL));
      const cz0 = Math.max(0, Math.floor((p.z - r + half) / CELL)), cz1 = Math.min(gw - 1, Math.floor((p.z + r + half) / CELL));
      for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
        const list = this.grid[cz * gw + cx]; if (!list) continue;
        for (let n = 0; n < list.length; n++) {
          const i = list[n] * 6;
          const qx = p.x < B[i] ? B[i] : p.x > B[i + 3] ? B[i + 3] : p.x;
          const qy = p.y < B[i + 1] ? B[i + 1] : p.y > B[i + 4] ? B[i + 4] : p.y;
          const qz = p.z < B[i + 2] ? B[i + 2] : p.z > B[i + 5] ? B[i + 5] : p.z;
          const dx = p.x - qx, dy = p.y - qy, dz = p.z - qz; const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= r * r) continue;
          if (d2 > 1e-10) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.y += dy * k; p.z += dz * k; nx = dx / d; ny = dy / d; nz = dz / d; }
          else { // centro dentro da caixa: sai pelo eixo mais curto
            const ax = p.x - B[i], bx = B[i + 3] - p.x, ay = p.y - B[i + 1], by = B[i + 4] - p.y, az = p.z - B[i + 2], bz = B[i + 5] - p.z;
            const m = Math.min(ax, bx, by, az, bz, ay * 3);
            nx = ny = nz = 0;
            if (m === by) { p.y = B[i + 4] + r; ny = 1; } else if (m === ax) { p.x = B[i] - r; nx = -1; } else if (m === bx) { p.x = B[i + 3] + r; nx = 1; }
            else if (m === az) { p.z = B[i + 2] - r; nz = -1; } else if (m === bz) { p.z = B[i + 5] + r; nz = 1; } else { p.y = B[i + 1] - r; ny = -1; }
          }
          any = hit = true;
        }
      }
      for (let n = 0; n < this.dyn.length; n++) {
        const D = this.dyn[n];
        const qx = p.x < D[0] ? D[0] : p.x > D[3] ? D[3] : p.x, qy = p.y < D[1] ? D[1] : p.y > D[4] ? D[4] : p.y, qz = p.z < D[2] ? D[2] : p.z > D[5] ? D[5] : p.z;
        const dx = p.x - qx, dy = p.y - qy, dz = p.z - qz, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-10) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.y += dy * k; p.z += dz * k; nx = dx / d; ny = dy / d; nz = dz / d; } else { p.y = D[4] + r; nx = 0; ny = 1; nz = 0; }
        any = hit = true;
      }
      const h = this.heightFn(p.x, p.z);
      if (p.y - r < h) {
        p.y = h + r; any = hit = true;
        const e = 0.3; const gx = (this.heightFn(p.x + e, p.z) - this.heightFn(p.x - e, p.z)) / (2 * e), gz = (this.heightFn(p.x, p.z + e) - this.heightFn(p.x, p.z - e)) / (2 * e);
        const l = Math.sqrt(gx * gx + 1 + gz * gz); nx = -gx / l; ny = 1 / l; nz = -gz / l;
      }
      if (!any) break;
    }
    if (out) { out.x = nx; out.y = ny; out.z = nz; }
    return hit;
  }
  // altura do "chão" (terreno ou topo de caixa) logo abaixo de um ponto — para sombras e NPCs
  floorAt(x, y, z) {
    let best = this.heightFn(x, z);
    for (let n = 0; n < this.dyn.length; n++) { const D = this.dyn[n]; if (x >= D[0] && x <= D[3] && z >= D[2] && z <= D[5] && D[4] <= y + 0.3 && D[4] > best) best = D[4]; }
    const B = this.boxes, gw = this.gw;
    const cx = Math.floor((x + this.half) / CELL), cz = Math.floor((z + this.half) / CELL);
    if (cx < 0 || cz < 0 || cx >= gw || cz >= gw) return best;
    const list = this.grid[cz * gw + cx]; if (!list) return best;
    for (let n = 0; n < list.length; n++) { const i = list[n] * 6; if (x >= B[i] && x <= B[i + 3] && z >= B[i + 2] && z <= B[i + 5] && B[i + 4] <= y + 0.3 && B[i + 4] > best) best = B[i + 4]; }
    return best;
  }

  // ---------- terreno ----------
  buildGround(segs, colorFn) {
    const n = segs + 1, size = this.size;
    const pos = new Float32Array(n * n * 3), col = new Uint8Array(n * n * 3), uv = new Float32Array(n * n * 2);
    const c = [0, 0, 0];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = (i / segs - 0.5) * size, z = (j / segs - 0.5) * size, h = this.heightFn(x, z), k = j * n + i;
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z; uv[k * 2] = x / 3; uv[k * 2 + 1] = z / 3;
      colorFn(x, z, h, c); col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2];
    }
    const idx = new Uint16Array(segs * segs * 6); let o = 0;
    for (let j = 0; j < segs; j++) for (let i = 0; i < segs; i++) { const a = j * n + i, b = a + 1, d = a + n, e = d + 1; idx[o++] = a; idx[o++] = d; idx[o++] = b; idx[o++] = b; idx[o++] = d; idx[o++] = e; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
    if (!groundMat.map) { groundMat.map = detailTexture(); groundMat.needsUpdate = true; }
    const m = new THREE.Mesh(g, groundMat); m.receiveShadow = true; m.frustumCulled = false; this.group.add(m); this.ground = m;
    // "saia" escura além da borda, para o mapa não terminar no vazio
    return m;
  }
  addWater(y, color, mul, opacity) {
    this.waterY = y; const sz = this.size * (mul || 1), seg = 28;
    const mat = new THREE.MeshBasicMaterial({ color: color || 0x3a8fd0, transparent: true, opacity: opacity || 0.84, side: THREE.DoubleSide });
    this.waterU = { uTime: { value: 0 } };
    mat.onBeforeCompile = (sh) => { // ondas, reflexo do céu em ângulo rasante (fresnel) e cintilação do sol
      sh.uniforms.uTime = this.waterU.uTime;
      sh.vertexShader = 'uniform float uTime;\nvarying float vWave;\nvarying vec3 vWw;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat wv = sin(position.x * 0.42 + uTime * 1.3) * 0.5 + sin(position.y * 0.37 + uTime * 1.7) * 0.5 + sin((position.x + position.y) * 0.9 + uTime * 2.3) * 0.25;\ntransformed.z += wv * 0.07;\nvWave = wv;\nvWw = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'uniform float uTime;\nvarying float vWave;\nvarying vec3 vWw;\n' + sh.fragmentShader.replace('#include <color_fragment>', [
        '#include <color_fragment>',
        'vec3 wv3 = cameraPosition - vWw; float wd = length(wv3); float wf = pow(1.0 - abs(wv3.y) / max(wd, 0.001), 3.0);',
        'diffuseColor.rgb += vec3(0.16, 0.18, 0.2) * smoothstep(0.55, 1.1, vWave) + vec3(-0.05, -0.03, 0.0) * smoothstep(-0.4, -1.1, vWave);',
        'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.96, 1.0), wf * 0.55);',
        'float wg = pow(max(sin(vWw.x * 1.9 + uTime * 2.1) * sin(vWw.z * 2.3 - uTime * 1.6), 0.0), 22.0) * clamp(1.5 - wd * 0.02, 0.0, 1.0);',
        'diffuseColor.rgb += vec3(wg) * 0.6; diffuseColor.a = clamp(diffuseColor.a + wf * 0.14 + wg * 0.3, 0.0, 1.0);'].join('\n'));
    };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz, seg, seg), mat);
    m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = 1; this.group.add(m); this.water = m; return m;
  }

  // ---------- cenário estático em lotes por chunk ----------
  // opts: s (escala ou [sx,sy,sz]), ry, y (deslocamento), col ('box'|'trunk'), cs (encolhe colisor xz), tint [r,g,b] 0..2, detail (LOD: some longe)
  put(key, x, z, opts) {
    const raw = modelRaw(key); if (!raw) return null;
    opts = opts || {};
    const s = opts.s == null ? 1 : opts.s; const sx = s.length ? s[0] : s, sy = s.length ? s[1] : s, sz = s.length ? s[2] : s;
    const ry = opts.ry || 0; const y = (opts.abs != null ? opts.abs : this.heightFn(x, z)) + (opts.y || 0);
    const ck = Math.floor((x + this.half) / CH) + ',' + Math.floor((z + this.half) / CH);
    let ch = this.chunks.get(ck);
    if (!ch) { ch = { main: [], detail: [], meshes: null, cx: (Math.floor((x + this.half) / CH) + 0.5) * CH - this.half, cz: (Math.floor((z + this.half) / CH) + 0.5) * CH - this.half, state: 0 }; this.chunks.set(ck, ch); }
    (opts.detail ? ch.detail : ch.main).push({ raw, x, y, z, sx, sy, sz, ry, tint: opts.tint || null });
    const b = raw.b, cos = Math.cos(ry), sin = Math.sin(ry);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < 4; i++) { const lx = (i & 1 ? b[3] : b[0]) * sx, lz = (i & 2 ? b[5] : b[2]) * sz; const wx = lx * cos + lz * sin, wz = -lx * sin + lz * cos; if (wx < x0) x0 = wx; if (wx > x1) x1 = wx; if (wz < z0) z0 = wz; if (wz > z1) z1 = wz; }
    const box = { x0: x + x0, x1: x + x1, z0: z + z0, z1: z + z1, y0: y + b[1] * sy, y1: y + b[4] * sy };
    if (opts.col === 'box') {
      const cs = opts.cs == null ? 1 : opts.cs, mx = (box.x0 + box.x1) / 2, mz = (box.z0 + box.z1) / 2, hw = (box.x1 - box.x0) / 2 * cs, hd = (box.z1 - box.z0) / 2 * cs;
      this.addBox(mx - hw, box.y0, mz - hd, mx + hw, y + b[4] * sy * (opts.ch || 1), mz + hd);
    } else if (opts.col === 'trunk') {
      const w = opts.cw || 0.12 * sx; this.addBox(x - w, box.y0, z - w, x + w, box.y1 * 1 - (box.y1 - box.y0) * 0.1, z + w);
    }
    return box;
  }
  _merge(items) {
    const meshes = []; let start = 0;
    while (start < items.length) {
      let nv = 0, ni = 0, end = start;
      while (end < items.length && nv + items[end].raw.v <= 65535) { nv += items[end].raw.v; ni += items[end].raw.i; end++; }
      if (end === start) { start++; continue; }
      const pos = new Float32Array(nv * 3), nrm = new Int8Array(nv * 3), col = new Uint8Array(nv * 3), idx = new Uint16Array(ni);
      let vo = 0, io = 0;
      for (let n = start; n < end; n++) {
        const it = items[n], r = it.raw, P = r.pos, N = r.nrm, C = r.col, I = r.idx;
        const cos = Math.cos(it.ry), sin = Math.sin(it.ry), t = it.tint;
        const y0 = r.b[1], hgt = r.b[4] - r.b[1], ao = hgt > 0.15 ? 1 / (hgt * 0.45) : 0; // sombreado falso: base mais escura dá volume sem custo
        for (let i = 0; i < r.v; i++) {
          const px = P[i * 3] * it.sx, py = P[i * 3 + 1] * it.sy, pz = P[i * 3 + 2] * it.sz, k = (vo + i) * 3;
          pos[k] = px * cos + pz * sin + it.x; pos[k + 1] = py + it.y; pos[k + 2] = -px * sin + pz * cos + it.z;
          const ax = N[i * 3], az = N[i * 3 + 2];
          nrm[k] = ax * cos + az * sin; nrm[k + 1] = N[i * 3 + 1]; nrm[k + 2] = -ax * sin + az * cos;
          const sh = ao ? 0.7 + 0.3 * Math.min(1, (P[i * 3 + 1] - y0) * ao) : 1;
          if (t) { col[k] = Math.min(255, C[i * 3] * t[0] * sh); col[k + 1] = Math.min(255, C[i * 3 + 1] * t[1] * sh); col[k + 2] = Math.min(255, C[i * 3 + 2] * t[2] * sh); }
          else { col[k] = C[i * 3] * sh; col[k + 1] = C[i * 3 + 1] * sh; col[k + 2] = C[i * 3 + 2] * sh; }
        }
        for (let i = 0; i < r.i; i++) idx[io + i] = I[i] + vo;
        vo += r.v; io += r.i;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3, true));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3, true)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, worldMat); m.matrixAutoUpdate = false; m.castShadow = true; m.receiveShadow = true;
      meshes.push(m); start = end;
    }
    return meshes;
  }
  // Carregamento por distância: constrói no máx. um chunk por chamada, descarta os distantes.
  update(px, pz, perf) {
    const load = perf.drawDist + CH * 0.6, unload = load + CH, det = perf.detailDist;
    let best = null, bd = Infinity;
    this.chunks.forEach((ch) => {
      const dx = Math.max(0, Math.abs(ch.cx - px) - CH / 2), dz = Math.max(0, Math.abs(ch.cz - pz) - CH / 2), d = Math.sqrt(dx * dx + dz * dz);
      if (ch.state === 0) { if (d < load && d < bd) { bd = d; best = ch; } }
      else {
        if (d > unload) { this._free(ch); return; }
        const vis = d < load;
        for (let i = 0; i < ch.meshes.length; i++) ch.meshes[i].visible = vis;
        if (d < det && perf.detail) { if (!ch.dmeshes) { ch.dmeshes = this._merge(ch.detail); for (const m of ch.dmeshes) { m.castShadow = false; this.group.add(m); } } for (let i = 0; i < ch.dmeshes.length; i++) ch.dmeshes[i].visible = true; }
        else if (ch.dmeshes) { if (d > det + 12 || !perf.detail) { for (const m of ch.dmeshes) { this.group.remove(m); m.geometry.dispose(); } ch.dmeshes = null; } }
      }
    });
    if (best) { best.meshes = this._merge(best.main); for (const m of best.meshes) this.group.add(m); best.state = 1; }
    return !!best;
  }
  _free(ch) {
    if (ch.meshes) for (const m of ch.meshes) { this.group.remove(m); m.geometry.dispose(); }
    if (ch.dmeshes) for (const m of ch.dmeshes) { this.group.remove(m); m.geometry.dispose(); }
    ch.meshes = ch.dmeshes = null; ch.state = 0;
  }
  dispose() {
    this.chunks.forEach((ch) => this._free(ch)); this.chunks.clear();
    if (this.ground) this.ground.geometry.dispose();
    if (this.water) { this.water.geometry.dispose(); this.water.material.dispose(); }
    for (const o of this.extra) { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } if (o.dispose) o.dispose(); }
    this.scene.remove(this.group);
  }
}
