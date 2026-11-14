-- LocalScript (cliente): botões que pedem a compra ao servidor e mostram a resposta.
local RS = game:GetService("ReplicatedStorage")
local comprar = RS:WaitForChild("Comprar")
local gui = Instance.new("ScreenGui")
gui.Parent = game.Players.LocalPlayer.PlayerGui

local function botao(texto: string, y: number, item: string)
  local b = Instance.new("TextButton")
  b.Size = UDim2.new(0, 240, 0, 46)
  b.Position = UDim2.new(0, 20, 1, y)
  b.Text = texto
  b.BackgroundColor3 = Color3.fromRGB(60, 120, 220)
  b.Parent = gui
  b.Activated:Connect(function()
    local ok, msg = comprar:InvokeServer(item)
    RoleVR.toast((if ok then "✅ " else "❌ ") .. msg)
    RoleVR.sound(if ok then "power" else "error")
  end)
end
botao("⚡ Velocidade (5 🪙)", -130, "velocidade")
botao("🦘 Pulo (3 🪙)", -76, "pulo")
