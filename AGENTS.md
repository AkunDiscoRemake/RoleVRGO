# AGENTS.md — guia para IAs (e pessoas) que mexem no código do RoleVRGO

RoleVRGO 1.0.0 "FullFinalVer". É a última versão oficial: daqui em diante a comunidade continua o jogo pelo **Studio** (mapas, scripts Luau e mods). Se você quer **criar conteúdo**, não precisa deste arquivo: veja `docs/for-vibecode/` (API, prompt e exemplos). Este guia é para quem altera o **motor do jogo**.

## Stack

- JavaScript puro (ES modules) + **Three.js r160** + WebXR. Sem framework.
- Build com **esbuild** (`tools/build.mjs`): gera `dist/game.js` (um arquivo só).
- Backend: **Supabase**, acessado só por RPC (`security definer`). A identidade é `id` + `secret` no `localStorage`. Os SQL ficam em `supabase/*.sql`.
- Hospedagem: GitHub Pages (`.github/workflows/pages.yml` copia `index.html dist assets lancamento docs`).

## Comandos

```bash
npm install
npm run i18n     # extrai textos PT e monta src/i18n-dict.json (EN/ES/RU)
npm run build    # gera dist/game.js
python3 -m http.server 8080   # abre http://localhost:8080
```

## Mapa do código (`src/`)

| Arquivo | O que faz |
|---|---|
| `main.js` | lobby, `start()`, loop de render, VR/VR Box, globais de depuração `self.RV` |
| `game.js` | o jogo: `loadMap`, `update`, NPCs, inimigos, rede, efeitos. `G` |
| `player.js` | física do jogador, mãos (Gorilla Locomotion), entradas (teclado, controle, VR, toque) |
| `world.js` | terreno, colisão (`addBoxC`, `dyn`), lotes de modelos (`w.put`) |
| `maps.js`, `maps2.js`, `maps3.js`, `gp.js` | definições dos mapas: `MAPS.id = { build(w,E,r), after(G,add), tick(dt,G), amb() }` + `MAP_ORDER`/`MAP_ICONS`/`PORTAL_COLORS` |
| `cat.js` | avatar do gato (geometria procedural + shader com partes animadas) |
| `ui.js` | menus em canvas 3D (`p_<página>()`, `btn`, `qrow`) |
| `state.js` (`S`) | save, XP, itens, conquistas |
| `data.js` | itens, conquistas, missões, inimigos |
| `maker.js` | criador de mapas da comunidade (`maker.map` = JSON do mapa, com `scripts` e `mods`) |
| `studio/host.js` | host: iframes de servidor e cliente, eleição do anfitrião (`meta.jt`), replicação pela sala (mensagens `rx*`), Parts/GUI/placar/ClickDetector/Prompt e DataStore |
| `studio/runtime.js` | conversor Luau→Lua e inicialização do iframe |
| `studio/prelude.js` | prelúdio Lua: toda a API estilo Roblox (Instance, CFrame, serviços, Players, Remotes, DataStore...), com contexto `server` ou `client` |
| `studio/panel.js` | painel do Studio (DOM) |
| `studio/zip.js` | unzip/zip mínimos e montagem de mods |
| `marker.js`, `plusdetect.js` | rastreamento por um "+" no papel (câmera) |
| `touch.js` | controles de toque no celular sem óculos |
| `net.js` | Supabase: login, salas (Realtime broadcast `net.send(type, data)`), RPCs |
| `assets.js` | modelos (`assets/models.bin`, geometria com cor por vértice), sons, síntese de áudio |

## Regras importantes (quebram o build ou o jogo)

1. **Nunca regenere `tools/i18n/pt.json`**: os índices das traduções mudam. Traduções novas vão em `tools/i18n/homes.json` (`"texto pt": ["en", "es", "ru"]`) e depois `npm run i18n`.
2. Arquivos novos com textos para o jogador entram na lista de `tools/i18n-extract.mjs`.
3. **Não use comentário `//` no meio de código de uma linha só**. Muitas linhas são longas e "achatadas": use `/* */`.
4. Strings em aspas simples são traduzidas no build. Código que vira texto e roda em iframe (`iframeBoot`, `modApi`) não pode depender da função de tradução.
5. Modelos novos da Kenney: adicione a chave em `tools/models.json` e rode `KENNEY_DIR=... node tools/bake-models.mjs`. Os kits `space` e `fur` são recentralizados.
6. **Segurança dos scripts da comunidade:**
   - nunca rode código de mapa no contexto da página;
   - mantenha `sandbox="allow-scripts"` (sem `allow-same-origin`) e a CSP sem rede;
   - o host só aceita mensagens dos próprios iframes.
7. Mapas da comunidade rodam em `S.sandbox = true`: nada de XP, moedas ou itens de verdade.

## Testes

Não há suíte formal. Testa-se com **Playwright** (Chromium com `--use-gl=swiftshader`), dirigindo o jogo por `self.RV`:

```js
await page.click('#play');                       // entra no jogo
await page.evaluate(() => { RV.G.loadMap('moon'); RV.G.renderer.setAnimationLoop(null); for (let i = 0; i < 60; i++) RV.G.update(1 / 30); });
```

- Use uma sala privada (`localStorage.rv_room`) e **não** chame funções que gravam rankings públicos em testes.
- Teste de resistência: carregue todos os mapas em sequência e confira `pageerror`, NaN e vazamento de geometrias e texturas (`renderer.info.memory`).
- Studio: `RV.studio.enter(RV.G)` e `RV.host.start(RV.G, [{ n, src }], [{ n, html }], { studio: true })`.

## Convenções

- Comentários e textos do jogo em português.
- Novas mecânicas de mapa ficam no próprio objeto do mapa (`tick`, `press`/`release` para o gatilho, `grav`, `skyT`, `noWx`, `noClouds`).
- Commits em português, descrevendo o que muda para o jogador.
