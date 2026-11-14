# Prompt para IAs (For-VibeCode)

Cole o texto abaixo no começo da conversa com o ChatGPT, Claude, Gemini, Cursor, Copilot etc. Depois peça o que quiser ("faz um obby com 10 fases e placar", "faz uma loja com RemoteFunction", "faz um mod de placar").

---

Você vai escrever código para o **RoleVRGO Studio** (jogo de gatos em VR no navegador, versão 1.1.0 "FullFinalVer"). A API imita o **Roblox**, com **Luau**, e tem o modelo cliente/servidor.

**Regras obrigatórias:**

1. **Três tipos de script, como no Roblox.** Diga sempre qual é cada arquivo, usando a convenção do Rojo no nome:
   - `nome.server.luau` = **Script**. Roda no servidor, que é **um jogador anfitrião**. Use para regras, pontos, `leaderstats`, DataStore e Parts que todos veem.
   - `nome.client.luau` = **LocalScript**. Roda em cada jogador. Use para GUI (`PlayerGui`), teclas (`UserInputService`), câmera, `Players.LocalPlayer` e efeitos só seus.
   - `nome.module.luau` = **ModuleScript**. Use com `require("nome")`.
2. **Comunicação:** cliente e servidor só conversam por **RemoteEvent** ou **RemoteFunction** em `ReplicatedStorage`.
   - Crie os remotos no **Script** do servidor, e no LocalScript use `WaitForChild`.
   - **Valide tudo no servidor.**
   - `InvokeClient` não existe.
3. **Linguagem:** Luau-lite (convertido para Lua 5.3).
   - Pode usar: tipos, `type`, generics em funções, `+=`, `continue`, `` `interpolação {x}` ``, `if a then b else c` como expressão numa linha, e `task.wait`/`WaitForChild` no corpo do script.
   - NÃO use: `buffer`, `bit32`, HttpService com internet, MarketplaceService para compras, `Tool` equipável, animações, Terrain, `rbxassetid` e constraints.
4. **Só existe o que está na API.** Se o pedido precisar de algo que não existe, diga e proponha uma alternativa.
5. **Medidas:**
   - O mundo é em metros, e um gato tem ~1,3 m. O chão do mapa fica perto de y = 0.
   - Valores normais: `WalkSpeed` 16, `JumpPower` 50 e `workspace.Gravity` 196.2.
   - `/` dá número com vírgula; use `//` para inteiro.
6. **Limites:**
   - 600 Parts;
   - 900 KB por projeto;
   - DataStore: 16 KB por valor e 120 gravações por minuto;
   - `RoleVR.say` no máximo a cada 5 s.
7. **Persistência:** o servidor recomeça do zero quando o anfitrião sai. Salve o que importa no **DataStore**: salve no `PlayerRemoving` e periodicamente.
8. **Mods (HTML/CSS/JS):** são páginas por cima do jogo, com `window.rv`.
   - Sem rede (nada de CDN, `fetch` ou imagem externa) e sem `localStorage`.
   - Rodam só no aparelho de cada um.
   - Use `rv.interactive(true)` só enquanto houver botões.
9. **Formato da resposta:**
   - um bloco de código por arquivo, com o nome antes;
   - no fim, diga como colocar no Studio: aba 📜 Scripts > botão do tipo certo e colar; ou zipar tudo e importar em 🧩 Mods > Importar (`.luau` com sufixo viram scripts do tipo certo).

**Resumo da API:**

- **Globais:** `game`, `workspace`, `script`, `Instance.new`, `require`, `task.*`, `wait`, `print`, `warn`, `tick`, `typeof`, `Vector3`, `Vector2`, `CFrame` (completo), `Color3` (`fromRGB`, `fromHSV`, `fromHex`), `BrickColor`, `UDim2`, `TweenInfo`, `Random`, `RaycastParams`, `Enum`, `RoleVR`.
- **Biblioteca do Luau:** `math.clamp`, `math.sign`, `math.round`, `math.noise`, `string.split`, `table.find`, `table.clear`, `table.clone`, `table.create`.
- **Instance:**
  - `Name`, `Parent`, `FindFirstChild`, `FindFirstChildOfClass`, `FindFirstChildWhichIsA`, `WaitForChild`, `GetChildren`, `GetDescendants`;
  - `IsA`, `IsDescendantOf`, `Destroy`, `Clone`, `SetAttribute`, `GetAttribute`, `AddTag`, `HasTag`;
  - eventos `Changed`, `GetPropertyChangedSignal`, `ChildAdded`, `Destroying`.
- **Part:**
  - propriedades: `Position`, `Size`, `Orientation`, `CFrame`, `Color`, `BrickColor`, `Transparency`, `Anchored`, `CanCollide`, `CanTouch`, `Shape`, `Material` (`Neon`/`Glass`), `Velocity`;
  - eventos `Touched`/`TouchEnded` (o `hit` é a `HumanoidRootPart` do jogador: `Players:GetPlayerFromCharacter(hit.Parent)`);
  - métodos `:ApplyImpulse`, `:PivotTo`.
  - `Model`: `:PivotTo`, `:GetBoundingBox`.
- **Classes:** `Folder`, `IntValue`, `NumberValue`, `StringValue`, `BoolValue`, `ObjectValue`, `Vector3Value`, `RemoteEvent`, `RemoteFunction`, `BindableEvent`, `BindableFunction`, `ModuleScript`, `ClickDetector` (`MouseClick(player)`), `ProximityPrompt` (`ActionText`, `ObjectText`, `KeyboardKeyCode`, `Triggered(player)`), `Explosion` (`Position`, `BlastRadius`, `Hit`), `Sound` (`SoundId` = nome de som do jogo), `ScreenGui`, `Frame`, `TextLabel`, `TextButton`/`ImageButton` (`Activated`), `TextBox` (`FocusLost`, `.Text`), `ImageLabel` (só `data:`).
- **Players:**
  - `PlayerAdded`, `PlayerRemoving`, `GetPlayers`, `GetPlayerFromCharacter`, `GetPlayerByUserId`, `LocalPlayer` (só cliente);
  - Player: `Name`, `UserId`, `Character`, `PlayerGui`, `leaderstats` (Folder com Values vira placar na tela), `:Kick`, `CharacterAdded`, `Chatted`;
  - Humanoid: `Health`, `MaxHealth`, `WalkSpeed`, `JumpPower`, `TakeDamage`, `Died` (renasce em 3 s), `MoveTo` (teleporta).
- **Serviços:**
  - `RunService` (`Heartbeat`, `RenderStepped`, `Stepped`, `IsServer`, `IsClient`);
  - `UserInputService` (`InputBegan`/`InputEnded`, `IsKeyDown`, `input.KeyCode == Enum.KeyCode.E`; o clique e o gatilho chegam como `MouseButton1`);
  - `ContextActionService`, `TweenService`, `Debris`, `Lighting` (`ClockTime`);
  - `DataStoreService` (`GetDataStore`/`GetOrderedDataStore`: `GetAsync`, `SetAsync`, `UpdateAsync`, `IncrementAsync`, `RemoveAsync`, `GetSortedAsync(asc, n):GetCurrentPage()` → `{key, value}`; **só no servidor**);
  - `HttpService` (só `JSONEncode`/`JSONDecode`/`GenerateGUID`), `CollectionService`, `ReplicatedStorage`, `ServerStorage`, `ServerScriptService`, `StarterGui` (`SetCore("SendNotification")`).
- **Raycast e espaço:** `workspace:Raycast(origem, direcao, params)` (contra Parts de script), `workspace:GetPartBoundsInRadius`, `workspace.CurrentCamera.CFrame`, `player:GetMouse().Hit` e `.Target` (cliente).
- **`RoleVR`:**
  - `isServer`, `toast(texto)`, `banner(texto, s)` e `sound(nome)` (vindos de um Script, valem para todos);
  - `effect(posV3, Color3, n)`;
  - `model(chaveKenney, posV3, escala, giroY)` (ex.: "nature/tree_oak", "food/burger", "space/rocket_baseA", "car/taxi", "fur/loungeSofa");
  - `npc(nome, posV3, {falas})`, `say` (cliente), `fly` (cliente), `sky(Color3)`.
  - Sons: coin, pickup, win, secret, portal, levelup, quest, punch, click, bell, chest, power, heart, splash, glass, error, ko.
- **Mod JS (`window.rv`):** `rv.player {x,y,z}`, `rv.on('tick'|'key'|'chat'|'touch', fn)`, `rv.part({...})` → `{set, destroy}`, `rv.toast`, `rv.banner`, `rv.say`, `rv.sound`, `rv.effect`, `rv.teleport`, `rv.walkSpeed`, `rv.jumpPower`, `rv.gravity`, `rv.clockTime`, `rv.fly`, `rv.model`, `rv.npc`, `rv.interactive(bool)`.

A referência completa está em `API.md`.
