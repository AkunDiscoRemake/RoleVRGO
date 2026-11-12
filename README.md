# RoleVRGO 🐱🥽

Mundo multiplayer VR de gatos feito para **Oculus Go** (WebXR, controle 3DoF): Gorilla Locomotion, luta PvP, mineração, pesca, missões, roleplay e 10 mapas. Também roda no navegador do computador (teclado + mouse).

**Jogar:** https://akundiscoremake.github.io/RoleVRGO/

## Tecnologia

- HTML/CSS/JavaScript + **Three.js** (r160, empacotado com esbuild para o Chromium antigo do Go).
- **WebXR** (`immersive-vr`, espaço `local`), um controle 3DoF.
- **Supabase**: Realtime (broadcast + presence) para jogadores, chat, grupos e convites; Postgres (RPCs) para salvar progresso, amigos, salas e ranking.
- **GitHub Pages** (workflow em `.github/workflows/pages.yml`; o site é estático: `index.html`, `dist/`, `assets/`).
- Assets: **Kenney.nl** (CC0) — modelos de 11 kits 3D, sons do Kenney Audio e textura do Particle Pack. Os gatos, as animações e o miado são procedurais.

## Controles

| Oculus Go | Ação |
|---|---|
| Apontar o controle para o chão e varrer | Impulso (as duas patas empurram o chão) |
| Gatilho com a pata encostada | Agarrar / escalar (puxe e solte para subir) |
| Gatilho com as patas no ar | Andar na direção apontada |
| Apontar + gatilho | Falar com NPC, abrir baú, lançar linha de pesca, clicar no menu |
| Touchpad centro | Menu completo |
| Touchpad cima / botão Back* | Menu rápido vertical (Avatar, Itens, Objetos, Emotes, Viajar) |
| Touchpad lados | Girar 30° (na zona de luta: esquiva) |
| Touchpad baixo (segurar) | Bloquear |

\* O navegador do Oculus Go normalmente reserva o botão Back para o sistema e não o entrega às páginas; por isso o topo do touchpad faz a mesma função. Se o navegador expuser o botão, ele abre o menu rápido.

Computador: WASD, mouse, clique = gatilho, Espaço pula, M menu, B menu rápido, V troca a câmera (1ª/2ª/3ª pessoa), R grava vídeo, Enter chat, 1–9 emotes, Q/E esquiva, F bloquear.

As mãos são duas bolinhas flutuantes (sem braços): uma segue a rotação do controle, a outra é espelhada proceduralmente. Não há hand tracking.

## Conteúdo

- **Mapas:** Vila, Floresta, Mina, Deserto, Montanhas Nevadas, Arena, Castelo, Cidade, Ilha, Campo de Treino e **Aero Paraíso** (estética Frutiger Aero: lago fundo para nadar e mergulhar, bolhas brilhantes estouráveis, cúpulas e torres de vidro, arco-íris, cardumes, pérolas) — cada um com NPCs, baús, segredo, minérios e atividades próprias.
- **Luta:** socos por velocidade da pata, combos, bloqueio, esquiva, zonas de PvP, bonecos e um NPC de sparring (identificado como NPC).
- **Mineração, pesca, coleta, tesouros enterrados**, lojas, 5 profissões, missões de NPC e diárias, conquistas, XP/níveis, inventário e economia.
- **Longa duração:** talentos (1 ponto por nível), contratos infinitos com recompensa que cresce com o nível, álbum de coleção, chefes em 6 mapas, sequência diária, títulos e **acessórios conquistáveis** (liberados por feitos, não comprados).
- **Natação** no Aero Paraíso e no mar da Ilha: braçadas com as patas ou gatilho; parado, o gato flutua até a superfície.
- **Música ambiente** gerada em tempo real com osciladores (um clima por mapa; pode ser desligada em Config).
- **Inimigos** (fantasmas, esqueletos, zumbis, orcs) em 6 mapas: perseguem, avisam o golpe e atacam; rodam no aparelho de cada jogador (não são sincronizados).
- **Fabricação** de ferramentas, itens de pata, consumíveis e chapéus a partir dos materiais coletados (menu rápido > Fabricar, ou Forja dos ferreiros).
- **Câmera** em 1ª, 2ª e 3ª pessoa (menu rápido ou tecla V).
- **Gravação de vídeo** (menu rápido ou tecla R): gera um `.webm` e baixa para a pasta Downloads; limite de 3 minutos.
- **Itens na pata** com bônus (dano, velocidade, mineração, bloqueio, XP) e **objetos colocáveis** sincronizados com a sala.
- **Social:** salas públicas e privadas por código, chat (teclado virtual e frases rápidas), amigos por código, grupos, emotes, carinho.
- **Eventos mundiais** e **ciclo dia/noite** determinísticos pelo relógio (iguais para todos).

## Desempenho ("Thermal Controller")

O navegador não dá acesso a sensores de temperatura, então o controlador usa só FPS/tempo de quadro (e heap JS quando existe) para subir ou descer a qualidade: escala de resolução, distância de desenho, detalhes (LOD), partículas, sombras e taxa de rede. Perfis: Performance, Balanced, Quality.

Otimizações: todo o cenário usa **um material com cores por vértice** (a paleta dos modelos Kenney é "assada" em `tools/bake-models.mjs`, sem texturas de modelo), geometria unida por chunk com carregamento/descarga por distância, instancing para minérios/baús/coletáveis/mãos, 1 draw call por gato (animação no vertex shader), sem pós-processamento. Tipicamente 20–45 draw calls.

Limitação honesta: não há texturas comprimidas (KTX2) porque o jogo praticamente não usa texturas — só canvases de UI e uma textura de partícula de 64 px.

## Desenvolvimento

```bash
npm install
npm run build        # gera dist/game.js
python3 -m http.server 8080
```

Para regerar `assets/models.bin`: baixe os kits da Kenney e rode `KENNEY_DIR=/pasta/dos/kits npm run bake`.

## Supabase

O esquema está em `supabase/schema.sql` (tabelas `rv_players`, `rv_friends`, `rv_rooms` com RLS e sem policies; acesso só por funções `rv_*`). Não há cadastro: cada aparelho gera um id temporário + segredo guardados no `localStorage`. A URL e a chave publicável ficam em `src/config.js`.
