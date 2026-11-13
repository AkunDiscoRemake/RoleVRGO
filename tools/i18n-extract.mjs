// Extrai os textos em português do código-fonte (literais entre aspas simples) para traduzir.
import fs from 'node:fs';
const files = ['data.js', 'maps.js', 'ui.js', 'game.js', 'state.js', 'maker.js', 'cat.js', 'main.js', 'hands.js', 'rec.js', 'fx.js', 'home.js', 'maps2.js', 'infect.js', 'voice.js'];
const out = new Set();
for (const f of files) {
  const s = fs.readFileSync('src/' + f, 'utf8'); const re = /'((?:[^'\\\n]|\\.)*)'/g; let m;
  while ((m = re.exec(s))) {
    const t = m[1].replace(/\\'/g, "'").replace(/\\n/g, '\n');
    if (t.length < 2 || /[;{}=]|gl_|vec[234]|uniform|varying|sans-serif|^#|rgba?\(|^\w+\/[\w-]+$|^https?:|^[a-z_]+$|^[a-z]+:[a-z]*$|^[A-Z_]+$|^\.\/|^assets\/|\.ogg|\.png|\.js$|^rv[:_]|^p_|^realtime|^image\/|^video\/|^[a-z]+-[a-z]+$/.test(t)) continue;
    if (!/[A-Za-zÀ-ÿ]{2,}/.test(t)) continue;
    if (!/[ À-ÿ]/.test(t) && !/^[A-ZÀ-Ý][a-zà-ÿ]{2,}$/.test(t.trim().replace(/^[^A-Za-zÀ-ÿ]+/, ''))) continue;
    out.add(t);
  }
}
const list = [...out]; fs.writeFileSync(process.argv[2], JSON.stringify(list, null, 0).replace(/","/g, '",\n"'));
console.log(list.length, 'textos,', list.join('').length, 'caracteres');
