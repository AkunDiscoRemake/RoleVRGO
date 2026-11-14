// Runtime dos scripts (roda DENTRO de um iframe sandbox, sem acesso ao jogo, à conta ou ao login).
// Fala com o jogo só por postMessage. Traz uma API no estilo Roblox (Instance, Vector3, Color3, Signals,
// game:GetService, task.wait...) escrita em Lua sobre o fengari (Lua 5.3), mais um conversor "Luau-lite".

// ---------- Luau-lite -> Lua 5.3 ----------
export function luauToLua(src) {
  let s = String(src).replace(/\r/g, '');
  // declarações de tipo (type X = ... / export type X = {...}, também em várias linhas) somem
  s = s.replace(/^[ \t]*(export[ \t]+)?type[ \t]+[A-Za-z_]\w*(<[^>\n]*>)?[ \t]*=/gm, (m, ex, gen, off) => '\u0000TYPE');
  while (s.includes('\u0000TYPE')) { const i = s.indexOf('\u0000TYPE'); let j = i + 5, depth = 0; for (; j < s.length; j++) { const ch = s[j]; if (ch === '{' || ch === '(') depth++; else if (ch === '}' || ch === ')') depth--; else if (ch === '\n' && depth <= 0) break; } s = s.slice(0, i) + '-- (tipo removido)' + s.slice(j); }
  // generics na declaração de funções: function f<T>(x: T) / local function g<T, U>()
  s = s.replace(/\bfunction([ \t]+[\w.:]+)[ \t]*<[^>()\n]*>/g, 'function$1');
  // anotações de tipo em locais e parâmetros: local x: number = 1 / function f(a: number, b: {string}): boolean
  s = s.replace(/\blocal\s+([A-Za-z_]\w*)\s*:\s*[^=\n]+?\s*=(?!=)/g, 'local $1 =').replace(/\blocal\s+([A-Za-z_]\w*)\s*:\s*[A-Za-z_{][^\n=]*$/gm, 'local $1');
  s = s.replace(/\bfunction([ \t]+[\w.:]*)?[ \t]*\(([^)\n]*)\)([ \t]*:[ \t]*(?:\([^)\n]*\)|[A-Za-z_{][\w.?<>{}\[\]]*)(?:[ \t]*\|[ \t]*[\w.?<>{}()\[\]]+)*)?/g, (m, name, params) => 'function' + (name || '') + '(' + params.replace(/\s*:\s*[^,]+/g, '') + ')');
  // atribuição composta (em qualquer lugar da linha): x += 1  ->  x = x + (1)
  s = compound(s);
  // continue -> goto (só dentro de laços simples: "continue" vira "goto continue" e o rótulo é posto antes do "end" do laço)
  if (/\bcontinue\b/.test(s)) s = addContinue(s);
  // if como expressão (uma linha): = if a then b elseif c then d else e
  s = s.replace(/(=|\breturn|\(|,|\{)([ \t]*)if[ \t]+(.+?)[ \t]+then[ \t]+(.+?)[ \t]+else[ \t]+([^\n]+?)(?=[ \t]*(\)[^\n]*$|,|\}|\n|$))/gm, (m, pre, sp, cond, a, b) => { if (/\bend\b|\bdo\b/.test(a + b)) return m; const ei = a.split(/[ \t]+elseif[ \t]+/); let body = 'if ' + cond + ' then return ' + ei[0]; for (const part of ei.slice(1)) { const q = part.split(/[ \t]+then[ \t]+/); body += ' elseif ' + q[0] + ' then return ' + q[1]; } return pre + sp + '(function() ' + body + ' else return ' + b + ' end end)()'; });
  // `texto {x}` (interpolação do Luau) -> "texto " .. tostring(x)
  s = s.replace(/`([^`\n]*)`/g, (m, body) => '(' + body.split(/(\{[^}]*\})/).filter((p) => p !== '').map((p) => (p[0] === '{' ? 'tostring(' + p.slice(1, -1) + ')' : JSON.stringify(p))).join(' .. ') + ')');
  return s;
}
// acha o fim de uma expressão Lua a partir de i (operandos, chamadas, índices, operadores binários)
function exprEnd(s, i) {
  const ws = () => { while (i < s.length && /[ \t]/.test(s[i])) i++; };
  const BIN = /^(\.\.|==|~=|<=|>=|\/\/|and\b|or\b|[-+*\/%^<>])/;
  const group = (open, close) => { let d = 0; for (; i < s.length; i++) { const c = s[i]; if (c === '"' || c === "'") { const q = c; i++; while (i < s.length && s[i] !== q) { if (s[i] === '\\') i++; i++; } continue; } if (c === open) d++; else if (c === close) { d--; if (!d) { i++; return; } } } };
  for (let guard = 0; guard < 200; guard++) {
    ws(); while (/^(not\b|-|#)/.test(s.slice(i))) { i += s.slice(i).match(/^(not\b|-|#)/)[0].length; ws(); }
    const r = s.slice(i); let m;
    if ((m = r.match(/^(\d[\w.]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|true\b|false\b|nil\b|\.\.\.)/))) i += m[0].length;
    else if ((m = r.match(/^[A-Za-z_]\w*/))) i += m[0].length;
    else if (r[0] === '(') group('(', ')'); else if (r[0] === '{') group('{', '}'); else return i;
    for (;;) { const t = s.slice(i); if ((m = t.match(/^[ \t]*\.[A-Za-z_]\w*/))) { i += m[0].length; continue; } if ((m = t.match(/^[ \t]*:[A-Za-z_]\w*[ \t]*/))) { i += m[0].length; if (s[i] === '(') group('(', ')'); else if (s[i] === '{') group('{', '}'); continue; }
      if (/^\[/.test(t)) { group('[', ']'); continue; } if (/^\(/.test(t)) { group('(', ')'); continue; } break; }
    const save = i; ws(); const t = s.slice(i); if ((m = t.match(BIN)) && !/^-[-]/.test(t)) { i += m[0].length; continue; } return save;
  }
  return i;
}
function compound(s) {
  const re = /(^|[\n;]|\bthen\b|\bdo\b|\belse\b|\)|\bend\b)([ \t]*)([A-Za-z_][\w]*(?:\.[A-Za-z_]\w*|\[[^\]\n]+\])*)[ \t]*(\+|-|\*|\/\/|\/|%|\^|\.\.)=(?!=)[ \t]*/g;
  let out = '', last = 0, m;
  while ((m = re.exec(s))) { const st = m.index + m[1].length + m[2].length, rhsStart = re.lastIndex, end = exprEnd(s, rhsStart);
    out += s.slice(last, st) + m[3] + ' = ' + m[3] + ' ' + m[4] + ' (' + s.slice(rhsStart, end).trim() + ')'; last = end; re.lastIndex = end; }
  return out + s.slice(last);
}
function addContinue(s) {
  const lines = s.split('\n'), stack = [], out = lines.slice();
  const opens = (l) => (l.match(/\b(function|do|then|repeat)\b/g) || []).length, closes = (l) => (l.match(/\b(end|until)\b/g) || []).length;
  lines.forEach((l, i) => { const code = l.replace(/--.*$/, '').replace(/"[^"]*"|'[^']*'/g, '""'); const loop = /\b(for|while)\b.*\bdo\b/.test(code);
    let o = opens(code), c = closes(code); if (loop) { stack.push({ loop: true, used: false }); o--; } for (let k = 0; k < o; k++) stack.push({ loop: false });
    if (/\bcontinue\b/.test(code)) { for (let k = stack.length - 1; k >= 0; k--) if (stack[k].loop) { stack[k].used = true; stack[k].id = stack[k].id || 'continue_' + i; out[i] = out[i].replace(/\bcontinue\b/, 'goto ' + stack[k].id); break; } }
    for (let k = 0; k < c; k++) { const f = stack.pop(); if (f && f.loop && f.used) out[i] = out[i].replace(/\bend\b(?!.*\bend\b)/, '::' + f.id + ':: end'); } });
  return out.join('\n');
}

export { PRELUDE } from './prelude.js';

// ---------- o que roda dentro do iframe ----------
export function iframeBoot() {
  // (esta função é convertida em texto e colocada no srcdoc do iframe)
  const post = (m) => parent.postMessage(Object.assign({ __rv: 1 }, m), '*');
  let dispatch = null, budget = 0;
  window.__rvhost = {
    emit(op, id, k, t, v) { post({ op, id, k, t, v: v && typeof v === 'object' && v.length != null ? Array.from(v) : v }); },
    setDispatch(f) { dispatch = f; }
  };
  const run = (name, code) => { try { const f = fengari.load(code, '@' + name); f(); return true; } catch (e) { post({ op: 'print', id: 'error', k: '[' + name + '] ' + (e && e.message ? e.message : String(e)) }); return false; } };
  const call = (m) => { try { dispatch(m[0], m[1], m[2], m[3], m[4], m[5], m[6]); } catch (e) { post({ op: 'print', id: 'error', k: String(e && e.message || e) }); } };
  addEventListener('message', (ev) => { const m = ev.data; if (!m || !m.__rvh) return;
    if (m.op === 'boot') { window.__RV_CTX = m.ctx; if (!run('RoleVRGO', m.prelude)) return; for (const x of m.pre || []) call(x); for (const md of m.modules || []) call(['module', md.n, md.src]); for (const s of m.scripts) run(s.n, '__spawn(function(...) ' + s.src + '\nend)'); post({ op: 'ready' }); return; } // o corpo do script roda numa corrotina (pode usar task.wait/WaitForChild)
    if (!dispatch) return; const t0 = performance.now();
    if (m.op === 'batch') for (const x of m.list) call(x); else call([m.op, m.a, m.b, m.c, m.d, m.e, m.f]);
    budget += performance.now() - t0; });
  setInterval(() => { if (budget > 600) post({ op: 'print', id: 'warn', k: 'Scripts pesados: ' + Math.round(budget) + ' ms no último segundo' }); budget = 0; }, 1000);
}
