// 🛠 RoleVRGO Studio: painel por cima do jogo (PC/celular). Scripts em Luau (estilo Roblox), mods HTML/CSS/JS,
// poderes de desenvolvedor (tudo em sandbox: não mexe no seu save de verdade) e publicação como mapa da comunidade.
import { host } from './host.js';
import { unzip, zip, bundle } from './zip.js';
import { maker } from '../maker.js';
import { S } from '../state.js';
import { on, emit, store } from '../util.js';
import { downloadBlob } from '../rec.js';

export const EXAMPLES = {
  'Olá mundo': `print("Olá do RoleVRGO Studio!")
RoleVR.toast("Meu primeiro script 🎉")`,
  'Part que mata (lava)': `local lava = Instance.new("Part")
lava.Name = "Lava"
lava.Size = Vector3.new(8, 1, 8)
lava.Position = Vector3.new(0, 0.5, -10)
lava.Color = Color3.fromRGB(255, 80, 0)
lava.Parent = workspace

lava.Touched:Connect(function(hit)
  local hum = hit.Parent:FindFirstChild("Humanoid")
  if hum then
    hum.Health = 0
    RoleVR.toast("🔥 Você pisou na lava!")
  end
end)`,
  'Plataformas que somem': `for i = 1, 8 do
  local p = Instance.new("Part")
  p.Size = Vector3.new(3, 0.6, 3)
  p.Position = Vector3.new(i * 4, 2 + i, 0)
  p.Color = Color3.fromHSV(i / 8, 0.7, 1)
  p.Parent = workspace
  p.Touched:Connect(function()
    task.wait(0.6)
    p.Transparency = 0.7
    p.CanCollide = false
    task.wait(2)
    p.Transparency = 0
    p.CanCollide = true
  end)
end`,
  'Contador de moedas (GUI)': `local gui = Instance.new("ScreenGui")
gui.Parent = game.Players.LocalPlayer.PlayerGui
local label = Instance.new("TextLabel")
label.Size = UDim2.new(0, 220, 0, 50)
label.Position = UDim2.new(0, 20, 0, 20)
label.Text = "Moedas: 0"
label.Parent = gui

local moedas = 0
for i = 1, 10 do
  local m = Instance.new("Part")
  m.Shape = Enum.PartType.Ball
  m.Size = Vector3.new(1, 1, 1)
  m.Color = Color3.fromRGB(255, 210, 60)
  m.CanCollide = false
  m.Position = Vector3.new(math.random(-20, 20), 1.5, math.random(-20, 20))
  m.Parent = workspace
  m.Touched:Connect(function()
    if m.Parent then
      m:Destroy()
      moedas += 1
      label.Text = \`Moedas: {moedas}\`
      RoleVR.sound("coin")
    end
  end)
end`,
  'Porta com tecla E': `local porta = Instance.new("Part")
porta.Size = Vector3.new(4, 6, 0.5)
porta.Position = Vector3.new(0, 3, -6)
porta.Color = Color3.fromRGB(150, 100, 60)
porta.Parent = workspace
local aberta = false
game:GetService("UserInputService").InputBegan:Connect(function(input)
  if input.KeyCode == Enum.KeyCode.E then
    aberta = not aberta
    local alvo = aberta and Vector3.new(0, 9, -6) or Vector3.new(0, 3, -6)
    game:GetService("TweenService"):Create(porta, TweenInfo.new(0.5), { Position = alvo }):Play()
  end
end)`,
  'Chuva de bolas': `local RunService = game:GetService("RunService")
local t = 0
RunService.Heartbeat:Connect(function(dt)
  t += dt
  if t > 0.4 then
    t = 0
    local b = Instance.new("Part")
    b.Shape = Enum.PartType.Ball
    b.Size = Vector3.new(1.5, 1.5, 1.5)
    b.Color = Color3.fromHSV(math.random(), 0.8, 1)
    b.Anchored = false
    b.Position = Vector3.new(math.random(-15, 15), 25, math.random(-15, 15))
    b.Parent = workspace
    game:GetService("Debris"):AddItem(b, 6)
  end
end)`,
  'Super pulo + velocidade': `local hum = game.Players.LocalPlayer.Character:WaitForChild("Humanoid")
hum.WalkSpeed = 32
hum.JumpPower = 120
workspace.Gravity = 80
RoleVR.toast("Modo herói ativado 🦸")`
};
const CSS = `#rvst{position:fixed;top:0;right:0;bottom:0;width:min(460px,100vw);background:#14122a;color:#eee;font:14px system-ui,sans-serif;z-index:30;display:flex;flex-direction:column;box-shadow:-6px 0 24px #0008}
#rvst.min{width:auto;bottom:auto;background:transparent;box-shadow:none}#rvst.min>*:not(.bar){display:none}#rvst.min .bar>*:not(.tg){display:none}
#rvst .bar{display:flex;gap:6px;align-items:center;padding:8px;background:#1d1a3a;flex-wrap:wrap}#rvst button,#rvst select{background:#4a5cc8;color:#fff;border:0;border-radius:8px;padding:7px 10px;font:600 13px system-ui;cursor:pointer}
#rvst button.r{background:#3a9a5a}#rvst button.s{background:#8a4a4a}#rvst button.g{background:#33355a}#rvst button.on{outline:2px solid #ffd76a}
#rvst .tabs{display:flex;gap:2px;padding:0 8px;background:#1d1a3a}#rvst .tabs button{border-radius:8px 8px 0 0;background:#2a2750}#rvst .tabs button.on{background:#14122a;outline:0;color:#ffd76a}
#rvst .pg{flex:1;overflow:auto;padding:10px;display:flex;flex-direction:column;gap:8px}#rvst textarea{flex:1;min-height:240px;background:#0d0c1c;color:#d8f0ff;border:1px solid #333a6a;border-radius:8px;padding:10px;font:13px/1.45 ui-monospace,Menlo,Consolas,monospace;tab-size:2;resize:none;white-space:pre}
#rvst .row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}#rvst .it{display:flex;gap:6px;align-items:center;padding:6px 8px;background:#211e40;border-radius:8px;cursor:pointer}#rvst .it.on{outline:2px solid #ffd76a}#rvst .it span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#rvst .log{font:12px/1.4 ui-monospace,monospace;background:#0d0c1c;border-radius:8px;padding:8px;flex:1;overflow:auto;white-space:pre-wrap}#rvst .log .warn{color:#ffd76a}#rvst .log .error{color:#ff8a8a}
#rvst label{display:flex;gap:8px;align-items:center}#rvst input[type=range]{flex:1}#rvst small{color:#aab}#rvst h4{margin:4px 0;color:#ffd76a}`;

export const studio = {
  on: false, el: null, G: null, tab: 'scripts', sel: 0, pw: { fly: false, speed: 1, grav: 1, time: null, coins: false },
  enter(G) {
    this.G = G; this.on = true; const d = store.get('studioDraft', null); const map = d && d.map ? d.map : maker.blank('Meu jogo no Studio');
    if (!map.scripts) map.scripts = [{ n: 'Script', src: EXAMPLES['Plataformas que somem'] }]; if (!map.mods) map.mods = [];
    maker.studio = true; maker.open(G, map, d && d.id, true, false); this.build(); this.run(); emit('toast', '🛠 Studio: tudo liberado em sandbox (não mexe no seu save). F2 mostra/esconde o painel', '#ffd76a');
    on('studioLog', () => this.tab === 'out' && this.render());
    addEventListener('keydown', (e) => { if (e.code === 'F2') { this.el.classList.toggle('min'); } });
  },
  map() { return maker.map; },
  save() { const m = this.map(); if (!m) return; store.set('studioDraft', { id: maker.id, map: m }); const kb = JSON.stringify(m).length / 1024; if (kb > 900) emit('toast', '⚠ Projeto com ' + Math.round(kb) + ' KB: o limite para publicar é 900 KB', '#ff9a8a'); },
  run() { const m = this.map(); if (maker.editing) maker.setEditing(false); host.start(this.G, m.scripts, m.mods, { studio: true }); this.applyPowers(); this.render(); },
  stopRun() { host.stop(); this.applyPowers(); this.render(); },
  applyPowers() { const G = this.G, P = G.player, w = this.pw; G.scriptFly = w.fly || G.scriptFly; if (w.speed !== 1) P.scriptWalk = w.speed; if (w.grav !== 1) G.scriptGrav = w.grav; if (w.time != null) G.scriptTime = w.time; if (w.coins) S.d.coins = 999999; },
  build() {
    if (this.el) return; const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const el = this.el = document.createElement('div'); el.id = 'rvst'; document.body.appendChild(el);
    el.addEventListener('keydown', (e) => e.stopPropagation()); el.addEventListener('keyup', (e) => e.stopPropagation());
    el.addEventListener('mousedown', (e) => e.stopPropagation()); el.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    this.render();
  },
  h(tag, attrs, kids) { const e = document.createElement(tag); for (const k in attrs || {}) { if (k === 'on') for (const ev in attrs.on) e.addEventListener(ev, attrs.on[ev]); else if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); } for (const c of kids || []) if (c) e.appendChild(c); return e; },
  render() {
    const el = this.el; if (!el) return; const h = this.h.bind(this), m = this.map() || { scripts: [], mods: [] }; const ta = el.querySelector('textarea'); const caret = ta ? [ta.selectionStart, ta.scrollTop] : null; el.innerHTML = '';
    el.appendChild(h('div', { class: 'bar' }, [h('button', { class: 'g tg', text: el.classList.contains('min') ? '🛠 Studio' : '🛠 —', on: { click: () => { el.classList.toggle('min'); this.render(); } } }),
      host.running ? h('button', { class: 's', text: '⏹ Parar', on: { click: () => this.stopRun() } }) : h('button', { class: 'r', text: '▶ Rodar', on: { click: () => this.run() } }),
      h('button', { class: maker.editing ? 'on' : 'g', text: maker.editing ? '✎ Editando mapa' : '✎ Editar mapa', on: { click: () => { host.stop(); maker.setEditing(!maker.editing); if (maker.editing) emit('toast', 'Edição: abra o menu (M) > 🛠 Criar para escolher modelos; aponte e clique para colocar', '#bfe6ff'); this.render(); } } }),
      h('button', { class: 'g', text: '📖 API', on: { click: () => window.open('docs/', '_blank', 'noopener') } })]));
    const tabs = [['scripts', '📜 Scripts'], ['mods', '🧩 Mods'], ['out', '🖨 Saída'], ['pw', '⚡ Poderes'], ['proj', '📦 Projeto']];
    el.appendChild(h('div', { class: 'tabs' }, tabs.map(([k, n]) => h('button', { class: this.tab === k ? 'on' : '', text: n, on: { click: () => { this.tab = k; this.render(); } } }))));
    const pg = h('div', { class: 'pg' }); el.appendChild(pg);
    if (this.tab === 'scripts') {
      const list = m.scripts; if (this.sel >= list.length) this.sel = 0;
      pg.appendChild(h('div', { class: 'row' }, [h('button', { text: '＋ Script', on: { click: () => { list.push({ n: 'Script' + (list.length + 1), src: '-- seu código Luau aqui\nprint("oi")\n' }); this.sel = list.length - 1; this.save(); this.render(); } } }),
        h('select', { on: { change: (e) => { if (!e.target.value) return; list.push({ n: e.target.value, src: EXAMPLES[e.target.value] }); this.sel = list.length - 1; this.save(); this.render(); } } }, [h('option', { value: '', text: '📚 Exemplos...' })].concat(Object.keys(EXAMPLES).map((k) => h('option', { value: k, text: k }))))]));
      list.forEach((s, i) => pg.appendChild(h('div', { class: 'it' + (i === this.sel ? ' on' : ''), on: { click: () => { this.sel = i; this.render(); } } }, [h('span', { text: (s.on === false ? '⏸ ' : '📜 ') + s.n }),
        h('button', { class: 'g', text: '✎', on: { click: (e) => { e.stopPropagation(); const n = prompt('Nome do script', s.n); if (n) { s.n = n.slice(0, 40); this.save(); this.render(); } } } }),
        h('button', { class: 'g', text: s.on === false ? '▶' : '⏸', on: { click: (e) => { e.stopPropagation(); s.on = s.on === false; this.save(); this.render(); } } }),
        h('button', { class: 's', text: '🗑', on: { click: (e) => { e.stopPropagation(); if (confirm('Apagar ' + s.n + '?')) { list.splice(i, 1); this.save(); this.render(); } } } })])));
      const cur = list[this.sel]; if (cur) { const t = h('textarea', { spellcheck: 'false' }); t.value = cur.src; t.addEventListener('input', () => { cur.src = t.value; clearTimeout(this._sv); this._sv = setTimeout(() => this.save(), 600); });
        t.addEventListener('keydown', (e) => { if (e.key === 'Tab') { e.preventDefault(); const a = t.selectionStart; t.setRangeText('  ', a, t.selectionEnd, 'end'); cur.src = t.value; } if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); this.run(); } });
        pg.appendChild(t); pg.appendChild(h('small', { text: 'Ctrl+Enter roda · Luau (estilo Roblox): Instance, Vector3, Color3, task.wait, game:GetService, eventos :Connect · extras em RoleVR.*' })); if (caret) { t.selectionStart = t.selectionEnd = caret[0]; t.scrollTop = caret[1]; } }
    } else if (this.tab === 'mods') {
      const inp = h('input', { type: 'file', multiple: '', accept: '.zip,.html,.htm,.css,.js,.mjs,.lua,.luau,.png,.jpg,.jpeg,.gif,.webp,.svg,.mp3,.ogg,.wav,.json', style: 'display:none' });
      inp.addEventListener('change', () => this.importFiles(inp.files)); pg.appendChild(inp);
      pg.appendChild(h('div', { class: 'row' }, [h('button', { text: '📥 Importar .zip / .html / .css / .js / .lua', on: { click: () => inp.click() } })]));
      pg.appendChild(h('small', { text: 'Um .zip com index.html + css + js vira um mod (página por cima do jogo, com a API window.rv). Arquivos .lua/.luau viram scripts. CSS/JS soltos também funcionam.' }));
      m.mods.forEach((md, i) => pg.appendChild(h('div', { class: 'it' }, [h('span', { text: (md.on === false ? '⏸ ' : '🧩 ') + md.n + ' · ' + Math.round(md.html.length / 1024) + ' KB' }),
        h('button', { class: md.interactive ? 'on' : 'g', text: md.interactive ? '🖱 clicável' : '👁 só visual', on: { click: () => { md.interactive = !md.interactive; this.save(); this.render(); } } }),
        h('button', { class: 'g', text: md.on === false ? '▶' : '⏸', on: { click: () => { md.on = md.on === false; this.save(); this.render(); } } }),
        h('button', { class: 's', text: '🗑', on: { click: () => { m.mods.splice(i, 1); this.save(); this.render(); } } })])));
    } else if (this.tab === 'out') {
      const lg = h('div', { class: 'log' }); for (const l of host.log) lg.appendChild(h('div', { class: l.lvl, text: l.msg })); pg.appendChild(lg); setTimeout(() => { lg.scrollTop = 1e9; }, 0);
      pg.appendChild(h('div', { class: 'row' }, [h('button', { class: 'g', text: 'Limpar', on: { click: () => { host.log.length = 0; this.render(); } } })]));
    } else if (this.tab === 'pw') {
      const w = this.pw, G = this.G, P = G.player, rng = (label, min, max, step, val, fn) => { const r = h('input', { type: 'range', min, max, step }); r.value = val; r.addEventListener('input', () => fn(+r.value)); return h('label', {}, [h('span', { text: label }), r]); };
      pg.appendChild(h('h4', { text: 'Poderes de desenvolvedor (só no Studio, em sandbox)' }));
      pg.appendChild(h('div', { class: 'row' }, [h('button', { class: w.fly ? 'on' : 'g', text: '🕊 Voar', on: { click: () => { w.fly = !w.fly; G.scriptFly = w.fly; this.render(); } } }),
        h('button', { class: w.coins ? 'on' : 'g', text: '💰 Moedas infinitas', on: { click: () => { w.coins = !w.coins; if (w.coins) S.d.coins = 999999; this.render(); } } }),
        h('button', { class: 'g', text: '📍 Ir para o spawn', on: { click: () => { const s = this.map().spawn; P.teleport(s[0], G.world.floorAt(s[0], 80, s[1]) + 0.3, s[1], P.yaw); } } }),
        h('button', { class: 'g', text: '📍 Spawn aqui', on: { click: () => { this.map().spawn = [P.pos.x, P.pos.z, P.yaw]; this.save(); emit('toast', 'Spawn definido aqui', '#9cf09c'); } } })]));
      pg.appendChild(rng('🏃 Velocidade ' + w.speed.toFixed(1) + 'x', 0.2, 6, 0.1, w.speed, (v) => { w.speed = v; P.scriptWalk = v; }));
      pg.appendChild(rng('🪐 Gravidade ' + w.grav.toFixed(2) + 'x', 0, 3, 0.05, w.grav, (v) => { w.grav = v; G.scriptGrav = v; }));
      pg.appendChild(rng('🕒 Hora do dia ' + (w.time == null ? 'real' : w.time.toFixed(1) + 'h'), 0, 24, 0.25, w.time == null ? 12 : w.time, (v) => { w.time = v; G.scriptTime = v; }));
      pg.appendChild(h('small', { text: 'Céu, chão, água, tamanho do mapa e todos os modelos ficam no criador de mapas (✎ Editar mapa > menu > 🛠 Criar). Scripts também podem mudar tudo pela API.' }));
    } else if (this.tab === 'proj') {
      const imp = h('input', { type: 'file', accept: '.zip,.json', style: 'display:none' }); imp.addEventListener('change', () => this.importProject(imp.files[0])); pg.appendChild(imp);
      pg.appendChild(h('div', { class: 'row' }, [h('span', { text: '📦 ' + (m.name || 'Projeto') + ' · ' + (m.objs ? m.objs.length : 0) + ' objetos · ' + m.scripts.length + ' scripts · ' + m.mods.length + ' mods' })]));
      pg.appendChild(h('div', { class: 'row' }, [h('button', { class: 'g', text: '✎ Renomear', on: { click: () => { const n = prompt('Nome do jogo/mapa', m.name); if (n) { m.name = n.slice(0, 28); this.save(); this.render(); } } } }),
        h('button', { text: '📤 Exportar .zip', on: { click: () => this.exportZip() } }), h('button', { text: '📥 Importar projeto', on: { click: () => imp.click() } }),
        h('button', { class: 's', text: '🆕 Novo projeto', on: { click: () => { if (!confirm('Começar um projeto novo? (exporte antes se quiser guardar)')) return; store.set('studioDraft', null); host.stop(); const nm = maker.blank('Meu jogo no Studio'); nm.scripts = []; nm.mods = []; maker.open(this.G, nm, null, true, false); this.render(); } } })]));
      pg.appendChild(h('div', { class: 'row' }, [h('button', { class: 'r', text: '🌍 Publicar para a comunidade', on: { click: async () => { this.save(); const r = await maker.save(true); emit('toast', r, /^(Publicado|Salvo)/.test(r) ? '#9cf09c' : '#ff9a8a'); this.render(); } } }),
        h('button', { class: 'g', text: '💾 Salvar (privado)', on: { click: async () => { this.save(); const r = await maker.save(false); emit('toast', r, /^(Publicado|Salvo)/.test(r) ? '#9cf09c' : '#ff9a8a'); } } })]));
      pg.appendChild(h('small', { text: 'Publicado, o mapa aparece no menu > 🛠 Criar > 🌍 Comunidade. Quem entrar roda seus scripts e mods isolados (sem acesso à conta). Limite: 900 KB por projeto.' + (maker.id ? '  Código: ' + maker.id : '') }));
    }
  },
  async importFiles(fl) {
    const files = {}; let name = '';
    for (const f of fl) { const buf = new Uint8Array(await f.arrayBuffer()); if (/\.zip$/i.test(f.name)) { try { Object.assign(files, await unzip(buf)); name = f.name.replace(/\.zip$/i, ''); } catch (e) { emit('toast', 'ZIP: ' + e.message, '#ff9a8a'); return; } } else files[f.name] = buf; }
    const b = bundle(files, name), m = this.map(); m.scripts.push(...b.scripts); m.mods.push(...b.mods); this.save();
    emit('toast', '📥 Importado: ' + b.scripts.length + ' script(s), ' + b.mods.length + ' mod(s)', '#9cf09c'); this.render(); if (host.running) this.run();
  },
  exportZip() { const m = this.map(), f = { 'map.json': JSON.stringify(Object.assign({}, m, { scripts: undefined, mods: undefined })), 'LEIA-ME.txt': 'Projeto do RoleVRGO Studio. Importe este .zip no Studio (aba Projeto).\n' };
    for (const s of m.scripts) f['scripts/' + s.n.replace(/[^\w-]+/g, '_') + '.luau'] = s.src; for (const md of m.mods) f['mods/' + md.n.replace(/[^\w-]+/g, '_') + '.html'] = md.html;
    downloadBlob(zip(f), (m.name || 'projeto').replace(/[^\w-]+/g, '_') + '.rvstudio.zip'); },
  async importProject(file) { if (!file) return; try { const buf = new Uint8Array(await file.arrayBuffer()); let map;
      if (/\.json$/i.test(file.name)) map = JSON.parse(new TextDecoder().decode(buf)); else { const fs = await unzip(buf); map = fs['map.json'] ? JSON.parse(new TextDecoder().decode(fs['map.json'])) : maker.blank(file.name); map.scripts = []; map.mods = [];
        for (const k in fs) { if (/^scripts\/.+\.(lua|luau)$/i.test(k)) map.scripts.push({ n: k.split('/').pop().replace(/\.\w+$/, ''), src: new TextDecoder().decode(fs[k]) }); else if (/^mods\/.+\.html?$/i.test(k)) map.mods.push({ n: k.split('/').pop().replace(/\.\w+$/, ''), html: new TextDecoder().decode(fs[k]) }); } }
      if (!map.objs) throw new Error('não parece um projeto do Studio'); map.scripts = map.scripts || []; map.mods = map.mods || []; host.stop(); maker.open(this.G, map, null, true, false); this.save(); this.render(); emit('toast', '📥 Projeto importado: ' + map.name, '#9cf09c');
    } catch (e) { emit('toast', 'Não deu para importar: ' + e.message, '#ff9a8a'); } }
};
