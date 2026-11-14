// Conteúdo do jogo: itens, minérios, ferramentas, lojas, missões, conquistas, profissões, eventos.
export const RARITY = [
  { n: 'Comum', c: '#cfd3da' }, { n: 'Incomum', c: '#6fd26f' }, { n: 'Raro', c: '#4aa8ff' }, { n: 'Épico', c: '#c06bff' }, { n: 'Lendário', c: '#ffb52e' }
];
// k: tipo (ore, gem, forage, fish, treasure, food)
export const ITEMS = {
  stone: { n: 'Pedra', r: 0, v: 2, k: 'ore' }, coal: { n: 'Carvão', r: 0, v: 5, k: 'ore' }, copper: { n: 'Cobre', r: 0, v: 9, k: 'ore' },
  iron: { n: 'Ferro', r: 1, v: 16, k: 'ore' }, silver: { n: 'Prata', r: 1, v: 28, k: 'ore' }, gold: { n: 'Ouro', r: 2, v: 55, k: 'ore' },
  quartz: { n: 'Cristal Azul', r: 2, v: 75, k: 'gem' }, amethyst: { n: 'Ametista', r: 2, v: 110, k: 'gem' }, emerald: { n: 'Esmeralda', r: 3, v: 190, k: 'gem' },
  ruby: { n: 'Rubi', r: 3, v: 270, k: 'gem' }, diamond: { n: 'Diamante', r: 4, v: 520, k: 'gem' }, ice: { n: 'Cristal de Gelo', r: 2, v: 85, k: 'gem' },
  sunstone: { n: 'Pedra do Sol', r: 3, v: 210, k: 'gem' }, star: { n: 'Fragmento Estelar', r: 4, v: 600, k: 'gem' },
  mushroom: { n: 'Cogumelo', r: 0, v: 6, k: 'forage' }, flower: { n: 'Flor Silvestre', r: 0, v: 5, k: 'forage' }, shell: { n: 'Concha', r: 0, v: 8, k: 'forage' },
  pumpkin: { n: 'Abóbora', r: 0, v: 9, k: 'forage' }, cactusfruit: { n: 'Fruto de Cacto', r: 1, v: 14, k: 'forage' }, snowbell: { n: 'Flor-de-Neve', r: 1, v: 18, k: 'forage' },
  package: { n: 'Encomenda', r: 0, v: 0, k: 'quest' }, wood: { n: 'Lenha', r: 0, v: 4, k: 'forage' },
  sardine: { n: 'Sardinha', r: 0, v: 8, k: 'fish' }, tilapia: { n: 'Tilápia', r: 0, v: 14, k: 'fish' }, bass: { n: 'Robalo', r: 1, v: 30, k: 'fish' },
  dourado: { n: 'Dourado', r: 2, v: 80, k: 'fish' }, koi: { n: 'Carpa Koi', r: 3, v: 200, k: 'fish' }, moonfish: { n: 'Peixe-Lua', r: 4, v: 550, k: 'fish' },
  oldcoin: { n: 'Moeda Antiga', r: 1, v: 40, k: 'treasure' }, relic: { n: 'Relíquia Felina', r: 3, v: 260, k: 'treasure' }, idol: { n: 'Ídolo de Ouro', r: 4, v: 700, k: 'treasure' },
  pearl: { n: 'Pérola', r: 1, v: 35, k: 'treasure' }, coral: { n: 'Coral Brilhante', r: 2, v: 90, k: 'treasure' },
  snack: { n: 'Petisco', r: 0, v: 5, k: 'food', heal: 45 }, catnip: { n: 'Erva-de-gato', r: 1, v: 20, k: 'food', boost: 180 }
};
// nós de mineração: hp, tier mínimo da picareta, cor, xp
export const ORES = {
  stone: { hp: 3, tier: 0, c: '#8d9199', xp: 3 }, coal: { hp: 4, tier: 0, c: '#3a3a40', xp: 5 }, copper: { hp: 5, tier: 0, c: '#c9743a', xp: 7 },
  iron: { hp: 7, tier: 1, c: '#b9a89a', xp: 11 }, silver: { hp: 9, tier: 1, c: '#dfe6ee', xp: 16 }, gold: { hp: 11, tier: 2, c: '#f2c230', xp: 24 },
  quartz: { hp: 8, tier: 1, c: '#58b8ff', xp: 22, gem: 1 }, amethyst: { hp: 10, tier: 2, c: '#a45cf0', xp: 30, gem: 1 }, emerald: { hp: 13, tier: 2, c: '#2fd070', xp: 45, gem: 1 },
  ruby: { hp: 15, tier: 3, c: '#f03a55', xp: 60, gem: 1 }, diamond: { hp: 20, tier: 3, c: '#c8fbff', xp: 110, gem: 1 }, ice: { hp: 8, tier: 1, c: '#a8e8ff', xp: 22, gem: 1 },
  sunstone: { hp: 12, tier: 2, c: '#ff9a2e', xp: 45, gem: 1 }, star: { hp: 10, tier: 0, c: '#fff27a', xp: 90, gem: 1 }
};
export const PICKS = [{ n: 'Picareta de Madeira', p: 1, price: 0 }, { n: 'Picareta de Ferro', p: 1.7, price: 150 }, { n: 'Picareta de Ouro', p: 2.6, price: 700 }, { n: 'Picareta de Diamante', p: 3.8, price: 2500 }];
export const GLOVES = [{ n: 'Patas Nuas', p: 1, price: 0 }, { n: 'Luvas de Treino', p: 1.15, price: 120 }, { n: 'Luvas de Aço', p: 1.3, price: 600 }, { n: 'Luvas do Campeão', p: 1.5, price: 2200 }];
export const RODS = [{ n: 'Vara de Graveto', p: 0, price: 0 }, { n: 'Vara de Bambu', p: 0.12, price: 200 }, { n: 'Vara Dourada', p: 0.3, price: 1200 }];
export const HAT_PRICES = [0, 180, 2500, 90, 60, 220, 150, 240, 900, 5000];
export const FISH_TABLE = [['sardine', 40], ['tilapia', 30], ['bass', 17], ['dourado', 9], ['koi', 3.4], ['moonfish', 0.6]];
export const TREASURE_TABLE = [['oldcoin', 55], ['shell', 20], ['relic', 12], ['gold', 10], ['idol', 3]];

export const PROFS = {
  miner: { n: 'Minerador', d: '+25% de minérios e mineração mais rápida', icon: '⛏' },
  fighter: { n: 'Lutador', d: '+15% de dano e +20 de vida na arena', icon: '🥊' },
  fisher: { n: 'Pescador', d: 'Peixes mordem mais rápido e raros aparecem mais', icon: '🎣' },
  explorer: { n: 'Explorador', d: '+50% de moedas em baús e XP de segredos em dobro', icon: '🧭' },
  merchant: { n: 'Mercador', d: 'Vende 20% mais caro e compra 10% mais barato', icon: '💰' }
};

// Lojas: kind item/pick/glove/rod/hat
export const SHOPS = {
  general: [{ k: 'item', id: 'snack', price: 15 }, { k: 'item', id: 'catnip', price: 60 }, { k: 'hat', id: 4 }, { k: 'hat', id: 3 }],
  smith: [{ k: 'pick', id: 1 }, { k: 'pick', id: 2 }, { k: 'pick', id: 3 }, { k: 'hat', id: 5 }],
  dojo: [{ k: 'glove', id: 1 }, { k: 'glove', id: 2 }, { k: 'glove', id: 3 }, { k: 'item', id: 'snack', price: 15 }],
  fisher: [{ k: 'rod', id: 1 }, { k: 'rod', id: 2 }, { k: 'hat', id: 7 }],
  fashion: [{ k: 'hat', id: 1 }, { k: 'hat', id: 3 }, { k: 'hat', id: 6 }, { k: 'hat', id: 8 }, { k: 'hat', id: 2 }, { k: 'hat', id: 9 }],
  winter: [{ k: 'hat', id: 6 }, { k: 'item', id: 'snack', price: 15 }, { k: 'pick', id: 1 }]
};

// Missões de NPC. goal: {t: tipo de evento, k: chave opcional, n: quantidade}; deliver consome itens.
export const QUESTS = {
  v1: { npc: 'mimi', title: 'Bem-vindo à Vila', desc: 'Empurre o chão com as patas e dê 5 impulsos.', goal: { t: 'fling', n: 5 }, xp: 40, coins: 25 },
  v2: { npc: 'mimi', title: 'Conhecendo o mundo', desc: 'Visite 3 mapas diferentes pelos portais.', goal: { t: 'visit', n: 3 }, xp: 80, coins: 60, after: 'v1' },
  v3: { npc: 'bigode', title: 'Peixe fresco', desc: 'Entregue 3 peixes de qualquer tipo... digo, 3 sardinhas.', goal: { t: 'deliver', k: 'sardine', n: 3 }, xp: 70, coins: 50 },
  v4: { npc: 'ferreiro', title: 'Ferro para a forja', desc: 'Traga 5 minérios de cobre da Mina.', goal: { t: 'deliver', k: 'copper', n: 5 }, xp: 90, coins: 80 },
  f1: { npc: 'salvia', title: 'Sopa de cogumelo', desc: 'Colha 6 cogumelos na Floresta.', goal: { t: 'deliver', k: 'mushroom', n: 6 }, xp: 70, coins: 45 },
  f2: { npc: 'salvia', title: 'A casa na árvore', desc: 'Encontre o segredo no alto da grande árvore.', goal: { t: 'secret', k: 'forest', n: 1 }, xp: 120, coins: 90, after: 'f1' },
  m1: { npc: 'pedrita', title: 'Primeira picaretada', desc: 'Minere 10 nós de qualquer minério.', goal: { t: 'mine', n: 10 }, xp: 90, coins: 60 },
  m2: { npc: 'pedrita', title: 'Brilho no escuro', desc: 'Entregue 3 Cristais Azuis.', goal: { t: 'deliver', k: 'quartz', n: 3 }, xp: 160, coins: 200, after: 'm1' },
  m3: { npc: 'tunel', title: 'Carvão para as lanternas', desc: 'Entregue 8 de carvão.', goal: { t: 'deliver', k: 'coal', n: 8 }, xp: 80, coins: 70 },
  d1: { npc: 'safira', title: 'O X marca o lugar', desc: 'Desenterre 3 tesouros no Deserto.', goal: { t: 'dig', n: 3 }, xp: 110, coins: 90 },
  d2: { npc: 'safira', title: 'O topo da pirâmide', desc: 'Escale a pirâmide e ache o segredo.', goal: { t: 'secret', k: 'desert', n: 1 }, xp: 150, coins: 140, after: 'd1' },
  s1: { npc: 'floco', title: 'Flores do frio', desc: 'Colha 5 Flores-de-Neve.', goal: { t: 'deliver', k: 'snowbell', n: 5 }, xp: 100, coins: 80 },
  s2: { npc: 'floco', title: 'O cume', desc: 'Escale até a bandeira no topo da montanha.', goal: { t: 'secret', k: 'snow', n: 1 }, xp: 220, coins: 180, after: 's1' },
  a1: { npc: 'garra', title: 'Aquecimento', desc: 'Acerte 20 golpes (boneco, mestre ou jogadores).', goal: { t: 'hit', n: 20 }, xp: 90, coins: 60 },
  a2: { npc: 'garra', title: 'Sequência perfeita', desc: 'Faça um combo de 5 golpes.', goal: { t: 'combo', n: 1 }, xp: 120, coins: 100, after: 'a1' },
  a3: { npc: 'garra', title: 'Nocaute!', desc: 'Vença 1 luta (jogador ou o Mestre).', goal: { t: 'ko', n: 1 }, xp: 200, coins: 180, after: 'a2' },
  c1: { npc: 'rei', title: 'O tesouro real', desc: 'Abra 3 baús em qualquer mapa.', goal: { t: 'chest', n: 3 }, xp: 100, coins: 120 },
  c2: { npc: 'rei', title: 'Guardião das muralhas', desc: 'Suba na torre mais alta do Castelo.', goal: { t: 'secret', k: 'castle', n: 1 }, xp: 160, coins: 160, after: 'c1' },
  c3: { npc: 'cozinheira', title: 'Banquete real', desc: 'Entregue 2 Robalos para o banquete.', goal: { t: 'deliver', k: 'bass', n: 2 }, xp: 130, coins: 130 },
  y1: { npc: 'carteiro', title: 'Entrega expressa', desc: 'Pegue 4 encomendas pela Cidade e entregue aqui.', goal: { t: 'deliver', k: 'package', n: 4 }, xp: 110, coins: 130 },
  y2: { npc: 'carteiro', title: 'Vista do alto', desc: 'Chegue ao topo de um arranha-céu.', goal: { t: 'secret', k: 'city', n: 1 }, xp: 200, coins: 200, after: 'y1' },
  i1: { npc: 'capitao', title: 'Conchas da sorte', desc: 'Junte 6 conchas na praia.', goal: { t: 'deliver', k: 'shell', n: 6 }, xp: 80, coins: 70 },
  i2: { npc: 'capitao', title: 'Pescaria', desc: 'Pesque 5 peixes.', goal: { t: 'fish', n: 5 }, xp: 120, coins: 110, after: 'i1' },
  i3: { npc: 'capitao', title: 'O navio naufragado', desc: 'Ache o segredo no mastro do naufrágio.', goal: { t: 'secret', k: 'island', n: 1 }, xp: 180, coins: 220, after: 'i2' },
  t1: { npc: 'sensei', title: 'Pista de obstáculos', desc: 'Complete a pista de escalada do Campo de Treino.', goal: { t: 'secret', k: 'training', n: 1 }, xp: 120, coins: 90 },
  f4: { npc: 'salvia', title: 'Lenha para o inverno', desc: 'Corte 6 árvores com o machado (as de tronco marcado).', goal: { t: 'chop', n: 6 }, xp: 110, coins: 90, after: 'f1' },
  f3: { npc: 'salvia', title: 'Floresta assombrada', desc: 'Derrote 5 inimigos na Floresta.', goal: { t: 'kill', n: 5 }, xp: 150, coins: 120, after: 'f1' },
  m4: { npc: 'tunel', title: 'Orcs nos túneis', desc: 'Derrote 4 Orcs.', goal: { t: 'kill', k: 'orc', n: 4 }, xp: 200, coins: 180, after: 'm3' },
  d3: { npc: 'safira', title: 'Ossos do deserto', desc: 'Derrote 6 Esqueletos.', goal: { t: 'kill', k: 'skeleton', n: 6 }, xp: 180, coins: 150 },
  v5: { npc: 'ferreiro', title: 'Mãos à obra', desc: 'Fabrique 2 itens (menu rápido > Fabricar).', goal: { t: 'craft', n: 2 }, xp: 100, coins: 80, after: 'v4' },
  z1: { npc: 'aqua', title: 'Mergulho inaugural', desc: 'Nade 150 metros no lago do Aero Paraíso.', goal: { t: 'swim', n: 150 }, xp: 120, coins: 100 },
  z2: { npc: 'aqua', title: 'Pérolas do fundo', desc: 'Entregue 8 Pérolas colhidas no fundo do lago.', goal: { t: 'deliver', k: 'pearl', n: 8 }, xp: 200, coins: 220, after: 'z1' },
  z3: { npc: 'aqua', title: 'A cúpula submersa', desc: 'Ache o segredo no fundo do lago.', goal: { t: 'secret', k: 'aero', n: 1 }, xp: 240, coins: 260, after: 'z2' },
  z4: { npc: 'vista', title: 'Estoura-bolhas', desc: 'Estoure 25 bolhas flutuantes com as patas.', goal: { t: 'pop', n: 25 }, xp: 110, coins: 90 },
  k1: { npc: 'corvina', title: 'Cavaleiros sem alma', desc: 'Derrote 3 Cavaleiros Sombrios no castelo em ruínas.', goal: { t: 'kill', k: 'darkknight', n: 3 }, xp: 180, coins: 160 },
  k2: { npc: 'corvina', title: 'A torre mais alta', desc: 'Suba a escada em espiral e ache o segredo no topo da torre.', goal: { t: 'secret', k: 'dark', n: 1 }, xp: 220, coins: 200, after: 'k1' },
  k3: { npc: 'corvina', title: 'Cristais da escuridão', desc: 'Entregue 4 Ametistas.', goal: { t: 'deliver', k: 'amethyst', n: 4 }, xp: 200, coins: 240 },
  p1: { npc: 'eco', title: 'A sala sem porta', desc: 'Encontre a sala secreta: só se entra nadando por baixo da parede.', goal: { t: 'secret', k: 'pool', n: 1 }, xp: 220, coins: 200 },
  p2: { npc: 'eco', title: 'Pérolas esquecidas', desc: 'Entregue 6 Pérolas das piscinas.', goal: { t: 'deliver', k: 'pearl', n: 6 }, xp: 160, coins: 180 },
  p3: { npc: 'eco', title: 'Nadando sem fim', desc: 'Nade 250 metros.', goal: { t: 'swim', n: 250 }, xp: 140, coins: 120, after: 'p2' },
  t2: { npc: 'sensei', title: 'Defesa primeiro', desc: 'Bloqueie 5 golpes do Mestre.', goal: { t: 'blocked', n: 5 }, xp: 120, coins: 90, after: 't1' }
};
// Missões diárias (3 por dia, sorteadas pela data UTC)
export const DAILY = [
  { title: 'Minere 15 nós', goal: { t: 'mine', n: 15 }, xp: 120, coins: 90 }, { title: 'Pesque 4 peixes', goal: { t: 'fish', n: 4 }, xp: 110, coins: 90 },
  { title: 'Abra 3 baús', goal: { t: 'chest', n: 3 }, xp: 100, coins: 100 }, { title: 'Acerte 30 golpes', goal: { t: 'hit', n: 30 }, xp: 110, coins: 80 },
  { title: 'Colete 10 itens da natureza', goal: { t: 'forage', n: 10 }, xp: 90, coins: 70 }, { title: 'Dê 25 impulsos com as patas', goal: { t: 'fling', n: 25 }, xp: 80, coins: 60 },
  { title: 'Visite 4 mapas', goal: { t: 'visit', n: 4 }, xp: 100, coins: 80 }, { title: 'Venda itens por 150 moedas', goal: { t: 'sold', n: 150 }, xp: 90, coins: 60 },
  { title: 'Use 5 emotes', goal: { t: 'emote', n: 5 }, xp: 60, coins: 50 }, { title: 'Desenterre 2 tesouros', goal: { t: 'dig', n: 2 }, xp: 110, coins: 90 },
  { title: 'Vença 1 luta', goal: { t: 'ko', n: 1 }, xp: 150, coins: 120 }, { title: 'Converse com 4 NPCs', goal: { t: 'talk', n: 4 }, xp: 70, coins: 50 },
  { title: 'Derrote 8 inimigos', goal: { t: 'kill', n: 8 }, xp: 140, coins: 110 }, { title: 'Corte 8 árvores', goal: { t: 'chop', n: 8 }, xp: 100, coins: 80 }, { title: 'Fabrique 1 item', goal: { t: 'craft', n: 1 }, xp: 80, coins: 60 }
];
// Conquistas: s = estatística, n = alvo
export const ACHIEVEMENTS = [
  { id: 'fl1', n: 'Primeiro Pulo', d: 'Dê 1 impulso com as patas', s: 'fling', v: 1, c: 10 }, { id: 'fl2', n: 'Gato Gorila', d: '200 impulsos', s: 'fling', v: 200, c: 150 },
  { id: 'mi1', n: 'Mineiro Aprendiz', d: 'Minere 10 nós', s: 'mine', v: 10, c: 30 }, { id: 'mi2', n: 'Mineiro Mestre', d: 'Minere 250 nós', s: 'mine', v: 250, c: 400 },
  { id: 'ge1', n: 'Olho de Lince', d: 'Ache uma gema épica ou melhor', s: 'epic', v: 1, c: 120 }, { id: 'hi1', n: 'Patada!', d: 'Acerte 50 golpes', s: 'hit', v: 50, c: 50 },
  { id: 'ko1', n: 'Nocauteador', d: 'Vença 1 luta', s: 'ko', v: 1, c: 60 }, { id: 'ko2', n: 'Campeão da Arena', d: 'Vença 25 lutas', s: 'ko', v: 25, c: 600 },
  { id: 'cb1', n: 'Combo x5', d: 'Faça um combo de 5', s: 'combo', v: 1, c: 60 }, { id: 'bl1', n: 'Muralha', d: 'Bloqueie 20 golpes', s: 'blocked', v: 20, c: 80 },
  { id: 'ch1', n: 'Caça-Baús', d: 'Abra 10 baús', s: 'chest', v: 10, c: 80 }, { id: 'ch2', n: 'Tesoureiro', d: 'Abra 75 baús', s: 'chest', v: 75, c: 500 },
  { id: 'se1', n: 'Curioso', d: 'Descubra 1 segredo', s: 'secret', v: 1, c: 40 }, { id: 'se2', n: 'Sabe-Tudo', d: 'Descubra 9 segredos', s: 'secret', v: 9, c: 800 },
  { id: 'vi1', n: 'Viajante', d: 'Visite todos os 18 mapas', s: 'maps', v: 18, c: 300 }, { id: 'tr1', n: 'Piloto', d: 'Complete uma corrida no Autódromo das Patas', s: 'trackRace', v: 1, c: 200 }, { id: 'sk1', n: 'Rei das Nuvens', d: 'Complete a Corrida nas Nuvens nas Ilhas do Céu', s: 'skyRace', v: 1, c: 200 }, { id: 'lv1', n: 'Pé Quente', d: 'Encoste na lava 5 vezes no Vulcão Ardente', s: 'lavaBurn', v: 5, c: 80 }, { id: 'zz1', n: 'Azarado e ao mesmo tempo sortudo', d: 'Levou um raio na cabeça e ficou torrado (0,001% por milissegundo)', s: 'lightning', v: 1, c: 1000, secret: 1 }, { id: 'nk1', n: 'Paciente Zero', d: 'Infecte 25 gatos na Infecção Nuclear', s: 'infTags', v: 25, c: 200 }, { id: 'nk2', n: 'Imune', d: 'Sobreviva a 5 rodadas da Infecção Nuclear', s: 'infSurvive', v: 5, c: 250 }, { id: 'fi1', n: 'Pescador', d: 'Pesque 10 peixes', s: 'fish', v: 10, c: 60 },
  { id: 'fi2', n: 'Lenda do Mar', d: 'Pesque um Peixe-Lua', s: 'moonfish', v: 1, c: 700 }, { id: 'di1', n: 'Arqueólogo', d: 'Desenterre 10 tesouros', s: 'dig', v: 10, c: 150 },
  { id: 'lv1', n: 'Nível 5', d: 'Chegue ao nível 5', s: 'level', v: 5, c: 100 }, { id: 'lv2', n: 'Nível 15', d: 'Chegue ao nível 15', s: 'level', v: 15, c: 500 },
  { id: 'co1', n: 'Pé-de-meia', d: 'Ganhe 1000 moedas no total', s: 'earned', v: 1000, c: 100 }, { id: 'so1', n: 'Sociável', d: 'Faça carinho em outro jogador', s: 'pat', v: 1, c: 40 },
  { id: 'em1', n: 'Expressivo', d: 'Use 20 emotes', s: 'emote', v: 20, c: 50 }, { id: 'qu1', n: 'Prestativo', d: 'Complete 10 missões', s: 'quests', v: 10, c: 300 },
  { id: 'ev1', n: 'Na hora certa', d: 'Participe de 1 evento mundial', s: 'event', v: 1, c: 100 }, { id: 'ki1', n: 'Caçador', d: 'Derrote 10 inimigos', s: 'kill', v: 10, c: 80 }, { id: 'ki2', n: 'Exterminador', d: 'Derrote 150 inimigos', s: 'kill', v: 150, c: 700 },
  { id: 'lu1', n: 'Lenhador', d: 'Corte 30 árvores', s: 'chop', v: 30, c: 150 }, { id: 'cr1', n: 'Artesão', d: 'Fabrique 5 itens', s: 'craft', v: 5, c: 120 }, { id: 'sw1', n: 'Peixinho', d: 'Nade 500 metros', s: 'swim', v: 500, c: 150 }, { id: 'po1', n: 'Estoura-Bolhas', d: 'Estoure 100 bolhas', s: 'pop', v: 100, c: 150 },
  { id: 'bo1', n: 'Mata-Chefe', d: 'Derrote 1 chefe', s: 'boss', v: 1, c: 200 }, { id: 'ct1', n: 'Contratado', d: 'Conclua 10 contratos', s: 'contracts', v: 10, c: 400 }, { id: 'al1', n: 'Colecionador', d: 'Complete 2 coleções do álbum', s: 'collections', v: 2, c: 500 },
  { id: 'fr1', n: 'Amigos', d: 'Adicione 1 amigo', s: 'friends', v: 1, c: 50 }
];
// Eventos mundiais: determinísticos pelo relógio (bloco de 10 min: 4 min ativo) — iguais para todos, sem servidor.
export const EVENTS = [
  { id: 'crystal', n: 'Chuva de Cristais', d: 'Fragmentos Estelares caíram em', maps: ['village', 'forest', 'desert', 'snow', 'island', 'castle'] },
  { id: 'goldchest', n: 'Baú Dourado', d: 'Um baú dourado apareceu em', maps: ['village', 'forest', 'mine', 'desert', 'snow', 'castle', 'city', 'island'] },
  { id: 'doublexp', n: 'Hora do Treino', d: 'XP em dobro em', maps: ['arena', 'training'] },
  { id: 'shoal', n: 'Cardume', d: 'Peixes raros mordendo em', maps: ['island', 'village'] }
];
export function currentEvent(nowMs) {
  const block = Math.floor(nowMs / 600000), into = (nowMs % 600000) / 1000;
  const ev = EVENTS[block % EVENTS.length], map = ev.maps[Math.floor(block / EVENTS.length) % ev.maps.length];
  return { ev, map, block, active: into < 240, left: into < 240 ? 240 - into : 600 - into };
}
export const QUICK_CHAT = ['Oi!', 'Miau!', 'Vamos lutar?', 'Me segue!', 'Boa!', 'Obrigado!', 'Onde você está?', 'Tchau!', 'Haha', 'Preciso de ajuda', 'Vamos minerar?', 'GG!'];

// Itens de pata (menu rápido > Itens): aparecem na mão e dão bônus reais enquanto equipados.
export const HELD = [
  { id: 'none', n: 'Patas livres', d: 'Nada na pata', price: 0 },
  { id: 'axe', n: 'Machado', d: 'Corta árvores para pegar lenha', model: 'survival/tool-axe', s: 2.6, price: 0 },
  { id: 'pick', n: 'Picareta', d: 'Mineração +30%', model: 'survival/tool-pickaxe', s: 2.6, price: 0, mine: 1.3 },
  { id: 'sword', n: 'Espada de Treino', d: 'Dano +25%', model: 'dungeon/weapon-sword', s: 1.1, price: 300, dmg: 1.25 },
  { id: 'spear', n: 'Lança', d: 'Dano +15%, velocidade +10%', model: 'arena/weapon-spear', s: 1.3, price: 450, dmg: 1.15, speed: 1.1 },
  { id: 'shield', n: 'Escudo', d: 'Bloqueio absorve 92%', model: 'dungeon/shield-round', s: 1.4, price: 350, block: 0.08 },
  { id: 'fish', n: 'Peixe da Sorte', d: 'Velocidade +20%', model: 'survival/fish', s: 2.6, price: 200, speed: 1.2 },
  { id: 'potion', n: 'Poção Veloz', d: 'Velocidade +35%, dano -10%', model: 'dungeon/potion', s: 0.8, price: 500, speed: 1.35, dmg: 0.9 },
  { id: 'heart', n: 'Coração', d: 'Vida regenera 2x', model: 'plat/heart', s: 0.7, price: 400, regen: 2 },
  { id: 'star', n: 'Estrela da Sorte', d: 'XP +15%', model: 'plat/star', s: 0.8, price: 800, xp: 1.15 }
];
// Objetos que o jogador pode colocar no mundo (sincronizados com a sala).
export const PROPS = [
  { id: 'crate', n: '📦 Caixa', model: 'plat/crate', s: 1.6 }, { id: 'barrel', n: '🛢 Barril', model: 'plat/barrel', s: 1.7 },
  { id: 'bench', n: '🪑 Banco', model: 'grave/bench', s: 2 }, { id: 'spring', n: '🌀 Trampolim', model: 'plat/spring', s: 2.2, spring: 13, nocol: 1 },
  { id: 'flag', n: '🚩 Bandeira', model: 'plat/flag', s: 2.6, nocol: 1 }, { id: 'snowman', n: '⛄ Boneco de neve', model: 'holiday/snowman-hat', s: 1.8 },
  { id: 'fire', n: '🔥 Fogueira', model: 'nature/campfire_stones', s: 3, nocol: 1, fire: 1 }
];

// Fabricação (menu rápido > Fabricar, ou ferreiros): consome materiais e entrega o resultado.
// out: {item, n} | {equip:'pick'|'glove'|'rod', tier} | {held:id} | {hat:id}
export const RECIPES = [
  { n: 'Petiscos de peixe (x2)', need: { sardine: 2 }, out: { item: 'snack', n: 2 } },
  { n: 'Erva-de-gato', need: { mushroom: 3, flower: 2 }, out: { item: 'catnip', n: 1 } },
  { n: 'Picareta de Ferro', need: { iron: 6, wood: 4 }, out: { equip: 'pick', tier: 1 } },
  { n: 'Picareta de Ouro', need: { gold: 8, iron: 4 }, out: { equip: 'pick', tier: 2 } },
  { n: 'Picareta de Diamante', need: { diamond: 2, gold: 6 }, out: { equip: 'pick', tier: 3 } },
  { n: 'Luvas de Treino', need: { copper: 5, wood: 3 }, out: { equip: 'glove', tier: 1 } },
  { n: 'Luvas de Aço', need: { iron: 10, silver: 4 }, out: { equip: 'glove', tier: 2 } },
  { n: 'Vara de Bambu', need: { wood: 6, copper: 2 }, out: { equip: 'rod', tier: 1 } },
  { n: 'Espada de Treino', need: { iron: 8, wood: 3 }, out: { held: 'sword' } },
  { n: 'Lança', need: { iron: 5, wood: 5 }, out: { held: 'spear' } },
  { n: 'Escudo', need: { iron: 6, wood: 4 }, out: { held: 'shield' } },
  { n: 'Poção Veloz', need: { cactusfruit: 4, quartz: 2 }, out: { held: 'potion' } },
  { n: 'Coração', need: { ruby: 1, flower: 4 }, out: { held: 'heart' } },
  { n: 'Estrela da Sorte', need: { star: 2 }, out: { held: 'star' } },
  { n: 'Coroa (chapéu)', need: { gold: 10, amethyst: 2 }, out: { hat: 2 } },
  { n: 'Capacete de minerador', need: { iron: 4, coal: 6 }, out: { hat: 5 } }
];
// Inimigos (PvE). Rodam no aparelho de cada jogador — não são sincronizados entre jogadores.
export const ENEMIES = {
  ghost: { n: 'Fantasma', model: 'grave/character-ghost', s: 1.7, hp: 40, dmg: 8, sp: 2.3, xp: 18, coins: [4, 10], drop: ['quartz', 0.08], fly: 1 },
  skeleton: { n: 'Esqueleto', model: 'grave/character-skeleton', s: 1.75, hp: 55, dmg: 10, sp: 2.7, xp: 24, coins: [6, 14], drop: ['oldcoin', 0.18] },
  zombie: { n: 'Zumbi', model: 'grave/character-zombie', s: 1.7, hp: 75, dmg: 12, sp: 1.7, xp: 26, coins: [6, 14], drop: ['snack', 0.25] },
  orc: { n: 'Orc', model: 'dungeon/character-orc', s: 1.95, hp: 100, dmg: 15, sp: 2.4, xp: 40, coins: [10, 22], drop: ['iron', 0.35] },
  vampire: { n: 'Vampiro', model: 'grave/character-vampire', s: 1.8, hp: 80, dmg: 13, sp: 2.9, xp: 34, coins: [8, 18], drop: ['ruby', 0.12] },
  darkknight: { n: 'Cavaleiro Sombrio', model: 'arena/character-soldier', s: 2.0, hp: 95, dmg: 14, sp: 2.5, xp: 38, coins: [9, 20], drop: ['amethyst', 0.2], tint: [0.42, 0.36, 0.55] }
};
export const BOSS_NAMES = { ghost: 'Espectro Ancião', skeleton: 'Rei Esqueleto', zombie: 'Zumbi Gigante', orc: 'Chefe Orc', vampire: 'Conde Miaulácula', darkknight: 'Lorde Sombrio' };
export const BOSS_DROPS = ['emerald', 'ruby', 'relic', 'amethyst'];

// Acessórios CONQUISTÁVEIS (não se compram): liberam quando a condição é cumprida. s = estatística, v = valor.
export const ACCS = [
  { n: 'Nenhum', how: '' }, { n: 'Óculos escuros', how: 'Chegue ao nível 3', s: 'level', v: 3 }, { n: 'Cachecol', how: 'Abra 10 baús', s: 'chest', v: 10 },
  { n: 'Gravata borboleta', how: 'Complete 5 missões', s: 'quests', v: 5 }, { n: 'Mochila', how: 'Visite 6 mapas', s: 'maps', v: 6 }, { n: 'Capa de herói', how: 'Derrote 25 inimigos', s: 'kill', v: 25 },
  { n: 'Medalha', how: 'Vença 5 lutas', s: 'ko', v: 5 }, { n: 'Asas de bolha', how: 'Estoure 60 bolhas no Aero Paraíso', s: 'pop', v: 60 }, { n: 'Snorkel', how: 'Nade 300 metros', s: 'swim', v: 300 },
  { n: 'Aura dourada', how: 'Chegue ao nível 20', s: 'level', v: 20 }, { n: 'Colar de pérolas', how: 'Colete 15 pérolas', s: 'pearl', v: 15 }, { n: 'Chifres de chefe', how: 'Derrote 3 chefes', s: 'boss', v: 3 }
];
// Talentos: 1 ponto por nível.
export const PERKS = [
  { id: 'hp', n: '❤ Vitalidade', d: '+10 de vida por ponto', max: 6 }, { id: 'dmg', n: '🥊 Força', d: '+6% de dano por ponto', max: 6 }, { id: 'speed', n: '💨 Agilidade', d: '+4% de velocidade por ponto', max: 5 },
  { id: 'jump', n: '🦘 Impulso', d: '+6% de força nos saltos por ponto', max: 5 }, { id: 'mine', n: '⛏ Garimpo', d: '+12% de mineração por ponto', max: 5 }, { id: 'luck', n: '🍀 Sorte', d: '+10% de moedas em baús e peixes raros', max: 5 },
  { id: 'regen', n: '✨ Recuperação', d: '+30% de regeneração por ponto', max: 3 }, { id: 'xp', n: '📘 Sabedoria', d: '+5% de XP por ponto', max: 5 }
];
export const TITLES = [[1, 'Filhote'], [4, 'Curioso'], [8, 'Explorador'], [12, 'Aventureiro'], [16, 'Veterano'], [20, 'Herói'], [26, 'Campeão'], [32, 'Lenda'], [40, 'Mito']];
export function titleFor(level) { let t = TITLES[0][1]; for (const x of TITLES) if (level >= x[0]) t = x[1]; return t; }
// Contratos infinitos: gerados conforme o nível.
export const CONTRACT_TYPES = [
  { t: 'mine', title: 'Minere %n nós', base: 10 }, { t: 'kill', title: 'Derrote %n inimigos', base: 6 }, { t: 'fish', title: 'Pesque %n peixes', base: 4 }, { t: 'chest', title: 'Abra %n baús', base: 3 },
  { t: 'forage', title: 'Colete %n itens da natureza', base: 8 }, { t: 'dig', title: 'Desenterre %n tesouros', base: 3 }, { t: 'hit', title: 'Acerte %n golpes', base: 30 }, { t: 'fling', title: 'Dê %n impulsos', base: 25 },
  { t: 'swim', title: 'Nade %n metros', base: 120 }, { t: 'pop', title: 'Estoure %n bolhas', base: 15 }, { t: 'craft', title: 'Fabrique %n itens', base: 1 }, { t: 'chop', title: 'Corte %n árvores', base: 6 }
];
// Álbum de coleção: categorias de itens; completar uma dá recompensa.
export const ALBUM = { fish: 'Peixes', gem: 'Gemas', ore: 'Minérios', forage: 'Natureza', treasure: 'Tesouros' };

// Bichinhos de estimação: filhotes que seguem você (os outros jogadores também veem).
export const PETS = [
  { id: 'none', n: 'Nenhum' },
  { id: 'kit_orange', n: 'Filhote Laranja', price: 400, look: { fur: '#f2a65a', fur2: '#f5f1e8', pattern: 1, eyes: '#58c26a', hat: 0 } },
  { id: 'kit_gray', n: 'Filhote Cinza', price: 400, look: { fur: '#8a8f98', fur2: '#f5f1e8', pattern: 3, eyes: '#e0b030', hat: 0 } },
  { id: 'kit_black', n: 'Filhote Preto', price: 700, look: { fur: '#3b3b45', fur2: '#f5f1e8', pattern: 5, eyes: '#e0b030', hat: 3 } },
  { id: 'kit_snow', n: 'Filhote de Neve', price: 1200, look: { fur: '#f5f1e8', fur2: '#b8b0d8', pattern: 0, eyes: '#4aa3e0', hat: 6 } },
  { id: 'kit_aero', n: 'Filhote Aero', price: 1800, look: { fur: '#7fb7c9', fur2: '#f5f1e8', pattern: 1, eyes: '#4aa3e0', hat: 9 } },
  { id: 'kit_gold', n: 'Filhote Dourado', how: 'Chegue ao nível 15', s: 'level', v: 15, look: { fur: '#e8c27a', fur2: '#f2c230', pattern: 2, eyes: '#9b6ad6', hat: 2 } },
  { id: 'kit_shadow', n: 'Filhote Sombrio', how: 'Derrote 1 chefe', s: 'boss', v: 1, look: { fur: '#3b3b45', fur2: '#9b6ad6', pattern: 2, eyes: '#e05050', hat: 8 } }
];
