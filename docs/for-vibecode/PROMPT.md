# Prompt para IAs (For-VibeCode)

Cole o texto abaixo no começo da conversa com o ChatGPT, Claude, Gemini, Cursor, Copilot etc. Depois peça o que quiser ("faz um obby com 10 fases", "faz uma loja", "faz um mod de placar").

---

Você vai escrever código para o **RoleVRGO Studio** (jogo de gatos em VR no navegador, versão 1.0.0 "FullFinalVer").

**Regras obrigatórias:**

1. **Scripts:** são em **Luau-lite** (Luau convertido para Lua 5.3), no estilo Roblox, e rodam no aparelho de cada jogador, como um LocalScript.
   - Pode usar anotações de tipo, `type X = ...`, `+=`, `continue` e strings `` `com {interpolação}` ``.
   - NÃO use `local x = if a then b else c`, `require`, RemoteEvents, DataStores, `HttpService` nem `bit32`/`buffer`.
2. **Só existe o que está na API abaixo.** Se o pedido precisar de algo que não existe, diga e proponha uma alternativa com a API.
3. **Medidas:** o mundo é em metros. Um gato tem cerca de 1,3 m de altura. O chão do mapa é perto de y = 0. `WalkSpeed` 16 = normal, `JumpPower` 50 = normal e `workspace.Gravity` 196.2 = normal.
4. **Limites:** no máximo 600 Parts, 900 KB por projeto, e `RoleVR.say` no máximo a cada 5 s.
5. **Divisão:** `/` sempre dá número com vírgula. Use `//` ou `math.floor` quando precisar de inteiro.
6. **Mods:** são páginas HTML/CSS/JS por cima do jogo, com o objeto `window.rv`.
   - Sem rede: nada de CDN, `fetch` ou imagem externa. Embuta tudo.
   - Sem `localStorage`.
   - Chame `rv.interactive(true)` só enquanto houver botões na tela.
7. **Formato da resposta:** um único bloco de código por arquivo, com o nome do arquivo antes.
   - Scripts terminam em `.luau`.
   - Para mod com vários arquivos, gere `index.html`, `style.css` e `main.js` e diga para zipar e importar em Studio > Mods > Importar.

**Resumo da API:**

- **Globais:** `game`, `workspace`, `script`, `Instance.new`, `Vector3`, `Color3`, `UDim2`, `CFrame.new` (só posição), `TweenInfo`, `BrickColor`, `Enum`, `task.wait/spawn/delay/defer/cancel`, `wait`, `print`, `warn`, `tick`, `time`, `RoleVR`.
- **Part:**
  - propriedades: `Position`, `Size`, `Orientation` (só Y colide), `Color`, `Transparency`, `Anchored`, `CanCollide`, `Shape` (`Enum.PartType.Block/Ball/Cylinder`), `Velocity`;
  - eventos `Touched`/`TouchEnded` (o `hit` é a `HumanoidRootPart`, então `hit.Parent:FindFirstChild("Humanoid")` funciona);
  - métodos `:ApplyImpulse`, `:Destroy`, `:Clone`.
- **Outras classes:** `Model`, `Folder`, `*Value`, `ScreenGui`, `Frame`, `TextLabel`, `TextButton` (`Activated`), `ImageLabel` (só `data:`), `Sound` (`SoundId` = nome de som do jogo), `Humanoid` (`Health`, `MaxHealth`, `WalkSpeed`, `JumpPower`, `TakeDamage`, `Died`, `MoveTo`).
- **Todo Instance:** `Name`, `Parent`, `FindFirstChild`, `WaitForChild`, `GetChildren`, `GetDescendants`, `IsA`, `Destroy`, `Clone`, `SetAttribute`/`GetAttribute`, `Changed`, `GetPropertyChangedSignal`, `ChildAdded`.
- **Serviços:**
  - `Players` (`LocalPlayer.Character.Humanoid` / `.HumanoidRootPart`, `LocalPlayer.PlayerGui`, `Chatted`);
  - `RunService` (`Heartbeat`, `RenderStepped`, `Stepped`);
  - `UserInputService` (`InputBegan`/`InputEnded`, `input.KeyCode == Enum.KeyCode.E`);
  - `TweenService` (`:Create(obj, TweenInfo.new(t), {Prop=alvo}):Play()`);
  - `Debris` (`:AddItem`);
  - `Lighting` (`ClockTime`);
  - `ReplicatedStorage`;
  - `StarterGui` (`SetCore("SendNotification")`).
- **`RoleVR`:**
  - `toast(texto)`, `banner(texto, s)`, `say(texto)`;
  - `sound(nome)` (coin, pickup, win, secret, portal, levelup, quest, punch, click, bell, chest, power, heart, splash, glass, error);
  - `effect(posV3, Color3, n)`;
  - `model(chaveKenney, posV3, escala, giroY)`, por exemplo "nature/tree_oak", "food/burger", "space/rocket_baseA", "car/taxi", "fur/loungeSofa";
  - `npc(nome, posV3, {falas})`, `fly(bool)`, `sky(Color3)`, `emote(id)`.
- **Mod JS (`window.rv`):**
  - `rv.player {x,y,z}`, `rv.on('tick'|'key'|'chat'|'touch', fn)`;
  - `rv.part({Position:{x,y,z}, Size:{x,y,z}, Color:[r,g,b], Anchored, CanCollide, Shape})` devolve `{set(k,v), destroy()}`;
  - `rv.toast`, `rv.banner`, `rv.say`, `rv.sound`, `rv.effect(x,y,z,cor,n)`, `rv.teleport`;
  - `rv.walkSpeed`, `rv.jumpPower`, `rv.gravity`, `rv.clockTime`, `rv.fly`;
  - `rv.model(chave,x,y,z,escala,giro)`, `rv.npc(nome,x,y,z,[falas])`, `rv.interactive(bool)`.

A referência completa está em `API.md`.
