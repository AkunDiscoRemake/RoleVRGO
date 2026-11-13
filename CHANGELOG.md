# Changelog

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
