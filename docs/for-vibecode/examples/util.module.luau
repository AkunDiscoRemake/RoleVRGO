-- ModuleScript: funções úteis. Em qualquer Script/LocalScript: local Util = require("util")
local Util = {}

function Util.sortear<T>(lista: {T}): T
  return lista[math.random(1, #lista)]
end

function Util.formatar(n: number): string
  local s = tostring(math.floor(n))
  local r = s:reverse():gsub("(%d%d%d)", "%1."):reverse()
  return (r:gsub("^%.", ""))
end

function Util.cor(nome: string): Color3
  local cores = { vermelho = Color3.fromRGB(230, 60, 60), azul = Color3.fromRGB(60, 120, 230), verde = Color3.fromRGB(60, 200, 110) }
  return cores[nome] or Color3.new(1, 1, 1)
end

return Util
