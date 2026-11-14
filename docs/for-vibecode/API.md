# RoleVRGO Studio — referência completa da API

> Versão do jogo: **1.0.0 "FullFinalVer"**. Este arquivo é a fonte única da API: humanos leem em `docs/`, IAs leem este arquivo.

O RoleVRGO Studio roda **dois tipos de código** feitos pela comunidade:

| Tipo | Linguagem | Onde roda | Para quê |
|---|---|---|---|
| **Script** | Luau (estilo Roblox), convertido para Lua 5.3 | iframe sandbox invisível | lógica do jogo: Parts, eventos, GUI, física simples |
| **Mod** | HTML + CSS + JS | iframe sandbox visível, por cima do jogo | interfaces, HUDs, minigames 2D, efeitos |

Os dois **não têm acesso** à conta, ao login, ao save, à rede (CSP `default-src 'none'`) nem à página do jogo. Eles só falam com o jogo pela API abaixo.

---

## 1. Scripts Luau

### 1.1 O que é "Luau-lite"

O código é convertido para Lua 5.3 antes de rodar. Funciona:

- Anotações de tipo: `local x: number = 1`, `function f(a: string, b: {number}?): boolean`, retorno em tupla `(): (number, string)`.
- Declarações `type X = ...` e `export type X = {...}` (inclusive em várias linhas): são removidas.
- Atribuição composta: `+=  -=  *=  /=  //=  %=  ^=  ..=`.
- `continue` dentro de `for`/`while`.
- Interpolação: `` `Moedas: {moedas}` ``.

**Não** funciona: generics complexos em expressões, `if ... then ... else` como expressão (`local x = if a then b else c`), bibliotecas `buffer`/`bit32`, `require` de ModuleScripts (use um script só, ou `_G`).

Números do Lua 5.3: `10 / 2` dá `5.0`. Use `//` para divisão inteira e `math.floor` quando precisar de inteiro. O `print` já mostra `5` em vez de `5.0` quando o número é inteiro.

### 1.2 Globais

| Global | Descrição |
|---|---|
| `game` | DataModel. `game:GetService(nome)`, `game.Workspace`, `game.Players`, `game.Lighting`... |
| `workspace` | O mundo. Parts com `Parent = workspace` aparecem no mapa. `workspace.Gravity` (padrão 196.2) |
| `script` | O script atual (`script.Parent == workspace`) |
| `Instance.new(classe, pai?)` | Cria um objeto |
| `Vector3`, `Color3`, `UDim2`, `CFrame`, `TweenInfo`, `BrickColor`, `Enum` | Tipos de dados |
| `task.wait(s)`, `task.spawn(f, ...)`, `task.delay(s, f, ...)`, `task.defer(f, ...)`, `task.cancel(co)` | Agendador. `wait`, `spawn`, `delay` também existem |
| `print(...)`, `warn(...)` | Vão para a aba **Saída** do Studio |
| `tick()`, `time()` | Segundos desde que os scripts começaram |
| `RoleVR` | Extras do RoleVRGO (seção 1.8) |

### 1.3 Tipos de dados

**Vector3**: `Vector3.new(x, y, z)`. Também `Vector3.zero`, `Vector3.one`, `xAxis`, `yAxis`, `zAxis`.
- Campos: `.X .Y .Z .Magnitude .Unit`
- Operações: `+ - * /` (com vetor ou número), `-v`, `==`
- Métodos: `:Dot(v)`, `:Cross(v)`, `:Lerp(v, t)`

**Color3**: `Color3.new(r, g, b)` (0–1), `Color3.fromRGB(0–255)`, `Color3.fromHSV(h, s, v)`.
- Campos: `.R .G .B`
- Método: `:Lerp(c, t)`

**UDim2**: `UDim2.new(escalaX, pixelsX, escalaY, pixelsY)`, `UDim2.fromScale(x, y)`, `UDim2.fromOffset(x, y)`.

**CFrame** (simplificado): `CFrame.new(x, y, z)` ou `CFrame.new(vec)`. Só a posição (`.Position`) é usada. `part.CFrame = ...` muda a posição.

**TweenInfo**: `TweenInfo.new(tempo, estilo?, direção?, repetições?, volta?, atraso?)`. A suavização é sempre "smoothstep".

**BrickColor**: `BrickColor.new("Red" | "Blue" | "Green" | "Yellow" | "White" | "Black" | "Gray")` e depois `.Color`.

**Enum**:
- `Enum.KeyCode.A..Z`, `Space`, `LeftShift`, `Return`, `One..Five`, `Up`, `Down`, `Left`, `Right`
- `Enum.PartType.Block | Ball | Cylinder`
- `Enum.UserInputType.Keyboard`
- `Enum.Material.*` é aceito e ignorado.

### 1.4 Classes de Instance

Toda Instance tem:

- **Propriedades:** `Name`, `ClassName`, `Parent`
- **Métodos:**
  - `:IsA(c)`, `:GetChildren()`, `:GetDescendants()`
  - `:FindFirstChild(nome, recursivo?)`, `:FindFirstChildOfClass(c)`, `:FindFirstAncestor(nome)`, `:WaitForChild(nome, timeout?)`
  - `:Destroy()`, `:ClearAllChildren()`, `:Clone()`, `:GetFullName()`
  - `:SetAttribute(k, v)`, `:GetAttribute(k)`, `:GetPropertyChangedSignal(prop)`
- **Eventos:** `Changed(prop)`, `ChildAdded`, `ChildRemoved`, `AncestryChanged`, `Destroying`

Um filho pode ser acessado pelo nome: `workspace.Lava`.

| Classe | Propriedades extras | Eventos / métodos |
|---|---|---|
| `Part`, `SpawnLocation`, `WedgePart`, `MeshPart` | `Position` (V3), `Size` (V3, padrão 4×1×2), `Orientation` (V3, graus; só Y afeta a colisão), `Color` (C3), `BrickColor`, `Transparency` (0–1), `Anchored` (padrão true), `CanCollide` (padrão true), `Shape` (`Block`/`Ball`/`Cylinder`), `Velocity`, `CFrame` (só a posição), `Material` (ignorado) | `Touched(hit)`, `TouchEnded(hit)`, `:ApplyImpulse(v)`, `:PivotTo(cf)`, `:GetPivot()`, `:MoveTo(v)` |
| `Model`, `Folder` | — | agrupam objetos |
| `StringValue`, `IntValue`, `NumberValue`, `BoolValue`, `ObjectValue`, `Vector3Value`, `Color3Value` | `Value` | `Changed` |
| `ScreenGui` | `Enabled`/`Visible` | contêiner da interface. Ponha em `game.Players.LocalPlayer.PlayerGui` |
| `Frame`, `TextLabel`, `TextButton`, `ImageLabel` | `Position`, `Size` (UDim2), `Text`, `TextSize`, `TextColor3`, `BackgroundColor3`, `BackgroundTransparency`, `Visible`, `Image` (só `data:image/...;base64`) | `TextButton`: `Activated`, `MouseButton1Click` |
| `Sound` | `SoundId` (nome de um som do jogo, ex. `"coin"`), `Volume` | `:Play()`, `:Stop()` |
| `PointLight` | `Brightness`, `Range`, `Color` | (ainda não ilumina) |
| `Humanoid` | `Health`, `MaxHealth`, `WalkSpeed` (16 = normal), `JumpPower` (50 = normal) | `Died`, `HealthChanged`, `:TakeDamage(n)`, `:MoveTo(v3)` (teleporta) |

**Física:** uma Part com `Anchored = false` cai com a gravidade do `workspace`, quica no chão e respeita `Velocity` e `ApplyImpulse`. Não colide com outras Parts.

**Colisão do jogador:** Parts com `CanCollide = true` viram caixas sólidas. Rotação só no eixo Y.

**Limite:** 600 Parts por mapa.

### 1.5 Jogador

```lua
local Players = game:GetService("Players")
local player = Players.LocalPlayer           -- você (Name = seu nome)
local char = player.Character                -- Model "Gato"
local root = char.HumanoidRootPart           -- .Position (só leitura em tempo real; escrever teleporta)
local hum = char.Humanoid                    -- Health, WalkSpeed, JumpPower...
```

Mais coisas do jogador:

- `player.PlayerGui`: onde vai a sua ScreenGui.
- `player.Chatted:Connect(function(msg) end)`: o que você digitou no chat.
- `Players:GetPlayers()`: lista com você.
- `Players:GetPlayerFromCharacter(char)`.

**Padrão do Roblox:**

```lua
part.Touched:Connect(function(hit)
  local hum = hit.Parent:FindFirstChild("Humanoid")
  if hum then hum:TakeDamage(10) end
end)
```

`hit` é a `HumanoidRootPart` do seu gato, então `hit.Parent` é o personagem.

### 1.6 Serviços (`game:GetService`)

| Serviço | O que tem |
|---|---|
| `Players` | `LocalPlayer`, `GetPlayers()`, `PlayerAdded`, `PlayerRemoving` |
| `Workspace` | igual a `workspace` |
| `RunService` | `Heartbeat(dt)`, `RenderStepped(dt)`, `Stepped(t, dt)`: todos rodam uma vez por quadro |
| `UserInputService` | `InputBegan(input, gp)`, `InputEnded`. `input.KeyCode == Enum.KeyCode.E` (teclado do PC) |
| `TweenService` | `:Create(obj, TweenInfo, {Prop = alvo}):Play()`. Anima números, Vector3 e Color3. `tween.Completed` |
| `Debris` | `:AddItem(obj, segundos)` |
| `Lighting` | `ClockTime` (0–24): muda a hora do dia |
| `ReplicatedStorage`, `ServerStorage` | guardar objetos fora do mundo |
| `SoundService` | (vazio) |
| `StarterGui` | `:SetCore("SendNotification", {Title=, Text=})` vira um aviso na tela |
| `Chat` / `TextChatService` | `Chatted(msg)` |

### 1.7 Multijogador

Os scripts rodam **no aparelho de cada jogador** (como LocalScripts). Cada pessoa que entra no mapa roda os scripts para si. Ainda não há RemoteEvents, servidor nem dados salvos por script.

### 1.8 `RoleVR` — extras do RoleVRGO

| Função | Efeito |
|---|---|
| `RoleVR.toast(texto, corCSS?)` | aviso no canto |
| `RoleVR.banner(texto, segundos?)` | faixa grande no topo |
| `RoleVR.say(texto)` | o seu gato fala no chat (no máximo 1 vez a cada 5 s) |
| `RoleVR.sound(nome, volume?)` | toca um som do jogo: `coin`, `pickup`, `win`, `secret`, `portal`, `levelup`, `quest`, `punch`, `click`, `bell`, `chest`, `power`, `heart`, `splash`, `glass`, `error`, `confirm`, `open`, `close`, `ko`, `event`, `dodge`, `book`, `msg` |
| `RoleVR.effect(posV3, cor?, quantidade?)` | explosão de partículas |
| `RoleVR.model(chave, posV3, escala?, giroY?)` | coloca um modelo do jogo (`"nature/tree_oak"`, `"food/burger"`, `"space/rocket_baseA"`...). Retorna um objeto com `:Destroy()` |
| `RoleVR.npc(nome, posV3, {falas})` | cria um gato NPC que fala |
| `RoleVR.fly(true/false)` | liga ou desliga o voo |
| `RoleVR.sky(Color3)` | cor do céu |
| `RoleVR.emote(id)` | o seu gato faz um emote |

As chaves dos modelos estão no criador de mapas: menu > 🛠 Criar > paleta. São mais de 330 modelos da Kenney, nos pacotes nature, town, castle, city, pirate, survival, arena, holiday, plat, dungeon, grave, food, fur, car, space, golf e train.

### 1.9 Exemplos

**Lava:**

```lua
local lava = Instance.new("Part")
lava.Size = Vector3.new(8, 1, 8)
lava.Position = Vector3.new(0, 0.5, -10)
lava.Color = Color3.fromRGB(255, 80, 0)
lava.Parent = workspace
lava.Touched:Connect(function(hit)
  local hum = hit.Parent:FindFirstChild("Humanoid")
  if hum then hum.Health = 0 end
end)
```

**Contador com GUI:**

```lua
local gui = Instance.new("ScreenGui")
gui.Parent = game.Players.LocalPlayer.PlayerGui
local label = Instance.new("TextLabel")
label.Size = UDim2.new(0, 220, 0, 50)
label.Position = UDim2.new(0, 20, 0, 20)
label.Parent = gui
local n = 0
while true do
  n += 1
  label.Text = `Segundos: {n}`
  task.wait(1)
end
```

**Porta com tecla E:**

```lua
local porta = Instance.new("Part")
porta.Size = Vector3.new(4, 6, 0.5)
porta.Position = Vector3.new(0, 3, -6)
porta.Parent = workspace
local aberta = false
game:GetService("UserInputService").InputBegan:Connect(function(input)
  if input.KeyCode == Enum.KeyCode.E then
    aberta = not aberta
    local alvo = aberta and Vector3.new(0, 9, -6) or Vector3.new(0, 3, -6)
    game:GetService("TweenService"):Create(porta, TweenInfo.new(0.5), { Position = alvo }):Play()
  end
end)
```

---

## 2. Mods HTML/CSS/JS

Um mod é uma página HTML transparente **por cima do jogo**. Ela ganha o objeto global `window.rv`.

### 2.1 Formatos aceitos (Studio > aba Mods > Importar)

- **`.zip`** com `index.html` (ou outro `.html`), `.css`, `.js` e imagens/sons. Os `<link rel="stylesheet">`, os `<script src>` e as imagens/sons referenciados são embutidos automaticamente.
- **Arquivos soltos:** `.html`, `.css`, `.js` (CSS e JS sem HTML viram um mod próprio).
- **`.lua` / `.luau`:** viram scripts (seção 1).

### 2.2 `window.rv`

```js
rv.player                         // { x, y, z } atualizado a cada quadro
rv.on('tick', (dt) => {})         // uma vez por quadro
rv.on('key', (code, down) => {})  // teclas do PC: 'KeyE', 'Space'...
rv.on('chat', (texto) => {})      // o que você digitou no chat
rv.on('touch', (partId, entrou) => {})
const p = rv.part({ Position: {x:0, y:3, z:-5}, Size: {x:2, y:2, z:2}, Color: [1, 0.3, 0.6], Anchored: true, Shape: 'Ball' })
p.set('Position', {x:0, y:6, z:-5}); p.destroy()
rv.toast(texto, corCSS?); rv.banner(texto, s?); rv.say(texto)
rv.sound(nome, vol?); rv.effect(x, y, z, cor0xRRGGBB?, n?)
rv.teleport(x, y, z); rv.walkSpeed(16); rv.jumpPower(50); rv.gravity(196.2); rv.clockTime(14); rv.fly(true)
rv.model('food/burger', x, y, z, escala?, giroY?) // -> { destroy() }
rv.npc('Nome', x, y, z, ['fala 1', 'fala 2'])
rv.interactive(true)  // o mod passa a receber cliques (bloqueia o jogo embaixo); false devolve
```

Por padrão o mod é **só visual** (não recebe cliques). Use `rv.interactive(true)` enquanto mostrar um menu e `false` ao fechar. O Studio também tem o botão "🖱 clicável".

### 2.3 Restrições

- Sem rede: `fetch`, imagens externas e CDNs são bloqueados. Embuta tudo no `.zip`.
- Sem `localStorage` (iframe sem origem). Guarde estado em variáveis.
- Não aparece dentro do VR (é uma camada 2D da página). Funciona no PC e no celular.

---

## 3. Publicar para a comunidade

Studio > **Projeto**:

- **📤 Exportar .zip**: `map.json` + `scripts/*.luau` + `mods/*.html`.
- **📥 Importar projeto**: o mesmo `.zip`, ou um `map.json`.
- **🌍 Publicar**: vira um mapa da comunidade (menu > 🛠 Criar > 🌍 Comunidade), com um código de 6 letras.
- **Limite:** 900 KB por projeto, 700 objetos de mapa e 600 Parts de script.

Quem entra no seu mapa roda os scripts e mods isolados e recebe um aviso. O progresso dentro de mapas da comunidade é sandbox: não dá XP, moedas nem itens de verdade.

## 4. Segurança (resumo)

| Proteção | Como funciona |
|---|---|
| Isolamento | iframes com `sandbox="allow-scripts"` (origem nula) |
| Sem rede | CSP `default-src 'none'` (só scripts inline e o fengari) |
| Comunicação | o host só aceita `postMessage` dos próprios iframes |
| Valores | os valores são validados e limitados (tamanhos, quantidades, textos) |
| Chat | `say` no máximo a cada 5 s |
| Imagens | só `data:` |
