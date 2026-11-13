// Junta pt.json (textos originais) com as traduções tr*.txt -> src/i18n-dict.json { "texto pt": ["en", "es", "ru"] }
import fs from 'node:fs';
const pt = JSON.parse(fs.readFileSync('tools/i18n/pt.json', 'utf8'));
const un = (s) => s.replace(/\\"/g, '"');
const dict = {};
for (const f of fs.readdirSync('tools/i18n').filter((n) => /^tr\d+\.txt$/.test(n)).sort()) {
  for (const line of fs.readFileSync('tools/i18n/' + f, 'utf8').split('\n')) {
    if (!line.trim()) continue; const sep = line.indexOf('¦') >= 0 ? '¦' : '|'; const p = line.split(sep);
    if (p.length !== 4) { console.error('linha inválida', f, line.slice(0, 60)); continue; }
    const i = +p[0]; if (!(i in pt)) { console.error('índice inválido', i); continue; }
    dict[pt[i]] = [un(p[1]), un(p[2]), un(p[3])];
  }
}
// textos curtos que o extrator não pega (palavras soltas minúsculas e frases rápidas)
const extra = { 'Oi!': ['Hi!', '¡Hola!', 'Привет!'], 'Miau!': ['Meow!', '¡Miau!', 'Мяу!'], 'Boa!': ['Nice!', '¡Bien!', 'Отлично!'], 'Obrigado!': ['Thanks!', '¡Gracias!', 'Спасибо!'], 'Tchau!': ['Bye!', '¡Adiós!', 'Пока!'],
  'SIM': ['YES', 'SÍ', 'ДА'], 'sim': ['yes', 'sí', 'да'], 'plano': ['flat', 'plano', 'плоский'], 'suave': ['gentle', 'suave', 'мягкий'], 'forte': ['strong', 'fuerte', 'сильный'], 'nenhuma': ['none', 'ninguna', 'нет'],
  'direita': ['right', 'derecha', 'правая'], 'esquerda': ['left', 'izquierda', 'левая'], 'conectado': ['connected', 'conectado', 'подключён'], 'desligado': ['off', 'apagado', 'выкл.'], 'ativo': ['active', 'activo', 'активно'],
  '🎉 FESTA!': ['🎉 PARTY!', '🎉 ¡FIESTA!', '🎉 ВЕЧЕРИНКА!'], '👾 INVASÃO!': ['👾 INVASION!', '👾 ¡INVASIÓN!', '👾 ВТОРЖЕНИЕ!'], '💰 CHUVA DE OURO!': ['💰 GOLD RAIN!', '💰 ¡LLUVIA DE ORO!', '💰 ЗОЛОТОЙ ДОЖДЬ!'], '🗝 CAÇA AO TESOURO!': ['🗝 TREASURE HUNT!', '🗝 ¡BÚSQUEDA DEL TESORO!', '🗝 ОХОТА ЗА СОКРОВИЩАМИ!'],
  '⭐ XP EM DOBRO!': ['⭐ DOUBLE XP!', '⭐ ¡XP DOBLE!', '⭐ ДВОЙНОЙ ОПЫТ!'], '🌙 NOITE ETERNA': ['🌙 ENDLESS NIGHT', '🌙 NOCHE ETERNA', '🌙 ВЕЧНАЯ НОЧЬ'], '☀ DIA ETERNO': ['☀ ENDLESS DAY', '☀ DÍA ETERNO', '☀ ВЕЧНЫЙ ДЕНЬ'],
  '🎉 Festa · XP x2 · ': ['🎉 Party · XP x2 · ', '🎉 Fiesta · XP x2 · ', '🎉 Вечеринка · опыт x2 · '], '⭐ XP em dobro · ': ['⭐ Double XP · ', '⭐ XP doble · ', '⭐ Двойной опыт · '], '🌙 Noite eterna · ': ['🌙 Endless night · ', '🌙 Noche eterna · ', '🌙 Вечная ночь · '], '☀ Dia eterno · ': ['☀ Endless day · ', '☀ Día eterno · ', '☀ Вечный день · '],
  '💰 Chuva de Ouro · ': ['💰 Gold Rain · ', '💰 Lluvia de Oro · ', '💰 Золотой дождь · '], '👾 Invasão · onda ': ['👾 Invasion · wave ', '👾 Invasión · oleada ', '👾 Вторжение · волна '], ' inimigos · ': [' enemies · ', ' enemigos · ', ' врагов · '], '🗝 Caça ao Tesouro · ': ['🗝 Treasure Hunt · ', '🗝 Búsqueda del Tesoro · ', '🗝 Охота за сокровищами · '], ' neste mapa · ': [' on this map · ', ' en este mapa · ', ' на этой карте · '],
  '👑 ONDA FINAL: CHEFE!': ['👑 FINAL WAVE: BOSS!', '👑 OLEADA FINAL: ¡JEFE!', '👑 ПОСЛЕДНЯЯ ВОЛНА: БОСС!'], '👾 Onda ': ['👾 Wave ', '👾 Oleada ', '👾 Волна '], '🗝 Tesouro encontrado! +': ['🗝 Treasure found! +', '🗝 ¡Tesoro encontrado! +', '🗝 Сокровище найдено! +'], '🗝 Você achou todos os tesouros deste mapa!': ['🗝 You found every treasure on this map!', '🗝 ¡Encontraste todos los tesoros de este mapa!', '🗝 Ты нашёл все сокровища на этой карте!'],
  ' te mandou para a Vila': [' sent you to the Village', ' te envió a la Villa', ' отправил тебя в деревню'], ' te deu ': [' gave you ', ' te dio ', ' дал тебе '], ': eventos encerrados': [': events ended', ': eventos terminados', ': события завершены'],
  '🪐 Gravidade baixa': ['🪐 Low gravity', '🪐 Gravedad baja', '🪐 Низкая гравитация'], '⚡ Super velocidade': ['⚡ Super speed', '⚡ Supervelocidad', '⚡ Суперскорость'], '🦘 Super pulo': ['🦘 Super jump', '🦘 Supersalto', '🦘 Суперпрыжок'], '🕊 Voar': ['🕊 Fly', '🕊 Volar', '🕊 Полёт'], '❤ Curar tudo': ['❤ Full heal', '❤ Curar todo', '❤ Полное лечение'],
  '🌈 Arco-íris': ['🌈 Rainbow', '🌈 Arcoíris', '🌈 Радуга'], '✨ Brilho dourado': ['✨ Golden glow', '✨ Brillo dorado', '✨ Золотое сияние'], '🎊 Confete': ['🎊 Confetti', '🎊 Confeti', '🎊 Конфетти'], '🧊 Congelar (5 s)': ['🧊 Freeze (5 s)', '🧊 Congelar (5 s)', '🧊 Заморозка (5 с)'], '🪩 Disco': ['🪩 Disco', '🪩 Disco', '🪩 Диско'],
  'Nome reservado ao admin': ['Name reserved for the admin', 'Nombre reservado al admin', 'Имя зарезервировано за админом'],
  'META QUEST: cada pata segue o seu controle (ou a sua mão, sem controles). Encoste no chão e empurre para trás para se impulsionar.': ['META QUEST: each paw follows its controller (or your hand, without controllers). Touch the ground and push back to propel yourself.', 'META QUEST: cada pata sigue su mando (o tu mano, sin mandos). Toca el suelo y empuja hacia atrás para impulsarte.', 'META QUEST: каждая лапа следует за своим контроллером (или рукой без контроллеров). Коснись земли и оттолкнись назад.'],
  'ESCALAR: encoste as patas na parede e puxe para baixo, uma mão de cada vez. Soltar no ar lança você.': ['CLIMB: touch the wall with your paws and pull down, one hand at a time. Letting go mid-air launches you.', 'ESCALAR: apoya las patas en la pared y tira hacia abajo, una mano cada vez. Soltar en el aire te lanza.', 'ЛАЗАНИЕ: коснись лапами стены и тяни вниз, по одной руке. Отпусти в воздухе — и полетишь.'],
  'ANALÓGICO ESQUERDO: andar · DIREITO: girar 30° (empurrar para frente = mira de teleporte, solte para ir).': ['LEFT STICK: walk · RIGHT: turn 30° (push forward = teleport aim, release to go).', 'STICK IZQUIERDO: andar · DERECHO: girar 30° (empujar adelante = mira de teletransporte, suelta para ir).', 'ЛЕВЫЙ СТИК: ходьба · ПРАВЫЙ: поворот на 30° (вперёд = прицел телепорта, отпусти — перенесёт).'],
  'GATILHO: falar com NPCs, abrir baús, pescar, clicar no menu (aponte com o controle). Mãos: junte polegar e indicador.': ['TRIGGER: talk to NPCs, open chests, fish, click the menu (point with the controller). Hands: pinch thumb and index.', 'GATILLO: hablar con NPC, abrir cofres, pescar, pulsar el menú (apunta con el mando). Manos: junta pulgar e índice.', 'КУРОК: говорить с NPC, открывать сундуки, рыбачить, нажимать в меню (наводи контроллером). Руки: сведи большой и указательный.'],
  'A: pular · B: menu · X: menu rápido · Y: câmera · os dois grips: bloquear.': ['A: jump · B: menu · X: quick menu · Y: camera · both grips: block.', 'A: saltar · B: menú · X: menú rápido · Y: cámara · ambos grips: bloquear.', 'A: прыжок · B: меню · X: быстрое меню · Y: камера · оба грипа: блок.'],
  'SOCOS / MINERAR / CORTAR: bata com as mãos de verdade. Mais velocidade = mais dano.': ['PUNCH / MINE / CHOP: hit with your real hands. More speed = more damage.', 'GOLPEAR / MINAR / TALAR: golpea con tus manos de verdad. Más velocidad = más daño.', 'УДАРЫ / ДОБЫЧА / РУБКА: бей настоящими руками. Быстрее удар — больше урон.'],
};
for (const k in extra) if (!dict[k]) dict[k] = extra[k];
fs.writeFileSync('src/i18n-dict.json', JSON.stringify(dict));
console.log(Object.keys(dict).length, 'textos traduzidos');
