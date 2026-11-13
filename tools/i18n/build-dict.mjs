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
};
for (const k in extra) if (!dict[k]) dict[k] = extra[k];
fs.writeFileSync('src/i18n-dict.json', JSON.stringify(dict));
console.log(Object.keys(dict).length, 'textos traduzidos');
