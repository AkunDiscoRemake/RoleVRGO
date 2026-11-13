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
};
for (const k in extra) if (!dict[k]) dict[k] = extra[k];
fs.writeFileSync('src/i18n-dict.json', JSON.stringify(dict));
console.log(Object.keys(dict).length, 'textos traduzidos');
