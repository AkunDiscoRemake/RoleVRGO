# RoleVRGO Studio — referência completa da API

> **Versão do jogo:** 1.1.0 "FullFinalVer". Este arquivo é a fonte única da API: humanos leem em `docs/`, IAs leem este arquivo.

O RoleVRGO Studio roda **três tipos de script**, como o Roblox, e **mods HTML/CSS/JS**:

| Tipo | Ícone | Onde roda | Para quê |
|---|---|---|---|
| **Script** | 🖥 | no **servidor** (um só, no jogador anfitrião) | regras do jogo, pontos, DataStore, Parts que todos veem |
| **LocalScript** | 📱 | em **cada jogador** | GUI, teclas, câmera, efeitos só seus |
| **ModuleScript** | 📦 | onde for chamado com `require` | código compartilhado |
| **Mod** | 🧩 | em cada jogador, por cima do jogo | interfaces HTML/CSS/JS com a API `window.rv` |

Nada disso tem acesso à conta, ao login, ao save, à rede (CSP `default-src 'none'`) ou à página do jogo. Tudo roda em iframes isolados e só fala com o jogo pela API abaixo.

---

## 0. Como funciona o servidor

O RoleVRGO não tem um servidor de jogo dedicado, então usa o modelo **"servidor de jogador"** (*listen server*):

- O jogador que está no mapa **há mais tempo** é o **anfitrião**: ele roda todos os `Script`s do mapa.
- **Replicação:** tudo que o servidor cria em `workspace`, `ReplicatedStorage`, `Players` (inclusive `leaderstats`), `Teams` e `Lighting` é replicado para todos pela sala. Quem chega depois recebe uma "foto" do mundo.
- **Troca de anfitrião:** se o anfitrião sair, o próximo jogador mais antigo vira o servidor e os `Script`s **recomeçam do zero**. Use o **DataStore** para o que precisa sobreviver.
- **Sozinho ou offline:** você mesmo é o servidor (online, ele sobe em cerca de 1,5 s, depois de ver quem está na sala).
- **LocalScripts** veem o mundo replicado. O que eles criam fica **só no seu aparelho**, e eles não mexem nas Parts do servidor (como o FilteringEnabled do Roblox).
- **Tempo de resposta:** a replicação acontece 10 vezes por segundo, e os RemoteEvents viajam pela sala com alguns décimos de segundo de atraso.
- **Confiança:** o anfitrião é um jogador comum. Não guarde segredos nos Scripts, e não trate o DataStore como à prova de trapaça.

## 1. Linguagem: Luau-lite

O código é convertido para Lua 5.3 (fengari) antes de rodar.

**Funciona:**
- anotações de tipo (`local x: number = 1`, `function f(a: string): boolean`, `(): (number, string)`);
- `type X = ...` e `export type X = {...}` (inclusive em várias linhas);
- `+= -= *= /= //= %= ^= ..=` em qualquer lugar da linha;
- `continue`;
- `` `texto {expr}` ``;
- `if a then b elseif c then d else e` usado como **expressão** (numa linha);
- o corpo do script pode pausar (`task.wait`, `WaitForChild`, `:Wait()`).

**Não funciona:**
- generics em expressões;
- `buffer`, `bit32` e `vector`;
- atributos de função (`@native`).

Números do Lua 5.3: `10 / 2` dá `5.0`. Use `//` para divisão inteira. O `print` mostra inteiros sem `.0`.

**Funções do Luau adicionadas:**
- `math.clamp`, `math.sign`, `math.round`, `math.noise`, `math.lerp`;
- `string.split`;
- `table.find`, `table.clear`, `table.clone`, `table.freeze`, `table.isfrozen`, `table.create`;
- `typeof`, `utf8`, `os.time`, `os.clock`, `DateTime.now()`.

## 2. Globais

| Global | Descrição |
|---|---|
| `game` | DataModel. `game:GetService(n)`, `game.Workspace`, `game.Players`, `game.PlaceId`, `game.JobId`, `game:BindToClose(f)` |
| `workspace` / `Workspace` | o mundo. `Gravity` (196.2), `CurrentCamera`, `Raycast`, `GetPartBoundsInRadius`, `GetPartBoundsInBox`, `GetPartsInPart`, `GetServerTimeNow` |
| `script` | o script atual. `script.Parent` é `ServerScriptService` (Script) ou `workspace` (LocalScript) |
| `Instance.new(classe, pai?)` | cria um objeto |
| `require(m)` | roda um ModuleScript: `require("Nome")` ou `require(game.ReplicatedStorage.Nome)` |
| `task.wait/spawn/delay/defer/cancel`, `wait`, `spawn`, `delay` | agendador |
| `print`, `warn` | vão para a aba **🖨 Saída** (os do servidor aparecem com `[Servidor]`) |
| `tick()`, `time()`, `elapsedTime()` | segundos desde o início |
| `Vector3`, `Vector2`, `CFrame`, `Color3`, `BrickColor`, `UDim`, `UDim2`, `TweenInfo`, `Random`, `Ray`, `RaycastParams`, `OverlapParams`, `NumberRange`, `ColorSequence`, `NumberSequence`, `Enum` | tipos de dados |
| `RoleVR` | extras do RoleVRGO (seção 10) |

## 3. Tipos de dados

**Vector3**
- Criar: `Vector3.new(x, y, z)`, `.zero`, `.one`, `.xAxis`, `.yAxis`, `.zAxis`.
- Campos: `.X .Y .Z .Magnitude .Unit`.
- Operações: `+ - * / //` (com vetor ou número), `==`, `-v`.
- Métodos: `:Dot`, `:Cross`, `:Lerp`, `:Abs`, `:Floor`, `:Ceil`, `:Max`, `:Min`, `:FuzzyEq`, `:Angle`.

**Vector2:** `Vector2.new(x, y)`, com `.X .Y .Magnitude .Unit`, `+ - * /`, `:Dot` e `:Lerp`.

**CFrame** (completo: posição + rotação, convenções do Roblox)
- Criar: `CFrame.new(x, y, z)`, `CFrame.new(pos)`, `CFrame.new(pos, olharPara)`, `CFrame.new(x, y, z, qx, qy, qz, qw)` (quatérnio), `CFrame.new(x, y, z, r00..r22)`.
- Construtores: `CFrame.lookAt(pos, alvo, up?)`, `CFrame.Angles(rx, ry, rz)` / `fromEulerAnglesXYZ`, `fromEulerAnglesYXZ` / `fromOrientation`, `fromAxisAngle(eixo, ângulo)`, `fromMatrix(pos, direita, cima, trás?)`, `CFrame.identity`.
- Operações: `cf * cf`, `cf * vec` (ponto no mundo), `cf + vec`, `cf - vec`, `==`.
- Campos: `.Position` (`.p`), `.X .Y .Z`, `.LookVector`, `.RightVector`, `.UpVector`, `.XVector .YVector .ZVector`, `.Rotation`.
- Métodos: `:Inverse()`, `:Lerp(cf, t)` (com interpolação esférica), `:ToWorldSpace`, `:ToObjectSpace`, `:PointToWorldSpace`, `:PointToObjectSpace`, `:VectorToWorldSpace`, `:VectorToObjectSpace`, `:GetComponents()` / `:components()`, `:ToEulerAnglesYXZ()` / `:ToOrientation()`, `:ToEulerAnglesXYZ()`, `:ToAxisAngle()`.

**Color3**
- Criar: `Color3.new(r, g, b)` (0–1), `fromRGB`, `fromHSV`, `fromHex("#ff8800")`.
- Métodos: `:ToHex()`, `:ToHSV()`, `:Lerp()`.

**BrickColor:** `BrickColor.new("Bright red")` e cerca de 30 nomes comuns, `BrickColor.Random()`, `.Color`, `.Name`. `part.BrickColor = ...` funciona.

**UDim2:** `UDim2.new(sx, ox, sy, oy)`, `fromScale` e `fromOffset`.

**TweenInfo:** `TweenInfo.new(tempo, estilo?, direção?, repetições?, volta?, atraso?)`.
- Estilos: `Linear`, `Quad`, `Back`, `Bounce`, `Elastic`. Os outros usam suavização.
- `repetições = -1` repete para sempre.

**Random:** `Random.new(semente?)` com `:NextInteger(a, b)`, `:NextNumber(a?, b?)`, `:NextUnitVector()`, `:Shuffle(t)` e `:Clone()`.

**Enum:**
- `KeyCode` (A–Z, números, setas, `Space`, `LeftShift`, `Return`, `Tab`...);
- `UserInputType`, `UserInputState`, `PartType` (`Block`, `Ball`, `Cylinder`), `Material`;
- `EasingStyle`, `EasingDirection`, `RaycastFilterType`, `HumanoidStateType`, `Font`, `TextXAlignment`, `SortOrder`.

Itens desconhecidos são criados sob demanda e não dão erro.

## 4. Instâncias

### 4.1 O que toda Instance tem

- **Propriedades:** `Name`, `ClassName`, `Parent`.
- **Hierarquia:**
  - `:GetChildren()`, `:GetDescendants()`;
  - `:FindFirstChild(n, recursivo?)`, `:FindFirstChildOfClass`, `:FindFirstChildWhichIsA`;
  - `:FindFirstAncestor`, `:FindFirstAncestorOfClass`, `:FindFirstAncestorWhichIsA`;
  - `:IsDescendantOf`, `:IsAncestorOf`, `:WaitForChild(n, timeout?)`;
  - `:IsA(c)` (entende `BasePart`, `GuiObject`, `ValueBase`, `GuiButton`, `Light`...);
  - `:GetFullName()`.
- **Objeto:** `:Destroy()`, `:ClearAllChildren()`, `:Clone()`.
- **Atributos:** `:SetAttribute`, `:GetAttribute`, `:GetAttributes`, `:GetAttributeChangedSignal`.
- **Tags:** `:AddTag`, `:RemoveTag`, `:HasTag`, `:GetTags`.
- **Eventos:** `Changed`, `ChildAdded`, `ChildRemoved`, `DescendantAdded`, `AncestryChanged`, `Destroying`, `AttributeChanged`, `:GetPropertyChangedSignal(prop)`.

Um filho pode ser acessado pelo nome: `workspace.Lava`, `player.leaderstats.Moedas`.

### 4.2 Classes

| Classe | Propriedades | Eventos / métodos |
|---|---|---|
| `Part`, `SpawnLocation`, `WedgePart`, `MeshPart`, `TrussPart`, `Seat`... | `Position`, `Size`, `Orientation` (graus), `CFrame`, `Color`, `BrickColor`, `Transparency`, `Anchored`, `CanCollide`, `CanTouch`, `Shape`, `Material` (`Neon` brilha, `Glass` fica translúcido), `Velocity` | `Touched(hit)`, `TouchEnded(hit)`, `:ApplyImpulse(v)`, `:GetMass()`, `:PivotTo(cf)`, `:GetPivot()`, `:MoveTo(v)` |
| `Model`, `Folder`, `Configuration` | `PrimaryPart` (Model) | `:PivotTo`, `:GetPivot`, `:MoveTo`, `:GetBoundingBox`, `:GetExtentsSize`, `:SetPrimaryPartCFrame` |
| `StringValue`, `IntValue`, `NumberValue`, `BoolValue`, `ObjectValue`, `Vector3Value`, `Color3Value`, `CFrameValue` | `Value` | `Changed(novoValor)` |
| `RemoteEvent` | — | servidor: `:FireClient(player, ...)`, `:FireAllClients(...)`, `OnServerEvent(player, ...)`. Cliente: `:FireServer(...)`, `OnClientEvent(...)` |
| `RemoteFunction` | `OnServerInvoke = function(player, ...)` | cliente: `:InvokeServer(...)` (espera a resposta) |
| `BindableEvent` / `BindableFunction` | `OnInvoke` | `:Fire(...)` / `Event`, `:Invoke(...)` (no mesmo lado) |
| `ClickDetector` (filho de uma Part) | `MaxActivationDistance` (32) | `MouseClick(player)`. O jogador mira com o centro da tela e aperta o gatilho, o clique ou o toque |
| `ProximityPrompt` (filho de uma Part) | `ActionText`, `ObjectText`, `KeyboardKeyCode` (E), `MaxActivationDistance` (10), `Enabled` | `Triggered(player)`, `TriggerEnded`. Mostra "[E] Ação" na tela; no VR e no celular, o gatilho ativa |
| `Explosion` | `Position`, `BlastRadius`, `DestroyJointRadiusPercent` | `Hit(part, distância)`. No servidor, mata os jogadores dentro do raio (se `DestroyJointRadiusPercent` > 0) e empurra Parts soltas |
| `ScreenGui`, `Frame`, `TextLabel`, `TextButton`, `ImageLabel`, `ImageButton`, `TextBox` | `Position`/`Size` (UDim2), `Text`, `TextSize`, `TextColor3`, `BackgroundColor3`, `BackgroundTransparency`, `Visible`, `Enabled`, `Image` (só `data:`) | botões: `Activated`, `MouseButton1Click`. `TextBox`: `FocusLost` com `.Text`. Ponha a ScreenGui em `player.PlayerGui` (num LocalScript) |
| `Sound` | `SoundId` (nome de um som do jogo), `Volume` | `:Play()` (num Script, todos ouvem), `:Stop()` |
| `PointLight`, `SpotLight` | `Brightness`, `Range`, `Color` | (ainda não iluminam) |
| `ModuleScript` | — | `require` |
| `UICorner`, `UIListLayout`, `UIPadding`, `UIStroke`, `UIGradient`, `Attachment`, `Decal`, `ParticleEmitter`, `Fire`, `Smoke`, `Sparkles`, `Tool`, `Accessory`, `Team` | aceitos (para scripts do Roblox não quebrarem); só guardam propriedades | `ParticleEmitter:Emit()` faz partículas |

**Física:** uma Part com `Anchored = false` cai com a gravidade do `workspace`, quica no chão e respeita `Velocity` e `ApplyImpulse`. Quem simula é o servidor, que replica a posição. Não colide com outras Parts.

**Colisão do jogador:** Parts com `CanCollide = true` são caixas sólidas. Só a rotação Y entra na colisão.

**Limite:** 600 Parts por mapa.

## 5. Jogadores

```lua
-- Script (servidor)
local Players = game:GetService("Players")
Players.PlayerAdded:Connect(function(player)
  print(player.Name, player.UserId)
  local hum = player.Character:WaitForChild("Humanoid")
  hum.WalkSpeed = 20                        -- vale no aparelho daquele jogador
  hum.Died:Connect(function() print(player.Name .. " caiu") end)   -- renasce no spawn após Players.RespawnTime (3 s)
end)
Players.PlayerRemoving:Connect(function(player) end)
```

**Player**
- Propriedades: `Name`, `DisplayName`, `UserId` (número estável por jogador), `Character`.
- Filhos: `PlayerGui`, `Backpack`, `PlayerScripts`, `leaderstats`.
- Eventos: `CharacterAdded`, `CharacterRemoving`, `Chatted`.
- Métodos: `:Kick(motivo)` (manda para a Vila), `:LoadCharacter()`, `:DistanceFromCharacter(v)`, `:GetMouse()`.

**Character:** `HumanoidRootPart` (`Position`; escrever teleporta), `Head` e `Humanoid`.

**Humanoid**
- Propriedades: `Health`, `MaxHealth`, `WalkSpeed` (16), `JumpPower` (50), `JumpHeight`, `DisplayName`.
- Eventos: `Died`, `HealthChanged`.
- Métodos: `:TakeDamage(n)`, `:MoveTo(v)` (teleporta), `:LoadAnimation()` (ainda não anima).

**Players (serviço)**
- `GetPlayers()`, `GetPlayerByUserId`, `GetPlayerFromCharacter`;
- `LocalPlayer` (só em LocalScripts);
- `RespawnTime`, `MaxPlayers`.

**`leaderstats`:** uma Folder chamada `leaderstats` dentro do Player, com `IntValue`/`NumberValue`/`StringValue`, aparece como **placar** no canto da tela de todos (até 4 colunas, ordenado pela primeira).

**Toque do servidor:** `part.Touched` no servidor dispara para **qualquer** jogador. O `hit` é a `HumanoidRootPart` dele, então `Players:GetPlayerFromCharacter(hit.Parent)` funciona.

## 6. Serviços (`game:GetService`)

| Serviço | O que tem |
|---|---|
| `Players` | seção 5 |
| `Workspace` | igual a `workspace` |
| `ReplicatedStorage`, `ReplicatedFirst` | compartilhados: RemoteEvents, módulos, modelos |
| `ServerStorage`, `ServerScriptService` | só no servidor (não replicam) |
| `RunService` | `Heartbeat(dt)`, `RenderStepped`, `Stepped`, `PreSimulation`, `PostSimulation`, `IsServer()`, `IsClient()`, `IsStudio()`, `BindToRenderStep`, `UnbindFromRenderStep` |
| `UserInputService` | `InputBegan(input, gp)`, `InputEnded`, `JumpRequest`, `IsKeyDown(KeyCode)`, `GetKeysPressed()`, `TouchEnabled`, `KeyboardEnabled`. O clique e o gatilho chegam como `MouseButton1` |
| `ContextActionService` | `BindAction(nome, f, botaoToque, KeyCode...)`, `UnbindAction` |
| `TweenService` | `:Create(obj, TweenInfo, {Prop = alvo}):Play()`. Anima número, Vector3, Color3, CFrame e UDim2. Tem `Completed`, `Cancel` e `Pause` |
| `Debris` | `:AddItem(obj, s)` |
| `Lighting` | `ClockTime` (0–24, muda o céu para todos), `GetMinutesAfterMidnight`, `SetMinutesAfterMidnight` |
| `DataStoreService` | seção 7 (só no servidor) |
| `HttpService` | `JSONEncode`, `JSONDecode`, `GenerateGUID`, `UrlEncode`. `GetAsync`/`PostAsync` dão erro: **sem internet** |
| `CollectionService` | `AddTag`, `RemoveTag`, `HasTag`, `GetTagged`, `GetTags`, `GetInstanceAddedSignal`, `GetInstanceRemovedSignal` (por lado; as tags não replicam) |
| `StarterGui` | `SetCore("SendNotification", {Title, Text})` vira um aviso |
| `StarterPlayer` | `CharacterWalkSpeed`, `CharacterJumpPower` (valores iniciais) |
| `Chat`, `TextChatService` | `Chatted` / `MessageReceived` |
| `MarketplaceService`, `BadgeService` | existem para scripts não quebrarem. Não há compras: o RoleVRGO é grátis. `AwardBadge` mostra um aviso |
| `PathfindingService` | `CreatePath()` com caminho em linha reta |
| `TeleportService`, `MessagingService`, `GroupService`, `LocalizationService`, `Teams`, `SoundService`, `StarterPack` | existem para compatibilidade, com funções vazias |

**Camera e Mouse** (LocalScript)
- `workspace.CurrentCamera.CFrame`: onde você está olhando (só leitura).
- `player:GetMouse()` traz:
  - `Hit` (CFrame do ponto mirado);
  - `Target` (a Part mirada);
  - `UnitRay`;
  - os eventos `Button1Down`, `Button1Up` e `KeyDown`.

**Raycast**

```lua
local params = RaycastParams.new()
params.FilterDescendantsInstances = { workspace.Parede }
params.FilterType = Enum.RaycastFilterType.Exclude
local r = workspace:Raycast(origem, direcao * 100, params)
if r then print(r.Instance.Name, r.Position, r.Normal, r.Distance) end
```

Funciona contra as Parts dos scripts, como caixas sem rotação. O cenário do mapa e os modelos não entram.

## 7. DataStore (só em Scripts do servidor)

```lua
local DSS = game:GetService("DataStoreService")
local banco = DSS:GetDataStore("Moedas")
local valor = banco:GetAsync(tostring(player.UserId)) or 0
banco:SetAsync(tostring(player.UserId), valor + 10)
banco:UpdateAsync("total", function(velho) return (velho or 0) + 1 end)
banco:IncrementAsync("visitas", 1)
banco:RemoveAsync("lixo")

local ranking = DSS:GetOrderedDataStore("Recordes")
ranking:SetAsync(tostring(player.UserId), 1234)
for _, item in ipairs(ranking:GetSortedAsync(false, 10):GetCurrentPage()) do print(item.key, item.value) end
```

**Onde os dados ficam:**
- **Mapa publicado:** no servidor do RoleVRGO, separados por mapa.
- **Projeto ainda não publicado (Studio) ou offline:** no aparelho.

**Valores aceitos:** número, texto, booleano, tabela, Vector3, Color3 e CFrame.

**Limites:**
- 16 KB por valor;
- 20 mil chaves por mapa;
- 120 gravações por minuto por anfitrião;
- nomes com até 60 letras.

`GetSortedAsync` só lista valores numéricos (até 100).

## 8. Cliente ↔ servidor (padrão do Roblox)

```lua
-- Script (servidor)
local evento = Instance.new("RemoteEvent")
evento.Name = "Pontuar"
evento.Parent = game:GetService("ReplicatedStorage")
evento.OnServerEvent:Connect(function(player, quanto)
  if typeof(quanto) ~= "number" or quanto > 10 then return end   -- sempre valide no servidor
  player.leaderstats.Pontos.Value += quanto
end)

-- LocalScript (cliente)
local evento = game:GetService("ReplicatedStorage"):WaitForChild("Pontuar")
evento:FireServer(5)
```

**O que pode viajar entre cliente e servidor:**
- números, textos, booleanos e tabelas;
- `Vector3`, `Color3`, `CFrame`, `Vector2`, `UDim2` e EnumItems;
- **Instances replicadas** (Parts, Players...).

Funções não viajam.

## 9. O que não existe (ainda)

Isto aparece em muitos jogos do Roblox, mas ainda não existe no RoleVRGO:

- Animações de personagem: `LoadAnimation` não anima.
- Ferramentas na mão (`Tool` equipável).
- Constraints e física entre Parts.
- Terreno (`Terrain`).
- Malhas e texturas importadas por ID.
- Sons por `rbxassetid` (use os nomes de som do jogo).
- `InvokeClient`.
- Teleporte entre lugares e servidores reservados.
- Compras.
- Times com cores no placar.
- Luzes que iluminam.

## 10. `RoleVR`: extras do RoleVRGO

| Função | Efeito |
|---|---|
| `RoleVR.isServer` | `true` em Scripts do servidor |
| `RoleVR.toast(texto, corCSS?)` | aviso. Num Script, todos veem |
| `RoleVR.banner(texto, s?)` | faixa grande no topo. Num Script, todos veem |
| `RoleVR.say(texto)` | o seu gato fala no chat (LocalScript, no máximo 1 vez a cada 5 s) |
| `RoleVR.sound(nome, vol?)` | som do jogo. Num Script, todos ouvem |
| `RoleVR.effect(posV3, Color3?, n?)` | partículas |
| `RoleVR.model(chave, posV3, escala?, giroY?)` | modelo da Kenney (`"nature/tree_oak"`, `"food/burger"`, `"space/rocket_baseA"`...) |
| `RoleVR.npc(nome, posV3, {falas})` | gato NPC que fala |
| `RoleVR.fly(bool)`, `RoleVR.sky(Color3)`, `RoleVR.emote(id)` | voo, cor do céu, emote (LocalScript) |

**Nomes de som:** `coin`, `pickup`, `win`, `secret`, `portal`, `levelup`, `quest`, `punch`, `click`, `bell`, `chest`, `power`, `heart`, `splash`, `glass`, `error`, `confirm`, `open`, `close`, `ko`, `event`, `dodge`, `book`, `msg`.

**Modelos:** mais de 330, nos pacotes nature, town, castle, city, pirate, survival, arena, holiday, plat, dungeon, grave, food, fur, car, space, golf e train. Veja a paleta em menu > 🛠 Criar.

---

## 11. Mods HTML/CSS/JS

Um mod é uma página HTML transparente **por cima do jogo**, com o objeto `window.rv`.

**Importar:** Studio > 🧩 Mods > Importar.
- `.zip` com `index.html` + `.css` + `.js` + imagens/sons, que são embutidos automaticamente;
- ou arquivos soltos `.html`, `.css`, `.js`;
- `.lua` e `.luau` viram scripts.

```js
rv.player                         // { x, y, z } a cada quadro
rv.on('tick', (dt) => {}); rv.on('key', (code, down) => {}); rv.on('chat', (texto) => {}); rv.on('touch', (partId, entrou) => {})
const p = rv.part({ Position: {x:0, y:3, z:-5}, Size: {x:2, y:2, z:2}, Color: [1, 0.3, 0.6], Anchored: true, Shape: 'Ball' })
p.set('Position', {x:0, y:6, z:-5}); p.destroy()
rv.toast(t, cor?); rv.banner(t, s?); rv.say(t); rv.sound(nome, vol?); rv.effect(x, y, z, 0xRRGGBB?, n?)
rv.teleport(x, y, z); rv.walkSpeed(16); rv.jumpPower(50); rv.gravity(196.2); rv.clockTime(14); rv.fly(true)
rv.model('food/burger', x, y, z, escala?, giro?); rv.npc('Nome', x, y, z, ['fala'])
rv.interactive(true)   // recebe cliques enquanto um menu estiver aberto; false devolve
```

**Restrições:**
- O mod roda **só no seu aparelho**.
- Sem rede e sem `localStorage`.
- Não aparece dentro do VR.

## 12. Publicar e segurança

**Studio > 📦 Projeto:**
- exportar e importar `.zip`;
- salvar privado;
- **🌍 Publicar**: o mapa aparece em menu > 🛠 Criar > 🌍 Comunidade, com um código.

**Limites:** 900 KB por projeto, 700 objetos de mapa e 600 Parts de script. Mapas da comunidade são sandbox: não dão XP, moedas nem itens de verdade.

**Segurança:**
- iframes `sandbox="allow-scripts"` (origem nula), com CSP sem rede;
- o host só aceita `postMessage` dos próprios iframes;
- valores limitados;
- `say` no máximo a cada 5 s;
- imagens só `data:`;
- mensagens de rede aceitas só do anfitrião (replicação) ou validadas por ele (RemoteEvents).
