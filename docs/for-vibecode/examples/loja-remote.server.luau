-- Script (servidor): a loja de verdade. O cliente só PEDE; o servidor confere as moedas e entrega.
local RS = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local comprar = Instance.new("RemoteFunction")
comprar.Name = "Comprar"
comprar.Parent = RS

local PRECOS = { velocidade = 5, pulo = 3 }

Players.PlayerAdded:Connect(function(player)
  local ls = Instance.new("Folder") ls.Name = "leaderstats" ls.Parent = player
  local moedas = Instance.new("IntValue") moedas.Name = "Moedas" moedas.Value = 10 moedas.Parent = ls
end)

comprar.OnServerInvoke = function(player, item: string)
  local preco = PRECOS[item]
  local moedas = player.leaderstats.Moedas
  if not preco then return false, "Item não existe" end
  if moedas.Value < preco then return false, "Faltam " .. (preco - moedas.Value) .. " moedas" end
  moedas.Value -= preco
  local hum = player.Character:FindFirstChild("Humanoid")
  if item == "velocidade" then hum.WalkSpeed += 6 else hum.JumpPower += 20 end
  return true, "Comprado: " .. item
end
