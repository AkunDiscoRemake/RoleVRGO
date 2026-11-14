// ZIP mínimo (sem bibliotecas): lê "stored" e "deflate" com DecompressionStream e grava sem compressão.
// E monta um mod a partir de arquivos soltos ou de um .zip: HTML + CSS + JS (+ imagens) viram uma página única.
const td = new TextDecoder(), te = new TextEncoder();
export async function unzip(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), out = {}; let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('arquivo .zip inválido');
  const n = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break; const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = td.decode(u8.subarray(p + 46, p + 46 + nlen)); p += 46 + nlen + elen + clen;
    if (name.endsWith('/') || /(^|\/)(__MACOSX|\.DS_Store)/.test(name)) continue;
    const lo = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true), data = u8.subarray(lo, lo + csize);
    if (method === 0) out[name] = data.slice(); else if (method === 8) out[name] = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()); else throw new Error('compressão não suportada em ' + name);
  }
  return out;
}
const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (d) => { let c = 0xffffffff; for (let i = 0; i < d.length; i++) c = crcT[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export function zip(files) { // files: { 'pasta/nome.ext': string | Uint8Array }
  const parts = [], cent = []; let off = 0;
  for (const name in files) { const data = typeof files[name] === 'string' ? te.encode(files[name]) : files[name], nm = te.encode(name), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(h.buffer), nm, data);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    cent.push(new Uint8Array(c.buffer), nm); off += 30 + nm.length + data.length; }
  const csz = cent.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22)); const cnt = Object.keys(files).length;
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, cnt, true); e.setUint16(10, cnt, true); e.setUint32(12, csz, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...cent, new Uint8Array(e.buffer)], { type: 'application/zip' });
}
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', json: 'application/json' };
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768)); return btoa(s); };
// arquivos (nome -> bytes) -> { scripts: [{n, src}], mods: [{n, html}] }
export function bundle(files, baseName) {
  const txt = {}, bin = {}; for (const k in files) { const ext = k.split('.').pop().toLowerCase(); if (/^(html?|css|js|mjs|lua|luau|txt|json)$/.test(ext)) txt[k] = td.decode(files[k]); else bin[k] = files[k]; }
  const base = (k) => k.split('/').pop(), find = (ref, from) => { const r = ref.replace(/^\.\//, ''); const dir = from.includes('/') ? from.slice(0, from.lastIndexOf('/') + 1) : ''; return [dir + r, r].find((c) => c in txt || c in bin) || Object.keys({ ...txt, ...bin }).find((k) => base(k) === base(r)); };
  const kindOf = (k) => (/\.server\.(lua|luau)$/i.test(k) ? 'server' : /\.(module)\.(lua|luau)$/i.test(k) || /(^|\/)ModuleScript/i.test(k) ? 'module' : 'client');
  const scripts = Object.keys(txt).filter((k) => /\.(lua|luau)$/i.test(k)).map((k) => ({ n: base(k).replace(/(\.(server|client|module))?\.(lua|luau)$/i, ''), k: kindOf(k), src: txt[k] }));
  const mods = []; const htmls = Object.keys(txt).filter((k) => /\.html?$/i.test(k)).sort((a, b) => (/index\.html?$/i.test(b) ? 1 : 0) - (/index\.html?$/i.test(a) ? 1 : 0));
  const inlineAssets = (html, from) => html.replace(/(src|href)=["']([^"':]+\.(png|jpe?g|gif|webp|svg|mp3|ogg|wav))["']/gi, (m, attr, ref, ext) => { const k = find(ref, from); return k && bin[k] ? attr + '="data:' + MIME[ext.toLowerCase()] + ';base64,' + b64(bin[k]) + '"' : m; });
  const used = new Set();
  for (const h of htmls.slice(0, 1)) { let html = txt[h];
    html = html.replace(/<link[^>]+href=["']([^"']+\.css)["'][^>]*>/gi, (m, ref) => { const k = find(ref, h); if (!k || !(k in txt)) return m; used.add(k); return '<style>\n' + txt[k] + '\n</style>'; });
    html = html.replace(/<script([^>]*)src=["']([^"']+\.m?js)["']([^>]*)><\/script>/gi, (m, a, ref, b) => { const k = find(ref, h); if (!k || !(k in txt)) return m; used.add(k); return '<script' + a + b + '>\n' + txt[k].replace(/<\/script/gi, '<\\/script') + '\n</script>'; });
    mods.push({ n: baseName || base(h).replace(/\.html?$/i, ''), html: inlineAssets(html, h) }); }
  // CSS/JS soltos (sem HTML, ou não usados pelo HTML) viram um mod próprio
  const looseCss = Object.keys(txt).filter((k) => /\.css$/i.test(k) && !used.has(k)), looseJs = Object.keys(txt).filter((k) => /\.m?js$/i.test(k) && !used.has(k));
  if (looseCss.length || looseJs.length) mods.push({ n: baseName || (looseJs[0] ? base(looseJs[0]) : base(looseCss[0])).replace(/\.\w+$/, ''), html: '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent;color:#fff;font-family:sans-serif}</style>' + looseCss.map((k) => '<style>\n' + txt[k] + '\n</style>').join('') + '</head><body>' + looseJs.map((k) => '<script>\n' + txt[k].replace(/<\/script/gi, '<\\/script') + '\n</script>').join('') + '</body></html>' });
  return { scripts, mods };
}
