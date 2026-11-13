import * as THREE from 'three';
import { S } from './state.js';
import { net } from './net.js';
import { emit, clamp } from './util.js';
import { play } from './assets.js';

// Casas customizáveis: cada jogador tem uma casa (vários estilos para comprar), decora com
// móveis (comprados uma vez, guardados e recolocados à vontade), troca cor de parede/chão
// e recebe visitas (aberta, só amigos ou trancada). Os dados ficam em S.d.home (salvo na nuvem).
const PI = Math.PI;
const T = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const shade = (hex, k) => (Math.min(255, ((hex >> 16) & 255) * k) << 16) | (Math.min(255, ((hex >> 8) & 255) * k) << 8) | Math.min(255, (hex & 255) * k);

export const WALLS = [0xf3e6cf, 0xc98a5a, 0xf4b8c8, 0xb8e0f4, 0xc8f0c0, 0xfff1a0, 0xd8c8f4, 0xffffff, 0x8a8f98, 0x5a4a6a, 0x3b5a8a, 0xe07a5a];
export const FLOORS = [0xb07a4a, 0xd8b088, 0x7a5232, 0xe8e4dc, 0x9aa0aa, 0x6a8ac8, 0xc86a6a, 0x5a9a6a, 0x3b3b45, 0xf4d8a0];
export const COLS = [0, 0xe05050, 0xf2a65a, 0xf2c230, 0x6fd26f, 0x2fb8a0, 0x4aa8ff, 0x4a5cc8, 0xa45cf0, 0xe39ab0, 0xffffff, 0x3b3b45, 0x8a6a45];
export const COL_NAMES = ['Original', 'Vermelho', 'Laranja', 'Amarelo', 'Verde', 'Turquesa', 'Azul', 'Anil', 'Roxo', 'Rosa', 'Branco', 'Grafite', 'Madeira'];

export const HOUSES = [
  { id: 'cabana', n: 'Cabana de Madeira', icon: '🛖', price: 0, W: 12, D: 10, H: 3.4, wall: 1, floor: 0, roof: 0x8a4a3a, g: [0x6fbf4f, 0x58a844], surface: 'grass', sky: [0x8fd0f5, 0xffb27a, 0x0b1230], trees: 'nature/tree_oak' },
  { id: 'casinha', n: 'Casinha Colorida', icon: '🏡', price: 1500, W: 14, D: 12, H: 3.6, wall: 3, floor: 1, roof: 0xd05050, g: [0x7fd05a, 0x60b848], surface: 'grass', sky: [0x8fd0f5, 0xffb27a, 0x0b1230], trees: 'nature/tree_default' },
  { id: 'chale', n: 'Chalé na Neve', icon: '🏔', price: 3000, W: 14, D: 12, H: 3.8, wall: 1, floor: 2, roof: 0x5a3a2a, g: [0xf4f8ff, 0xdde8f5], surface: 'snow', sky: [0xc8e4f8, 0xf5b8a0, 0x0c1430], trees: 'holiday/tree-snow-a', snow: 1 },
  { id: 'praia', n: 'Casa de Praia', icon: '🏖', price: 4000, W: 14, D: 12, H: 3.6, wall: 7, floor: 9, roof: 0x2fb8a0, g: [0xf2dc9a, 0xe8c878], surface: 'sand', sky: [0x60c8ff, 0xffc890, 0x0b1230], trees: 'nature/tree_palmTall' },
  { id: 'aero', n: 'Bolha Aero', icon: '🫧', price: 6000, W: 16, D: 16, H: 4, wall: 3, floor: 3, roof: 0x9fe8ff, g: [0x5fe03c, 0x86f24e], surface: 'grass', sky: [0x4cc6ff, 0xffb8e6, 0x0c2a66], trees: 'nature/tree_fat', dome: 1 },
  { id: 'sombria', n: 'Torre Sombria', icon: '🦇', price: 7000, W: 14, D: 14, H: 4.4, wall: 9, floor: 8, roof: 0x2a1838, g: [0x3a3448, 0x2c2838], surface: 'stone', sky: [0x2a2060, 0x40206a, 0x100820], trees: 'grave/pine-crooked' },
  { id: 'pool', n: 'Apê Poolrooms', icon: '🏊', price: 6000, W: 16, D: 14, H: 3.6, wall: 7, floor: 3, roof: 0xe8f4f8, g: [0xe8f4f8, 0xd8eef4], surface: 'stone', sky: [0xbfefff, 0xe8f8ff, 0x203040], trees: 'nature/plant_bushLarge' },
  { id: 'mansao', n: 'Mansão', icon: '🏰', price: 15000, W: 24, D: 18, H: 4.4, wall: 0, floor: 2, roof: 0x3b4a6a, g: [0x6fbf4f, 0x58a844], surface: 'grass', sky: [0x8fd0f5, 0xffb27a, 0x0b1230], trees: 'nature/tree_detailed', rooms: 1 }
];

// ---------- móveis ----------
// cada parte: [tipo, dx, dy, dz, sx, sy, sz, cor, sem colisão]; tipo b=caixa c=cilindro k=cone s=esfera, ou um modelo Kenney ('kit/nome', escala em sx)
// cor 'M' = cor principal do móvel (escolhível); light = [altura, cor] acende uma luz; act = sentar/dormir/festa
const M = 'M', WD = 0x9a6a40, WDD = 0x6b4a36, WH = 0xf4f4f6, BK = 0x22222a;
const legs4 = (w, d, h, c) => [['b', -w / 2 + 0.05, 0, -d / 2 + 0.05, 0.07, h, 0.07, c, 1], ['b', w / 2 - 0.05, 0, -d / 2 + 0.05, 0.07, h, 0.07, c, 1], ['b', -w / 2 + 0.05, 0, d / 2 - 0.05, 0.07, h, 0.07, c, 1], ['b', w / 2 - 0.05, 0, d / 2 - 0.05, 0.07, h, 0.07, c, 1]];
export const FCATS = ['Sala', 'Quarto', 'Cozinha', 'Gatos', 'Banheiro', 'Festa e Natal', 'Escola', 'Jardim'];
export const FURN = [
  // Sala
  { id: 'sofa', n: 'Sofá', cat: 'Sala', price: 300, c: 0x4a6ad0, sz: [2.2, 0.95, 0.9], act: 'sit', p: [['b', 0, 0, 0, 2.2, 0.45, 0.9, M], ['b', 0, 0.45, 0.32, 2.2, 0.5, 0.26, M], ['b', -1.0, 0.45, 0, 0.2, 0.25, 0.9, M], ['b', 1.0, 0.45, 0, 0.2, 0.25, 0.9, M], ['b', -0.45, 0.45, -0.08, 0.86, 0.1, 0.6, 'L', 1], ['b', 0.45, 0.45, -0.08, 0.86, 0.1, 0.6, 'L', 1]] },
  { id: 'poltrona', n: 'Poltrona', cat: 'Sala', price: 180, c: 0xc05a5a, sz: [1, 0.95, 0.9], act: 'sit', p: [['b', 0, 0, 0, 1, 0.45, 0.9, M], ['b', 0, 0.45, 0.32, 1, 0.5, 0.26, M], ['b', -0.42, 0.45, 0, 0.16, 0.25, 0.9, M], ['b', 0.42, 0.45, 0, 0.16, 0.25, 0.9, M], ['b', 0, 0.45, -0.08, 0.66, 0.1, 0.6, 'L', 1]] },
  { id: 'mesacentro', n: 'Mesa de centro', cat: 'Sala', price: 120, c: WD, sz: [1.2, 0.4, 0.7], p: [['b', 0, 0.33, 0, 1.2, 0.07, 0.7, M]].concat(legs4(1.2, 0.7, 0.33, WDD)) },
  { id: 'tv', n: 'TV', cat: 'Sala', price: 400, c: WDD, sz: [1.4, 1.25, 0.45], light: [0.9, 0x60c0ff], p: [['b', 0, 0, 0, 1.4, 0.45, 0.45, M], ['b', 0, 0.45, 0.05, 1.3, 0.78, 0.08, BK], ['b', 0, 0.49, 0.0, 1.18, 0.68, 0.01, 0x3ab0ff, 1], ['b', 0, 0.62, -0.005, 0.5, 0.25, 0.01, 0xa0f0ff, 1]] },
  { id: 'tapete', n: 'Tapete', cat: 'Sala', price: 80, c: 0xc04060, sz: [2.4, 0.03, 1.6], nocol: 1, p: [['b', 0, 0, 0, 2.4, 0.025, 1.6, M], ['b', 0, 0, 0, 2.0, 0.03, 1.2, 'L']] },
  { id: 'tapeter', n: 'Tapete redondo', cat: 'Sala', price: 60, c: 0x4aa8ff, sz: [1.8, 0.03, 1.8], nocol: 1, p: [['c', 0, 0, 0, 1.8, 0.025, 1.8, M], ['c', 0, 0, 0, 1.3, 0.03, 1.3, 'L']] },
  { id: 'estante', n: 'Estante de livros', cat: 'Sala', price: 250, c: WD, sz: [1.4, 2, 0.4], p: [['b', -0.67, 0, 0, 0.06, 2, 0.4, M], ['b', 0.67, 0, 0, 0.06, 2, 0.4, M], ['b', 0, 0, 0.18, 1.4, 2, 0.04, M], ['b', 0, 0, 0, 1.34, 0.06, 0.4, M], ['b', 0, 0.64, 0, 1.34, 0.05, 0.4, M], ['b', 0, 1.28, 0, 1.34, 0.05, 0.4, M], ['b', 0, 1.94, 0, 1.4, 0.06, 0.4, M],
    ['b', -0.4, 0.06, 0, 0.5, 0.42, 0.3, 0xc04040, 1], ['b', 0.25, 0.06, 0, 0.5, 0.36, 0.3, 0x4060c0, 1], ['b', -0.2, 0.69, 0, 0.7, 0.4, 0.3, 0x40a060, 1], ['b', 0.4, 0.69, 0, 0.3, 0.34, 0.3, 0xe0b040, 1], ['b', 0, 1.33, 0, 1.0, 0.38, 0.3, 0xa050c0, 1]] },
  { id: 'luminaria', n: 'Luminária', cat: 'Sala', price: 90, c: 0xfff0b0, sz: [0.45, 1.75, 0.45], light: [1.5, 0xffe0a0], p: [['c', 0, 0, 0, 0.4, 0.05, 0.4, BK], ['c', 0, 0.05, 0, 0.05, 1.3, 0.05, BK], ['k', 0, 1.3, 0, 0.5, 0.42, 0.5, M, 1]] },
  { id: 'lareira', n: 'Lareira', cat: 'Sala', price: 500, c: 0x9a9aa4, sz: [1.8, 1.6, 0.6], light: [0.4, 0xff8030], p: [['b', -0.7, 0, 0, 0.4, 1.2, 0.6, M], ['b', 0.7, 0, 0, 0.4, 1.2, 0.6, M], ['b', 0, 0.8, 0, 1.0, 0.4, 0.6, M], ['b', 0, 1.2, 0, 2.0, 0.12, 0.7, 'D'], ['b', 0, 0, 0.2, 1.0, 0.8, 0.2, 0x2a2020], ['b', 0, 0, -0.05, 0.7, 0.12, 0.3, 0x6b3a1a, 1], ['k', 0, 0.1, -0.05, 0.4, 0.45, 0.25, 0xff9030, 1], ['k', 0, 0.1, -0.05, 0.22, 0.32, 0.15, 0xffe070, 1]] },
  { id: 'quadro', n: 'Quadro (parede)', cat: 'Sala', price: 70, c: 0xd8a830, sz: [1.1, 0.85, 0.1], wall: 1.3, nocol: 1, p: [['b', 0, 0, 0, 1.1, 0.85, 0.06, M], ['b', 0, 0.06, -0.04, 0.96, 0.73, 0.02, 0x80c8f0], ['b', 0, 0.06, -0.05, 0.96, 0.25, 0.02, 0x60b050], ['c', 0.25, 0.5, -0.05, 0.16, 0.02, 0.16, 0xffe060]] },
  { id: 'planta', n: 'Vaso de planta', cat: 'Sala', price: 60, c: 0xc8743a, sz: [0.6, 1.3, 0.6], p: [['c', 0, 0, 0, 0.5, 0.45, 0.5, M], ['nature/plant_bushDetailed', 0, 0.42, 0, 1.1]] },
  { id: 'piano', n: 'Piano', cat: 'Sala', price: 900, c: BK, sz: [1.6, 1.3, 0.7], p: [['b', 0, 0, 0.1, 1.6, 1.3, 0.5, M], ['b', 0, 0.75, -0.25, 1.6, 0.06, 0.4, M], ['b', 0, 0.81, -0.28, 1.5, 0.03, 0.3, WH, 1], ['b', 0, 0, -0.3, 0.1, 0.75, 0.1, M]] },
  { id: 'relogio', n: 'Relógio de pé', cat: 'Sala', price: 220, c: WDD, sz: [0.6, 2.1, 0.45], p: [['b', 0, 0, 0, 0.6, 2.1, 0.45, M], ['c', 0, 1.6, -0.23, 0.42, 0.02, 0.42, WH, 1], ['b', 0, 0.5, -0.23, 0.05, 0.6, 0.02, 0xd8a830, 1]] },
  // Quarto
  { id: 'camacasal', n: 'Cama de casal', cat: 'Quarto', price: 450, c: 0x4a5cc8, sz: [2, 0.7, 2.2], act: 'sleep', p: [['b', 0, 0, 0, 2, 0.35, 2.2, WD], ['b', 0, 0.35, 0, 1.9, 0.2, 2.1, WH], ['b', 0, 0.5, -0.25, 1.92, 0.08, 1.6, M], ['b', -0.48, 0.55, 0.78, 0.8, 0.14, 0.4, WH, 1], ['b', 0.48, 0.55, 0.78, 0.8, 0.14, 0.4, WH, 1], ['b', 0, 0, 1.1, 2.1, 1.2, 0.12, WDD]] },
  { id: 'camasolteiro', n: 'Cama de solteiro', cat: 'Quarto', price: 250, c: 0x6fd26f, sz: [1.1, 0.7, 2.1], act: 'sleep', p: [['b', 0, 0, 0, 1.1, 0.35, 2.1, WD], ['b', 0, 0.35, 0, 1.0, 0.2, 2.0, WH], ['b', 0, 0.5, -0.25, 1.02, 0.08, 1.5, M], ['b', 0, 0.55, 0.75, 0.8, 0.14, 0.4, WH, 1], ['b', 0, 0, 1.03, 1.2, 1.0, 0.1, WDD]] },
  { id: 'berco', n: 'Berço', cat: 'Quarto', price: 300, c: 0xf4b8c8, sz: [1.1, 1, 1.4], act: 'sleep', p: (() => { const p = [['b', 0, 0.3, 0, 1.1, 0.12, 1.4, M], ['b', 0, 0.42, 0, 1.0, 0.12, 1.3, WH, 1]]; for (let i = 0; i < 7; i++) { const x = -0.5 + i / 6; p.push(['b', x, 0, -0.68, 0.05, 1, 0.05, M, 1], ['b', x, 0, 0.68, 0.05, 1, 0.05, M, 1]); } p.push(['b', 0, 0.95, -0.68, 1.1, 0.06, 0.06, M], ['b', 0, 0.95, 0.68, 1.1, 0.06, 0.06, M], ['b', -0.53, 0, 0, 0.06, 1, 1.4, M], ['b', 0.53, 0, 0, 0.06, 1, 1.4, M]); return p; })() },
  { id: 'caminha', n: 'Caminha de gato', cat: 'Quarto', price: 80, c: 0xa45cf0, sz: [1, 0.3, 1], act: 'sleep', p: [['c', 0, 0, 0, 1, 0.28, 1, M], ['c', 0, 0.05, 0, 0.75, 0.26, 0.75, 'L']] },
  { id: 'guardaroupa', n: 'Guarda-roupa', cat: 'Quarto', price: 350, c: WD, sz: [1.6, 2.2, 0.6], p: [['b', 0, 0, 0, 1.6, 2.2, 0.6, M], ['b', -0.4, 0.08, -0.305, 0.76, 2.0, 0.02, 'L', 1], ['b', 0.4, 0.08, -0.305, 0.76, 2.0, 0.02, 'L', 1], ['b', -0.06, 1.0, -0.32, 0.04, 0.25, 0.03, 0xd8a830, 1], ['b', 0.06, 1.0, -0.32, 0.04, 0.25, 0.03, 0xd8a830, 1]] },
  { id: 'criado', n: 'Criado-mudo', cat: 'Quarto', price: 90, c: WD, sz: [0.5, 0.95, 0.45], light: [0.85, 0xffe0a0], p: [['b', 0, 0, 0, 0.5, 0.55, 0.45, M], ['b', 0, 0.3, -0.23, 0.4, 0.16, 0.02, 'L', 1], ['c', 0, 0.55, 0, 0.1, 0.2, 0.1, BK, 1], ['k', 0, 0.72, 0, 0.3, 0.22, 0.3, 0xfff0b0, 1]] },
  { id: 'escrivaninha', n: 'Escrivaninha', cat: 'Quarto', price: 200, c: WD, sz: [1.4, 1.2, 0.7], p: [['b', 0, 0.72, 0, 1.4, 0.06, 0.7, M], ['b', -0.6, 0, 0, 0.1, 0.72, 0.7, M], ['b', 0.45, 0, 0, 0.4, 0.72, 0.7, M], ['b', 0, 0.78, 0.15, 0.6, 0.4, 0.04, BK, 1], ['b', 0, 0.82, 0.13, 0.54, 0.32, 0.01, 0x60c0ff, 1], ['b', 0, 0.78, -0.12, 0.5, 0.02, 0.2, 0xd0d0d8, 1]] },
  // Cozinha
  { id: 'geladeira', n: 'Geladeira', cat: 'Cozinha', price: 450, c: WH, sz: [0.8, 1.9, 0.75], p: [['b', 0, 0, 0, 0.8, 1.9, 0.75, M], ['b', 0, 1.2, -0.38, 0.78, 0.02, 0.02, 0x9aa0aa, 1], ['b', 0.3, 1.3, -0.4, 0.05, 0.4, 0.04, 0x9aa0aa, 1], ['b', 0.3, 0.6, -0.4, 0.05, 0.4, 0.04, 0x9aa0aa, 1]] },
  { id: 'fogao', n: 'Fogão', cat: 'Cozinha', price: 350, c: WH, sz: [0.8, 0.95, 0.7], p: [['b', 0, 0, 0, 0.8, 0.9, 0.7, M], ['b', 0, 0.9, 0, 0.8, 0.02, 0.7, BK, 1], ['c', -0.18, 0.91, -0.15, 0.22, 0.02, 0.22, 0x555560, 1], ['c', 0.18, 0.91, -0.15, 0.22, 0.02, 0.22, 0x555560, 1], ['c', -0.18, 0.91, 0.15, 0.22, 0.02, 0.22, 0x555560, 1], ['c', 0.18, 0.91, 0.15, 0.22, 0.02, 0.22, 0x555560, 1], ['b', 0, 0.2, -0.355, 0.6, 0.4, 0.02, 0x303038, 1]] },
  { id: 'balcao', n: 'Balcão', cat: 'Cozinha', price: 200, c: 0xd8b088, sz: [1.2, 0.92, 0.65], p: [['b', 0, 0, 0, 1.2, 0.88, 0.62, M], ['b', 0, 0.88, 0, 1.24, 0.05, 0.66, 0xe8e4dc], ['b', -0.3, 0.1, -0.315, 0.56, 0.7, 0.02, 'L', 1], ['b', 0.3, 0.1, -0.315, 0.56, 0.7, 0.02, 'L', 1]] },
  { id: 'pia', n: 'Pia', cat: 'Cozinha', price: 220, c: 0xd8b088, sz: [1.2, 1.2, 0.65], p: [['b', 0, 0, 0, 1.2, 0.88, 0.62, M], ['b', 0, 0.88, 0, 1.24, 0.05, 0.66, 0xe8e4dc], ['b', 0, 0.9, -0.02, 0.6, 0.03, 0.4, 0x9aa0aa, 1], ['c', 0, 0.93, 0.22, 0.05, 0.3, 0.05, 0xc0c4cc, 1]] },
  { id: 'mesajantar', n: 'Mesa de jantar', cat: 'Cozinha', price: 250, c: WD, sz: [2, 0.78, 1.1], p: [['b', 0, 0.72, 0, 2, 0.06, 1.1, M]].concat(legs4(2, 1.1, 0.72, WDD)) },
  { id: 'cadeira', n: 'Cadeira', cat: 'Cozinha', price: 60, c: WD, sz: [0.5, 1, 0.5], act: 'sit', p: [['b', 0, 0.42, 0, 0.5, 0.06, 0.5, M], ['b', 0, 0.48, 0.22, 0.5, 0.55, 0.06, M]].concat(legs4(0.5, 0.5, 0.42, WDD)) },
  { id: 'tigela', n: 'Tigela de ração', cat: 'Gatos', price: 20, c: 0xe05050, sz: [0.45, 0.16, 0.45], nocol: 1, p: [['c', 0, 0, 0, 0.45, 0.14, 0.45, M], ['c', 0, 0.02, 0, 0.36, 0.14, 0.36, 0xa86a3a]] },
  // Gatos
  { id: 'arranhador', n: 'Torre arranhador', cat: 'Gatos', price: 300, c: 0xa45cf0, sz: [1.1, 2.3, 1.1], p: [['b', 0, 0, 0, 1.1, 0.12, 1.1, M], ['c', -0.3, 0.12, -0.3, 0.22, 1.0, 0.22, 0xd8c098], ['c', 0.3, 0.12, 0.3, 0.22, 1.6, 0.22, 0xd8c098], ['b', -0.15, 1.1, -0.15, 0.8, 0.1, 0.8, M], ['b', 0.25, 1.72, 0.25, 0.7, 0.1, 0.7, M], ['c', 0.25, 1.82, 0.25, 0.6, 0.25, 0.6, 'L'], ['s', -0.3, 0.55, -0.62, 0.15, 0.15, 0.15, 0xffe060, 1]] },
  { id: 'caixa', n: 'Caixa de papelão', cat: 'Gatos', price: 15, c: 0xc8a070, sz: [0.9, 0.5, 0.7], p: [['b', 0, 0, 0, 0.9, 0.06, 0.7, M], ['b', -0.43, 0, 0, 0.04, 0.5, 0.7, M], ['b', 0.43, 0, 0, 0.04, 0.5, 0.7, M], ['b', 0, 0, -0.33, 0.9, 0.5, 0.04, M], ['b', 0, 0, 0.33, 0.9, 0.5, 0.04, M], ['b', -0.43, 0.5, -0.15, 0.04, 0.3, 0.4, 'D', 1]] },
  { id: 'novelo', n: 'Novelo de lã', cat: 'Gatos', price: 10, c: 0xe05050, sz: [0.35, 0.35, 0.35], nocol: 1, p: [['s', 0, 0, 0, 0.35, 0.35, 0.35, M], ['b', 0.25, 0, 0.1, 0.4, 0.015, 0.02, M, 1]] },
  { id: 'casinhagato', n: 'Casinha de gato', cat: 'Gatos', price: 200, c: 0xe07a5a, sz: [1.2, 1.3, 1.2], p: [['b', 0, 0, 0.55, 1.2, 0.9, 0.1, M], ['b', -0.55, 0, 0, 0.1, 0.9, 1.2, M], ['b', 0.55, 0, 0, 0.1, 0.9, 1.2, M], ['b', -0.38, 0, -0.55, 0.45, 0.9, 0.1, M], ['b', 0.38, 0, -0.55, 0.45, 0.9, 0.1, M], ['b', 0, 0.62, -0.55, 0.32, 0.28, 0.1, M], ['k', 0, 0.9, 0, 1.75, 0.5, 1.75, 'D']] },
  // Banheiro
  { id: 'banheira', n: 'Banheira', cat: 'Banheiro', price: 400, c: WH, sz: [1.7, 0.65, 0.85], p: [['b', 0, 0, 0, 1.7, 0.6, 0.85, M], ['b', 0, 0.42, 0, 1.5, 0.2, 0.65, 0x80d0f0, 1], ['s', 0.4, 0.58, 0.1, 0.18, 0.12, 0.18, WH, 1], ['s', 0.2, 0.58, -0.15, 0.14, 0.1, 0.14, WH, 1]] },
  { id: 'privada', n: 'Vaso sanitário', cat: 'Banheiro', price: 150, c: WH, sz: [0.5, 0.85, 0.7], act: 'sit', p: [['c', 0, 0, -0.05, 0.42, 0.42, 0.5, M], ['b', 0, 0.42, -0.05, 0.46, 0.04, 0.55, M], ['b', 0, 0, 0.25, 0.42, 0.85, 0.2, M]] },
  { id: 'espelho', n: 'Espelho (parede)', cat: 'Banheiro', price: 100, c: 0xc0c4cc, sz: [0.8, 1, 0.08], wall: 1.2, nocol: 1, p: [['b', 0, 0, 0, 0.8, 1, 0.05, M], ['b', 0, 0.05, -0.03, 0.7, 0.9, 0.01, 0xdff4ff]] },
  // Festa e Natal (easter egg: a ceia dos gatos natalinos com laser)
  { id: 'arvorenatal', n: 'Árvore de Natal', cat: 'Festa e Natal', price: 350, c: 0x40a060, sz: [1.4, 2.6, 1.4], light: [2.2, 0xffd060], p: [['holiday/tree-decorated-snow', 0, 0, 0, 1.05], ['s', 0, 2.36, 0, 0.26, 0.26, 0.26, 0xffe060, 1], ['b', 0.5, 0, 0.5, 0.35, 0.3, 0.35, 0xe05050, 1], ['b', -0.5, 0, 0.4, 0.3, 0.25, 0.3, 0x4aa8ff, 1]] },
  { id: 'ceia', n: 'Mesa da Ceia 🦃', cat: 'Festa e Natal', price: 600, c: WH, sz: [2.4, 1.05, 1.2], light: [1.15, 0xffc060], p: [['b', 0, 0.72, 0, 2.4, 0.06, 1.2, M], ['b', 0, 0.5, -0.6, 2.4, 0.24, 0.02, M, 1], ['b', 0, 0.5, 0.6, 2.4, 0.24, 0.02, M, 1]].concat(legs4(2.3, 1.1, 0.72, WDD)).concat([
    ['c', 0, 0.78, 0, 0.75, 0.03, 0.55, 0xe8e8ec, 1], ['s', 0, 0.8, 0, 0.55, 0.32, 0.4, 0xc8742a, 1], ['c', -0.28, 0.86, 0.1, 0.07, 0.07, 0.25, 0xd88a3a, 1], ['c', 0.28, 0.86, 0.1, 0.07, 0.07, 0.25, 0xd88a3a, 1], ['s', -0.2, 0.79, -0.25, 0.05, 0.05, 0.05, 0xc02030, 1], ['s', 0.22, 0.79, 0.25, 0.05, 0.05, 0.05, 0xc02030, 1],
    ['c', -0.95, 0.78, 0, 0.06, 0.3, 0.06, 0xf8f0e0, 1], ['c', 0.95, 0.78, 0, 0.06, 0.3, 0.06, 0xf8f0e0, 1], ['k', -0.95, 1.08, 0, 0.05, 0.08, 0.05, 0xffd060, 1], ['k', 0.95, 1.08, 0, 0.05, 0.08, 0.05, 0xffd060, 1],
    ['c', -0.6, 0.78, -0.35, 0.3, 0.02, 0.3, WH, 1], ['c', 0.6, 0.78, -0.35, 0.3, 0.02, 0.3, WH, 1], ['c', -0.6, 0.78, 0.35, 0.3, 0.02, 0.3, WH, 1], ['c', 0.6, 0.78, 0.35, 0.3, 0.02, 0.3, WH, 1],
    ['c', -0.35, 0.78, -0.4, 0.07, 0.2, 0.07, 0xe8d890, 1], ['c', 0.35, 0.78, 0.4, 0.07, 0.2, 0.07, 0xe8d890, 1], ['c', 0, 0.78, 0.42, 0.35, 0.1, 0.3, 0xf0e4b0, 1]]) },
  { id: 'laser', n: 'Globo de laser 🪩', cat: 'Festa e Natal', price: 800, c: 0xd0d4dc, sz: [0.6, 0.9, 0.6], act: 'party', p: [['c', 0, 0, 0, 0.5, 0.35, 0.5, BK], ['c', 0, 0.35, 0, 0.08, 0.2, 0.08, BK, 1], ['s', 0, 0.5, 0, 0.42, 0.42, 0.42, M, 1]] },
  { id: 'presentes', n: 'Presentes', cat: 'Festa e Natal', price: 50, c: 0xe05050, sz: [1, 0.55, 0.8], p: [['b', -0.25, 0, 0, 0.45, 0.45, 0.45, M], ['b', -0.25, 0, 0, 0.47, 0.47, 0.08, 0xffe060, 1], ['b', 0.25, 0, 0.1, 0.35, 0.3, 0.35, 0x4aa8ff], ['b', 0.25, 0, 0.1, 0.08, 0.32, 0.37, WH, 1], ['b', 0.1, 0, -0.3, 0.3, 0.55, 0.25, 0x6fd26f]] },
  { id: 'bonecoNeve', n: 'Boneco de neve', cat: 'Festa e Natal', price: 120, c: WH, sz: [1.3, 1.7, 0.9], p: [['holiday/snowman-hat', 0, 0, 0, 1.2]] },
  { id: 'pisca', n: 'Pisca-pisca', cat: 'Festa e Natal', price: 80, c: 0xffd060, sz: [2, 0.2, 0.2], wall: 2.2, nocol: 1, light: [0, 0xffa0e0], p: (() => { const p = [['b', 0, 0.08, 0, 2, 0.015, 0.015, 0x30a040, 1]]; const cs = [0xff4040, 0xffe040, 0x40ff80, 0x40a0ff, 0xff60e0]; for (let i = 0; i < 9; i++) p.push(['s', -0.96 + i * 0.24, 0, 0, 0.09, 0.12, 0.09, cs[i % 5], 1]); return p; })() },
  { id: 'baloes', n: 'Balões', cat: 'Festa e Natal', price: 40, c: 0xe39ab0, sz: [0.8, 2, 0.8], nocol: 1, p: [['c', 0, 0, 0, 0.01, 1.4, 0.01, WH, 1], ['s', 0, 1.35, 0, 0.42, 0.5, 0.42, M, 1], ['s', 0.3, 1.5, 0.1, 0.38, 0.46, 0.38, 0x4aa8ff, 1], ['s', -0.25, 1.55, -0.1, 0.38, 0.46, 0.38, 0xffe060, 1]] },
  // Escola (roleplay)
  { id: 'lousa', n: 'Lousa (parede)', cat: 'Escola', price: 200, c: 0x2a5a3a, sz: [2.2, 1.3, 0.12], wall: 1.1, nocol: 1, p: [['b', 0, 0, 0, 2.3, 1.35, 0.06, WDD], ['b', 0, 0.06, -0.035, 2.15, 1.2, 0.02, M], ['b', 0, -0.02, -0.08, 2.0, 0.05, 0.08, WDD], ['b', -0.4, 0.75, -0.05, 0.7, 0.02, 0.01, WH], ['b', 0.1, 0.55, -0.05, 1.0, 0.02, 0.01, WH]] },
  { id: 'carteira', n: 'Carteira escolar', cat: 'Escola', price: 90, c: 0x4aa8ff, sz: [0.7, 0.8, 0.9], act: 'sit', p: [['b', 0, 0.7, -0.2, 0.7, 0.05, 0.5, WD], ['b', 0, 0.4, 0.22, 0.5, 0.05, 0.4, M], ['b', 0, 0.45, 0.42, 0.5, 0.4, 0.05, M], ['b', 0, 0, -0.2, 0.08, 0.7, 0.08, BK, 1], ['b', 0, 0, 0.22, 0.08, 0.4, 0.08, BK, 1]] },
  { id: 'globo', n: 'Globo terrestre', cat: 'Escola', price: 70, c: 0x4aa8ff, sz: [0.45, 0.65, 0.45], nocol: 1, p: [['c', 0, 0, 0, 0.3, 0.05, 0.3, WDD], ['c', 0, 0.05, 0, 0.04, 0.2, 0.04, 0xd8a830], ['s', 0, 0.22, 0, 0.42, 0.42, 0.42, M], ['s', 0.06, 0.32, -0.1, 0.22, 0.18, 0.22, 0x6fd26f]] },
  // Jardim
  { id: 'arvore', n: 'Árvore', cat: 'Jardim', price: 100, c: 0, sz: [2.6, 4.7, 2.6], p: [['nature/tree_oak', 0, 0, 0, 4]] },
  { id: 'flores', n: 'Canteiro de flores', cat: 'Jardim', price: 40, c: 0x8a6a45, sz: [1.4, 0.5, 0.6], p: [['b', 0, 0, 0, 1.4, 0.25, 0.6, M], ['nature/flower_redA', -0.4, 0.25, 0, 2.6], ['nature/flower_yellowB', 0, 0.25, 0, 2.6], ['nature/flower_purpleC', 0.4, 0.25, 0, 2.6]] },
  { id: 'banco', n: 'Banco de praça', cat: 'Jardim', price: 120, c: 0, sz: [1.3, 0.85, 0.75], act: 'sit', p: [['grave/bench', 0, 0, 0, 1.6]] },
  { id: 'fonte', n: 'Fonte', cat: 'Jardim', price: 900, c: 0, sz: [3, 0.45, 3], p: [['town/fountain-round', 0, 0, 0, 1.5]] },
  { id: 'lanterna', n: 'Poste de luz', cat: 'Jardim', price: 60, c: 0, sz: [0.4, 2.4, 0.4], light: [2.3, 0xffd890], p: [['grave/lightpost-single', 0, 0, 0, 2]] },
  { id: 'cerca', n: 'Cerca', cat: 'Jardim', price: 30, c: 0, sz: [3.5, 1, 0.3], p: [['nature/fence_simple', 0, 0, 0, 3.5]] },
  { id: 'bau', n: 'Baú', cat: 'Jardim', price: 100, c: 0, sz: [1, 0.8, 0.7], p: [['plat/chest', 0, 0, 0, 1.9]] },
  { id: 'trampolim', n: 'Trampolim', cat: 'Jardim', price: 250, c: 0, sz: [1.2, 0.4, 1.2], act: 'spring', nocol: 1, p: [] },
  { id: 'fogueira', n: 'Fogueira', cat: 'Jardim', price: 80, c: 0, sz: [1.2, 0.6, 1.2], light: [0.5, 0xff8030], p: [['nature/campfire_stones', 0, 0, 0, 3.2], ['k', 0, 0.1, 0, 0.4, 0.55, 0.4, 0xff9030, 1], ['k', 0, 0.1, 0, 0.22, 0.38, 0.22, 0xffe070, 1]] }
];
export const FURN_BY = {}; for (const f of FURN) FURN_BY[f.id] = f;
const MAXI = 150;

// ---------- dados ----------
function blankHome() { return { t: 'cabana', has: ['cabana'], L: {}, own: {}, lock: 0 }; }
function layout(h, t) { const hs = HOUSES.find((x) => x.id === t) || HOUSES[0]; return h.L[t] || (h.L[t] = { w: hs.wall, f: hs.floor, it: [] }); }
const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : 0);
// valida dados vindos da nuvem/de outros jogadores (nunca confia no formato)
export function cleanHome(h) {
  const o = blankHome(); if (!h || typeof h !== 'object') return o;
  o.t = HOUSES.some((x) => x.id === h.t) ? h.t : 'cabana'; o.lock = clamp(h.lock | 0, 0, 2);
  if (Array.isArray(h.has)) o.has = h.has.filter((id) => HOUSES.some((x) => x.id === id)).slice(0, HOUSES.length); if (o.has.indexOf('cabana') < 0) o.has.unshift('cabana');
  if (h.own && typeof h.own === 'object') for (const k in h.own) if (FURN_BY[k]) o.own[k] = clamp(h.own[k] | 0, 0, MAXI);
  if (h.L && typeof h.L === 'object') for (const hs of HOUSES) { const l = h.L[hs.id]; if (!l || typeof l !== 'object') continue; const lim = Math.max(hs.W, hs.D) + 22;
    o.L[hs.id] = { w: clamp(l.w | 0, 0, WALLS.length - 1), f: clamp(l.f | 0, 0, FLOORS.length - 1), it: (Array.isArray(l.it) ? l.it : []).filter((a) => Array.isArray(a) && FURN_BY[a[0]]).slice(0, MAXI).map((a) => [a[0], num(a[1], -lim, lim), num(a[2], 0, 12), num(a[3], -lim, lim), clamp(a[4] | 0, 0, 7), clamp(a[5] | 0, 0, COLS.length - 1)]) }; }
  return o;
}

// ---------- construção do mapa ----------
function partColor(f, part, ci) {
  const base = ci ? COLS[ci] : f.c, c = part[7];
  return c === 'M' ? base : c === 'L' ? shade(base, 1.25) : c === 'D' ? shade(base, 0.72) : c;
}
// coloca um móvel no mundo (lotes estáticos) e registra luzes/ações
function placeItem(w, E, a, acts) {
  const f = FURN_BY[a[0]]; if (!f) return; const x = a[1], y = a[2] + (f.wall || 0), z = a[3], ry = a[4] * PI / 4, cs = Math.cos(ry), sn = Math.sin(ry);
  for (const p of f.p) {
    const dx = p[1], dz = p[3], wx = x + dx * cs + dz * sn, wz = z - dx * sn + dz * cs, py = y + p[2];
    if (p[0].length > 1) { w.put(p[0], wx, wz, { s: p[4], ry, abs: py, col: f.nocol ? null : 'box', cs: 0.8 }); continue; }
    const key = { b: 'prim/box', c: 'prim/cyl', k: 'prim/cone', s: 'prim/sphere' }[p[0]];
    w.put(key, wx, wz, { s: [p[4], p[5], p[6]], ry, abs: py, tint: T(partColor(f, p, a[5])), col: f.nocol || p[8] ? null : 'box' });
  }
  if (f.light) E.lamp(x, y + f.light[0], z, f.light[1]);
  if (f.act === 'spring') E.springs.push({ x, z, p: 14, fy: a[2] });
  if (f.act) acts.push({ act: f.act, x, y: a[2], z, ry, id: f.id, c: a[5] });
}
function houseBox(w, x, y, z, sx, sy, sz, c, nocol) { w.put('prim/box', x, z, { s: [sx, sy, sz], tint: T(c), abs: y, col: nocol ? null : 'box' }); }

export function homeDef(h, owner, ownerName, mine) {
  const hs = HOUSES.find((x) => x.id === h.t) || HOUSES[0], L = layout(h, hs.id), W = hs.W, D = hs.D, Hh = hs.H, t = 0.25;
  const wallC = WALLS[L.w] || WALLS[0], floorC = FLOORS[L.f] || FLOORS[0], trim = shade(wallC, 0.7), acts = [];
  return {
    name: (mine ? 'Minha casa' : 'Casa de ' + ownerName) + ' — ' + hs.n, size: 80, surface: hs.surface, sky: hs.sky, fog: 1.2, swim: false, spawn: [-1, D / 2 + 3.2, 0], custom: true, home: true, owner, mine,
    netKey: 'h_' + owner, moodId: hs.id === 'sombria' ? 'castle' : hs.id === 'chale' ? 'snow' : hs.id === 'aero' ? 'aero' : hs.id === 'praia' ? 'island' : 'village', ambId: hs.snow ? 'snow' : hs.id === 'aero' ? 'bubble' : '', acts,
    build(w, E) {
      const half = w.half;
      w.heightFn = (x2, z2) => { const d = Math.max(Math.abs(x2), Math.abs(z2)); return d > half - 8 ? Math.min(8, (d - half + 8) * (d - half + 8) * 0.12) : 0; };
      const g1 = hs.g[0], g2 = hs.g[1];
      w.buildGround(40, (x2, z2, hh, c) => { const k = (Math.sin(x2 * 0.31) * Math.cos(z2 * 0.27) + 1) / 2, a = T(g1), b = T(g2); c[0] = (a[0] + (b[0] - a[0]) * k) * 255; c[1] = (a[1] + (b[1] - a[1]) * k) * 255; c[2] = (a[2] + (b[2] - a[2]) * k) * 255; });
      // piso com tábuas/ladrilhos
      houseBox(w, 0, 0, 0, W, 0.12, D, floorC);
      for (let i = 1; i < (hs.id === 'pool' ? W : W / 0.6); i++) { const xx = -W / 2 + i * (hs.id === 'pool' ? 1 : 0.6); houseBox(w, xx, 0.118, 0, 0.03, 0.006, D - 0.1, shade(floorC, 0.82), 1); }
      if (hs.id === 'pool') for (let j = 1; j < D; j++) houseBox(w, 0, 0.118, -D / 2 + j, W - 0.1, 0.006, 0.03, shade(floorC, 0.82), 1);
      // paredes: fundo, laterais e frente com porta (vão de 2 m)
      houseBox(w, 0, 0, -D / 2, W + t, Hh, t, wallC); houseBox(w, -W / 2, 0, 0, t, Hh, D, wallC); houseBox(w, W / 2, 0, 0, t, Hh, D, wallC);
      const sw = (W - 2) / 2; houseBox(w, -W / 2 + sw / 2, 0, D / 2, sw, Hh, t, wallC); houseBox(w, W / 2 - sw / 2, 0, D / 2, sw, Hh, t, wallC); houseBox(w, 0, 2.4, D / 2, 2.1, Hh - 2.4, t, wallC);
      houseBox(w, -1.08, 0, D / 2, 0.16, 2.5, t + 0.08, trim, 1); houseBox(w, 1.08, 0, D / 2, 0.16, 2.5, t + 0.08, trim, 1); houseBox(w, 0, 2.4, D / 2, 2.3, 0.14, t + 0.08, trim, 1);
      houseBox(w, 0, -0.1, D / 2 + 0.9, 2.6, 0.16, 1.4, shade(floorC, 0.85)); // degrau da entrada
      if (hs.rooms) { const gap = 2.2, seg = (D - gap) / 2; houseBox(w, 0, 0, -D / 2 + seg / 2, t, Hh, seg, wallC); houseBox(w, 0, 0, D / 2 - seg / 2, t, Hh, seg, wallC); houseBox(w, 0, 2.4, 0, t, Hh - 2.4, gap, wallC); }
      // rodapé e quinas
      houseBox(w, 0, 0.12, -D / 2 + t / 2 + 0.02, W - t, 0.12, 0.04, trim, 1); houseBox(w, -W / 2 + t / 2 + 0.02, 0.12, 0, 0.04, 0.12, D - t, trim, 1); houseBox(w, W / 2 - t / 2 - 0.02, 0.12, 0, 0.04, 0.12, D - t, trim, 1);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) houseBox(w, sx * W / 2, 0, sz * D / 2, t + 0.12, Hh, t + 0.12, trim, 1);
      // janelas (vidro + moldura dos dois lados)
      const glass = hs.id === 'sombria' ? 0x8a60c0 : 0xbfe8ff, win = (x2, z2, alongX) => { houseBox(w, x2, 1.0, z2, alongX ? 1.5 : t + 0.06, 1.2, alongX ? t + 0.06 : 1.5, trim, 1); houseBox(w, x2, 1.06, z2, alongX ? 1.3 : t + 0.08, 1.08, alongX ? t + 0.08 : 1.3, glass, 1); houseBox(w, x2, 1.58, z2, alongX ? 0.05 : t + 0.1, 0.04, alongX ? t + 0.1 : 1.3, trim, 1); };
      for (let i = 0; i < Math.floor(W / 4); i++) win(-W / 2 + 2 + i * (W - 4) / Math.max(1, Math.floor(W / 4) - 1), -D / 2, true);
      for (let i = 0; i < Math.floor(D / 4); i++) { const z2 = -D / 2 + 2 + i * (D - 4) / Math.max(1, Math.floor(D / 4) - 1); win(-W / 2, z2, false); win(W / 2, z2, false); }
      win(-W / 4 - 0.5, D / 2, true); win(W / 4 + 0.5, D / 2, true);
      // forro (colisão) + luz de teto
      w.addBoxC(0, Hh, 0, W + t, 0.2, D + t); w.addBoxC(0, Hh + 0.2, 0, W * 0.6, 0.6, D * 0.9); w.addBoxC(0, Hh + 0.8, 0, W * 0.25, 0.6, D * 0.9);
      E.lamp(0, Hh - 0.25, 0, 0xfff2d8); if (hs.rooms) { E.lamp(-W / 4, Hh - 0.25, 0, 0xfff2d8); E.lamp(W / 4, Hh - 0.25, 0, 0xfff2d8); }
      // quintal: caixa de correio, caminho, árvores em volta
      for (let i = 0; i < 6; i++) houseBox(w, 0, -0.08, D / 2 + 2.2 + i * 1.1, 1.2, 0.1, 0.8, shade(hs.g[0], 0.7), 1);
      houseBox(w, 2.2, 0, D / 2 + 3, 0.1, 1.1, 0.1, WDD); houseBox(w, 2.2, 1.1, D / 2 + 3, 0.5, 0.35, 0.3, 0x4aa8ff); houseBox(w, 2.48, 1.2, D / 2 + 3, 0.04, 0.3, 0.05, 0xe05050, 1);
      E.sign('🏠 ' + (mine ? 'Minha casa' : 'Casa de ' + ownerName), 0, Hh + 0.55, D / 2 + 1.3);
      for (let i = 0; i < 22; i++) { const a = i / 22 * PI * 2 + 0.3, r = Math.max(W, D) / 2 + 9 + (i * 7 % 5); const x2 = Math.cos(a) * r, z2 = Math.sin(a) * r; if (z2 > D / 2 + 1 && Math.abs(x2) < 5) continue; w.put(hs.trees, x2, z2, { s: hs.trees.indexOf('holiday') === 0 ? 2.4 : hs.trees.indexOf('grave') === 0 ? 2.6 : 4, ry: i, col: 'trunk' }); }
      E.portal('village', 6, D / 2 + 7);
      for (const a of L.it) placeItem(w, E, a, acts);
    },
    after(G, add) { // telhado/forro como malhas próprias (sem projetar sombra, para o interior não ficar escuro)
      const mat = new THREE.MeshLambertMaterial({ color: hs.roof, flatShading: true });
      const ceil = add(new THREE.Mesh(new THREE.BoxGeometry(W + t + 0.5, 0.2, D + t + 0.5), new THREE.MeshLambertMaterial({ color: shade(wallC, 0.95) }))); ceil.position.set(0, Hh + 0.1, 0); ceil.receiveShadow = true;
      if (hs.dome) { const dm = add(new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, PI * 2, 0, PI / 2), new THREE.MeshLambertMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.55, emissive: 0x204060 }))); dm.scale.set(W * 0.72, 4, D * 0.72); dm.position.y = Hh + 0.2; dm.renderOrder = 4; }
      else { const r = (W + 1) / 1.732, rg = new THREE.CylinderGeometry(r, r, D + 1, 3); rg.rotateX(-PI / 2); const rf = add(new THREE.Mesh(rg, mat)); const hgt = hs.id === 'sombria' ? 4.5 : 2.6; rf.scale.y = hgt / (1.5 * r); rf.position.y = Hh + 0.2 + r * 0.5 * rf.scale.y; rf.receiveShadow = true; }
      // globos de laser: feixes coloridos girando (a festa da ceia!)
      this.party = [];
      for (const a of acts) if (a.act === 'party') { const grp = new THREE.Group(); grp.position.set(a.x, a.y + 0.72, a.z); const cols = [0xff40d0, 0x40a0ff, 0x50ff80, 0xffe040, 0xff5050, 0xa060ff];
        for (let i = 0; i < 6; i++) { const g = new THREE.CylinderGeometry(0.02, 0.06, 7, 5, 1, true); g.translate(0, 3.5, 0); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: cols[i], transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); m.rotation.set(0.9 + (i % 2) * 0.35, i * PI / 3, 0, 'YXZ'); m.renderOrder = 7; grp.add(m); }
        add(grp); this.party.push(grp); for (const m of grp.children) G.world.extra.push(m); }
    },
    tick(dt, G) { if (this.party) for (let k = 0; k < this.party.length; k++) { const grp = this.party[k], tt = G.time; grp.rotation.y += dt * 0.9; grp.children.forEach((m, i) => { m.rotation.x = 0.75 + Math.sin(tt * 1.7 + i) * 0.4; }); } }
  };
}

// ---------- sessão / edição ----------
export const home = {
  editing: false, brush: null, rot: 0, color: 0, tool: 'place', hit: new THREE.Vector3(), hitOk: false, ghost: null, G: null, owner: null, ownerName: '', data: null, undo: [], _send: 0,
  mine() { return !!this.G && this.G.mapId === 'home' && this.owner === this.myId(); },
  myId() { return net.id || 'local'; },
  my() { if (!S.d.home || typeof S.d.home !== 'object' || !S.d.home.L) S.d.home = cleanHome(S.d.home); return S.d.home; },
  placed(id) { let n = 0; const h = this.my(); for (const k in h.L) for (const a of h.L[k].it) if (a[0] === id) n++; return n; },
  spare(id) { return (this.my().own[id] || 0) - this.placed(id); },
  cur() { const h = this.my(); return layout(h, h.t); },
  // abre a própria casa
  goMine(G) { this.G = G; this.owner = this.myId(); this.ownerName = S.name; this.data = this.my(); G.homeDef = homeDef(this.data, this.owner, S.name, true); G.travel('home'); },
  // visita a casa de outro jogador (busca na nuvem respeitando o cadeado)
  async visit(G, id, name) {
    this.G = G; if (!id || id === this.myId()) { this.goMine(G); return ''; }
    if (!net.online) return 'Offline: não dá para visitar agora';
    let r; try { r = await net.rpc('rv_home_get', { p_owner: id }); } catch (e) { return /rv_home_get|PGRST202/.test(e.message || '') ? 'O servidor ainda não tem casas (rode supabase/homes.sql)' : 'Não foi possível abrir a casa'; }
    if (!r) return 'Jogador não encontrado'; if (r.locked) return r.friends ? '🔒 ' + r.name + ' só recebe amigos' : '🔒 A casa de ' + r.name + ' está trancada';
    this.editing = false; this.owner = id; this.ownerName = String(r.name || name || 'Gato').slice(0, 16); this.data = cleanHome(r.home);
    G.homeDef = homeDef(this.data, id, this.ownerName, false); G.travel('home'); return '';
  },
  rebuild() { const G = this.G; if (!G || G.mapId !== 'home') return; const P = G.player, x = P.pos.x, y = P.pos.y, z = P.pos.z, yaw = P.yaw;
    G.homeDef = homeDef(this.data, this.owner, this.ownerName, this.owner === this.myId()); G.loadMap('home', true); P.teleport(x, y + 0.05, z, yaw); },
  changed() { S.touch(); emit('saveNow'); emit('home'); this.rebuild(); clearTimeout(this._send); this._send = setTimeout(() => this.share(), 800); },
  share() { if (this.mine() && net.online) net.send('home', { d: this.my() }); },
  // dados ao vivo do dono (quando ele decora com visitas em casa)
  remote(e) { const G = this.G; if (!G || G.mapId !== 'home' || !e || e.f !== this.owner || this.owner === this.myId()) return; this.data = cleanHome(e.d); this.rebuild(); },
  setEditing(v) { this.editing = !!v && this.mine(); if (!this.editing && this.ghost) this.ghost.visible = false; if (this.editing) S.toast(this.brush ? '✏ Decorando: ' + FURN_BY[this.brush].n + ' — gatilho coloca' : '✏ Escolha um móvel no catálogo', '#9cf09c'); emit('home'); },
  setBrush(id) { this.brush = id; this.tool = 'place'; this.setEditing(true); play('sel', 0.5); },
  // compra/troca de casa
  buyHouse(id) { const h = this.my(), hs = HOUSES.find((x) => x.id === id); if (!hs) return 'Casa inválida';
    if (h.has.indexOf(id) < 0) { const pr = S.buyPrice ? S.buyPrice(hs.price) : hs.price; if (S.d.coins < pr) return 'Faltam ' + (pr - S.d.coins) + ' moedas'; S.d.coins -= pr; h.has.push(id); emit('coins'); play('coin', 0.7); S.toast('🏠 Nova casa: ' + hs.n + '!', '#ffd76a'); S.stat && S.stat('houses'); }
    h.t = id; layout(h, id); this.changed(); return ''; },
  setWall(dir) { const l = this.cur(); l.w = (l.w + dir + WALLS.length) % WALLS.length; this.changed(); },
  setFloor(dir) { const l = this.cur(); l.f = (l.f + dir + FLOORS.length) % FLOORS.length; this.changed(); },
  setLock(v) { this.my().lock = clamp(v, 0, 2); S.touch(); emit('saveNow'); emit('home'); },
  clearAll() { const l = this.cur(); if (!l.it.length) return; this.undo.push({ all: l.it.slice() }); l.it.length = 0; this.changed(); },
  undoLast() { const u = this.undo.pop(), l = this.cur(); if (!u) return; if (u.all) l.it.push.apply(l.it, u.all); else if (u.del) { const i = l.it.indexOf(u.del); if (i >= 0) l.it.splice(i, 1); } else if (u.add) l.it.push(u.add); this.changed(); },
  aim(P, world) {
    const o = P.aimPos, d = P.aimDir, p = this.hit; p.copy(o); this.hitOk = false; const n = this._n || (this._n = new THREE.Vector3()), tv = this._t || (this._t = new THREE.Vector3());
    for (let i = 0; i < 70; i++) { p.addScaledVector(d, 0.2); tv.copy(p); if (world.collide(tv, 0.05, n)) { this.hitOk = true; this.nrm = n; break; } }
    if (this.hitOk) { p.x = Math.round(p.x * 4) / 4; p.z = Math.round(p.z * 4) / 4; const f = this.brush && FURN_BY[this.brush]; if (f && f.wall) { p.y = 0.12; if (Math.abs(n.y) < 0.5) this.rot = ((Math.round(Math.atan2(-n.x, -n.z) / (PI / 4)) % 8) + 8) % 8; } else p.y = Math.max(0, world.floorAt(p.x, p.y + 0.2, p.z)); }
    return this.hitOk;
  },
  update(G) {
    this.G = G; const on = this.editing && this.mine() && G.world && !G.uiOpen;
    if (!on) { if (this.ghost) this.ghost.visible = false; if (G.mapId !== 'home') this.editing = false; return; }
    if (!this.ghost) { this.ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x60ff90, transparent: true, opacity: 0.4, depthWrite: false, fog: false })); this.ghost.renderOrder = 9; G.scene.add(this.ghost); }
    const ok = this.aim(G.player, G.world), gh = this.ghost; gh.visible = ok; if (!ok) return;
    if (this.tool === 'erase' || !this.brush) { gh.scale.set(0.6, 0.6, 0.6); gh.position.set(this.hit.x, this.hit.y + 0.3, this.hit.z); gh.material.color.setHex(this.tool === 'erase' ? 0xff5050 : 0xffe060); return; }
    const f = FURN_BY[this.brush], can = this.spare(f.id) > 0 || S.d.coins >= f.price;
    gh.scale.set(f.sz[0], Math.max(0.05, f.sz[1]), f.sz[2]); gh.rotation.y = this.rot * PI / 4; gh.position.set(this.hit.x, this.hit.y + (f.wall || 0) + f.sz[1] / 2, this.hit.z); gh.material.color.setHex(can ? 0x60ff90 : 0xff5050);
  },
  act() {
    if (!this.hitOk) return; const l = this.cur(), h = this.hit;
    if (this.tool === 'erase' || !this.brush) {
      let best = -1, bd = 2.2; l.it.forEach((a, i) => { const f = FURN_BY[a[0]], d = Math.hypot(a[1] - h.x, a[3] - h.z) + Math.abs(a[2] + (f.wall || 0) + f.sz[1] / 2 - h.y) * 0.3; if (d < bd) { bd = d; best = i; } });
      if (best < 0) { S.toast(this.brush ? 'Nada para guardar aqui' : 'Escolha um móvel no catálogo', '#ff9a8a'); return; }
      const a = l.it.splice(best, 1)[0]; this.undo.push({ add: a }); S.toast('📦 ' + FURN_BY[a[0]].n + ' guardado (pode recolocar de graça)', '#bfe6ff'); play('close', 0.6); this.changed(); return;
    }
    if (l.it.length >= MAXI) { S.toast('Limite de ' + MAXI + ' móveis nesta casa', '#ff9a8a'); return; }
    const f = FURN_BY[this.brush], hm = this.my();
    if (this.spare(f.id) <= 0) { const pr = f.price; if (S.d.coins < pr) { S.toast('Faltam ' + (pr - S.d.coins) + ' moedas para ' + f.n, '#ff9a8a'); play('error', 0.5); return; } S.d.coins -= pr; hm.own[f.id] = (hm.own[f.id] || 0) + 1; emit('coins'); play('coin', 0.6); }
    const r2 = (v) => Math.round(v * 100) / 100, a = [f.id, r2(h.x), r2(Math.min(12, h.y)), r2(h.z), this.rot, this.color];
    l.it.push(a); this.undo.push({ del: a }); play('wood', 0.6); S.stat && S.stat('furniture'); this.changed();
  },
  key(code) { if (!this.editing) return false; if (code === 'KeyZ') this.rot = (this.rot + 7) % 8; else if (code === 'KeyX') this.rot = (this.rot + 1) % 8; else if (code === 'Delete') this.tool = this.tool === 'erase' ? 'place' : 'erase'; else if (code === 'KeyU') this.undoLast(); else return false; emit('home'); return true; },
  // sem decorar: gatilho perto de um móvel senta/deita/liga a festa
  interact(G) {
    if (G.mapId !== 'home' || !G.def || !G.def.acts) return false; const P = G.player.pos; let best = null, bd = 1.6;
    for (const a of G.def.acts) { const d = Math.hypot(a.x - P.x, a.z - P.z); if (d < bd && Math.abs(a.y - P.y) < 1.5) { bd = d; best = a; } }
    if (!best || best.act === 'spring') return false;
    if (best.act === 'party') { G.fx.burst(best.x, best.y + 1, best.z, 0xff60e0, 30, 4, 2); play('event', 0.6); S.toast('🪩 Festa!', '#ff9ad8'); G.emote(2); return true; }
    G.emote(best.act === 'sleep' ? 4 : 3); return true;
  }
};
