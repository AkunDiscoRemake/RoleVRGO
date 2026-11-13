# Changelog

## 0.0.2 — Casas e roleplay

### Novo
- **Casas customizáveis** (Menu rápido > 🏠 Casa).
  - 8 estilos para morar: Cabana de Madeira (grátis), Casinha Colorida, Chalé na Neve, Casa de Praia, Bolha Aero, Torre Sombria, Apê Poolrooms e Mansão com dois cômodos.
  - **53 móveis** em 8 categorias: Sala, Quarto, Cozinha, Gatos, Banheiro, Festa e Natal, Escola e Jardim. Cada móvel é comprado uma vez; "Guardar" devolve ao estoque e recolocar é grátis.
  - Modo decorar: mire e aperte o gatilho para colocar. Dá para girar, mudar a cor, desfazer e guardar tudo. Os itens de parede (quadro, espelho, lousa, pisca-pisca) se viram sozinhos para fora da parede.
  - Cor de parede e de chão, e móveis salvos separadamente em cada casa.
  - Gatilho perto de um móvel: senta (sofá, cadeira, banco), deita (cama, berço, caminha) ou liga a festa (globo de laser). O trampolim pula de verdade.
- **Visitas:** botão 🏠 em Social (Jogadores e Amigos). A casa pode ser aberta, só para amigos ou trancada. Quando o dono decora, quem está visitando vê as mudanças na hora.
- **Idades para roleplay:** adulto, adolescente e filhote. Filhotes são menores, têm cabeça maior e enxergam o mundo mais de baixo.
- **10 roupas:** suéteres de Natal, moletom, camiseta, vestido, macacão, jaleco, uniforme escolar e pijama.
- **Olhos de laser** em 5 cores.
- **Avatares prontos** (no menu e no lobby): família, escola, doutor, fazendeiro e o easter egg **Trio da Ceia 🎄**, os três gatos natalinos de suéter, gorro e olhos de laser (homenagem a @frostyresenha). Na loja de móveis há a Mesa da Ceia 🦃 e o Globo de laser 🪩 para montar a cena.

- **Patas no mouse (PC)**, a pedido de um tester: a tecla **H** liga e desliga, e segurar o botão do meio do mouse ativa enquanto estiver apertado. O mouse move as patas e a câmera fica parada. Encoste no chão, segure o clique e arraste para se impulsionar, como no Gorilla Tag de PC. A rodinha muda o alcance.

### Correções
- Mudanças de visual feitas dentro do jogo (chapéu, acessório...) agora ficam guardadas ao reabrir o jogo.

### Servidor
- Nova função `rv_home_get` (`supabase/homes.sql`), já aplicada no projeto.

## 0.0.1-stable

Primeira versão estável. O jogo saiu da Beta.

### Novo
- **Mascotes:** 7 filhotes que seguem o jogador (loja, nível 15 ou chefe). Os outros jogadores veem o seu.
- **Modo foto** (tecla P ou menu rápido): tira a foto sem a interface e baixa em PNG; também funciona em VR.
- **Conforto em VR:** vinheta ao se mover, giro configurável (30°, 45° ou suave) e Recentralizar no modo celular.
- **Silenciar jogadores** na aba Social.
- Página **Novidades** e atalhos novos em Config (Como jogar, Salvar).
- Luz de contorno nos gatos, poeira ao pousar e ao andar.
- Conquista "Visite todos os 13 mapas".

### Correções
- O teclado virtual (Esc/✕) quebrava o menu; páginas inválidas agora voltam ao mapa.
- Abas Social e Criador de Mapas com estado inválido não quebram mais.
- Vazamento de geometria a cada troca de mapa.
- O jogador andava sozinho ao digitar no chat; as teclas são zeradas ao perder o foco.
- Salvamentos locais agrupados (antes salvava a cada ação), com salvamento extra ao fechar a aba.
- Dados de rede validados: posições, chat, efeitos e respawns com limites (protege contra valores quebrados ou maliciosos).
- O lobby, o grupo e a caixa de entrada reconectam sozinhos após uma queda.
- Inimigos não atravessam mais paredes.
- O som ambiente não é mais reprogramado a todo quadro; vetores de áudio são reutilizados.
- Marcadores de missão dos NPCs atualizam na hora.
