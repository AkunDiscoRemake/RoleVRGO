// Host dos scripts e mods: cria o iframe sandbox, recebe comandos (criar/alterar Parts, GUI, sons, efeitos...)
// e aplica no jogo. Scripts e mods NUNCA rodam no contexto da página: não veem a conta, o login nem o save.
import * as THREE from 'three';
import { PRELUDE, iframeBoot, luauToLua } from './runtime.js';
import { emit } from '../util.js';
import { S } from '../state.js';
import { play } from '../assets.js';

const VENDOR = () => new URL('assets/vendor/fengari-web.js', document.baseURI).href;
const MAX_PARTS = 600;
const geoms = { Block: new THREE.BoxGeometry(1, 1, 1), Ball: new THREE.SphereGeometry(0.5, 16, 12), Cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 16) };
geoms.Cylinder.rotateZ(Math.PI / 2); // no Roblox o cilindro deita no eixo X
const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

export const host = {
  G: null, frame: null, mods: [], parts: new Map(), gui: new Map(), touching: new Set(), log: [], running: false, ready: false, studio: false, guiRoot: null, sounds: new Map(), extra: [],
  start(G, scripts, mods, opts) {
    this.stop(); this.G = G; this.studio = !!(opts && opts.studio); this.log = []; this.running = true;
    const list = (scripts || []).filter((s) => s && s.src && s.on !== false).map((s) => ({ n: s.n || 'Script', src: luauToLua(s.src) }));
    if (list.length) this._bootLua(list);
    for (const m of mods || []) if (m && m.html && m.on !== false) this._bootMod(m);
    if (!this._lis) { this._lis = (ev) => this._msg(ev); addEventListener('message', this._lis); }
    if (!this._keys) { this._keys = (e) => { if (!this.running || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return; if (e.repeat) return; this._send({ op: 'key', a: e.code, b: e.type === 'keydown' ? 1 : 0 }); }; addEventListener('keydown', this._keys); addEventListener('keyup', this._keys); }
    if (list.length || (mods && mods.length)) this.print('info', '▶ ' + list.length + ' script(s) e ' + (mods || []).length + ' mod(s) rodando (isolados em sandbox)');
  },
  _bootLua(list) {
    const f = this.frame = document.createElement('iframe'); f.setAttribute('sandbox', 'allow-scripts'); f.style.display = 'none'; f.title = 'scripts';
    f.srcdoc = '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' \'unsafe-eval\' ' + new URL(VENDOR()).origin + '">' + '<script src="' + VENDOR() + '"></script><script>(' + iframeBoot.toString() + ')()</script>';
    f.onload = () => f.contentWindow.postMessage({ __rvh: 1, op: 'boot', prelude: PRELUDE, scripts: list }, '*');
    document.body.appendChild(f);
  },
  // mod HTML/CSS/JS: página visível por cima do jogo, com a API RoleVRGO (window.rv) injetada
  _bootMod(m) {
    const f = document.createElement('iframe'); f.setAttribute('sandbox', 'allow-scripts'); f.title = m.n || 'mod'; f.className = 'rvmod';
    Object.assign(f.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', border: '0', background: 'transparent', zIndex: 15, pointerEvents: m.interactive ? 'auto' : 'none' }); f.allowTransparency = 'true';
    const csp = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' \'unsafe-eval\'; style-src \'unsafe-inline\'; img-src data: blob:; media-src data: blob:; font-src data:">'; // sem rede: mods da comunidade não conseguem rastrear ninguém
    const api = csp + '<script>(' + modApi.toString() + ')()</script>';
    f.srcdoc = /<head[^>]*>/i.test(m.html) ? m.html.replace(/<head[^>]*>/i, (h) => h + api) : api + m.html;
    document.body.appendChild(f); this.mods.push({ f, m });
  },
  stop() {
    if (this.frame) { this.frame.remove(); this.frame = null; } for (const x of this.mods) x.f.remove(); this.mods = [];
    for (const [, p] of this.parts) this._dropPart(p); this.parts.clear(); for (const e of this.extra) { if (e.parent) e.parent.remove(e); } this.extra = [];
    if (this.guiRoot) { this.guiRoot.remove(); this.guiRoot = null; } this.gui.clear(); this.touching.clear();
    if (this.G) { const P = this.G.player; P.scriptWalk = 1; P.scriptJump = 1; this.G.scriptFly = false; this.G.scriptGrav = null; this.G.scriptTime = null; }
    if (this.running) { this.running = false; emit('studioLog'); }
  },
  print(lvl, msg) { this.log.push({ lvl, msg: String(msg).slice(0, 500), t: Date.now() }); if (this.log.length > 300) this.log.shift(); emit('studioLog'); if (lvl === 'error' && !this.studio) console.warn('[script]', msg); },
  _send(m) { m.__rvh = 1; if (this.frame && this.frame.contentWindow) this.frame.contentWindow.postMessage(m, '*'); for (const x of this.mods) if (x.f.contentWindow) x.f.contentWindow.postMessage(m, '*'); },
  _msg(ev) {
    const d = ev.data; if (!d || !d.__rv || !this.running) return;
    const fromMod = this.mods.find((x) => x.f.contentWindow === ev.source); if (!fromMod && (!this.frame || ev.source !== this.frame.contentWindow)) return; // só aceita dos nossos iframes
    try { this._op(d, fromMod); } catch (e) { this.print('error', 'host: ' + e.message); }
  },
  _val(t, v) { return t === 'v3' ? v3(v) : t === 'c3' ? new THREE.Color(v[0], v[1], v[2]) : t === 'u2' ? v : t === 'ref' ? v[0] : v; },
  _op(d, mod) {
    const G = this.G; switch (d.op) {
      case 'ready': this._send({ op: 'player', a: S.name || 'Gato', b: 1 }); break;
      case 'print': this.print(d.id, d.k); break;
      case 'new': if (/^(Part|SpawnLocation|WedgePart|MeshPart)$/.test(d.k)) { if (this.parts.size >= MAX_PARTS) { this.print('warn', 'Limite de ' + MAX_PARTS + ' Parts'); break; } this._newPart(d.id); } else if (/^(ScreenGui|Frame|TextLabel|TextButton|ImageLabel)$/.test(d.k)) this._newGui(d.id, d.k, d.t); else if (d.k === 'PointLight') this.parts.set(d.id, { light: true, id: d.id, props: {} }); break;
      case 'set': { const p = this.parts.get(d.id); const val = this._val(d.t, d.v); if (p && !p.light) this._setPart(p, d.k, val); else if (this.gui.has(d.id)) this._setGui(this.gui.get(d.id), d.k, val); break; }
      case 'parent': { const g = this.gui.get(d.id); if (g) { const par = this.gui.get(d.v); (par ? par.el : this._root()).appendChild(g.el); } break; }
      case 'del': { const p = this.parts.get(d.id); if (p) { this._dropPart(p); this.parts.delete(d.id); } const g = this.gui.get(d.id); if (g) { g.el.remove(); this.gui.delete(d.id); } const x = this.extra.find((e) => e.userData.sid === d.id); if (x) { x.parent && x.parent.remove(x); } break; }
      case 'sound': play(/^[a-z_]+$/i.test(d.k) ? d.k : 'pop', Math.min(1, +d.v || 0.6)); break;
      case 'api': this._api(d.id, d.v || [], mod); break;
      case 'interactive': if (mod) mod.f.style.pointerEvents = d.v ? 'auto' : 'none'; break;
    }
  },
  _api(n, a, mod) {
    const G = this.G, P = G.player;
    switch (n) {
      case 'toast': emit('toast', String(a[0]).slice(0, 120), typeof a[1] === 'string' ? a[1] : '#bfe6ff'); break;
      case 'banner': emit('banner', String(a[0]).slice(0, 80), Math.min(10, +a[1] || 3)); break;
      case 'say': { const t = performance.now(); if (t - (this._sayT || -1e9) < 5000) break; this._sayT = t; G.say(String(a[0]).slice(0, 80)); break; } // no máximo 1 mensagem a cada 5 s
      case 'play': play(String(a[0]).replace(/[^a-z_0-9]/gi, ''), Math.min(1, +a[1] || 0.7)); break;
      case 'fx': G.fx.burst(+a[0], +a[1], +a[2], +a[3] | 0, Math.min(80, +a[4] || 20), 3, 2); break;
      case 'teleport': if ([a[0], a[1], a[2]].every(Number.isFinite)) P.teleport(a[0], a[1], a[2], P.yaw); break;
      case 'walk': P.scriptWalk = Math.max(0, Math.min(10, (+a[0] || 16) / 16)); break;
      case 'jump': P.scriptJump = Math.max(0, Math.min(6, (+a[0] || 50) / 50)); break;
      case 'health': if (this.studio || G.mapId === 'custom') { S.hp = Math.max(0, Math.min(S.maxHp(), (+a[0] / Math.max(1, +a[1] || 100)) * S.maxHp())); emit('hp'); } break;
      case 'gravity': G.scriptGrav = Math.max(0, Math.min(5, (+a[0] || 196.2) / 196.2)); break;
      case 'time': G.scriptTime = ((+a[0] || 0) % 24 + 24) % 24; break;
      case 'fly': G.scriptFly = !!a[0]; break;
      case 'sky': G.scene.background && G.scene.background.setRGB(+a[0], +a[1], +a[2]); break;
      case 'emote': G.emote && G.emote(+a[0] | 0); break;
      case 'model': { const g = G.modelMesh ? G.modelMesh(String(a[1])) : null; if (!g) break; g.position.set(+a[2], +a[3], +a[4]); g.scale.multiplyScalar(Math.min(20, +a[5] || 1)); g.rotation.y = +a[6] || 0; g.userData.sid = a[0]; G.scene.add(g); this.extra.push(g); break; }
      case 'npc': if (G.scriptNpc) G.scriptNpc(String(a[0]).slice(0, 24), +a[1], +a[2], +a[3], String(a[4] || 'Miau!').split('\n').slice(0, 8)); break;
    }
  },
  // ---------- Parts ----------
  _newPart(id) { const mat = new THREE.MeshLambertMaterial({ color: 0xa3a2a5 }); const m = new THREE.Mesh(geoms.Block, mat); m.castShadow = true; m.receiveShadow = true; this.G.scene.add(m); const p = { id, mesh: m, shape: 'Block', size: new THREE.Vector3(4, 1, 2), pos: new THREE.Vector3(0, 5, 0), rot: new THREE.Euler(), anchored: true, collide: true, vel: new THREE.Vector3(), box: null }; this.parts.set(id, p); this._fit(p); return p; },
  _setPart(p, k, v) {
    switch (k) {
      case 'Position': p.pos.copy(v); break; case 'Size': p.size.set(Math.max(0.05, Math.min(2048, v.x)), Math.max(0.05, Math.min(2048, v.y)), Math.max(0.05, Math.min(2048, v.z))); break;
      case 'Orientation': p.rot.set(v.x * Math.PI / 180, v.y * Math.PI / 180, v.z * Math.PI / 180, 'YXZ'); break;
      case 'Color': p.mesh.material.color.copy(v); break; case 'Transparency': p.mesh.material.transparent = v > 0; p.mesh.material.opacity = 1 - Math.max(0, Math.min(1, v)); p.mesh.visible = v < 1; break;
      case 'Anchored': p.anchored = !!v; break; case 'CanCollide': p.collide = !!v; break; case 'Velocity': p.vel.copy(v); break;
      case 'Shape': if (geoms[v]) { p.shape = v; p.mesh.geometry = geoms[v]; } break;
    } this._fit(p);
  },
  _fit(p) { p.mesh.position.copy(p.pos); p.mesh.rotation.copy(p.rot); p.mesh.scale.copy(p.size); const W = this.G.world; if (!W) return;
    if (p.box) { const i = W.dyn.indexOf(p.box); if (i >= 0) W.dyn.splice(i, 1); p.box = null; }
    if (p.collide && p.mesh.visible !== false) { const h = p.size.clone().multiplyScalar(0.5); if (Math.abs(p.rot.y) > 0.01) { const c = Math.abs(Math.cos(p.rot.y)), s = Math.abs(Math.sin(p.rot.y)); const hx = h.x * c + h.z * s, hz = h.x * s + h.z * c; h.x = hx; h.z = hz; } p.box = [p.pos.x - h.x, p.pos.y - h.y, p.pos.z - h.z, p.pos.x + h.x, p.pos.y + h.y, p.pos.z + h.z]; W.dyn.push(p.box); } },
  _dropPart(p) { if (p.mesh) { p.mesh.parent && p.mesh.parent.remove(p.mesh); p.mesh.material.dispose(); } if (p.box && this.G && this.G.world) { const i = this.G.world.dyn.indexOf(p.box); if (i >= 0) this.G.world.dyn.splice(i, 1); } },
  // ---------- GUI (ScreenGui/Frame/TextLabel/TextButton) ----------
  _root() { if (!this.guiRoot) { const r = this.guiRoot = document.createElement('div'); Object.assign(r.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: 16, fontFamily: 'sans-serif' }); document.body.appendChild(r); } return this.guiRoot; },
  _newGui(id, cls, parentId) { const el = document.createElement(cls === 'TextButton' ? 'button' : 'div'); const g = { id, cls, el }; Object.assign(el.style, { position: 'absolute', boxSizing: 'border-box', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', borderRadius: '8px', border: '0', font: 'bold 22px sans-serif' });
    if (cls === 'ScreenGui') Object.assign(el.style, { inset: '0', background: 'transparent', display: 'block' }); else { el.style.background = 'rgb(33,31,51)'; el.style.color = '#fff'; el.style.left = '0px'; el.style.top = '0px'; el.style.width = '200px'; el.style.height = '50px'; }
    if (cls === 'TextButton') { el.style.pointerEvents = 'auto'; el.style.cursor = 'pointer'; el.onclick = (e) => { e.stopPropagation(); this._send({ op: 'gui', a: id }); }; }
    const par = this.gui.get(parentId); (par ? par.el : this._root()).appendChild(el); this.gui.set(id, g); },
  _setGui(g, k, v) { if (g.cls === 'ScreenGui' && k !== 'Visible') return; const st = g.el.style, col = (c) => 'rgb(' + Math.round(c.r * 255) + ',' + Math.round(c.g * 255) + ',' + Math.round(c.b * 255) + ')';
    switch (k) { case 'Text': g.el.textContent = String(v).slice(0, 400); break; case 'TextSize': st.fontSize = Math.max(6, Math.min(120, +v)) + 'px'; break; case 'TextColor3': st.color = col(v); break;
      case 'BackgroundColor3': g.bg = col(v); st.background = g.bg; break; case 'BackgroundTransparency': st.background = v >= 1 ? 'transparent' : g.bg || 'rgb(33,31,51)'; if (v > 0 && v < 1) st.opacity = 1 - v * 0.5; break;
      case 'Visible': st.display = v ? (g.cls === 'ScreenGui' ? 'block' : 'flex') : 'none'; break;
      case 'Position': if (g.cls !== 'ScreenGui') { st.left = 'calc(' + v[0] * 100 + '% + ' + v[1] + 'px)'; st.top = 'calc(' + v[2] * 100 + '% + ' + v[3] + 'px)'; } break;
      case 'Size': if (g.cls !== 'ScreenGui') { st.width = 'calc(' + v[0] * 100 + '% + ' + v[1] + 'px)'; st.height = 'calc(' + v[2] * 100 + '% + ' + v[3] + 'px)'; } break;
      case 'Image': if (g.cls === 'ImageLabel' && /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(String(v))) { st.backgroundImage = 'url("' + String(v).replace(/"/g, '') + '")'; st.backgroundSize = 'contain'; st.backgroundRepeat = 'no-repeat'; st.backgroundPosition = 'center'; } break; } },
  // ---------- a cada quadro ----------
  tick(dt) {
    if (!this.running || !this.G) return; const P = this.G.player, pp = P.pos, touch = [], pos = [];
    for (const [id, p] of this.parts) { if (p.light) continue;
      if (!p.anchored) { p.vel.y -= 9.8 * (this.G.scriptGrav == null ? 1 : this.G.scriptGrav) * dt; p.pos.addScaledVector(p.vel, dt); const fl = this.G.world ? this.G.world.heightAt(p.pos.x, p.pos.z) + p.size.y / 2 : 0; if (p.pos.y < fl) { p.pos.y = fl; p.vel.y = Math.abs(p.vel.y) > 2 ? -p.vel.y * 0.3 : 0; p.vel.x *= 0.9; p.vel.z *= 0.9; } this._fit(p); pos.push([id, p.pos.x, p.pos.y, p.pos.z]); }
      const h = p.size, inside = Math.abs(pp.x - p.pos.x) < h.x / 2 + 0.35 && Math.abs(pp.z - p.pos.z) < h.z / 2 + 0.35 && pp.y + 1.2 > p.pos.y - h.y / 2 && pp.y - 0.15 < p.pos.y + h.y / 2;
      if (inside && !this.touching.has(id)) { this.touching.add(id); touch.push([id, 1]); } else if (!inside && this.touching.has(id)) { this.touching.delete(id); touch.push([id, 0]); } }
    this._send({ op: 'tick', dt, p: [pp.x, pp.y, pp.z], touch, pos });
  },
  chat(text) { if (this.running) this._send({ op: 'chat', a: String(text).slice(0, 80) }); }
};

// API JavaScript dos mods (vai como texto para dentro do iframe do mod)
function modApi() {
  const post = (m) => parent.postMessage(Object.assign({ __rv: 1 }, m), '*'); const L = { tick: [], key: [], chat: [], touch: [] }; let n = 0; const id = () => 'j' + (++n) + '_' + Math.random().toString(36).slice(2, 6);
  const set = (pid, k, v) => { if (v && typeof v === 'object' && 'x' in v) post({ op: 'set', id: pid, k, t: 'v3', v: [v.x, v.y, v.z] }); else if (Array.isArray(v) && k === 'Color') post({ op: 'set', id: pid, k, t: 'c3', v }); else post({ op: 'set', id: pid, k, v }); };
  window.rv = {
    part(props) { const pid = id(); post({ op: 'new', id: pid, k: 'Part' }); for (const k in props || {}) set(pid, k, props[k]); return { id: pid, set: (k, v) => set(pid, k, v), destroy: () => post({ op: 'del', id: pid }) }; },
    toast: (t, c) => post({ op: 'api', id: 'toast', v: [String(t), c || '#bfe6ff'] }), banner: (t, s) => post({ op: 'api', id: 'banner', v: [String(t), s || 3] }), say: (t) => post({ op: 'api', id: 'say', v: [String(t)] }),
    sound: (nm, vol) => post({ op: 'api', id: 'play', v: [nm, vol || 0.7] }), effect: (x, y, z, cor, q) => post({ op: 'api', id: 'fx', v: [x, y, z, cor || 0xffd040, q || 20] }), teleport: (x, y, z) => post({ op: 'api', id: 'teleport', v: [x, y, z] }),
    walkSpeed: (s) => post({ op: 'api', id: 'walk', v: [s] }), jumpPower: (s) => post({ op: 'api', id: 'jump', v: [s] }), gravity: (g) => post({ op: 'api', id: 'gravity', v: [g] }), clockTime: (h) => post({ op: 'api', id: 'time', v: [h] }), fly: (on) => post({ op: 'api', id: 'fly', v: [!!on] }),
    model: (key, x, y, z, s, ry) => { const pid = id(); post({ op: 'api', id: 'model', v: [pid, key, x, y, z, s || 1, ry || 0] }); return { destroy: () => post({ op: 'del', id: pid }) }; },
    npc: (nome, x, y, z, falas) => post({ op: 'api', id: 'npc', v: [nome, x, y, z, (falas || ['Miau!']).join('\n')] }),
    interactive: (on) => post({ op: 'interactive', v: !!on }),
    on(ev, fn) { (L[ev] || (L[ev] = [])).push(fn); }, player: { x: 0, y: 0, z: 0 }
  };
  addEventListener('message', (e) => { const m = e.data; if (!m || !m.__rvh) return; if (m.op === 'tick') { rv.player.x = m.p[0]; rv.player.y = m.p[1]; rv.player.z = m.p[2]; for (const f of L.tick) try { f(m.dt) } catch (er) { console.error(er); } for (const t of m.touch || []) for (const f of L.touch) f(t[0], !!t[1]); }
    else if (m.op === 'key') for (const f of L.key) f(m.a, !!m.b); else if (m.op === 'chat') for (const f of L.chat) f(m.a); });
}
