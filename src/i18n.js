import DICT from './i18n-dict.json';

// Idiomas: pt (original), en, es, ru. Os textos do código são trocados por __t('texto') na compilação
// (tools/build.mjs); a troca de idioma recarrega a página porque muitos textos são lidos uma vez só.
export const LANGS = [['pt', 'Português'], ['en', 'English'], ['es', 'Español'], ['ru', 'Русский']];
function detect() {
  try { const v = JSON.parse(localStorage.getItem('rv_lang')); if (LANGS.some((l) => l[0] === v)) return v; } catch (e) { /* sem armazenamento */ }
  const n = String((navigator.languages && navigator.languages[0]) || navigator.language || 'pt').toLowerCase();
  return n.indexOf('pt') === 0 ? 'pt' : n.indexOf('es') === 0 ? 'es' : n.indexOf('ru') === 0 ? 'ru' : 'en';
}
export const LANG = detect();
const IDX = { en: 0, es: 1, ru: 2 }[LANG];
export function __t(s) { if (IDX == null) return s; const e = DICT[s]; return e && e[IDX] ? e[IDX] : s; }
export function setLang(l) { try { localStorage.setItem('rv_lang', JSON.stringify(l)); } catch (e) { /* sem armazenamento */ } }
export function langName() { const l = LANGS.find((x) => x[0] === LANG); return l ? l[1] : LANG; }
// textos fixos do index.html (lobby)
const HTML = {
  'Mundo multiplayer VR de gatos — Gorilla Locomotion, luta, mineração e roleplay. Feito para Oculus Go e Meta Quest.': ['Multiplayer VR cat world — Gorilla Locomotion, fighting, mining and roleplay. Made for Oculus Go and Meta Quest.', 'Mundo multijugador VR de gatos — Gorilla Locomotion, lucha, minería y rol. Hecho para Oculus Go y Meta Quest.', 'Многопользовательский VR-мир котов — Gorilla Locomotion, бои, добыча и ролевая игра. Сделано для Oculus Go и Meta Quest.'],
  'Nome do seu gato': ['Your cat\'s name', 'Nombre de tu gato', 'Имя твоего кота'], 'Pelagem': ['Fur', 'Pelaje', 'Шерсть'], 'Cor de detalhe': ['Detail color', 'Color de detalle', 'Цвет деталей'], 'Olhos': ['Eyes', 'Ojos', 'Глаза'], 'Padrão': ['Pattern', 'Patrón', 'Узор'],
  'Sala': ['Room', 'Sala', 'Комната'], 'Idioma': ['Language', 'Idioma', 'Язык'], 'Código de sala privada': ['Private room code', 'Código de sala privada', 'Код закрытой комнаты'], 'Entrar': ['Join', 'Entrar', 'Войти'], '+ Criar privada': ['+ Create private', '+ Crear privada', '+ Создать закрытую'],
  'Verificando VR...': ['Checking VR...', 'Comprobando VR...', 'Проверка VR...'], '🖥 Jogar no navegador (sem VR)': ['🖥 Play in the browser (no VR)', '🖥 Jugar en el navegador (sin VR)', '🖥 Играть в браузере (без VR)'], '📱 VR Box / Cardboard (celular)': ['📱 VR Box / Cardboard (phone)', '📱 VR Box / Cardboard (móvil)', '📱 VR Box / Cardboard (телефон)'],
  'Rastrear minhas mãos pela câmera (MediaPipe) no VR Box': ['Track my hands with the camera (MediaPipe) in VR Box', 'Seguir mis manos con la cámara (MediaPipe) en VR Box', 'Отслеживать руки камерой (MediaPipe) в VR Box'], 'Carregando...': ['Loading...', 'Cargando...', 'Загрузка...'],
  'Sem cadastro: seu progresso fica ligado a este aparelho. Assets e sons: Kenney.nl (CC0). Criado por hark, programado com Claude (Anthropic) 🤖💛': ['No sign-up: your progress is tied to this device. Assets and sounds: Kenney.nl (CC0). Created by hark, coded with Claude (Anthropic) 🤖💛', 'Sin registro: tu progreso queda ligado a este dispositivo. Assets y sonidos: Kenney.nl (CC0). Creado por hark, programado con Claude (Anthropic) 🤖💛', 'Без регистрации: прогресс привязан к этому устройству. Ассеты и звуки: Kenney.nl (CC0). Автор: hark, код написан вместе с Claude (Anthropic) 🤖💛'],
  'Sobre o jogo': ['About the game', 'Sobre el juego', 'Об игре'],
  '🥽 Entrar em VR': ['🥽 Enter VR', '🥽 Entrar en VR', '🥽 Войти в VR'],
  'Clique para controlar · WASD andar · Mouse mira as patas · H = patas no mouse · Clique = gatilho · M = menu · B = menu rápido · V = câmera · R = gravar · T = teleporte · Enter = chat · Q/E esquiva · F bloquear': ['Click to control · WASD walk · Mouse aims the paws · H = paws on mouse · Click = trigger · M = menu · B = quick menu · V = camera · R = record · T = teleport · Enter = chat · Q/E dodge · F block', 'Clic para controlar · WASD andar · El ratón apunta las patas · H = patas con el ratón · Clic = gatillo · M = menú · B = menú rápido · V = cámara · R = grabar · T = teletransporte · Enter = chat · Q/E esquivar · F bloquear', 'Кликни для управления · WASD ходьба · Мышь наводит лапы · H = лапы на мыши · Клик = курок · M = меню · B = быстрое меню · V = камера · R = запись · T = телепорт · Enter = чат · Q/E уклон · F блок']
};
export function translateDOM(root) {
  if (IDX == null) return; document.documentElement.lang = LANG;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
  for (const n of nodes) { const k = n.nodeValue.trim(); if (HTML[k]) n.nodeValue = n.nodeValue.replace(k, HTML[k][IDX]); }
  root.querySelectorAll('[placeholder]').forEach((el) => { const k = el.getAttribute('placeholder'); if (HTML[k]) el.setAttribute('placeholder', HTML[k][IDX]); });
}
export function htmlT(k) { return IDX == null || !HTML[k] ? k : HTML[k][IDX]; }
