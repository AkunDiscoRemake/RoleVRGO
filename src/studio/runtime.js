// Runtime dos scripts (roda DENTRO de um iframe sandbox, sem acesso ao jogo, à conta ou ao login).
// Fala com o jogo só por postMessage. Traz uma API no estilo Roblox (Instance, Vector3, Color3, Signals,
// game:GetService, task.wait...) escrita em Lua sobre o fengari (Lua 5.3), mais um conversor "Luau-lite".

// ---------- Luau-lite -> Lua 5.3 ----------
export function luauToLua(src) {
  let s = String(src).replace(/\r/g, '');
  // declarações de tipo (type X = ... / export type X = {...}, também em várias linhas) somem
  s = s.replace(/^[ \t]*(export[ \t]+)?type[ \t]+[A-Za-z_]\w*(<[^>\n]*>)?[ \t]*=/gm, (m, ex, gen, off) => '\u0000TYPE');
  while (s.includes('\u0000TYPE')) { const i = s.indexOf('\u0000TYPE'); let j = i + 5, depth = 0; for (; j < s.length; j++) { const ch = s[j]; if (ch === '{' || ch === '(') depth++; else if (ch === '}' || ch === ')') depth--; else if (ch === '\n' && depth <= 0) break; } s = s.slice(0, i) + '-- (tipo removido)' + s.slice(j); }
  // anotações de tipo em locais e parâmetros: local x: number = 1 / function f(a: number, b: {string}): boolean
  s = s.replace(/\blocal\s+([A-Za-z_]\w*)\s*:\s*[^=\n]+?\s*=(?!=)/g, 'local $1 =').replace(/\blocal\s+([A-Za-z_]\w*)\s*:\s*[A-Za-z_{][^\n=]*$/gm, 'local $1');
  s = s.replace(/\bfunction([ \t]+[\w.:]*)?[ \t]*\(([^)\n]*)\)([ \t]*:[ \t]*(?:\([^)\n]*\)|[A-Za-z_{][\w.?<>{}\[\]]*)(?:[ \t]*\|[ \t]*[\w.?<>{}()\[\]]+)*)?/g, (m, name, params) => 'function' + (name || '') + '(' + params.replace(/\s*:\s*[^,]+/g, '') + ')');
  // atribuição composta: x += 1  ->  x = x + (1)
  s = s.replace(/^(\s*)([A-Za-z_][\w.\[\]"']*)\s*(\+|-|\*|\/\/|\/|%|\^|\.\.)=\s*(.+)$/gm, (m, ind, lhs, op, rhs) => ind + lhs + ' = ' + lhs + ' ' + op + ' (' + rhs.trim() + ')');
  // continue -> goto (só dentro de laços simples: "continue" vira "goto continue" e o rótulo é posto antes do "end" do laço)
  if (/\bcontinue\b/.test(s)) s = addContinue(s);
  // `texto {x}` (interpolação do Luau) -> "texto " .. tostring(x)
  s = s.replace(/`([^`\n]*)`/g, (m, body) => '(' + body.split(/(\{[^}]*\})/).filter((p) => p !== '').map((p) => (p[0] === '{' ? 'tostring(' + p.slice(1, -1) + ')' : JSON.stringify(p))).join(' .. ') + ')');
  return s;
}
function addContinue(s) {
  const lines = s.split('\n'), stack = [], out = lines.slice();
  const opens = (l) => (l.match(/\b(function|do|then|repeat)\b/g) || []).length, closes = (l) => (l.match(/\b(end|until)\b/g) || []).length;
  lines.forEach((l, i) => { const code = l.replace(/--.*$/, '').replace(/"[^"]*"|'[^']*'/g, '""'); const loop = /\b(for|while)\b.*\bdo\b/.test(code);
    let o = opens(code), c = closes(code); if (loop) { stack.push({ loop: true, used: false }); o--; } for (let k = 0; k < o; k++) stack.push({ loop: false });
    if (/\bcontinue\b/.test(code)) { for (let k = stack.length - 1; k >= 0; k--) if (stack[k].loop) { stack[k].used = true; stack[k].id = stack[k].id || 'continue_' + i; out[i] = out[i].replace(/\bcontinue\b/, 'goto ' + stack[k].id); break; } }
    for (let k = 0; k < c; k++) { const f = stack.pop(); if (f && f.loop && f.used) out[i] = out[i].replace(/\bend\b(?!.*\bend\b)/, '::' + f.id + ':: end'); } });
  return out.join('\n');
}

// ---------- prelúdio Lua: a API no estilo Roblox ----------
export const PRELUDE = String.raw`
local H = js.global.__rvhost
local floor, sqrt = math.floor, math.sqrt
local function num(x) if math.type(x) == 'float' and x == floor(x) and x > -2^53 and x < 2^53 then return math.tointeger(x) end return x end
local function out(lvl, ...) local t = {} for i = 1, select('#', ...) do local v = select(i, ...) t[#t + 1] = tostring(num(v)) end H:emit('print', lvl, table.concat(t, ' ')) end
print = function(...) out('info', ...) end
warn = function(...) out('warn', ...) end

-- Vector3
Vector3 = {}; Vector3.__index = Vector3
local function V(x, y, z) return setmetatable({ X = x or 0, Y = y or 0, Z = z or 0 }, Vector3) end
Vector3.new = V; Vector3.zero = V(0, 0, 0); Vector3.one = V(1, 1, 1); Vector3.xAxis = V(1, 0, 0); Vector3.yAxis = V(0, 1, 0); Vector3.zAxis = V(0, 0, 1)
Vector3.__add = function(a, b) return V(a.X + b.X, a.Y + b.Y, a.Z + b.Z) end
Vector3.__sub = function(a, b) return V(a.X - b.X, a.Y - b.Y, a.Z - b.Z) end
Vector3.__mul = function(a, b) if type(a) == 'number' then return V(b.X * a, b.Y * a, b.Z * a) elseif type(b) == 'number' then return V(a.X * b, a.Y * b, a.Z * b) end return V(a.X * b.X, a.Y * b.Y, a.Z * b.Z) end
Vector3.__div = function(a, b) if type(b) == 'number' then return V(a.X / b, a.Y / b, a.Z / b) end return V(a.X / b.X, a.Y / b.Y, a.Z / b.Z) end
Vector3.__unm = function(a) return V(-a.X, -a.Y, -a.Z) end
Vector3.__eq = function(a, b) return a.X == b.X and a.Y == b.Y and a.Z == b.Z end
Vector3.__tostring = function(a) return num(a.X) .. ', ' .. num(a.Y) .. ', ' .. num(a.Z) end
Vector3.__index = function(t, k)
  if k == 'Magnitude' then return sqrt(t.X * t.X + t.Y * t.Y + t.Z * t.Z) end
  if k == 'Unit' then local m = sqrt(t.X * t.X + t.Y * t.Y + t.Z * t.Z) if m == 0 then return V() end return V(t.X / m, t.Y / m, t.Z / m) end
  return rawget(Vector3, k)
end
function Vector3.Dot(a, b) return a.X * b.X + a.Y * b.Y + a.Z * b.Z end
function Vector3.Cross(a, b) return V(a.Y * b.Z - a.Z * b.Y, a.Z * b.X - a.X * b.Z, a.X * b.Y - a.Y * b.X) end
function Vector3.Lerp(a, b, t) return V(a.X + (b.X - a.X) * t, a.Y + (b.Y - a.Y) * t, a.Z + (b.Z - a.Z) * t) end

-- Color3
Color3 = {}; Color3.__index = Color3
local function C3(r, g, b) return setmetatable({ R = r or 0, G = g or 0, B = b or 0 }, Color3) end
Color3.new = C3; function Color3.fromRGB(r, g, b) return C3((r or 0) / 255, (g or 0) / 255, (b or 0) / 255) end
function Color3.fromHSV(h, s, v) local i = floor(h * 6); local f = h * 6 - i; local p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s); i = i % 6
  if i == 0 then return C3(v, t, p) elseif i == 1 then return C3(q, v, p) elseif i == 2 then return C3(p, v, t) elseif i == 3 then return C3(p, q, v) elseif i == 4 then return C3(t, p, v) end return C3(v, p, q) end
Color3.__tostring = function(c) return num(c.R) .. ', ' .. num(c.G) .. ', ' .. num(c.B) end
function Color3.Lerp(a, b, t) return C3(a.R + (b.R - a.R) * t, a.G + (b.G - a.G) * t, a.B + (b.B - a.B) * t) end
BrickColor = { new = function(n) local m = { Red = C3(0.77, 0.16, 0.11), Blue = C3(0.05, 0.41, 0.67), Green = C3(0.16, 0.5, 0.25), Yellow = C3(0.96, 0.8, 0.19), White = C3(0.95, 0.95, 0.95), Black = C3(0.1, 0.1, 0.1), Gray = C3(0.64, 0.64, 0.64) } local c = m[n] or C3(0.64, 0.64, 0.64) return { Color = c, Name = n } end }
UDim2 = { new = function(xs, xo, ys, yo) return { X = { Scale = xs or 0, Offset = xo or 0 }, Y = { Scale = ys or 0, Offset = yo or 0 }, __udim2 = true } end }
UDim2.fromScale = function(x, y) return UDim2.new(x, 0, y, 0) end; UDim2.fromOffset = function(x, y) return UDim2.new(0, x, 0, y) end
TweenInfo = { new = function(t, style, dir, rep, rev, delay) return { Time = t or 1, Reverses = rev or false, RepeatCount = rep or 0, DelayTime = delay or 0 } end }

-- Enum
local KEYS = { 'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','Space','LeftShift','Return','One','Two','Three','Four','Five','Up','Down','Left','Right' }
Enum = { KeyCode = {}, UserInputType = { Keyboard = 'Keyboard', MouseButton1 = 'MouseButton1', Touch = 'Touch' }, Material = setmetatable({}, { __index = function(_, k) return k end }), PartType = { Block = 'Block', Ball = 'Ball', Cylinder = 'Cylinder' }, EasingStyle = setmetatable({}, { __index = function(_, k) return k end }), EasingDirection = setmetatable({}, { __index = function(_, k) return k end }) }
for _, k in ipairs(KEYS) do Enum.KeyCode[k] = { Name = k, __key = k } end

-- Signal
local Signal = {}; Signal.__index = Signal
local function newSignal() return setmetatable({ fns = {} }, Signal) end
function Signal:Connect(f) local c = { Connected = true } local s = self c.Disconnect = function() c.Connected = false for i, g in ipairs(s.fns) do if g == f then table.remove(s.fns, i) break end end end table.insert(self.fns, f) return c end
function Signal:Once(f) local c c = self:Connect(function(...) c.Disconnect() f(...) end) return c end
function Signal:Wait() local co = coroutine.running() local c c = self:Connect(function(...) c.Disconnect() __resume(co, ...) end) return coroutine.yield() end
function Signal:Fire(...) for _, f in ipairs({ table.unpack(self.fns) }) do __spawn(f, ...) end end

-- agendador (task.*)
local waiting, now = {}, 0
function __resume(co, ...) if coroutine.status(co) == 'dead' then return end local ok, err = coroutine.resume(co, ...) if not ok then out('error', debug.traceback(co, tostring(err))) end end
function __spawn(f, ...) local co = coroutine.create(f) __resume(co, ...) return co end
task = {}
function task.wait(t) t = t or 0 local co = coroutine.running() if not co or not coroutine.isyieldable() then return 0 end table.insert(waiting, { co = co, at = now + t, t0 = now }) return coroutine.yield() end
function task.spawn(f, ...) if type(f) == 'thread' then __resume(f, ...) return f end return __spawn(f, ...) end
function task.defer(f, ...) local a = table.pack(...) table.insert(waiting, { fn = function() f(table.unpack(a, 1, a.n)) end, at = now }) end
function task.delay(t, f, ...) local a = table.pack(...) table.insert(waiting, { fn = function() f(table.unpack(a, 1, a.n)) end, at = now + (t or 0) }) end
function task.cancel(co) for i = #waiting, 1, -1 do if waiting[i].co == co then table.remove(waiting, i) end end end
wait = task.wait; spawn = task.spawn; delay = task.delay
function tick() return now end; function time() return now end
local function step(dt) now = now + dt local ready = {} for i = #waiting, 1, -1 do local w = waiting[i] if w.at <= now then table.remove(waiting, i) table.insert(ready, w) end end
  for _, w in ipairs(ready) do if w.co then __resume(w.co, now - w.t0) else __spawn(w.fn) end end end

-- Instâncias
local nextId, byId = 0, {}
Instance = {}
local CLASSES = { Part = 'part', SpawnLocation = 'part', WedgePart = 'part', MeshPart = 'part', Model = 'container', Folder = 'container', Script = 'container', LocalScript = 'container', ModuleScript = 'container',
  StringValue = 'value', IntValue = 'value', NumberValue = 'value', BoolValue = 'value', ObjectValue = 'value', Vector3Value = 'value', Color3Value = 'value',
  ScreenGui = 'gui', Frame = 'gui', TextLabel = 'gui', TextButton = 'gui', ImageLabel = 'gui', UICorner = 'container', PointLight = 'light', Sound = 'sound', Humanoid = 'humanoid', ParticleEmitter = 'fx' }
local DEF = { part = { Size = V(4, 1, 2), Position = V(0, 5, 0), Orientation = V(0, 0, 0), Color = C3(0.64, 0.64, 0.64), Transparency = 0, Anchored = true, CanCollide = true, Shape = 'Block', Material = 'Plastic', Velocity = V(0, 0, 0) },
  gui = { Visible = true, Text = '', TextSize = 22, TextColor3 = C3(1, 1, 1), BackgroundColor3 = C3(0.13, 0.12, 0.2), BackgroundTransparency = 0, Position = UDim2.new(0, 0, 0, 0), Size = UDim2.new(0, 200, 0, 50), Image = '' },
  light = { Brightness = 1, Range = 12, Color = C3(1, 0.9, 0.7) }, sound = { SoundId = '', Volume = 0.6, Looped = false, Playing = false } }
local SYNC = { Size = 1, Position = 1, Orientation = 1, Color = 1, Transparency = 1, Anchored = 1, CanCollide = 1, Shape = 1, Name = 1, Text = 1, TextSize = 1, TextColor3 = 1, BackgroundColor3 = 1, BackgroundTransparency = 1, Visible = 1, Brightness = 1, Range = 1, Velocity = 1, Image = 1 }
local function enc(v) if type(v) == 'table' then if getmetatable(v) == Vector3 then return { v.X, v.Y, v.Z, __t = 'v3' } elseif getmetatable(v) == Color3 then return { v.R, v.G, v.B, __t = 'c3' } elseif v.__udim2 then return { v.X.Scale, v.X.Offset, v.Y.Scale, v.Y.Offset, __t = 'u2' } elseif v.__id then return { v.__id, __t = 'ref' } end end return v end
local function jsarr(t) local a = js.new(js.global.Array) for i, v in ipairs(t) do a[i - 1] = v end return a end
local function api(n, ...) local t = table.pack(...) local a = js.new(js.global.Array) for i = 1, t.n do local v = t[i] if v == nil then v = false end a[i - 1] = v end H:emit('api', n, nil, nil, a) end
local function send(op, id, k, v) local e = enc(v) if type(e) == 'table' then local t = e.__t e.__t = nil H:emit(op, id, k, t, jsarr(e)) else H:emit(op, id, k, nil, e) end end
local Obj = {}
Obj.__index = function(t, k)
  local p = rawget(t, '__p') if p[k] ~= nil then return p[k] end
  local m = Instance[k] if m ~= nil then return m end
  local ch = rawget(t, '__ch') for _, c in ipairs(ch) do if c.__p.Name == k then return c end end
  local ev = rawget(t, '__ev') if ev[k] then return ev[k] end
  return nil
end
Obj.__newindex = function(t, k, v)
  local p = rawget(t, '__p')
  if k == 'Parent' then t:__setParent(v) return end
  if k == 'CFrame' and type(v) == 'table' and v.Position then k = 'Position' v = v.Position end
  if k == 'BrickColor' and type(v) == 'table' then k = 'Color' v = v.Color end
  p[k] = v
  if SYNC[k] and t.__live then send('set', t.__id, k, v) end
  local chg = rawget(t, '__chg') if chg[k] then chg[k]:Fire(v) end
  t.Changed:Fire(k)
end
Obj.__tostring = function(t) return t.__p.Name end
local EVENTS = { part = { 'Touched', 'TouchEnded' }, gui = { 'Activated', 'MouseButton1Click', 'MouseEnter', 'MouseLeave' }, humanoid = { 'Died', 'HealthChanged' }, sound = { 'Ended' } }
local function make(cls, id)
  local kind = CLASSES[cls] or 'container'
  local o = { __id = id, __cls = cls, __kind = kind, __p = { Name = cls, ClassName = cls }, __ch = {}, __ev = { Changed = newSignal(), ChildAdded = newSignal(), ChildRemoved = newSignal(), AncestryChanged = newSignal() }, __chg = {}, __live = false }
  for k, v in pairs(DEF[kind] or {}) do o.__p[k] = (type(v) == 'table' and getmetatable(v) == Vector3) and V(v.X, v.Y, v.Z) or v end
  for _, e in ipairs(EVENTS[kind] or {}) do o.__ev[e] = newSignal() end
  o.__ev.Destroying = newSignal()
  setmetatable(o, Obj) byId[id] = o return o
end
function Instance.new(cls, parent) nextId = nextId + 1 local o = make(cls, 's' .. nextId) if parent then o.Parent = parent end return o end
function Instance:IsA(c) return self.__cls == c or (c == 'BasePart' and self.__kind == 'part') or (c == 'GuiObject' and self.__kind == 'gui') or c == 'Instance' end
function Instance:GetChildren() return { table.unpack(self.__ch) } end
function Instance:GetDescendants() local r = {} local function rec(o) for _, c in ipairs(o.__ch) do r[#r + 1] = c rec(c) end end rec(self) return r end
function Instance:FindFirstChild(n, rec) for _, c in ipairs(self.__ch) do if c.__p.Name == n then return c end end if rec then for _, c in ipairs(self.__ch) do local f = c:FindFirstChild(n, true) if f then return f end end end return nil end
function Instance:FindFirstChildOfClass(cn) for _, c in ipairs(self.__ch) do if c.__cls == cn then return c end end return nil end
function Instance:FindFirstAncestor(n) local p = self.__p.Parent while p do if p.__p.Name == n then return p end p = p.__p.Parent end return nil end
function Instance:WaitForChild(n, t) local f = self:FindFirstChild(n) local waited = 0 while not f and (not t or waited < t) do waited = waited + task.wait(0.1) f = self:FindFirstChild(n) end return f end
function Instance:GetPropertyChangedSignal(k) local c = rawget(self, '__chg') if not c[k] then c[k] = newSignal() end return c[k] end
function Instance:SetAttribute(k, v) self.__p['@' .. k] = v end
function Instance:GetAttribute(k) return self.__p['@' .. k] end
function Instance:GetFullName() local n, p = self.__p.Name, self.__p.Parent while p and p ~= game do n = p.__p.Name .. '.' .. n p = p.__p.Parent end return n end
local function isLiveRoot(o) while o do if o == workspace or o == __playerGui then return true end o = o.__p.Parent end return false end
local function goLive(o) if o.__live then return end o.__live = true local props = {} for k, v in pairs(o.__p) do if SYNC[k] then props[k] = v end end
  H:emit('new', o.__id, o.__cls, o.__p.Parent and o.__p.Parent.__id or nil) for k, v in pairs(props) do send('set', o.__id, k, v) end for _, c in ipairs(o.__ch) do goLive(c) end end
local function goDead(o) if not o.__live then return end o.__live = false H:emit('del', o.__id) for _, c in ipairs(o.__ch) do goDead(c) end end
function Instance:__setParent(v)
  local old = self.__p.Parent if old == v then return end
  if old then for i, c in ipairs(old.__ch) do if c == self then table.remove(old.__ch, i) break end end old.ChildRemoved:Fire(self) end
  self.__p.Parent = v
  if v then table.insert(v.__ch, self) v.ChildAdded:Fire(self) end
  if isLiveRoot(self) then if self.__live then H:emit('parent', self.__id, nil, nil, v and v.__id or nil) else goLive(self) end else goDead(self) end
  self.AncestryChanged:Fire(self, v)
end
function Instance:Destroy() self.Destroying:Fire() for _, c in ipairs({ table.unpack(self.__ch) }) do c:Destroy() end self:__setParent(nil) byId[self.__id] = nil end
function Instance:ClearAllChildren() for _, c in ipairs({ table.unpack(self.__ch) }) do c:Destroy() end end
function Instance:Clone() local c = Instance.new(self.__cls) for k, v in pairs(self.__p) do if k ~= 'Parent' then c.__p[k] = (type(v) == 'table' and getmetatable(v) == Vector3) and V(v.X, v.Y, v.Z) or v end end for _, ch in ipairs(self.__ch) do ch:Clone().Parent = c end return c end
function Instance:ApplyImpulse(v) self.Velocity = self.Velocity + v end
function Instance:Play() self.Playing = true H:emit('sound', self.__id, self.__p.SoundId, nil, self.__p.Volume) end
function Instance:Stop() self.Playing = false end
function Instance:PivotTo(cf) self.Position = cf.Position or cf end
function Instance:GetPivot() return CFrame.new(self.Position) end
function Instance:MoveTo(p) self.Position = p end
CFrame = { new = function(x, y, z) if type(x) == 'table' then return { Position = x } end return { Position = V(x, y, z) } end }

-- serviços
game = make('DataModel', 'game'); game.__p.Name = 'Game'; game.__live = true
workspace = make('Workspace', 'workspace'); workspace.__p.Name = 'Workspace'; workspace.__live = true; workspace.__p.Parent = game; table.insert(game.__ch, workspace); workspace.__p.Gravity = 196.2
local Players = make('Players', 'players'); Players.__p.Name = 'Players'
local Lighting = make('Lighting', 'lighting'); Lighting.__p.Name = 'Lighting'; Lighting.__p.ClockTime = 14
local RunService = make('RunService', 'run'); RunService.__ev.Heartbeat = newSignal(); RunService.__ev.RenderStepped = RunService.__ev.Heartbeat; RunService.__ev.Stepped = newSignal()
local UIS = make('UserInputService', 'uis'); UIS.__ev.InputBegan = newSignal(); UIS.__ev.InputEnded = newSignal(); UIS.__p.TouchEnabled = false
local Debris = make('Debris', 'debris'); function Debris.AddItem(_, o, t) task.delay(t or 10, function() if o.Destroy then o:Destroy() end end) end
local TweenService = make('TweenService', 'tween')
function TweenService.Create(_, obj, info, goal) local tw = { Completed = newSignal() } function tw:Play() task.spawn(function()
    local t0, start = 0, {} for k, v in pairs(goal) do start[k] = obj[k] end task.wait(info.DelayTime or 0)
    local reps = (info.RepeatCount or 0) + 1 for r = 1, reps do t0 = 0 while t0 < info.Time do t0 = t0 + task.wait() local a = math.min(1, t0 / info.Time) a = a * a * (3 - 2 * a)
      for k, v in pairs(goal) do local s = start[k] if type(v) == 'number' then obj[k] = s + (v - s) * a elseif getmetatable(v) == Vector3 then obj[k] = Vector3.Lerp(s, v, a) elseif getmetatable(v) == Color3 then obj[k] = Color3.Lerp(s, v, a) end end end
      if info.Reverses then for k, v in pairs(start) do obj[k] = v end end end tw.Completed:Fire() end) end function tw:Cancel() end return tw end
local ReplicatedStorage = make('ReplicatedStorage', 'rs'); ReplicatedStorage.__p.Name = 'ReplicatedStorage'
local ServerStorage = make('ServerStorage', 'ss'); local SoundService = make('SoundService', 'snd')
local StarterGui = make('StarterGui', 'sgui'); function StarterGui.SetCore(_, k, v) if k == 'SendNotification' then api('toast', (v.Title or '') .. ' ' .. (v.Text or '')) end end
local Chat = make('Chat', 'chat'); Chat.__ev.Chatted = newSignal()
for _, sv in ipairs({ Players, Lighting, RunService, UIS, Debris, TweenService, ReplicatedStorage, ServerStorage, SoundService, StarterGui, Chat }) do sv.__p.Parent = game table.insert(game.__ch, sv) end
for nm, sv in pairs({ Lighting = Lighting, RunService = RunService, UserInputService = UIS, Debris = Debris, TweenService = TweenService, ServerStorage = ServerStorage, SoundService = SoundService, StarterGui = StarterGui, Chat = Chat }) do sv.__p.Name = nm end
script = make('Script', 'script'); script.__p.Name = 'Script'; script.__p.Parent = workspace
local SERVICES = { Workspace = workspace, Players = Players, Lighting = Lighting, RunService = RunService, UserInputService = UIS, Debris = Debris, TweenService = TweenService, ReplicatedStorage = ReplicatedStorage, ServerStorage = ServerStorage, SoundService = SoundService, StarterGui = StarterGui, Chat = Chat, TextChatService = Chat }
function game.GetService(_, n) return SERVICES[n] end
game.FindService = game.GetService
Lighting.__ev.Changed:Connect(function(k) if k == 'ClockTime' then api('time', Lighting.ClockTime) end end)
workspace.__ev.Changed:Connect(function(k) if k == 'Gravity' then api('gravity', workspace.Gravity) end end)

-- jogador local (o seu gato)
local player = make('Player', 'player'); player.__p.Name = 'Gato'; player.__p.Parent = Players; table.insert(Players.__ch, player); Players.__p.LocalPlayer = player
local char = make('Model', 'char'); char.__p.Name = 'Gato'; player.__p.Character = char; char.__p.Parent = workspace; table.insert(workspace.__ch, char)
local root = make('Part', 'hrp'); root.__p.Name = 'HumanoidRootPart'; root.__p.Parent = char; table.insert(char.__ch, root)
local hum = make('Humanoid', 'hum'); hum.__p.Name = 'Humanoid'; hum.__p.Parent = char; table.insert(char.__ch, hum); hum.__p.Health = 100; hum.__p.MaxHealth = 100; hum.__p.WalkSpeed = 16; hum.__p.JumpPower = 50
player.__ev.CharacterAdded = newSignal(); player.__ev.Chatted = newSignal()
function hum.TakeDamage(_, d) hum.Health = math.max(0, hum.Health - d) end
function hum.MoveTo(_, p) api('teleport', p.X, p.Y, p.Z) end
hum.__ev.Changed:Connect(function(k) if k == 'Health' or k == 'MaxHealth' then api('health', hum.Health, hum.MaxHealth) hum.HealthChanged:Fire(hum.Health) if hum.Health <= 0 then hum.Died:Fire() end
  elseif k == 'WalkSpeed' then api('walk', hum.WalkSpeed) elseif k == 'JumpPower' or k == 'JumpHeight' then api('jump', hum.JumpPower) end end)
root.__ev.Changed:Connect(function(k) if k == 'Position' and not rawget(root, '__sync') then local p = root.Position api('teleport', p.X, p.Y, p.Z) end end)
__playerGui = make('PlayerGui', 'pgui'); __playerGui.__p.Name = 'PlayerGui'; __playerGui.__live = true; __playerGui.__p.Parent = player; table.insert(player.__ch, __playerGui)
local ls = nil
function player.GetMouse() return { Hit = { Position = V() } } end
Players.__ev.PlayerAdded = newSignal(); Players.__ev.PlayerRemoving = newSignal()
function Players.GetPlayers() return { player } end
function Players.GetPlayerFromCharacter(_, c) if c == char then return player end return nil end

-- extras do RoleVRGO
RoleVR = {
  toast = function(t, cor) api('toast', tostring(t), cor) end,
  banner = function(t, s) api('banner', tostring(t), s or 3) end,
  say = function(t) api('say', tostring(t)) end,
  sound = function(n, vol) api('play', tostring(n), vol or 0.7) end,
  effect = function(p, cor, n) local c = cor or Color3.new(1, 0.85, 0.3) api('fx', p.X, p.Y, p.Z, floor(c.R * 255) * 65536 + floor(c.G * 255) * 256 + floor(c.B * 255), n or 20) end,
  model = function(key, p, escala, giro) nextId = nextId + 1 local id = 'm' .. nextId api('model', id, key, p.X, p.Y, p.Z, escala or 1, giro or 0) return { Destroy = function() H:emit('del', id) end } end,
  npc = function(nome, p, falas) api('npc', tostring(nome), p.X, p.Y, p.Z, table.concat(falas or { 'Miau!' }, '\n')) end,
  fly = function(on) api('fly', on and true or false) end,
  sky = function(c) api('sky', c.R, c.G, c.B) end,
  emote = function(id) api('emote', id) end,
}

-- ponte JS -> Lua
local inputMap = { KeyW = 'W', KeyA = 'A', KeyS = 'S', KeyD = 'D', KeyE = 'E', KeyF = 'F', KeyG = 'G', KeyQ = 'Q', KeyR = 'R', KeyT = 'T', KeyX = 'X', KeyZ = 'Z', KeyC = 'C', KeyV = 'V', KeyB = 'B', KeyN = 'N', KeyH = 'H', KeyJ = 'J', KeyK = 'K', KeyL = 'L', KeyI = 'I', KeyO = 'O', KeyP = 'P', KeyU = 'U', KeyY = 'Y', KeyM = 'M', Space = 'Space', ShiftLeft = 'LeftShift', Enter = 'Return', Digit1 = 'One', Digit2 = 'Two', Digit3 = 'Three', Digit4 = 'Four', Digit5 = 'Five', ArrowUp = 'Up', ArrowDown = 'Down', ArrowLeft = 'Left', ArrowRight = 'Right' }
H:setDispatch(function(_, kind, a, b, c, d, e)
  if kind == 'tick' then
    local dt = a rawset(root, '__sync', true) root.__p.Position = V(b, c, d) rawset(root, '__sync', nil)
    RunService.Stepped:Fire(now, dt) step(dt) RunService.Heartbeat:Fire(dt)
  elseif kind == 'touch' then local o = byId[a] if o then local ev = b == 1 and o.Touched or o.TouchEnded if ev then ev:Fire(root) end end
  elseif kind == 'pos' then local o = byId[a] if o then o.__p.Position = V(b, c, d) end
  elseif kind == 'key' then local k = inputMap[a] or a local inp = { KeyCode = Enum.KeyCode[k] or { Name = k }, UserInputType = Enum.UserInputType.Keyboard } if b == 1 then UIS.InputBegan:Fire(inp, false) else UIS.InputEnded:Fire(inp, false) end
  elseif kind == 'gui' then local o = byId[a] if o and o.Activated then o.Activated:Fire() o.MouseButton1Click:Fire() end
  elseif kind == 'chat' then player.Chatted:Fire(a) Chat.Chatted:Fire(a)
  elseif kind == 'player' then player.__p.Name = a char.__p.Name = a player.__p.UserId = b
  elseif kind == 'health' then hum.__p.Health = a
  end
end)
`;

// ---------- o que roda dentro do iframe ----------
export function iframeBoot() {
  // (esta função é convertida em texto e colocada no srcdoc do iframe)
  const post = (m) => parent.postMessage(Object.assign({ __rv: 1 }, m), '*');
  let dispatch = null, budget = 0;
  window.__rvhost = {
    emit(op, id, k, t, v) { post({ op, id, k, t, v: v && v.length != null && typeof v !== 'string' ? Array.from(v) : v }); },
    setDispatch(f) { dispatch = f; }
  };
  const run = (name, code) => { try { const f = fengari.load(code, '@' + name); f(); } catch (e) { post({ op: 'print', id: 'error', k: '[' + name + '] ' + (e && e.message ? e.message : String(e)) }); } };
  addEventListener('message', (ev) => { const m = ev.data; if (!m || !m.__rvh) return;
    if (m.op === 'boot') { run('RoleVRGO', m.prelude); for (const s of m.scripts) run(s.n, s.src); post({ op: 'ready' }); return; }
    if (!dispatch) return; const t0 = performance.now();
    try { if (m.op === 'tick') { dispatch('tick', m.dt, m.p[0], m.p[1], m.p[2]); for (const t of m.touch || []) dispatch('touch', t[0], t[1]); for (const q of m.pos || []) dispatch('pos', q[0], q[1], q[2], q[3]); }
      else dispatch(m.op, m.a, m.b, m.c, m.d); } catch (e) { post({ op: 'print', id: 'error', k: String(e && e.message || e) }); }
    budget += performance.now() - t0; });
  setInterval(() => { if (budget > 600) post({ op: 'print', id: 'warn', k: 'Scripts pesados: ' + Math.round(budget) + ' ms no último segundo' }); budget = 0; }, 1000);
}
