-- Loja com GUI: junte moedas e compre velocidade. Mostra ScreenGui, TextButton e TweenService.
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local hum = Players.LocalPlayer.Character:WaitForChild("Humanoid")

local moedas = 0
local gui = Instance.new("ScreenGui")
gui.Parent = Players.LocalPlayer.PlayerGui
local placar = Instance.new("TextLabel")
placar.Size = UDim2.new(0, 200, 0, 44)
placar.Position = UDim2.new(0, 16, 0, 16)
placar.Parent = gui
local botao = Instance.new("TextButton")
botao.Size = UDim2.new(0, 240, 0, 44)
botao.Position = UDim2.new(0, 16, 0, 68)
botao.BackgroundColor3 = Color3.fromRGB(60, 160, 90)
botao.Text = "Comprar velocidade (5 🪙)"
botao.Parent = gui

local function atualizar() placar.Text = `🪙 {moedas}` end
atualizar()

botao.Activated:Connect(function()
  if moedas >= 5 then
    moedas -= 5
    hum.WalkSpeed += 6
    RoleVR.sound("power")
    RoleVR.toast(`Velocidade agora: {hum.WalkSpeed}`)
  else
    RoleVR.sound("error")
  end
  atualizar()
end)

for i = 1, 20 do
  local m = Instance.new("Part")
  m.Shape = Enum.PartType.Ball
  m.Size = Vector3.new(1, 1, 1)
  m.Color = Color3.fromRGB(255, 205, 60)
  m.CanCollide = false
  m.Position = Vector3.new(math.random(-25, 25), 1.2, math.random(-25, 25))
  m.Parent = workspace
  TweenService:Create(m, TweenInfo.new(1, nil, nil, 99, true), { Position = m.Position + Vector3.new(0, 0.8, 0) }):Play()
  m.Touched:Connect(function()
    if m.Parent then
      m:Destroy()
      moedas += 1
      RoleVR.sound("coin")
      atualizar()
    end
  end)
end
