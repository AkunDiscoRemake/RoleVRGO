// Prelúdio Lua: a API no estilo Roblox do RoleVRGO Studio. Roda dentro do iframe sandbox, em dois contextos:
// 'server' (Scripts, no jogador que hospeda o mapa) e 'client' (LocalScripts, em cada jogador).
export const PRELUDE = String.raw`
local H = js.global.__rvhost
local IS_SERVER = tostring(js.global.__RV_CTX) == 'server'
local IS_CLIENT = not IS_SERVER
local floor, sqrt, abs, sin, cos, pi = math.floor, math.sqrt, math.abs, math.sin, math.cos, math.pi
local function atan2(y, x) return math.atan(y, x) end
local function num(x) if math.type(x) == 'float' and x == floor(x) and x > -2^53 and x < 2^53 then return math.tointeger(x) end return x end
local unpack = table.unpack
local TAG = IS_SERVER and '[Servidor] ' or ''
local function out(lvl, ...) local t = {} for i = 1, select('#', ...) do local v = select(i, ...) t[#t + 1] = tostring(num(v)) end H:emit('print', lvl, TAG .. table.concat(t, ' ')) end
print = function(...) out('info', ...) end
warn = function(...) out('warn', ...) end
local function jarr(t, n) local a = js.new(js.global.Array) for i = 1, n or #t do local v = t[i] if v == nil then v = false end a[i - 1] = v end return a end
local function api(n, ...) local t = table.pack(...) H:emit('api', n, nil, nil, jarr(t, t.n)) end

-- ===== biblioteca padrão do Luau que falta no Lua 5.3 =====
function math.clamp(x, a, b) if x < a then return a elseif x > b then return b end return x end
function math.sign(x) if x > 0 then return 1 elseif x < 0 then return -1 end return 0 end
function math.round(x) return floor(x + 0.5) end
function math.noise(x, y, z) local n = sin((x or 0) * 12.9898 + (y or 0) * 78.233 + (z or 0) * 37.719) * 43758.5453 return (n - floor(n)) - 0.5 end
function math.lerp(a, b, t) return a + (b - a) * t end
function string.split(s, sep) sep = sep or ',' local r = {} if sep == '' then for c in s:gmatch('.') do r[#r + 1] = c end return r end local i = 1 while true do local a, b = s:find(sep, i, true) if not a then r[#r + 1] = s:sub(i) break end r[#r + 1] = s:sub(i, a - 1) i = b + 1 end return r end
function table.find(t, v, init) for i = init or 1, #t do if t[i] == v then return i end end return nil end
function table.clear(t) for k in pairs(t) do t[k] = nil end end
function table.clone(t) local r = {} for k, v in pairs(t) do r[k] = v end return setmetatable(r, getmetatable(t)) end
function table.freeze(t) return t end
function table.isfrozen() return false end
function table.create(n, v) local r = {} for i = 1, n do r[i] = v end return r end
function table.maxn(t) local m = 0 for k in pairs(t) do if type(k) == 'number' and k > m then m = k end end return m end
utf8 = utf8 or {}

-- ===== tipos de dados =====
Vector3 = {}
local V3 = {}
local function V(x, y, z) return setmetatable({ X = x or 0, Y = y or 0, Z = z or 0 }, V3) end
V3.__index = function(t, k)
  if k == 'Magnitude' then return sqrt(t.X * t.X + t.Y * t.Y + t.Z * t.Z) end
  if k == 'Unit' then local m = sqrt(t.X * t.X + t.Y * t.Y + t.Z * t.Z) if m == 0 then return V() end return V(t.X / m, t.Y / m, t.Z / m) end
  if k == 'x' then return t.X elseif k == 'y' then return t.Y elseif k == 'z' then return t.Z end
  return Vector3[k]
end
V3.__add = function(a, b) return V(a.X + b.X, a.Y + b.Y, a.Z + b.Z) end
V3.__sub = function(a, b) return V(a.X - b.X, a.Y - b.Y, a.Z - b.Z) end
V3.__mul = function(a, b) if type(a) == 'number' then return V(b.X * a, b.Y * a, b.Z * a) elseif type(b) == 'number' then return V(a.X * b, a.Y * b, a.Z * b) end return V(a.X * b.X, a.Y * b.Y, a.Z * b.Z) end
V3.__div = function(a, b) if type(b) == 'number' then return V(a.X / b, a.Y / b, a.Z / b) end return V(a.X / b.X, a.Y / b.Y, a.Z / b.Z) end
V3.__idiv = function(a, b) if type(b) == 'number' then return V(a.X // b, a.Y // b, a.Z // b) end return V(a.X // b.X, a.Y // b.Y, a.Z // b.Z) end
V3.__unm = function(a) return V(-a.X, -a.Y, -a.Z) end
V3.__eq = function(a, b) return a.X == b.X and a.Y == b.Y and a.Z == b.Z end
V3.__tostring = function(a) return num(a.X) .. ', ' .. num(a.Y) .. ', ' .. num(a.Z) end
V3.__type = 'Vector3'
Vector3.new = V; Vector3.zero = V(0, 0, 0); Vector3.one = V(1, 1, 1); Vector3.xAxis = V(1, 0, 0); Vector3.yAxis = V(0, 1, 0); Vector3.zAxis = V(0, 0, 1)
function Vector3.Dot(a, b) return a.X * b.X + a.Y * b.Y + a.Z * b.Z end
function Vector3.Cross(a, b) return V(a.Y * b.Z - a.Z * b.Y, a.Z * b.X - a.X * b.Z, a.X * b.Y - a.Y * b.X) end
function Vector3.Lerp(a, b, t) return V(a.X + (b.X - a.X) * t, a.Y + (b.Y - a.Y) * t, a.Z + (b.Z - a.Z) * t) end
function Vector3.Abs(a) return V(abs(a.X), abs(a.Y), abs(a.Z)) end
function Vector3.Floor(a) return V(floor(a.X), floor(a.Y), floor(a.Z)) end
function Vector3.Ceil(a) return V(math.ceil(a.X), math.ceil(a.Y), math.ceil(a.Z)) end
function Vector3.Max(a, b) return V(math.max(a.X, b.X), math.max(a.Y, b.Y), math.max(a.Z, b.Z)) end
function Vector3.Min(a, b) return V(math.min(a.X, b.X), math.min(a.Y, b.Y), math.min(a.Z, b.Z)) end
function Vector3.FuzzyEq(a, b, e) e = e or 1e-5 return abs(a.X - b.X) <= e and abs(a.Y - b.Y) <= e and abs(a.Z - b.Z) <= e end
function Vector3.Angle(a, b) local d = Vector3.Dot(a.Unit, b.Unit) return math.acos(math.clamp(d, -1, 1)) end

Vector2 = {}
local V2 = {}
local function V2n(x, y) return setmetatable({ X = x or 0, Y = y or 0 }, V2) end
V2.__index = function(t, k) if k == 'Magnitude' then return sqrt(t.X * t.X + t.Y * t.Y) end if k == 'Unit' then local m = sqrt(t.X * t.X + t.Y * t.Y) if m == 0 then return V2n() end return V2n(t.X / m, t.Y / m) end return Vector2[k] end
V2.__add = function(a, b) return V2n(a.X + b.X, a.Y + b.Y) end
V2.__sub = function(a, b) return V2n(a.X - b.X, a.Y - b.Y) end
V2.__mul = function(a, b) if type(a) == 'number' then return V2n(b.X * a, b.Y * a) elseif type(b) == 'number' then return V2n(a.X * b, a.Y * b) end return V2n(a.X * b.X, a.Y * b.Y) end
V2.__div = function(a, b) if type(b) == 'number' then return V2n(a.X / b, a.Y / b) end return V2n(a.X / b.X, a.Y / b.Y) end
V2.__eq = function(a, b) return a.X == b.X and a.Y == b.Y end
V2.__tostring = function(a) return num(a.X) .. ', ' .. num(a.Y) end
V2.__type = 'Vector2'
Vector2.new = V2n; Vector2.zero = V2n(0, 0); Vector2.one = V2n(1, 1)
function Vector2.Dot(a, b) return a.X * b.X + a.Y * b.Y end
function Vector2.Lerp(a, b, t) return V2n(a.X + (b.X - a.X) * t, a.Y + (b.Y - a.Y) * t) end

Color3 = {}
local C3m = { __type = 'Color3' }
C3m.__index = Color3
local function C3(r, g, b) return setmetatable({ R = r or 0, G = g or 0, B = b or 0 }, C3m) end
C3m.__eq = function(a, b) return a.R == b.R and a.G == b.G and a.B == b.B end
C3m.__tostring = function(c) return num(c.R) .. ', ' .. num(c.G) .. ', ' .. num(c.B) end
Color3.new = C3
function Color3.fromRGB(r, g, b) return C3((r or 0) / 255, (g or 0) / 255, (b or 0) / 255) end
function Color3.fromHSV(h, s, v) local i = floor(h * 6) local f = h * 6 - i local p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s) i = i % 6
  if i == 0 then return C3(v, t, p) elseif i == 1 then return C3(q, v, p) elseif i == 2 then return C3(p, v, t) elseif i == 3 then return C3(p, q, v) elseif i == 4 then return C3(t, p, v) end return C3(v, p, q) end
function Color3.fromHex(h) h = tostring(h):gsub('#', '') return C3((tonumber(h:sub(1, 2), 16) or 0) / 255, (tonumber(h:sub(3, 4), 16) or 0) / 255, (tonumber(h:sub(5, 6), 16) or 0) / 255) end
function Color3.ToHex(c) return string.format('%02X%02X%02X', floor(c.R * 255 + 0.5), floor(c.G * 255 + 0.5), floor(c.B * 255 + 0.5)) end
function Color3.ToHSV(c) local mx, mn = math.max(c.R, c.G, c.B), math.min(c.R, c.G, c.B) local d = mx - mn local h = 0 if d > 0 then if mx == c.R then h = ((c.G - c.B) / d) % 6 elseif mx == c.G then h = (c.B - c.R) / d + 2 else h = (c.R - c.G) / d + 4 end h = h / 6 end return h, mx > 0 and d / mx or 0, mx end
function Color3.Lerp(a, b, t) return C3(a.R + (b.R - a.R) * t, a.G + (b.G - a.G) * t, a.B + (b.B - a.B) * t) end
local BRICKS = { Red = { 0.77, 0.16, 0.11 }, ['Bright red'] = { 0.77, 0.16, 0.11 }, Blue = { 0.05, 0.41, 0.67 }, ['Bright blue'] = { 0.05, 0.41, 0.67 }, Green = { 0.16, 0.5, 0.25 }, ['Bright green'] = { 0.29, 0.59, 0.29 }, Yellow = { 0.96, 0.8, 0.19 }, ['Bright yellow'] = { 0.96, 0.8, 0.19 }, White = { 0.95, 0.95, 0.95 }, ['Institutional white'] = { 0.97, 0.97, 0.97 }, Black = { 0.1, 0.1, 0.1 }, ['Really black'] = { 0.07, 0.07, 0.07 }, Gray = { 0.64, 0.64, 0.64 }, ['Medium stone grey'] = { 0.64, 0.64, 0.64 }, ['Dark stone grey'] = { 0.39, 0.37, 0.38 }, Orange = { 0.85, 0.52, 0.25 }, ['Bright orange'] = { 0.85, 0.52, 0.25 }, Pink = { 1, 0.4, 0.8 }, ['Hot pink'] = { 1, 0, 0.75 }, Purple = { 0.48, 0.18, 0.55 }, ['Bright violet'] = { 0.42, 0.2, 0.6 }, Brown = { 0.49, 0.36, 0.27 }, ['Reddish brown'] = { 0.41, 0.25, 0.16 }, Cyan = { 0.02, 0.72, 0.89 }, ['Lime green'] = { 0, 1, 0 }, ['Really red'] = { 1, 0, 0 }, ['Really blue'] = { 0, 0, 1 }, ['New Yeller'] = { 1, 1, 0 }, Gold = { 0.94, 0.74, 0.2 } }
BrickColor = { new = function(n) local c = BRICKS[n] or BRICKS.Gray return { Color = C3(c[1], c[2], c[3]), Name = BRICKS[n] and n or 'Medium stone grey', __type = 'BrickColor' } end, Random = function() local k = {} for n in pairs(BRICKS) do k[#k + 1] = n end return BrickColor.new(k[math.random(#k)]) end }
BrickColor.Red = function() return BrickColor.new('Bright red') end; BrickColor.Green = function() return BrickColor.new('Bright green') end; BrickColor.Blue = function() return BrickColor.new('Bright blue') end; BrickColor.White = function() return BrickColor.new('White') end; BrickColor.Black = function() return BrickColor.new('Black') end; BrickColor.Yellow = function() return BrickColor.new('Bright yellow') end
UDim = { new = function(s, o) return { Scale = s or 0, Offset = o or 0, __type = 'UDim' } end }
UDim2 = { new = function(xs, xo, ys, yo) return { X = { Scale = xs or 0, Offset = xo or 0 }, Y = { Scale = ys or 0, Offset = yo or 0 }, __udim2 = true, __type = 'UDim2' } end }
UDim2.fromScale = function(x, y) return UDim2.new(x, 0, y, 0) end; UDim2.fromOffset = function(x, y) return UDim2.new(0, x, 0, y) end
TweenInfo = { new = function(t, style, dir, rep, rev, delay) return { Time = t or 1, EasingStyle = style, EasingDirection = dir, Reverses = rev or false, RepeatCount = rep or 0, DelayTime = delay or 0, __type = 'TweenInfo' } end }
NumberRange = { new = function(a, b) return { Min = a, Max = b or a } end }
ColorSequence = { new = function(a) return { Keypoints = a } end }; NumberSequence = { new = function(a) return { Keypoints = a } end }

-- CFrame (posição + matriz de rotação 3x3, convenções do Roblox: olha para -Z)
CFrame = {}
local CFm = { __type = 'CFrame' }
local function CF(x, y, z, a, b, c, d, e, f, g, h, i) return setmetatable({ x = x or 0, y = y or 0, z = z or 0, m = { a or 1, b or 0, c or 0, d or 0, e or 1, f or 0, g or 0, h or 0, i or 1 } }, CFm) end
local function mmul(A, B) return { A[1] * B[1] + A[2] * B[4] + A[3] * B[7], A[1] * B[2] + A[2] * B[5] + A[3] * B[8], A[1] * B[3] + A[2] * B[6] + A[3] * B[9],
  A[4] * B[1] + A[5] * B[4] + A[6] * B[7], A[4] * B[2] + A[5] * B[5] + A[6] * B[8], A[4] * B[3] + A[5] * B[6] + A[6] * B[9],
  A[7] * B[1] + A[8] * B[4] + A[9] * B[7], A[7] * B[2] + A[8] * B[5] + A[9] * B[8], A[7] * B[3] + A[8] * B[6] + A[9] * B[9] } end
local function rx(a) local c, s = cos(a), sin(a) return { 1, 0, 0, 0, c, -s, 0, s, c } end
local function ry(a) local c, s = cos(a), sin(a) return { c, 0, s, 0, 1, 0, -s, 0, c } end
local function rz(a) local c, s = cos(a), sin(a) return { c, -s, 0, s, c, 0, 0, 0, 1 } end
local function fromM(x, y, z, m) return CF(x, y, z, m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9]) end
local function lookAt(at, target, up) up = up or V(0, 1, 0) local f = (target - at).Unit if f.Magnitude == 0 then return CF(at.X, at.Y, at.Z) end
  local r = Vector3.Cross(f, up).Unit if r.Magnitude == 0 then r = V(1, 0, 0) end local u = Vector3.Cross(r, f)
  return CF(at.X, at.Y, at.Z, r.X, u.X, -f.X, r.Y, u.Y, -f.Y, r.Z, u.Z, -f.Z) end
function CFrame.new(a, b, c, ...)
  if a == nil then return CF() end
  if type(a) == 'table' then if b then return lookAt(a, b) end return CF(a.X, a.Y, a.Z) end
  local n = select('#', ...) if n == 9 then return CF(a, b, c, ...) end
  if n == 4 then local qx, qy, qz, qw = ... local xx, yy, zz, xy, xz, yz, wx, wy, wz = qx * qx, qy * qy, qz * qz, qx * qy, qx * qz, qy * qz, qw * qx, qw * qy, qw * qz
    return CF(a, b, c, 1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy), 2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx), 2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy)) end
  return CF(a, b, c)
end
CFrame.lookAt = lookAt
function CFrame.Angles(x, y, z) return fromM(0, 0, 0, mmul(mmul(rx(x or 0), ry(y or 0)), rz(z or 0))) end
CFrame.fromEulerAnglesXYZ = CFrame.Angles
function CFrame.fromEulerAnglesYXZ(x, y, z) return fromM(0, 0, 0, mmul(mmul(ry(y or 0), rx(x or 0)), rz(z or 0))) end
CFrame.fromOrientation = CFrame.fromEulerAnglesYXZ
function CFrame.fromAxisAngle(ax, a) local u = ax.Unit local c, s, t = cos(a), sin(a), 1 - cos(a) local x, y, z = u.X, u.Y, u.Z
  return CF(0, 0, 0, t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c) end
function CFrame.fromMatrix(p, r, u, b) b = b or Vector3.Cross(r, u) return CF(p.X, p.Y, p.Z, r.X, u.X, b.X, r.Y, u.Y, b.Y, r.Z, u.Z, b.Z) end
CFrame.identity = CF()
local function cfpt(cf, v) local m = cf.m return V(m[1] * v.X + m[2] * v.Y + m[3] * v.Z + cf.x, m[4] * v.X + m[5] * v.Y + m[6] * v.Z + cf.y, m[7] * v.X + m[8] * v.Y + m[9] * v.Z + cf.z) end
local function cfvec(cf, v) local m = cf.m return V(m[1] * v.X + m[2] * v.Y + m[3] * v.Z, m[4] * v.X + m[5] * v.Y + m[6] * v.Z, m[7] * v.X + m[8] * v.Y + m[9] * v.Z) end
CFm.__mul = function(a, b)
  if getmetatable(b) == V3 then return cfpt(a, b) end
  local p = cfpt(a, V(b.x, b.y, b.z)) return fromM(p.X, p.Y, p.Z, mmul(a.m, b.m))
end
CFm.__add = function(a, v) return fromM(a.x + v.X, a.y + v.Y, a.z + v.Z, a.m) end
CFm.__sub = function(a, v) return fromM(a.x - v.X, a.y - v.Y, a.z - v.Z, a.m) end
CFm.__eq = function(a, b) for i = 1, 9 do if a.m[i] ~= b.m[i] then return false end end return a.x == b.x and a.y == b.y and a.z == b.z end
CFm.__tostring = function(c) local t = { num(c.x), num(c.y), num(c.z) } for i = 1, 9 do t[#t + 1] = num(c.m[i]) end return table.concat(t, ', ') end
CFm.__index = function(c, k)
  local m = c.m
  if k == 'Position' or k == 'p' then return V(c.x, c.y, c.z) elseif k == 'X' then return c.x elseif k == 'Y' then return c.y elseif k == 'Z' then return c.z
  elseif k == 'LookVector' then return V(-m[3], -m[6], -m[9]) elseif k == 'RightVector' then return V(m[1], m[4], m[7]) elseif k == 'UpVector' then return V(m[2], m[5], m[8])
  elseif k == 'XVector' then return V(m[1], m[4], m[7]) elseif k == 'YVector' then return V(m[2], m[5], m[8]) elseif k == 'ZVector' then return V(m[3], m[6], m[9])
  elseif k == 'Rotation' then return fromM(0, 0, 0, m) end
  return CFrame[k]
end
function CFrame.Inverse(c) local m = c.m local t = { m[1], m[4], m[7], m[2], m[5], m[8], m[3], m[6], m[9] } local p = { -(t[1] * c.x + t[2] * c.y + t[3] * c.z), -(t[4] * c.x + t[5] * c.y + t[6] * c.z), -(t[7] * c.x + t[8] * c.y + t[9] * c.z) } return fromM(p[1], p[2], p[3], t) end
function CFrame.ToWorldSpace(a, b) return a * b end
function CFrame.ToObjectSpace(a, b) return a:Inverse() * b end
function CFrame.PointToWorldSpace(a, v) return cfpt(a, v) end
function CFrame.PointToObjectSpace(a, v) return cfpt(a:Inverse(), v) end
function CFrame.VectorToWorldSpace(a, v) return cfvec(a, v) end
function CFrame.VectorToObjectSpace(a, v) return cfvec(a:Inverse(), v) end
function CFrame.GetComponents(c) local m = c.m return c.x, c.y, c.z, m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9] end
CFrame.components = CFrame.GetComponents
function CFrame.ToEulerAnglesYXZ(c) local m = c.m local x = math.asin(math.clamp(-m[6], -1, 1)) local y, z if abs(m[6]) < 0.9999999 then y = atan2(m[3], m[9]) z = atan2(m[4], m[5]) else y = atan2(-m[7], m[1]) z = 0 end return x, y, z end
CFrame.ToOrientation = CFrame.ToEulerAnglesYXZ
function CFrame.ToEulerAnglesXYZ(c) local m = c.m local y = math.asin(math.clamp(m[3], -1, 1)) local x, z if abs(m[3]) < 0.9999999 then x = atan2(-m[6], m[9]) z = atan2(-m[2], m[1]) else x = atan2(m[8], m[5]) z = 0 end return x, y, z end
local function toQuat(m) local tr = m[1] + m[5] + m[9] local w, x, y, z
  if tr > 0 then local s = sqrt(tr + 1) * 2 w = 0.25 * s x = (m[8] - m[6]) / s y = (m[3] - m[7]) / s z = (m[4] - m[2]) / s
  elseif m[1] > m[5] and m[1] > m[9] then local s = sqrt(1 + m[1] - m[5] - m[9]) * 2 w = (m[8] - m[6]) / s x = 0.25 * s y = (m[2] + m[4]) / s z = (m[3] + m[7]) / s
  elseif m[5] > m[9] then local s = sqrt(1 + m[5] - m[1] - m[9]) * 2 w = (m[3] - m[7]) / s x = (m[2] + m[4]) / s y = 0.25 * s z = (m[6] + m[8]) / s
  else local s = sqrt(1 + m[9] - m[1] - m[5]) * 2 w = (m[4] - m[2]) / s x = (m[3] + m[7]) / s y = (m[6] + m[8]) / s z = 0.25 * s end return x, y, z, w end
function CFrame.Lerp(a, b, t) local ax, ay, az, aw = toQuat(a.m) local bx, by, bz, bw = toQuat(b.m) local d = ax * bx + ay * by + az * bz + aw * bw if d < 0 then bx, by, bz, bw, d = -bx, -by, -bz, -bw, -d end
  local x, y, z, w if d > 0.9995 then x, y, z, w = ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t, aw + (bw - aw) * t else local th = math.acos(d) local s0, s1 = sin((1 - t) * th) / sin(th), sin(t * th) / sin(th) x, y, z, w = ax * s0 + bx * s1, ay * s0 + by * s1, az * s0 + bz * s1, aw * s0 + bw * s1 end
  local n = sqrt(x * x + y * y + z * z + w * w) return CFrame.new(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t, x / n, y / n, z / n, w / n) end
function CFrame.ToAxisAngle(c) local x, y, z, w = toQuat(c.m) local a = 2 * math.acos(math.clamp(w, -1, 1)) local s = sqrt(1 - w * w) if s < 1e-6 then return V(1, 0, 0), 0 end return V(x / s, y / s, z / s), a end

-- Random
Random = {}
local RNm = { __index = Random, __type = 'Random' }
function Random.new(seed) local s = floor(seed or os.time() * 1000) % 2147483647 if s <= 0 then s = s + 2147483646 end return setmetatable({ s = s }, RNm) end
local function rnext(r) r.s = (r.s * 16807) % 2147483647 return r.s / 2147483647 end
function Random:NextNumber(a, b) a = a or 0 b = b or 1 return a + (b - a) * rnext(self) end
function Random:NextInteger(a, b) return a + floor(rnext(self) * (b - a + 1)) end
function Random:NextUnitVector() local z = rnext(self) * 2 - 1 local t = rnext(self) * 2 * pi local r = sqrt(1 - z * z) return V(r * cos(t), r * sin(t), z) end
function Random:Shuffle(t) for i = #t, 2, -1 do local j = self:NextInteger(1, i) t[i], t[j] = t[j], t[i] end end
function Random:Clone() return setmetatable({ s = self.s }, RNm) end
DateTime = { now = function() return { UnixTimestamp = os.time(), UnixTimestampMillis = os.time() * 1000 } end }

-- Enum
local function enumItem(cat, n, v) return { Name = n, Value = v, EnumType = cat, __type = 'EnumItem' } end
local function enumCat(cat, names) local t = {} for i, n in ipairs(names) do t[n] = enumItem(cat, n, i - 1) end return setmetatable(t, { __index = function(_, k) local e = enumItem(cat, k, -1) rawset(t, k, e) return e end }) end
local KEYS = { 'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','Space','LeftShift','RightShift','LeftControl','Return','Tab','Backspace','Escape','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Zero','Up','Down','Left','Right' }
Enum = {
  KeyCode = enumCat('KeyCode', KEYS), UserInputType = enumCat('UserInputType', { 'Keyboard', 'MouseButton1', 'MouseButton2', 'MouseMovement', 'Touch', 'Gamepad1' }),
  UserInputState = enumCat('UserInputState', { 'Begin', 'Change', 'End' }), PartType = enumCat('PartType', { 'Ball', 'Block', 'Cylinder' }), Material = enumCat('Material', { 'Plastic', 'SmoothPlastic', 'Neon', 'Wood', 'Metal', 'Grass', 'Glass', 'Brick', 'Concrete', 'Sand', 'Ice', 'Slate' }),
  EasingStyle = enumCat('EasingStyle', { 'Linear', 'Sine', 'Quad', 'Cubic', 'Back', 'Bounce', 'Elastic', 'Exponential' }), EasingDirection = enumCat('EasingDirection', { 'In', 'Out', 'InOut' }),
  RaycastFilterType = enumCat('RaycastFilterType', { 'Exclude', 'Include', 'Blacklist', 'Whitelist' }), HumanoidStateType = enumCat('HumanoidStateType', { 'Running', 'Jumping', 'Freefall', 'Dead' }),
  Font = enumCat('Font', { 'SourceSans', 'GothamBold', 'Gotham', 'Arcade', 'Cartoon', 'FredokaOne' }), TextXAlignment = enumCat('TextXAlignment', { 'Left', 'Center', 'Right' }), SortOrder = enumCat('SortOrder', { 'LayoutOrder', 'Name' }),
}
for _, k in ipairs(KEYS) do Enum.KeyCode[k].__key = k end
function typeof(v) local t = type(v) if t == 'table' then local mt = getmetatable(v) if mt and mt.__type then return mt.__type end if v.__type then return v.__type end if v.__id then return 'Instance' end end if t == 'thread' then return 'thread' end return t end

-- ===== JSON (também transporta Vector3/Color3/CFrame/Instance entre servidor e clientes) =====
local byId = {}
local function jstr(s) return '"' .. s:gsub('[%c"\\]', function(c) local m = { ['"'] = '\\"', ['\\'] = '\\\\', ['\n'] = '\\n', ['\r'] = '\\r', ['\t'] = '\\t' } return m[c] or string.format('\\u%04x', c:byte()) end) .. '"' end
local function enc(v, depth)
  depth = (depth or 0) + 1 if depth > 40 then error('tabela aninhada demais') end
  local t = type(v)
  if v == nil then return 'null' elseif t == 'boolean' then return tostring(v) elseif t == 'number' then if v ~= v or v == math.huge or v == -math.huge then return '0' end return tostring(num(v)) elseif t == 'string' then return jstr(v) end
  if t == 'table' then
    local mt = getmetatable(v)
    if mt == V3 then return '{"$v3":[' .. v.X .. ',' .. v.Y .. ',' .. v.Z .. ']}' elseif mt == C3m then return '{"$c3":[' .. v.R .. ',' .. v.G .. ',' .. v.B .. ']}' elseif mt == V2 then return '{"$v2":[' .. v.X .. ',' .. v.Y .. ']}'
    elseif mt == CFm then return '{"$cf":[' .. table.concat({ CFrame.GetComponents(v) }, ',') .. ']}' elseif v.__id then return '{"$ref":' .. jstr(v.__id) .. '}' elseif v.__udim2 then return '{"$u2":[' .. v.X.Scale .. ',' .. v.X.Offset .. ',' .. v.Y.Scale .. ',' .. v.Y.Offset .. ']}'
    elseif v.__type == 'EnumItem' then return '{"$enum":[' .. jstr(v.EnumType) .. ',' .. jstr(v.Name) .. ']}' end
    local n = #v local isArr = n > 0 or next(v) == nil
    if isArr then for k in pairs(v) do if type(k) ~= 'number' then isArr = false break end end end
    local parts = {}
    if isArr then for i = 1, n do parts[i] = enc(v[i], depth) end return '[' .. table.concat(parts, ',') .. ']' end
    for k, x in pairs(v) do if type(x) ~= 'function' and type(x) ~= 'thread' then parts[#parts + 1] = jstr(tostring(k)) .. ':' .. enc(x, depth) end end
    return '{' .. table.concat(parts, ',') .. '}'
  end
  return 'null'
end
local function dec(s)
  local i = 1
  local function ws() i = s:find('[^ \t\r\n]', i) or #s + 1 end
  local val
  local function str() local j, buf = i + 1, {} while true do local c = s:sub(j, j) if c == '"' then break elseif c == '\\' then local e = s:sub(j + 1, j + 1) local m = { n = '\n', r = '\r', t = '\t', b = '\b', f = '\f', ['/'] = '/', ['\\'] = '\\', ['"'] = '"' }
        if e == 'u' then local cp = tonumber(s:sub(j + 2, j + 5), 16) buf[#buf + 1] = utf8.char(cp) j = j + 6 else buf[#buf + 1] = m[e] or e j = j + 2 end
      elseif c == '' then error('JSON inválido') else buf[#buf + 1] = c j = j + 1 end end i = j + 1 return table.concat(buf) end
  val = function()
    ws() local c = s:sub(i, i)
    if c == '{' then i = i + 1 local o = {} ws() if s:sub(i, i) == '}' then i = i + 1 return o end
      while true do ws() local k = str() ws() i = i + 1 o[k] = val() ws() local d = s:sub(i, i) i = i + 1 if d == '}' then break end end
      if o['$v3'] then local a = o['$v3'] return V(a[1], a[2], a[3]) elseif o['$c3'] then local a = o['$c3'] return C3(a[1], a[2], a[3]) elseif o['$v2'] then local a = o['$v2'] return V2n(a[1], a[2])
      elseif o['$cf'] then return CFrame.new(unpack(o['$cf'])) elseif o['$ref'] then return byId[o['$ref']] elseif o['$u2'] then local a = o['$u2'] return UDim2.new(a[1], a[2], a[3], a[4]) elseif o['$enum'] then local a = o['$enum'] return Enum[a[1]] and Enum[a[1]][a[2]] or a[2] end
      return o
    elseif c == '[' then i = i + 1 local a = {} ws() if s:sub(i, i) == ']' then i = i + 1 return a end
      while true do a[#a + 1] = val() ws() local d = s:sub(i, i) i = i + 1 if d == ']' then break end end return a
    elseif c == '"' then return str()
    elseif s:sub(i, i + 3) == 'true' then i = i + 4 return true elseif s:sub(i, i + 4) == 'false' then i = i + 5 return false elseif s:sub(i, i + 3) == 'null' then i = i + 4 return nil
    else local n = s:match('^-?%d+%.?%d*[eE]?[-+]?%d*', i) i = i + #n return num(tonumber(n)) end
  end
  return val()
end
local function packArgs(...) local t = table.pack(...) local a = {} for i = 1, t.n do a[i] = t[i] == nil and '__nil' or t[i] end return enc(a) end
local function unpackArgs(js) local a = dec(js) or {} for i = 1, #a do if a[i] == '__nil' then a[i] = nil end end return a, #a end

-- ===== Signals e agendador =====
local Signal = {}
Signal.__index = Signal
local function newSignal() return setmetatable({ fns = {} }, Signal) end
function Signal:Connect(f) local c = { Connected = true } local s = self c.Disconnect = function() c.Connected = false for i, g in ipairs(s.fns) do if g == f then table.remove(s.fns, i) break end end end table.insert(self.fns, f) return c end
function Signal:Once(f) local c c = self:Connect(function(...) c.Disconnect() f(...) end) return c end
function Signal:Wait() local co = coroutine.running() local c c = self:Connect(function(...) c.Disconnect() __resume(co, ...) end) return coroutine.yield() end
function Signal:Fire(...) for _, f in ipairs({ unpack(self.fns) }) do __spawn(f, ...) end end
Signal.connect = Signal.Connect; Signal.wait = Signal.Wait
local waiting, now = {}, 0
function __resume(co, ...) if coroutine.status(co) == 'dead' then return end local ok, err = coroutine.resume(co, ...) if not ok then out('error', debug.traceback(co, tostring(err))) end end
function __spawn(f, ...) local co = coroutine.create(f) __resume(co, ...) return co end
task = {}
function task.wait(t) t = t or 0 local co = coroutine.running() if not co or not coroutine.isyieldable() then return 0 end table.insert(waiting, { co = co, at = now + t, t0 = now }) return coroutine.yield() end
function task.spawn(f, ...) if type(f) == 'thread' then __resume(f, ...) return f end return __spawn(f, ...) end
function task.defer(f, ...) local a = table.pack(...) table.insert(waiting, { fn = function() f(unpack(a, 1, a.n)) end, at = now }) end
function task.delay(t, f, ...) local a = table.pack(...) table.insert(waiting, { fn = function() f(unpack(a, 1, a.n)) end, at = now + (t or 0) }) end
function task.cancel(co) for i = #waiting, 1, -1 do if waiting[i].co == co then table.remove(waiting, i) end end end
function task.synchronize() end; function task.desynchronize() end
wait = task.wait; spawn = task.spawn; delay = task.delay
function tick() return now end; function time() return now end; function elapsedTime() return now end
local reqs, reqN = {}, 0
local function newReq() reqN = reqN + 1 return reqN end
local function waitReq(q) local co = coroutine.running() if not co or not coroutine.isyieldable() then error('esta função precisa rodar dentro de um script (pode esperar)') end reqs[q] = co return coroutine.yield() end
local function step(dt) now = now + dt local ready = {} for i = #waiting, 1, -1 do local w = waiting[i] if w.at <= now then table.remove(waiting, i) table.insert(ready, w) end end
  for _, w in ipairs(ready) do if w.co then __resume(w.co, now - w.t0) else __spawn(w.fn) end end end

-- ===== Instâncias =====
local nextId = 0
local IDP = IS_SERVER and 'S' or 'C'
Instance = {}
local CLASSES = { Part = 'part', SpawnLocation = 'part', WedgePart = 'part', MeshPart = 'part', TrussPart = 'part', CornerWedgePart = 'part', UnionOperation = 'part', Seat = 'part',
  Model = 'container', Folder = 'container', Configuration = 'container', Script = 'container', LocalScript = 'container', Attachment = 'container', Decal = 'container', Texture = 'container', SurfaceGui = 'container', BillboardGui = 'container', Accessory = 'container', Tool = 'container',
  StringValue = 'value', IntValue = 'value', NumberValue = 'value', BoolValue = 'value', ObjectValue = 'value', Vector3Value = 'value', Color3Value = 'value', CFrameValue = 'value',
  ScreenGui = 'gui', Frame = 'gui', TextLabel = 'gui', TextButton = 'gui', ImageLabel = 'gui', ImageButton = 'gui', TextBox = 'gui', ScrollingFrame = 'gui', UICorner = 'container', UIListLayout = 'container', UIGridLayout = 'container', UIPadding = 'container', UIStroke = 'container', UIGradient = 'container',
  PointLight = 'light', SpotLight = 'light', SurfaceLight = 'light', Sound = 'sound', Humanoid = 'humanoid', ParticleEmitter = 'fx', Fire = 'fx', Smoke = 'fx', Sparkles = 'fx',
  RemoteEvent = 'remote', UnreliableRemoteEvent = 'remote', RemoteFunction = 'rfunc', BindableEvent = 'bind', BindableFunction = 'bindf', ClickDetector = 'clickdet', ProximityPrompt = 'prompt', Explosion = 'explosion', ModuleScript = 'module', Team = 'team', Player = 'player' }
local VALDEF = { StringValue = '', IntValue = 0, NumberValue = 0, BoolValue = false, Vector3Value = V(), Color3Value = C3(), CFrameValue = CF() }
local DEF = { part = { Size = V(4, 1, 2), Position = V(0, 5, 0), Orientation = V(0, 0, 0), Color = C3(0.64, 0.64, 0.64), Transparency = 0, Anchored = true, CanCollide = true, CanTouch = true, Shape = 'Block', Material = 'Plastic', Velocity = V(0, 0, 0), Reflectance = 0, Locked = false, Massless = false },
  gui = { Visible = true, Text = '', TextSize = 22, TextColor3 = C3(1, 1, 1), BackgroundColor3 = C3(0.13, 0.12, 0.2), BackgroundTransparency = 0, Position = UDim2.new(0, 0, 0, 0), Size = UDim2.new(0, 200, 0, 50), Image = '', Enabled = true, TextScaled = false, ZIndex = 1, LayoutOrder = 0 },
  light = { Brightness = 1, Range = 12, Color = C3(1, 0.9, 0.7), Enabled = true }, sound = { SoundId = '', Volume = 0.6, Looped = false, Playing = false, PlaybackSpeed = 1 },
  clickdet = { MaxActivationDistance = 32 }, prompt = { ActionText = 'Interagir', ObjectText = '', MaxActivationDistance = 10, HoldDuration = 0, Enabled = true, KeyboardKeyCode = 'E', RequiresLineOfSight = false },
  explosion = { Position = V(0, 0, 0), BlastRadius = 4, BlastPressure = 500000, DestroyJointRadiusPercent = 1 }, team = { TeamColor = 'White', AutoAssignable = true }, fx = { Enabled = true } }
local SYNC = { Size = 1, Position = 1, Orientation = 1, Color = 1, Transparency = 1, Anchored = 1, CanCollide = 1, Shape = 1, Name = 1, Text = 1, TextSize = 1, TextColor3 = 1, BackgroundColor3 = 1, BackgroundTransparency = 1, Visible = 1, Enabled = 1,
  Brightness = 1, Range = 1, Velocity = 1, Image = 1, Value = 1, UserId = 1, DisplayName = 1, ActionText = 1, ObjectText = 1, MaxActivationDistance = 1, KeyboardKeyCode = 1, BlastRadius = 1, Material = 1 }
local EVENTS = { part = { 'Touched', 'TouchEnded' }, gui = { 'Activated', 'MouseButton1Click', 'MouseButton1Down', 'MouseButton1Up', 'MouseEnter', 'MouseLeave', 'FocusLost' }, humanoid = { 'Died', 'HealthChanged', 'Running', 'Jumping', 'StateChanged' }, sound = { 'Ended', 'Played' },
  remote = { 'OnServerEvent', 'OnClientEvent' }, bind = { 'Event' }, clickdet = { 'MouseClick', 'MouseHoverEnter', 'MouseHoverLeave' }, prompt = { 'Triggered', 'TriggerEnded', 'PromptShown', 'PromptHidden' }, explosion = { 'Hit' },
  player = { 'CharacterAdded', 'CharacterRemoving', 'Chatted' }, value = {} }
local Obj = {}
local live, emitNew, emitDel, emitSet
Obj.__index = function(t, k)
  local p = rawget(t, '__p') local v = p[k] if v ~= nil then return v end
  if k == 'CFrame' and rawget(t, '__kind') == 'part' then local o = p.Orientation local pos = p.Position local cf = CFrame.fromOrientation(math.rad(o.X), math.rad(o.Y), math.rad(o.Z)) return cf + pos end
  if k == 'BrickColor' and p.Color then local c = p.Color return { Color = c, Name = '#' .. Color3.ToHex(c), __type = 'BrickColor' } end
  local m = Instance[k] if m ~= nil then return m end
  for _, c in ipairs(rawget(t, '__ch')) do if c.__p.Name == k then return c end end
  local ev = rawget(t, '__ev') if ev[k] then return ev[k] end
  local ex = rawget(t, '__x') if ex and ex[k] ~= nil then return ex[k] end
  return nil
end
Obj.__newindex = function(t, k, v)
  if type(k) == 'string' and k:sub(1, 2) == '__' then rawset(t, k, v) return end -- campos internos ficam fora das propriedades
  local p = rawget(t, '__p')
  if k == 'Parent' then t:__setParent(v) return end
  if k == 'CFrame' and type(v) == 'table' then local rx_, ry_, rz_ = CFrame.ToOrientation(v) p.Position = V(v.x, v.y, v.z) p.Orientation = V(math.deg(rx_), math.deg(ry_), math.deg(rz_)) if live(t) then emitSet(t, 'Position', p.Position) emitSet(t, 'Orientation', p.Orientation) end t.Changed:Fire('CFrame') return end
  if k == 'BrickColor' and type(v) == 'table' then k = 'Color' v = v.Color end
  if k == 'KeyboardKeyCode' and type(v) == 'table' then v = v.Name end
  if k == 'Shape' and type(v) == 'table' then v = v.Name end
  if k == 'Material' and type(v) == 'table' then v = v.Name end
  if p[k] == v and type(v) ~= 'table' then return end
  p[k] = v
  if SYNC[k] and live(t) then emitSet(t, k, v) end
  local h = rawget(t, '__onset') if h then h(t, k, v) end
  local chg = rawget(t, '__chg') if chg[k] then chg[k]:Fire(v) end
  if rawget(t, '__kind') == 'value' and k == 'Value' then t.Changed:Fire(v) else t.Changed:Fire(k) end
end
Obj.__tostring = function(t) return t.__p.Name end
Obj.__eq = function(a, b) return rawequal(a, b) end
local function make(cls, id)
  local kind = CLASSES[cls] or 'container'
  local o = { __id = id, __cls = cls, __kind = kind, __p = { Name = cls, ClassName = cls, Archivable = true }, __ch = {}, __ev = { Changed = newSignal(), ChildAdded = newSignal(), ChildRemoved = newSignal(), DescendantAdded = newSignal(), DescendantRemoving = newSignal(), AncestryChanged = newSignal(), Destroying = newSignal(), AttributeChanged = newSignal() }, __chg = {}, __live = false, __attr = {}, __tags = {} }
  for k, v in pairs(DEF[kind] or {}) do o.__p[k] = (type(v) == 'table' and getmetatable(v) == V3) and V(v.X, v.Y, v.Z) or v end
  if kind == 'value' then o.__p.Value = VALDEF[cls] end
  for _, e in ipairs(EVENTS[kind] or {}) do o.__ev[e] = newSignal() end
  setmetatable(o, Obj) byId[id] = o return o
end
function Instance.new(cls, parent) if not CLASSES[cls] and cls ~= 'Configuration' then warn('Classe ' .. tostring(cls) .. ' não existe no RoleVRGO (criada como pasta)') end nextId = nextId + 1 local o = make(cls, IDP .. nextId) if parent then o.Parent = parent end return o end
local roots = {}
live = function(o) if rawget(o, '__virtual') then return false end local x = o while x do if roots[x] then return true end x = rawget(x, '__p').Parent end return false end
emitSet = function(o, k, v) H:emit('set', o.__id, k, nil, enc(v)) end
local function props(o) local t = {} for k, v in pairs(o.__p) do if SYNC[k] and v ~= nil then t[k] = v end end return enc(t) end
emitNew = function(o) if o.__live or rawget(o, '__virtual') or rawget(o, '__rep') then return end o.__live = true H:emit('new', o.__id, o.__cls, o.__p.Parent and o.__p.Parent.__id or false, props(o)) for _, c in ipairs(o.__ch) do emitNew(c) end end
emitDel = function(o) if not o.__live or rawget(o, '__rep') then return end o.__live = false H:emit('del', o.__id) for _, c in ipairs(o.__ch) do emitDel(c) end end
function Instance:__setParent(v)
  local old = self.__p.Parent if old == v then return end
  if v == self then error('não dá para ser pai de si mesmo') end
  if old then for i, c in ipairs(old.__ch) do if c == self then table.remove(old.__ch, i) break end end old.ChildRemoved:Fire(self) end
  self.__p.Parent = v
  if v then table.insert(v.__ch, self) v.ChildAdded:Fire(self) local a = v while a do a.DescendantAdded:Fire(self) a = a.__p.Parent end end
  if live(self) then if self.__live then H:emit('parent', self.__id, nil, nil, v and v.__id or false) else emitNew(self) end else emitDel(self) end
  self.AncestryChanged:Fire(self, v)
  local h = rawget(self, '__onparent') if h then h(self, v) end
end
function Instance:IsA(c) local k = self.__kind return self.__cls == c or c == 'Instance' or (c == 'BasePart' and k == 'part') or (c == 'PVInstance' and (k == 'part' or self.__cls == 'Model')) or (c == 'GuiObject' and k == 'gui' and self.__cls ~= 'ScreenGui') or (c == 'GuiBase2d' and k == 'gui') or (c == 'ValueBase' and k == 'value') or (c == 'LuaSourceContainer' and (self.__cls == 'Script' or self.__cls == 'LocalScript' or self.__cls == 'ModuleScript')) or (c == 'Light' and k == 'light') or (c == 'GuiButton' and (self.__cls == 'TextButton' or self.__cls == 'ImageButton')) end
function Instance:GetChildren() return { unpack(self.__ch) } end
function Instance:GetDescendants() local r = {} local function rec(o) for _, c in ipairs(o.__ch) do r[#r + 1] = c rec(c) end end rec(self) return r end
function Instance:FindFirstChild(n, rec) for _, c in ipairs(self.__ch) do if c.__p.Name == n then return c end end if rec then for _, c in ipairs(self.__ch) do local f = c:FindFirstChild(n, true) if f then return f end end end return nil end
function Instance:FindFirstChildOfClass(cn) for _, c in ipairs(self.__ch) do if c.__cls == cn then return c end end return nil end
function Instance:FindFirstChildWhichIsA(cn, rec) for _, c in ipairs(self.__ch) do if c:IsA(cn) then return c end end if rec then for _, c in ipairs(self.__ch) do local f = c:FindFirstChildWhichIsA(cn, true) if f then return f end end end return nil end
function Instance:FindFirstAncestor(n) local p = self.__p.Parent while p do if p.__p.Name == n then return p end p = p.__p.Parent end return nil end
function Instance:FindFirstAncestorOfClass(cn) local p = self.__p.Parent while p do if p.__cls == cn then return p end p = p.__p.Parent end return nil end
function Instance:FindFirstAncestorWhichIsA(cn) local p = self.__p.Parent while p do if p:IsA(cn) then return p end p = p.__p.Parent end return nil end
function Instance:IsDescendantOf(a) local p = self.__p.Parent while p do if p == a then return true end p = p.__p.Parent end return false end
function Instance:IsAncestorOf(d) return d:IsDescendantOf(self) end
function Instance:WaitForChild(n, t) local f = self:FindFirstChild(n) if not f and not coroutine.isyieldable() then warn('WaitForChild("' .. n .. '") fora de uma corrotina') return nil end local waited = 0 while not f and (not t or waited < t) do waited = waited + task.wait(0.05) f = self:FindFirstChild(n) if not t and waited > 5 and not rawget(self, '__warned' .. n) then rawset(self, '__warned' .. n, true) warn('WaitForChild esperando "' .. n .. '" em ' .. self:GetFullName()) end end return f end
function Instance:GetPropertyChangedSignal(k) local c = rawget(self, '__chg') if not c[k] then c[k] = newSignal() end return c[k] end
function Instance:GetAttributeChangedSignal(k) return self:GetPropertyChangedSignal('@' .. k) end
function Instance:SetAttribute(k, v) self.__attr[k] = v self.AttributeChanged:Fire(k) local c = rawget(self, '__chg')['@' .. k] if c then c:Fire(v) end end
function Instance:GetAttribute(k) return self.__attr[k] end
function Instance:GetAttributes() return table.clone(self.__attr) end
function Instance:GetFullName() local n, p = self.__p.Name, self.__p.Parent while p and p ~= game do n = p.__p.Name .. '.' .. n p = p.__p.Parent end return n end
function Instance:Destroy() if rawget(self, '__destroyed') then return end rawset(self, '__destroyed', true) self.Destroying:Fire() for _, c in ipairs({ unpack(self.__ch) }) do c:Destroy() end self:__setParent(nil) byId[self.__id] = nil end
Instance.Remove = Instance.Destroy
function Instance:ClearAllChildren() for _, c in ipairs({ unpack(self.__ch) }) do c:Destroy() end end
function Instance:Clone() local c = Instance.new(self.__cls) for k, v in pairs(self.__p) do if k ~= 'Parent' then c.__p[k] = (type(v) == 'table' and getmetatable(v) == V3) and V(v.X, v.Y, v.Z) or v end end for k, v in pairs(self.__attr) do c.__attr[k] = v end for _, ch in ipairs(self.__ch) do ch:Clone().Parent = c end return c end
function Instance:ApplyImpulse(v) self.Velocity = self.Velocity + v end
function Instance:ApplyAngularImpulse() end
function Instance:GetMass() local s = self.__p.Size return s and s.X * s.Y * s.Z * 0.7 or 0 end
function Instance:SetNetworkOwner() end
function Instance:GetNetworkOwner() return nil end
function Instance:BreakJoints() end
function Instance:GetTouchingParts() return {} end
function Instance:PivotTo(cf) if self.__kind == 'part' then self.CFrame = cf else local pp = self.__p.PrimaryPart or self:FindFirstChildWhichIsA('BasePart', true) if pp then local delta = cf.Position - pp.Position for _, d in ipairs(self:GetDescendants()) do if d.__kind == 'part' then d.Position = d.Position + delta end end end end end
function Instance:GetPivot() if self.__kind == 'part' then return self.CFrame end local pp = self.__p.PrimaryPart or self:FindFirstChildWhichIsA('BasePart', true) return pp and pp.CFrame or CF() end
function Instance:MoveTo(pos) if self.__kind == 'part' then self.Position = pos else self:PivotTo(CFrame.new(pos)) end end
function Instance:SetPrimaryPartCFrame(cf) self:PivotTo(cf) end
function Instance:GetBoundingBox() local mn, mx for _, d in ipairs(self:GetDescendants()) do if d.__kind == 'part' then local h = d.Size / 2 local a, b = d.Position - h, d.Position + h mn = mn and Vector3.Min(mn, a) or a mx = mx and Vector3.Max(mx, b) or b end end if not mn then return CF(), V() end return CFrame.new((mn + mx) / 2), mx - mn end
function Instance:GetExtentsSize() local _, s = self:GetBoundingBox() return s end
function Instance:Play() self.Playing = true if IS_SERVER then api('soundAll', self.__p.SoundId, self.__p.Volume) else H:emit('sound', self.__id, self.__p.SoundId, nil, self.__p.Volume) end self.Played:Fire() end
function Instance:Stop() self.Playing = false end
function Instance:Pause() self.Playing = false end
function Instance:Resume() self.Playing = true end
function Instance:Emit() local p = self.__p.Parent if p and p.__kind == 'part' then api('fx', p.Position.X, p.Position.Y, p.Position.Z, 16766032, 18) end end
function Instance:LoadAnimation() return { Play = function() end, Stop = function() end, AdjustSpeed = function() end, Stopped = newSignal(), IsPlaying = false } end
function Instance:GetPlayingAnimationTracks() return {} end
-- remotos e bindables
function Instance:FireServer(...) if IS_SERVER then error('FireServer só funciona em LocalScripts') end api('fireServer', self.__id, packArgs(...)) end
function Instance:FireClient(pl, ...) if not IS_SERVER then error('FireClient só funciona em Scripts do servidor') end if not pl or not pl.__p.UserId then error('FireClient precisa de um Player') end api('fireClient', self.__id, pl.__p.UserId, packArgs(...)) end
function Instance:FireAllClients(...) if not IS_SERVER then error('FireAllClients só funciona em Scripts do servidor') end api('fireAll', self.__id, packArgs(...)) end
function Instance:InvokeServer(...) if IS_SERVER then error('InvokeServer só funciona em LocalScripts') end local q = newReq() api('invokeServer', self.__id, q, packArgs(...)) local ok, js = waitReq(q) local a, n = unpackArgs(js) return unpack(a, 1, n) end
function Instance:InvokeClient() error('InvokeClient não é suportado no RoleVRGO (use RemoteEvent)') end
function Instance:Fire(...) if self.__kind == 'bind' then self.Event:Fire(...) end end
function Instance:Invoke(...) local f = self.__p.OnInvoke if not f then error('BindableFunction sem OnInvoke') end return f(...) end

-- ===== serviços =====
local function service(cls, name) local s = make(cls, 'svc_' .. cls) s.__p.Name = name or cls return s end
game = make('DataModel', 'game'); game.__p.Name = 'Game'; game.__p.PlaceId = 0; game.__p.GameId = 0; game.__p.JobId = ''; game.__p.CreatorId = 0; game.__p.PlaceVersion = 1
workspace = service('Workspace'); Workspace = workspace; workspace.__p.Gravity = 196.2; workspace.__p.DistributedGameTime = 0
local Players = service('Players')
local Lighting = service('Lighting'); Lighting.__p.ClockTime = 14; Lighting.__p.Brightness = 2; Lighting.__p.FogEnd = 100000
local RunService = service('RunService'); RunService.__ev.Heartbeat = newSignal(); RunService.__ev.RenderStepped = RunService.__ev.Heartbeat; RunService.__ev.Stepped = newSignal(); RunService.__ev.PreSimulation = RunService.__ev.Heartbeat; RunService.__ev.PostSimulation = RunService.__ev.Heartbeat
function RunService.IsServer() return IS_SERVER end; function RunService.IsClient() return IS_CLIENT end; function RunService.IsStudio() return true end; function RunService.IsRunning() return true end
function RunService.BindToRenderStep(_, n, p, f) RunService.__x = RunService.__x or {} local c = RunService.Heartbeat:Connect(f) RunService.__x['bind_' .. n] = c end
function RunService.UnbindFromRenderStep(_, n) local c = RunService.__x and RunService.__x['bind_' .. n] if c then c.Disconnect() end end
local UIS = service('UserInputService'); UIS.__ev.InputBegan = newSignal(); UIS.__ev.InputEnded = newSignal(); UIS.__ev.InputChanged = newSignal(); UIS.__ev.JumpRequest = newSignal(); UIS.__p.TouchEnabled = false; UIS.__p.KeyboardEnabled = true; UIS.__p.MouseEnabled = true; UIS.__p.GamepadEnabled = false; UIS.__p.VREnabled = false
local keysDown = {}
function UIS.IsKeyDown(_, k) return keysDown[type(k) == 'table' and k.Name or k] == true end
function UIS.GetKeysPressed() local r = {} for k in pairs(keysDown) do r[#r + 1] = { KeyCode = Enum.KeyCode[k] } end return r end
function UIS.GetMouseLocation() return V2n(0, 0) end
local CAS = service('ContextActionService')
function CAS.BindAction(_, name, fn, touch, ...) local keys = { ... } CAS.__x = CAS.__x or {} CAS.__x[name] = UIS.InputBegan:Connect(function(inp) for _, k in ipairs(keys) do if inp.KeyCode == k then fn(name, Enum.UserInputState.Begin, inp) end end end) end
function CAS.UnbindAction(_, name) if CAS.__x and CAS.__x[name] then CAS.__x[name].Disconnect() end end
local Debris = service('Debris'); function Debris.AddItem(_, o, t) task.delay(t or 10, function() if o.Destroy then o:Destroy() end end) end
local function ease(style, a) local s = type(style) == 'table' and style.Name or style if s == 'Linear' then return a elseif s == 'Quad' then return a * a elseif s == 'Back' then return a * a * (2.7 * a - 1.7) elseif s == 'Bounce' then local n = 1 - a if n < 1 / 2.75 then return 1 - 7.5625 * n * n elseif n < 2 / 2.75 then n = n - 1.5 / 2.75 return 1 - (7.5625 * n * n + 0.75) else n = n - 2.25 / 2.75 return 1 - (7.5625 * n * n + 0.9375) end elseif s == 'Elastic' then return a == 0 and 0 or a == 1 and 1 or -(2 ^ (10 * (a - 1))) * sin((a - 1.075) * 2 * pi / 0.3) end return a * a * (3 - 2 * a) end
local TweenService = service('TweenService')
function TweenService.Create(_, obj, info, goal)
  local tw = { Completed = newSignal(), PlaybackState = 'Begin' } local running = false
  function tw.Cancel() running = false end function tw.Pause() running = false end
  local playImpl = function() if running then return end running = true task.spawn(function()
    local start = {} for k in pairs(goal) do start[k] = obj[k] end task.wait(info.DelayTime or 0)
    local reps = (info.RepeatCount or 0) if reps < 0 then reps = 1e9 end
    for r = 0, reps do for dir = 1, (info.Reverses and 2 or 1) do local t0 = 0
      while t0 < info.Time and running do t0 = t0 + task.wait() local a = math.min(1, t0 / info.Time) a = ease(info.EasingStyle, a) if dir == 2 then a = 1 - a end
        for k, v in pairs(goal) do local s = start[k] if type(v) == 'number' then obj[k] = s + (v - s) * a elseif getmetatable(v) == V3 then obj[k] = Vector3.Lerp(s, v, a) elseif getmetatable(v) == C3m then obj[k] = Color3.Lerp(s, v, a) elseif getmetatable(v) == CFm then obj[k] = CFrame.Lerp(s, v, a) elseif type(v) == 'table' and v.__udim2 then obj[k] = UDim2.new(s.X.Scale + (v.X.Scale - s.X.Scale) * a, s.X.Offset + (v.X.Offset - s.X.Offset) * a, s.Y.Scale + (v.Y.Scale - s.Y.Scale) * a, s.Y.Offset + (v.Y.Offset - s.Y.Offset) * a) end end end end end
    running = false tw.PlaybackState = 'Completed' tw.Completed:Fire('Completed') end) end
  tw.Play = function() playImpl() end
  return tw
end
local ReplicatedStorage = service('ReplicatedStorage')
local ServerStorage = service('ServerStorage')
local ServerScriptService = service('ServerScriptService')
local ReplicatedFirst = service('ReplicatedFirst')
local StarterGui = service('StarterGui'); function StarterGui.SetCore(_, k, v) if k == 'SendNotification' and type(v) == 'table' then api('toast', (v.Title and (v.Title .. ': ') or '') .. (v.Text or '')) end end; function StarterGui.SetCoreGuiEnabled() end
local StarterPlayer = service('StarterPlayer'); StarterPlayer.__p.CharacterWalkSpeed = 16; StarterPlayer.__p.CharacterJumpPower = 50
local StarterPack = service('StarterPack')
local SoundService = service('SoundService')
local Teams = service('Teams')
local Chat = service('Chat'); Chat.__ev.Chatted = newSignal(); local TextChatService = service('TextChatService'); TextChatService.__ev.MessageReceived = newSignal()
local HttpService = service('HttpService'); HttpService.__p.HttpEnabled = false
function HttpService.JSONEncode(_, v) return enc(v) end
function HttpService.JSONDecode(_, s) return dec(s) end
function HttpService.GenerateGUID(_, br) local t = {} for i = 1, 32 do t[i] = string.format('%x', math.random(0, 15)) end local s = table.concat(t) s = s:sub(1, 8) .. '-' .. s:sub(9, 12) .. '-4' .. s:sub(14, 16) .. '-' .. s:sub(17, 20) .. '-' .. s:sub(21, 32) return br == false and s or '{' .. s .. '}' end
function HttpService.GetAsync() error('Scripts do RoleVRGO não acessam a internet (segurança)') end
HttpService.PostAsync = HttpService.GetAsync; HttpService.RequestAsync = HttpService.GetAsync
function HttpService.UrlEncode(_, s) return (tostring(s):gsub('[^%w%-_%.~]', function(c) return string.format('%%%02X', c:byte()) end)) end
local CollectionService = service('CollectionService'); local tagged, tagAdded, tagRemoved = {}, {}, {}
local function tagSig(t, k) t[k] = t[k] or newSignal() return t[k] end
function CollectionService.AddTag(_, o, tag) if o.__tags[tag] then return end o.__tags[tag] = true tagged[tag] = tagged[tag] or {} table.insert(tagged[tag], o) tagSig(tagAdded, tag):Fire(o) end
function CollectionService.RemoveTag(_, o, tag) if not o.__tags[tag] then return end o.__tags[tag] = nil local l = tagged[tag] if l then local i = table.find(l, o) if i then table.remove(l, i) end end tagSig(tagRemoved, tag):Fire(o) end
function CollectionService.HasTag(_, o, tag) return o.__tags[tag] == true end
function CollectionService.GetTagged(_, tag) local r = {} for _, o in ipairs(tagged[tag] or {}) do if not rawget(o, '__destroyed') then r[#r + 1] = o end end return r end
function CollectionService.GetTags(_, o) local r = {} for t in pairs(o.__tags) do r[#r + 1] = t end return r end
function CollectionService.GetInstanceAddedSignal(_, tag) return tagSig(tagAdded, tag) end
function CollectionService.GetInstanceRemovedSignal(_, tag) return tagSig(tagRemoved, tag) end
function Instance:AddTag(t) CollectionService:AddTag(self, t) end; function Instance:RemoveTag(t) CollectionService:RemoveTag(self, t) end; function Instance:HasTag(t) return CollectionService:HasTag(self, t) end; function Instance:GetTags() return CollectionService:GetTags(self) end
local MarketplaceService = service('MarketplaceService'); MarketplaceService.__ev.PromptProductPurchaseFinished = newSignal(); MarketplaceService.__ev.PromptGamePassPurchaseFinished = newSignal()
function MarketplaceService.UserOwnsGamePassAsync() return false end
function MarketplaceService.PromptGamePassPurchase() api('toast', 'O RoleVRGO é grátis: não existem compras 💛') end
MarketplaceService.PromptProductPurchase = MarketplaceService.PromptGamePassPurchase; MarketplaceService.PromptPurchase = MarketplaceService.PromptGamePassPurchase
function MarketplaceService.GetProductInfo() return { Name = '', PriceInRobux = 0 } end
local BadgeService = service('BadgeService'); function BadgeService.AwardBadge(_, uid, id) api('toast', '🏅 Medalha do mapa: ' .. tostring(id)) return true end; function BadgeService.UserHasBadgeAsync() return false end
local PathfindingService = service('PathfindingService')
function PathfindingService.CreatePath() local wp = {} return { ComputeAsync = function(self, a, b) wp = { { Position = a, Action = 'Walk' }, { Position = (a + b) / 2, Action = 'Walk' }, { Position = b, Action = 'Walk' } } self.Status = 'Success' end, GetWaypoints = function() return wp end, Status = 'NoPath', Blocked = newSignal() } end
local LocalizationService = service('LocalizationService'); LocalizationService.__p.RobloxLocaleId = 'pt-br'
local GroupService = service('GroupService')
local TeleportService = service('TeleportService'); function TeleportService.Teleport() api('toast', 'Teleporte entre lugares não existe no RoleVRGO') end
local MessagingService = service('MessagingService'); function MessagingService.PublishAsync() end; function MessagingService.SubscribeAsync() return { Disconnect = function() end } end
local DataStoreService = service('DataStoreService')
for _, s in ipairs({ workspace, Players, Lighting, RunService, UIS, CAS, Debris, TweenService, ReplicatedStorage, ServerStorage, ServerScriptService, ReplicatedFirst, StarterGui, StarterPlayer, StarterPack, SoundService, Teams, Chat, TextChatService, HttpService, CollectionService, MarketplaceService, BadgeService, PathfindingService, LocalizationService, GroupService, TeleportService, MessagingService, DataStoreService }) do s.__p.Parent = game table.insert(game.__ch, s) end
local SERVICES = {} for _, s in ipairs(game.__ch) do SERVICES[s.__p.Name] = s end
function game.GetService(_, n) local s = SERVICES[n] if not s then warn('Serviço ' .. tostring(n) .. ' não existe no RoleVRGO') end return s end
game.FindService = game.GetService
function game.IsLoaded() return true end; game.__ev.Loaded = newSignal(); game.__ev.Close = newSignal()
function game.BindToClose(_, f) game.Close:Connect(f) end
roots[workspace] = true
if IS_SERVER then roots[ReplicatedStorage] = true roots[Players] = true roots[Teams] = true roots[Lighting] = true end
Lighting.__onset = function(_, k, v) if k == 'ClockTime' then api('time', v) elseif k == 'Ambient' or k == 'OutdoorAmbient' then end end
Lighting.__p.Ambient = C3(0.5, 0.5, 0.5); Lighting.__p.OutdoorAmbient = C3(0.5, 0.5, 0.5)
function Lighting.GetMinutesAfterMidnight() return Lighting.ClockTime * 60 end
function Lighting.SetMinutesAfterMidnight(_, m) Lighting.ClockTime = m / 60 end
workspace.__onset = function(_, k, v) if k == 'Gravity' then api('gravity', v) end end
local cam = make('Camera', 'camera'); cam.__virtual = true; cam.__p.Name = 'Camera'; cam.__p.CFrame = CF(); cam.__p.FieldOfView = 70; cam.__p.Parent = workspace; table.insert(workspace.__ch, cam); workspace.__p.CurrentCamera = cam
cam.__onset = function() end

-- ===== jogadores =====
local playersByUid = {}
local localPlayer = nil
local function makeCharacter(pl)
  local char = make('Model', pl.__id .. '_char'); char.__virtual = true; char.__p.Name = pl.__p.Name
  local root = make('Part', pl.__id .. '_root'); root.__virtual = true; root.__p.Name = 'HumanoidRootPart'; root.__p.Size = V(2, 2, 1); root.__p.Parent = char; table.insert(char.__ch, root)
  local head = make('Part', pl.__id .. '_head'); head.__virtual = true; head.__p.Name = 'Head'; head.__p.Size = V(1, 1, 1); head.__p.Parent = char; table.insert(char.__ch, head)
  local hum = make('Humanoid', pl.__id .. '_hum'); hum.__virtual = true; hum.__p.Name = 'Humanoid'; hum.__p.Parent = char; table.insert(char.__ch, hum)
  hum.__p.Health = 100; hum.__p.MaxHealth = 100; hum.__p.WalkSpeed = StarterPlayer.CharacterWalkSpeed; hum.__p.JumpPower = StarterPlayer.CharacterJumpPower; hum.__p.JumpHeight = 7.2; hum.__p.DisplayName = pl.__p.DisplayName; hum.__p.Sit = false; hum.__p.FloorMaterial = 'Plastic'; hum.__p.MoveDirection = V()
  char.__p.PrimaryPart = root; char.__p.Parent = workspace; table.insert(workspace.__ch, char)
  local mine = IS_SERVER or pl == localPlayer
  hum.__onset = function(h, k, v)
    if k == 'Health' then if v > h.__p.MaxHealth then h.__p.Health = h.__p.MaxHealth v = h.__p.MaxHealth end if v < 0 then h.__p.Health = 0 v = 0 end h.HealthChanged:Fire(v)
      if v <= 0 and not rawget(h, '__dead') then rawset(h, '__dead', true) h.Died:Fire() if IS_SERVER then task.delay(Players.RespawnTime or 3, function() if rawget(h, '__dead') then rawset(h, '__dead', nil) h.__p.Health = h.__p.MaxHealth api('hum', pl.__p.UserId, 'Health', enc(h.__p.MaxHealth)) api('hum', pl.__p.UserId, 'respawn', 'true') pl.CharacterAdded:Fire(char) end end) end end
      if v > 0 then rawset(h, '__dead', nil) end end
    if not mine then return end
    if IS_SERVER then if k == 'Health' or k == 'MaxHealth' or k == 'WalkSpeed' or k == 'JumpPower' or k == 'JumpHeight' then api('hum', pl.__p.UserId, k, enc(h.__p[k])) end
    else if k == 'Health' or k == 'MaxHealth' then api('health', h.__p.Health, h.__p.MaxHealth) elseif k == 'WalkSpeed' then api('walk', v) elseif k == 'JumpPower' then api('jump', v) elseif k == 'JumpHeight' then api('jump', v * 50 / 7.2) end end
  end
  function hum.TakeDamage(_, d) if (hum.__p.Health or 0) > 0 then hum.Health = hum.Health - d end end
  function hum.MoveTo(_, p) if IS_SERVER then api('hum', pl.__p.UserId, 'tp', enc(p)) elseif pl == localPlayer then api('teleport', p.X, p.Y, p.Z) end end
  function hum.ChangeState() end; function hum.GetState() return hum.__p.Health > 0 and Enum.HumanoidStateType.Running or Enum.HumanoidStateType.Dead end
  function hum.UnequipTools() end; function hum.EquipTool() end; function hum.GetAppliedDescription() return {} end
  hum.__ev.MoveToFinished = newSignal()
  root.__onset = function(r, k, v) if rawget(r, '__sync') then return end if k == 'Position' then if IS_SERVER then api('hum', pl.__p.UserId, 'tp', enc(v)) elseif pl == localPlayer then api('teleport', v.X, v.Y, v.Z) end end end
  pl.__p.Character = char
  return char
end
local function addPlayer(uid, name, id)
  uid = math.tointeger(uid) or uid
  local pl = playersByUid[uid] if pl then return pl end
  pl = byId[id or ('P' .. uid)] or make('Player', id or ('P' .. uid))
  pl.__p.Name = name or ('Gato' .. uid); pl.__p.DisplayName = pl.__p.Name; pl.__p.UserId = uid; pl.__p.AccountAge = 365; pl.__p.MembershipType = 'None'; pl.__p.Team = nil
  playersByUid[uid] = pl
  local pg = make('PlayerGui', pl.__id .. '_gui'); pg.__p.Name = 'PlayerGui'; pg.__virtual = true; pg.__p.Parent = pl; table.insert(pl.__ch, pg)
  local bp = make('Backpack', pl.__id .. '_bp'); bp.__p.Name = 'Backpack'; bp.__virtual = true; bp.__p.Parent = pl; table.insert(pl.__ch, bp)
  local ps = make('PlayerScripts', pl.__id .. '_ps'); ps.__p.Name = 'PlayerScripts'; ps.__virtual = true; ps.__p.Parent = pl; table.insert(pl.__ch, ps)
  function pl.GetMouse() return pl.__x and pl.__x.mouse end
  function pl.Kick(_, why) if IS_SERVER then api('hum', uid, 'kick', enc(why or '')) end end
  function pl.LoadCharacter() if IS_SERVER then api('hum', uid, 'respawn', 'true') end end
  function pl.GetRankInGroup() return 0 end; function pl.IsInGroup() return false end; function pl.IsFriendsWith() return false end
  function pl.DistanceFromCharacter(_, p) local r = pl.__p.Character and pl.__p.Character:FindFirstChild('HumanoidRootPart') return r and (r.Position - p).Magnitude or 0 end
  makeCharacter(pl)
  pl:__setParent(Players)
  return pl
end
Players.__ev.PlayerAdded = newSignal(); Players.__ev.PlayerRemoving = newSignal(); Players.__p.MaxPlayers = 30; Players.__p.RespawnTime = 3
function Players.GetPlayers() local r = {} for _, p in pairs(playersByUid) do r[#r + 1] = p end table.sort(r, function(a, b) return a.__p.UserId < b.__p.UserId end) return r end
function Players.GetPlayerFromCharacter(_, c) for _, p in pairs(playersByUid) do if p.__p.Character == c then return p end end return nil end
function Players.GetPlayerByUserId(_, uid) return playersByUid[uid] end
function Players.GetUserIdFromNameAsync(_, n) for _, p in pairs(playersByUid) do if p.__p.Name == n then return p.__p.UserId end end return 0 end
function Players.GetNameFromUserIdAsync(_, uid) local p = playersByUid[uid] return p and p.__p.Name or '' end
function Players.GetUserThumbnailAsync() return '', true end
function Players.CreateHumanoidModelFromUserId() return Instance.new('Model') end
local function removePlayer(uid) local pl = playersByUid[uid] if not pl or pl == localPlayer then return end Players.PlayerRemoving:Fire(pl) pl.CharacterRemoving:Fire(pl.__p.Character) playersByUid[uid] = nil if pl.__p.Character then pl.__p.Character:__setParent(nil) end pl:Destroy() end
-- mouse do jogador local
local mouse = { Hit = CF(), Target = nil, X = 0, Y = 0, Origin = CF(), UnitRay = { Origin = V(), Direction = V(0, 0, -1) }, Icon = '' }
mouse.Button1Down = newSignal(); mouse.Button1Up = newSignal(); mouse.Move = newSignal(); mouse.Button2Down = newSignal(); mouse.KeyDown = newSignal()

-- ===== raycast e consultas espaciais (sobre as Parts) =====
RaycastParams = { new = function() return { FilterDescendantsInstances = {}, FilterType = Enum.RaycastFilterType.Exclude, IgnoreWater = true, __type = 'RaycastParams' } end }
OverlapParams = RaycastParams
local function filtered(o, params) if not params then return true end local list = params.FilterDescendantsInstances or {} local hit = false for _, f in ipairs(list) do if o == f or o:IsDescendantOf(f) then hit = true break end end
  local ft = params.FilterType and (params.FilterType.Name or params.FilterType) or 'Exclude' if ft == 'Include' or ft == 'Whitelist' then return hit end return not hit end
local function allParts() local r = {} for _, o in pairs(byId) do if o.__kind == 'part' and not rawget(o, '__virtual') and not rawget(o, '__destroyed') and o:IsDescendantOf(workspace) then r[#r + 1] = o end end return r end
function workspace.Raycast(_, origin, dir, params)
  local best, bt, bn = nil, math.huge, nil
  for _, p in ipairs(allParts()) do if (p.__p.CanCollide or p.__p.CanQuery ~= false) and filtered(p, params) then
    local c, h = p.__p.Position, p.__p.Size / 2 local tmin, tmax, nrm = 0, 1, nil local ok = true
    for _, ax in ipairs({ 'X', 'Y', 'Z' }) do local o, d, lo, hi = origin[ax], dir[ax], c[ax] - h[ax], c[ax] + h[ax]
      if abs(d) < 1e-9 then if o < lo or o > hi then ok = false break end else local t1, t2 = (lo - o) / d, (hi - o) / d local n1 = -1 if t1 > t2 then t1, t2 = t2, t1 n1 = 1 end
        if t1 > tmin then tmin = t1 nrm = { ax, n1 } end if t2 < tmax then tmax = t2 end if tmin > tmax then ok = false break end end end
    if ok and tmin < bt then bt = tmin best = p bn = nrm end end end
  if not best then return nil end
  local n = V() if bn then n[bn[1]] = bn[2] end
  return { Instance = best, Position = origin + dir * bt, Normal = n, Distance = (dir * bt).Magnitude, Material = Enum.Material.Plastic, __type = 'RaycastResult' }
end
function workspace.FindPartOnRay(_, ray, ignore) local r = workspace:Raycast(ray.Origin, ray.Direction, nil) if r then return r.Instance, r.Position, r.Normal end return nil, ray.Origin + ray.Direction end
Ray = { new = function(o, d) return { Origin = o, Direction = d, Unit = { Origin = o, Direction = d.Unit }, __type = 'Ray' } end }
function workspace.GetPartBoundsInRadius(_, pos, r, params) local out_ = {} for _, p in ipairs(allParts()) do if filtered(p, params) then local h = p.__p.Size / 2 local d = Vector3.Max(Vector3.Abs(pos - p.__p.Position) - h, V()) if d.Magnitude <= r then out_[#out_ + 1] = p end end end return out_ end
function workspace.GetPartBoundsInBox(_, cf, size, params) local out_ = {} local c, hs = cf.Position, size / 2 for _, p in ipairs(allParts()) do if filtered(p, params) then local h = p.__p.Size / 2 local d = Vector3.Abs(c - p.__p.Position) if d.X <= hs.X + h.X and d.Y <= hs.Y + h.Y and d.Z <= hs.Z + h.Z then out_[#out_ + 1] = p end end end return out_ end
function workspace.GetPartsInPart(_, part, params) return workspace:GetPartBoundsInBox(part.CFrame, part.Size, params) end
function workspace.GetServerTimeNow() return now end
function workspace.GetRealPhysicsFPS() return 30 end

-- ===== ClickDetector / ProximityPrompt / Explosion / Sound / partes =====
local function explode(e) local p, r = e.__p.Position, e.__p.BlastRadius api('boom', p.X, p.Y, p.Z, r)
  if IS_SERVER then for _, pl in pairs(playersByUid) do local ch = pl.__p.Character local root = ch and ch:FindFirstChild('HumanoidRootPart') if root and (root.Position - p).Magnitude <= r then e.Hit:Fire(root, (root.Position - p).Magnitude) local h = ch:FindFirstChild('Humanoid') if h and e.__p.DestroyJointRadiusPercent > 0 then h.Health = 0 end end end end
  for _, part in ipairs(workspace:GetPartBoundsInRadius(p, r)) do if not part.__p.Anchored then local d = (part.Position - p) part.Velocity = part.Velocity + (d.Magnitude > 0 and d.Unit or V(0, 1, 0)) * 40 + V(0, 20, 0) end end
  task.delay(1, function() if e.Parent then e:Destroy() end end) end
local origMake = make
make = function(cls, id) local o = origMake(cls, id)
  if o.__kind == 'explosion' then o.__onparent = function(self, v) if v and live(self) then explode(self) end end end
  return o end

-- ===== DataStoreService (só no servidor) =====
local function dsCall(op, store, key, a, b) if not IS_SERVER then error('DataStoreService só funciona em Scripts do servidor') end local q = newReq() api('ds', q, op, store, key == nil and '' or tostring(key), a == nil and '' or a, b == nil and '' or b) local ok, res = waitReq(q) if not ok then error('DataStore: ' .. tostring(res)) end return res end
local function makeStore(name, ordered)
  local st = { Name = name, __type = 'DataStore' }
  function st.GetAsync(_, k) local js = dsCall('get', name, k) if js == nil or js == '' then return nil end return dec(js) end
  function st.SetAsync(_, k, v) dsCall('set', name, k, enc(v)) return v end
  function st.UpdateAsync(_, k, f) local old = st:GetAsync(k) local new = f(old) if new ~= nil then st:SetAsync(k, new) end return new end
  function st.IncrementAsync(_, k, d) return st:UpdateAsync(k, function(o) return (tonumber(o) or 0) + (d or 1) end) end
  function st.RemoveAsync(_, k) local old = st:GetAsync(k) dsCall('del', name, k) return old end
  if ordered then function st.GetSortedAsync(_, asc, size) local js = dsCall('list', name, nil, asc and 'asc' or 'desc', tostring(size or 10)) local list = dec(js) or {} local pg = { IsFinished = true } function pg.GetCurrentPage() return list end function pg.AdvanceToNextPageAsync() end return pg end end
  return st
end
local stores = {}
function DataStoreService.GetDataStore(_, n, scope) local key = tostring(n) .. (scope and ('/' .. scope) or '') stores[key] = stores[key] or makeStore(key, false) return stores[key] end
function DataStoreService.GetOrderedDataStore(_, n, scope) local key = 'ord:' .. tostring(n) .. (scope and ('/' .. scope) or '') stores[key] = stores[key] or makeStore(key, true) return stores[key] end
function DataStoreService.GetGlobalDataStore() return DataStoreService:GetDataStore('global') end
function DataStoreService.GetRequestBudgetForRequestType() return 60 end

-- ===== módulos (ModuleScript + require) =====
local modSrc, modCache, modLoading = {}, {}, {}
function require(m) local name = type(m) == 'string' and m or (type(m) == 'table' and m.__p and m.__p.Name) or tostring(m)
  if modCache[name] ~= nil then return modCache[name] end
  local src = modSrc[name] if not src then error('ModuleScript "' .. name .. '" não encontrado') end
  if modLoading[name] then error('require circular em ' .. name) end modLoading[name] = true
  local f, err = load(src, '@' .. name) if not f then modLoading[name] = nil error(err) end
  local ok, r = pcall(f) modLoading[name] = nil if not ok then error(r) end
  if r == nil then r = true end modCache[name] = r return r end
function __addModule(name, src) modSrc[name] = src local m = byId['mod_' .. name] if not m then m = make('ModuleScript', 'mod_' .. name) m.__virtual = true m.__p.Name = name m.__p.Parent = ReplicatedStorage table.insert(ReplicatedStorage.__ch, m) end end

-- ===== script atual =====
script = make(IS_SERVER and 'Script' or 'LocalScript', 'script'); script.__virtual = true; script.__p.Name = IS_SERVER and 'Script' or 'LocalScript'; script.__p.Parent = IS_SERVER and ServerScriptService or workspace

-- ===== extras do RoleVRGO =====
RoleVR = {
  isServer = IS_SERVER,
  toast = function(t, cor) api('toast', tostring(t), cor or false) end,
  banner = function(t, s) api('banner', tostring(t), s or 3) end,
  say = function(t) api('say', tostring(t)) end,
  sound = function(n, vol) api(IS_SERVER and 'soundAll' or 'play', tostring(n), vol or 0.7) end,
  effect = function(p, cor, n) local c = cor or C3(1, 0.85, 0.3) api('fx', p.X, p.Y, p.Z, floor(c.R * 255) * 65536 + floor(c.G * 255) * 256 + floor(c.B * 255), n or 20) end,
  model = function(key, p, escala, giro) nextId = nextId + 1 local id = IDP .. 'm' .. nextId api('model', id, key, p.X, p.Y, p.Z, escala or 1, giro or 0) return { Destroy = function() H:emit('del', id) end } end,
  npc = function(nome, p, falas) api('npc', tostring(nome), p.X, p.Y, p.Z, table.concat(falas or { 'Miau!' }, '\n')) end,
  fly = function(on) api('fly', on and true or false) end,
  sky = function(c) api('sky', c.R, c.G, c.B) end,
  emote = function(id) api('emote', id) end,
}

-- ===== ponte JS -> Lua =====
local inputMap = { Space = 'Space', ShiftLeft = 'LeftShift', ShiftRight = 'RightShift', ControlLeft = 'LeftControl', Enter = 'Return', Tab = 'Tab', Backspace = 'Backspace', Escape = 'Escape', ArrowUp = 'Up', ArrowDown = 'Down', ArrowLeft = 'Left', ArrowRight = 'Right', Digit0 = 'Zero', Digit1 = 'One', Digit2 = 'Two', Digit3 = 'Three', Digit4 = 'Four', Digit5 = 'Five', Digit6 = 'Six', Digit7 = 'Seven', Digit8 = 'Eight', Digit9 = 'Nine' }
local function keyName(code) if inputMap[code] then return inputMap[code] end local l = code:match('^Key(%u)$') return l or code end
local function getRoot(uid) local pl = playersByUid[uid] local ch = pl and pl.__p.Character return ch and ch:FindFirstChild('HumanoidRootPart') end
local function setPos(o, x, y, z) rawset(o, '__sync', true) o.__p.Position = V(x, y, z) rawset(o, '__sync', nil) end
-- objetos replicados do servidor (no cliente): aplicados sem reemitir
local function repNew(id, cls, parentId, pjs)
  local existed = byId[id] ~= nil local o = byId[id] if not o then o = make(cls, id) end rawset(o, '__rep', true) o.__live = true
  local pr = dec(pjs) or {} for k, v in pairs(pr) do o.__p[k] = v end
  if cls == 'Player' and pr.UserId then local uid = pr.UserId if not playersByUid[uid] then addPlayer(uid, pr.Name, id) Players.PlayerAdded:Fire(playersByUid[uid]) end return end
  if existed and o.__p.Parent then return end
  local par = parentId and byId[parentId] if par then o.__p.Parent = par table.insert(par.__ch, o) par.ChildAdded:Fire(o) local a = par while a do a.DescendantAdded:Fire(o) a = a.__p.Parent end end
end
local DISPATCH = {}
DISPATCH.tick = function(dt, x, y, z, othersJs, camJs)
  workspace.__p.DistributedGameTime = now
  if localPlayer then local r = getRoot(localPlayer.__p.UserId) if r then setPos(r, x, y, z) end end
  if othersJs and othersJs ~= '' then for _, o in ipairs(dec(othersJs) or {}) do local uid = o[1] if IS_CLIENT and not playersByUid[uid] then addPlayer(uid, o[2]) Players.PlayerAdded:Fire(playersByUid[uid]) end local r = getRoot(uid) if r then setPos(r, o[3], o[4], o[5]) end end end
  if camJs and camJs ~= '' then local c = dec(camJs) if c then cam.__p.CFrame = lookAt(V(c[1], c[2], c[3]), V(c[1] + c[4], c[2] + c[5], c[3] + c[6])) mouse.Hit = CFrame.new(V(c[7], c[8], c[9])) mouse.Target = c[10] and byId[c[10]] or nil mouse.Origin = cam.__p.CFrame mouse.UnitRay = { Origin = V(c[1], c[2], c[3]), Direction = V(c[4], c[5], c[6]) } end end
  RunService.Stepped:Fire(now, dt) step(dt) RunService.Heartbeat:Fire(dt)
end
DISPATCH.touch = function(id, inout, uid) local o = byId[id] if not o or o.__p.CanTouch == false then return end local hit = getRoot(uid or (localPlayer and localPlayer.__p.UserId)) if not hit then return end local ev = inout == 1 and o.Touched or o.TouchEnded if ev then ev:Fire(hit) end end
DISPATCH.pos = function(id, x, y, z) local o = byId[id] if o then o.__p.Position = V(x, y, z) end end
DISPATCH.key = function(code, down) local k = keyName(code) keysDown[k] = down == 1 or nil local inp = { KeyCode = Enum.KeyCode[k], UserInputType = Enum.UserInputType.Keyboard, UserInputState = down == 1 and Enum.UserInputState.Begin or Enum.UserInputState.End, Position = V() } if down == 1 then UIS.InputBegan:Fire(inp, false) mouse.KeyDown:Fire(k:lower()) if k == 'Space' then UIS.JumpRequest:Fire() end else UIS.InputEnded:Fire(inp, false) end end
DISPATCH.mdown = function(down) local inp = { KeyCode = Enum.KeyCode.Unknown, UserInputType = Enum.UserInputType.MouseButton1, UserInputState = down == 1 and Enum.UserInputState.Begin or Enum.UserInputState.End, Position = V() } if down == 1 then mouse.Button1Down:Fire() UIS.InputBegan:Fire(inp, false) else mouse.Button1Up:Fire() UIS.InputEnded:Fire(inp, false) end end
DISPATCH.gui = function(id, text) local o = byId[id] if not o then return end if o.__cls == 'TextBox' then o.__p.Text = tostring(text or '') o.Changed:Fire('Text') o.FocusLost:Fire(true) elseif o.Activated then o.Activated:Fire() o.MouseButton1Click:Fire() end end
DISPATCH.chat = function(msg, uid) local pl = uid and playersByUid[uid] or localPlayer if pl then pl.Chatted:Fire(msg) end Chat.Chatted:Fire(msg) end
DISPATCH.player = function(name, uid) localPlayer = addPlayer(uid, name) Players.__p.LocalPlayer = localPlayer localPlayer.__x = { mouse = mouse } local pg = localPlayer:FindFirstChild('PlayerGui') rawset(pg, '__virtual', nil) roots[pg] = true pg.__live = true Players.PlayerAdded:Fire(localPlayer) localPlayer.CharacterAdded:Fire(localPlayer.__p.Character) end
DISPATCH.health = function(h) if localPlayer then local hm = localPlayer.__p.Character.Humanoid rawset(hm, '__fromhost', true) hm.__p.Health = h end end
DISPATCH.pjoin = function(uid, name) local pl = addPlayer(uid, name) Players.PlayerAdded:Fire(pl) task.defer(function() pl.CharacterAdded:Fire(pl.__p.Character) end) end
DISPATCH.pleave = function(uid) removePlayer(uid) end
DISPATCH.remote = function(id, uid, js) local o = byId[id] if not o then return end local a, n = unpackArgs(js) if IS_SERVER then local pl = playersByUid[uid] if pl and o.OnServerEvent then o.OnServerEvent:Fire(pl, unpack(a, 1, n)) end elseif o.OnClientEvent then o.OnClientEvent:Fire(unpack(a, 1, n)) end end
DISPATCH.invoke = function(id, uid, q, js) local o = byId[id] local pl = playersByUid[uid] task.spawn(function() local res if o and pl and o.__p.OnServerInvoke then local a, n = unpackArgs(js) res = table.pack(pcall(o.__p.OnServerInvoke, pl, unpack(a, 1, n))) if not res[1] then out('error', 'OnServerInvoke: ' .. tostring(res[2])) api('invokeReply', uid, q, packArgs()) return end api('invokeReply', uid, q, packArgs(unpack(res, 2, res.n))) else api('invokeReply', uid, q, packArgs()) end end) end
DISPATCH.ret = function(q, ok, js) local co = reqs[q] if co then reqs[q] = nil __resume(co, ok == true or ok == 1, js) end end
DISPATCH.click = function(id, uid) local o = byId[id] local pl = playersByUid[uid] if o and pl then if o.__kind == 'clickdet' then o.MouseClick:Fire(pl) elseif o.__kind == 'prompt' then o.Triggered:Fire(pl) o.TriggerEnded:Fire(pl) end end end
DISPATCH.hum = function(k, js) if not localPlayer then return end local hm = localPlayer.__p.Character.Humanoid local v = dec(js) if k == 'Health' or k == 'MaxHealth' or k == 'WalkSpeed' or k == 'JumpPower' or k == 'JumpHeight' then hm.__p[k] = v if k == 'Health' then hm.HealthChanged:Fire(v) if v <= 0 and not rawget(hm, '__dead') then rawset(hm, '__dead', true) hm.Died:Fire() elseif v > 0 then rawset(hm, '__dead', nil) end end end end
DISPATCH.rnew = function(id, cls, parentId, pjs) repNew(id, cls, parentId, pjs) end
DISPATCH.rset = function(id, k, js) local o = byId[id] if not o then return end local v = dec(js) o.__p[k] = v local chg = rawget(o, '__chg') if chg[k] then chg[k]:Fire(v) end if o.__kind == 'value' and k == 'Value' then o.Changed:Fire(v) else o.Changed:Fire(k) end end
DISPATCH.rdel = function(id) local o = byId[id] if not o then return end if o == localPlayer then rawset(o, '__rep', nil) return end if o.__cls == 'Player' then removePlayer(o.__p.UserId) return end rawset(o, '__destroyed', true) o.Destroying:Fire() local par = o.__p.Parent if par then for i, c in ipairs(par.__ch) do if c == o then table.remove(par.__ch, i) break end end par.ChildRemoved:Fire(o) end o.__p.Parent = nil byId[id] = nil end
DISPATCH.rpar = function(id, parentId) local o = byId[id] if not o then return end local old = o.__p.Parent if old then for i, c in ipairs(old.__ch) do if c == o then table.remove(old.__ch, i) break end end old.ChildRemoved:Fire(o) end local par = parentId and byId[parentId] o.__p.Parent = par if par then table.insert(par.__ch, o) par.ChildAdded:Fire(o) end end
DISPATCH.ctx = function(placeId, jobId) game.__p.PlaceId = placeId game.__p.GameId = placeId game.__p.JobId = jobId end
DISPATCH.module = function(name, src) __addModule(name, src) end
DISPATCH.close = function() game.Close:Fire() end
H:setDispatch(function(_, kind, a, b, c, d, e, f) local fn = DISPATCH[kind] if fn then fn(a, b, c, d, e, f) end end)
`;
