# RoleVRGO 🐱🥽 (0.0.4)

Mundo multiplayer VR de gatos feito para **Oculus Go** (WebXR, controle 3DoF) e **Meta Quest** (controles 6DoF e rastreamento de mãos): Gorilla Locomotion, luta PvP, mineração, pesca, missões, roleplay com idades (adulto, adolescente, filhote), casas customizáveis com 53 móveis e visitas, pega-pega Infecção Nuclear ☢️ (bots ou multiplayer), chat de voz e 17 mapas (incluindo Ilhas do Céu, Vulcão Ardente e Neon City). Também roda no navegador do computador (teclado + mouse).

**Jogar:** https://akundiscoremake.github.io/RoleVRGO/ · **Página de lançamento:** https://akundiscoremake.github.io/RoleVRGO/lancamento/ · **Novidades:** [CHANGELOG.md](CHANGELOG.md) · **Guia de testes:** [BETA.md](BETA.md)

Também funciona em **VR Box / Cardboard** (tela dividida + sensor do celular), com **rastreamento de mãos pela câmera (MediaPipe)** opcional e **Joy-Cons/gamepads** (sem usar o giroscópio do controle).

## Idiomas

Português, English, Español e Русский (seletor no lobby e no menu Mapa; detecta o idioma do navegador). Os textos ficam em `src/i18n-dict.json`; a compilação (`tools/build.mjs`) troca cada texto em português por `__t('texto')`. Para traduzir textos novos: `node tools/i18n-extract.mjs tools/i18n/pt.json`, acrescente linhas em `tools/i18n/tr*.txt` e rode `npm run i18n`.

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
| Touchpad centro (toque) | Menu completo |
| Touchpad centro (segurar) | Mira de teleporte; solte para teleportar |
| Touchpad cima / botão Back* | Menu rápido vertical (Avatar, Itens, Objetos, Emotes, Viajar) |
| Touchpad lados | Girar 30° (na zona de luta: esquiva) |
| Touchpad baixo (segurar) | Bloquear |

\* O navegador do Oculus Go normalmente reserva o botão Back para o sistema e não o entrega às páginas; por isso o topo do touchpad faz a mesma função. Se o navegador expuser o botão, ele abre o menu rápido.

**Meta Quest:** cada pata segue a posição real do controle (ou da mão rastreada, sem controles: pinça = gatilho). Analógico esquerdo anda, direito gira 30° (para frente = teleporte), A pula, B menu, X menu rápido, Y câmera, os dois grips bloqueiam.

Computador: WASD, mouse, clique = gatilho, Espaço pula, M menu, B menu rápido, V troca a câmera (1ª/2ª/3ª pessoa), R grava vídeo, Enter chat, 1–9 emotes, Q/E esquiva, F bloquear.

As mãos são duas bolinhas flutuantes (sem braços): uma segue a rotação do controle, a outra é espelhada proceduralmente. Não há hand tracking.

## Conteúdo

- **Mapas:** Vila, Floresta, Mina, Deserto, Montanhas Nevadas, Arena, Castelo, Cidade, Ilha, Campo de Treino, **Reino Sombrio** (dark fantasy: crepúsculo eterno, relâmpagos, cemitério, castelo em ruínas, vampiros, cavaleiros sombrios e o chefe Conde Miaulácula), **Poolrooms** (salas liminares de azulejo com água rasa, piscinas fundas e uma sala secreta alcançada nadando por baixo da parede) e **Aero Paraíso** (estética Frutiger Aero: lago fundo para nadar e mergulhar, bolhas brilhantes estouráveis, cúpulas e torres de vidro com acabamento brilhante, arco-íris, aurora, lens flare, ilhas flutuantes com cachoeiras, golfinhos, águas-vivas, cáusticas e raios de luz debaixo d'água, cardumes, pérolas; sons de água, cachoeira e áudio abafado ao mergulhar) — cada um com NPCs, baús, segredo, minérios e atividades próprias.
- **Luta:** socos por velocidade da pata, combos, bloqueio, esquiva, zonas de PvP, bonecos e um NPC de sparring (identificado como NPC).
- **Mineração, pesca, coleta, tesouros enterrados**, lojas, 5 profissões, missões de NPC e diárias, conquistas, XP/níveis, inventário e economia.
- **Criador de Mapas** (menu > Criar): monte mapas com todos os modelos do jogo, formas coloridas, entidades (minérios, baús, inimigos, chefes, NPCs com fala, placas, trampolins, luzes, zonas de luta...) e **assets próprios** (.glb até 20 mil vértices e imagens); salve, publique e jogue os mapas da comunidade. Mapas criados não dão XP/moedas/itens. Requer `supabase/maps.sql` aplicado para salvar/publicar; sem isso funciona como rascunho local.
- **Longa duração:** talentos (1 ponto por nível), contratos infinitos com recompensa que cresce com o nível, álbum de coleção, chefes em 6 mapas, sequência diária, títulos e **acessórios conquistáveis** (liberados por feitos, não comprados).
- **Natação** no Aero Paraíso e no mar da Ilha: braçadas com as patas ou gatilho; parado, o gato flutua até a superfície.
- **Música ambiente** gerada em tempo real com osciladores (um clima por mapa; pode ser desligada em Config).
- **Machado e lenha:** árvores cortáveis (com toco) em 7 mapas; o machado aparece sozinho na pata perto delas. A árvore cai, dá lenha e volta depois de ~70 s. Tem missão, diária, contrato e conquista.
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

## Admin

O nome **hark** é reservado. No lobby, ao digitar esse nome aparece o campo de senha; o servidor confere a senha (hash bcrypt em `rv_admin_cfg`) e registra o aparelho como admin, então não pede de novo. Painel na aba **👑 Admin** do menu: mensagens globais, spawnar itens (na bolsa ou chovendo para o mapa) e bichos/chefes, efeitos (gravidade baixa, velocidade, pulo, voo, cura, arco-íris, brilho, confete, congelar, disco) para si, para o mapa ou para todos, eventos (Festa, Invasão, Chuva de Ouro, Caça ao Tesouro, XP em dobro, Noite/Dia eterno) e ações em jogadores (ir até, puxar, dar moedas, curar, mandar para a Vila). As ações passam pela função `rv_admin_send`, que só aceita admins, e chegam aos jogadores pela tabela `rv_admin_events` (Supabase Realtime). Esquema em `supabase/admin.sql` (troque a senha antes de rodar).

## Supabase

O esquema está em `supabase/schema.sql` (tabelas `rv_players`, `rv_friends`, `rv_rooms` com RLS e sem policies; acesso só por funções `rv_*`). Não há cadastro: cada aparelho gera um id temporário + segredo guardados no `localStorage`. A URL e a chave publicável ficam em `src/config.js`.

## Créditos

- **Criação e direção:** hark
- **Programação:** Claude, a IA da [Anthropic](https://www.anthropic.com), via [Claude Code](https://claude.ai/code). Escreveu o código do jogo, o multiplayer, o banco de dados, as traduções e a página de lançamento, a partir das ideias do hark.
- **Modelos 3D e sons:** [Kenney.nl](https://kenney.nl) (CC0)
- **Tecnologia:** Three.js, WebXR, Supabase, MediaPipe, GitHub Pages
- **Easter egg do Trio da Ceia:** homenagem aos gatos natalinos de @frostyresenha
