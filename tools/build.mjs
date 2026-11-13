// Compilação: esbuild + plugin que troca cada texto em português conhecido por __t('texto').
import * as esbuild from 'esbuild';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import fs from 'node:fs';
import path from 'node:path';

const dict = JSON.parse(fs.readFileSync('src/i18n-dict.json', 'utf8'));
let replaced = 0;
const i18nPlugin = {
  name: 'i18n',
  setup(build) {
    build.onLoad({ filter: /[\\/]src[\\/][^\\/]+\.js$/ }, async (args) => {
      let src = await fs.promises.readFile(args.path, 'utf8');
      if (path.basename(args.path) === 'i18n.js') return { contents: src, loader: 'js' };
      const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' }); const reps = [];
      walk.fullAncestor(ast, (node, st, anc) => {
        if (node.type !== 'Literal' || typeof node.value !== 'string' || !(node.value in dict)) return;
        const parent = anc[anc.length - 2];
        if (!parent || parent.type === 'ImportDeclaration' || parent.type === 'ExportNamedDeclaration' || parent.type === 'ExportAllDeclaration' || parent.type === 'ImportExpression') return;
        if (parent.type === 'Property' && parent.key === node && !parent.computed) return;
        if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return;
        reps.push([node.start, node.end, node.value]);
      });
      if (!reps.length) return { contents: src, loader: 'js' };
      reps.sort((a, b) => b[0] - a[0]); for (const [s, e, v] of reps) src = src.slice(0, s) + '__t(' + JSON.stringify(v) + ')' + src.slice(e);
      replaced += reps.length;
      return { contents: "import { __t } from './i18n.js';\n" + src, loader: 'js' };
    });
  }
};
const dev = process.argv.includes('--dev');
await esbuild.build({ entryPoints: ['src/main.js'], bundle: true, minify: !dev, sourcemap: dev, target: ['chrome66', 'firefox68', 'safari12'], outfile: 'dist/game.js', plugins: [i18nPlugin], logLevel: 'warning' });
console.log('dist/game.js pronto ·', replaced, 'textos traduzíveis');
