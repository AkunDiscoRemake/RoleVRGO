-- Script (servidor): placar com leaderstats, moedas salvas no DataStore e ranking dos melhores.
local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")
local moedasDS = DataStoreService:GetDataStore("Moedas")
local ranking = DataStoreService:GetOrderedDataStore("RankingMoedas")

Players.PlayerAdded:Connect(function(player)
  local leaderstats = Instance.new("Folder")
  leaderstats.Name = "leaderstats"
  leaderstats.Parent = player

  local moedas = Instance.new("IntValue")
  moedas.Name = "Moedas"
  moedas.Value = moedasDS:GetAsync(tostring(player.UserId)) or 0
  moedas.Parent = leaderstats

  -- +1 moeda a cada 10 s no mapa
  while player.Parent do
    task.wait(10)
    moedas.Value += 1
  end
end)

Players.PlayerRemoving:Connect(function(player)
  local stats = player:FindFirstChild("leaderstats")
  if not stats then return end
  local valor = stats.Moedas.Value
  moedasDS:SetAsync(tostring(player.UserId), valor)
  ranking:SetAsync(player.Name, valor)
end)

-- mostra o top 3 quando o mapa começa
task.delay(3, function()
  local pagina = ranking:GetSortedAsync(false, 3):GetCurrentPage()
  for i, item in ipairs(pagina) do
    RoleVR.toast(`🏆 {i}º {item.key}: {item.value} moedas`)
  end
end)
