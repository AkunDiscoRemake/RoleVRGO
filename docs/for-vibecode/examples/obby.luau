-- Obby: 12 plataformas subindo, checkpoints e lava embaixo. Cole num script do Studio.
local Players = game:GetService("Players")
local hum = Players.LocalPlayer.Character:WaitForChild("Humanoid")
local checkpoint = Vector3.new(0, 3, 0)

local lava = Instance.new("Part")
lava.Size = Vector3.new(80, 1, 80)
lava.Position = Vector3.new(0, -0.4, -30)
lava.Color = Color3.fromRGB(255, 70, 0)
lava.CanCollide = false
lava.Parent = workspace
lava.Touched:Connect(function()
  RoleVR.toast("🔥 Voltando para o checkpoint")
  hum:MoveTo(checkpoint)
end)

for i = 1, 12 do
  local p = Instance.new("Part")
  p.Size = Vector3.new(3, 0.6, 3)
  p.Position = Vector3.new(math.sin(i) * 4, 1 + i * 1.2, -i * 4)
  p.Color = Color3.fromHSV(i / 12, 0.6, 1)
  p.Parent = workspace
  if i % 4 == 0 then
    p.Color = Color3.fromRGB(80, 220, 120)
    p.Touched:Connect(function()
      if checkpoint ~= p.Position + Vector3.new(0, 2, 0) then
        checkpoint = p.Position + Vector3.new(0, 2, 0)
        RoleVR.sound("secret")
        RoleVR.toast(`✅ Checkpoint {i // 4}`)
      end
    end)
  end
end

local fim = Instance.new("Part")
fim.Size = Vector3.new(6, 1, 6)
fim.Position = Vector3.new(0, 16, -54)
fim.Color = Color3.fromRGB(255, 215, 80)
fim.Parent = workspace
fim.Touched:Once(function()
  RoleVR.banner("🏆 Você zerou o obby!", 4)
  RoleVR.effect(fim.Position + Vector3.new(0, 2, 0), Color3.new(1, 0.85, 0.3), 60)
end)
