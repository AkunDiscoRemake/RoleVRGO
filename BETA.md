# RoleVRGO — Beta para testers (v0.9.0-beta.1)

Jogar: https://akundiscoremake.github.io/RoleVRGO/

## Como entrar

| Aparelho | Botão no lobby | Como controla |
|---|---|---|
| Oculus Go | 🥽 Entrar em VR | Controle 3DoF (ver README) |
| Meta Quest 2/3/Pro | 🥽 Entrar em VR (no Quest Browser) | Controles 6DoF: cada pata segue um controle. Sem controles, as mãos rastreadas viram as patas |
| Celular + VR Box / Cardboard | 📱 VR Box / Cardboard | Cabeça = sensor de movimento do celular. Toque na tela (botão do Cardboard) = gatilho. Opcional: mãos pela câmera e/ou Joy-Cons/gamepad |
| Computador | 🖥 Jogar no navegador | Teclado + mouse, ou gamepad |

## VR Box / Cardboard

- Tela dividida (um olho de cada lado), sem correção de distorção das lentes.
- A cabeça segue o giroscópio/bússola **do celular**. Se o navegador negar o sensor, arraste o dedo na tela para olhar.
- **Mãos pela câmera (MediaPipe):** marque a caixa no lobby ou ligue em *Config → Mãos pela câmera*. A câmera traseira vê suas mãos; cada mão vira uma pata (6DoF). Juntar polegar e indicador (pinça) = gatilho. Com uma mão só visível, a outra pata é espelhada. Precisa de internet para baixar o MediaPipe na primeira vez.
- Sem mãos pela câmera, as patas seguem o olhar (3DoF).

## Joy-Cons e gamepads

Pareie por Bluetooth e aperte um botão. **O giroscópio do controle nunca é usado** — só botões e direcionais, então Joy-Cons não originais funcionam igual.

| Controle | Ação |
|---|---|
| Direcional esquerdo | Andar (na direção do olhar) |
| Direcional direito | Mover as patas (baixo = encostar no chão para empurrar) |
| ZR ou botão de baixo | Gatilho (agarrar, interagir, clicar) |
| ZL | Bloquear |
| L / R | Girar 30° (na zona de luta: esquiva) |
| Botão da direita | Pular |
| Botão de cima, ou clique dos direcionais (segurar) | Mira de teleporte |
| Botão da esquerda | Trocar câmera |
| + | Menu · − | Menu rápido |

Modos de mão com Joy-Con: **3DoF** = patas pelo olhar + direcional direito; **6DoF** = ligue "Mãos pela câmera" e use o Joy-Con só para botões. Com um Joy-Con sozinho (deitado) o mapeamento dos botões muda conforme o navegador.

## Teleporte

Segure o centro do touchpad (Oculus Go), a tecla T (PC) ou o botão de teleporte do gamepad: aparece um arco com uma bolinha no destino. Azul = válido, vermelho = inválido. Solte para teleportar. Não funciona na zona de luta nem para subir mais de ~2,8 m de uma vez.

## O que precisa de teste em aparelho real

Nada disto foi testado em hardware — só em navegador de computador, com gamepad e mãos simulados:

1. Meta Quest: patas seguindo os controles, empurrar o chão e escalar com os braços, analógicos, botões A/B/X/Y, teleporte, rastreamento de mãos (pinça).
2. Oculus Go: entrar em VR, locomoção, menu, teleporte, desempenho (FPS em Config).
2. VR Box: orientação da cabeça (direções certas? deriva?), separação dos olhos, toque como gatilho.
3. MediaPipe: as patas acompanham as mãos? A pinça dispara o gatilho? Quantos Hz aparecem em Config?
4. Joy-Cons: quais botões respondem, juntos e separados, originais e não originais.
5. Gravação de vídeo dentro do VR.

## Como relatar um problema

Diga: aparelho e navegador, o que tentou fazer, o que aconteceu, e os números de *Config* (FPS, nível de qualidade, status das mãos e do gamepad).
