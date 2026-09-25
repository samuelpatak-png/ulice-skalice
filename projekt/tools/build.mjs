// Bundle the game into one self-contained page (dist/index.html) + runtime files (dist/assets, dist/data).
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const out = path.join(ROOT, 'dist');
fs.mkdirSync(out, { recursive: true });
const r = await esbuild.build({
  entryPoints: [path.join(ROOT, 'src/main.js')], bundle: true, format: 'esm', target: 'es2021', minify: !process.argv.includes('--dev'),
  write: false, legalComments: 'none', logLevel: 'warning', treeShaking: true,
  banner: { js: '/* Ulice Skalice. Includes three.js (MIT, mrdoob & contributors), n8ao (MIT, N8python), postprocessing (Zlib, vanruesc). */' },
});
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const tpl = fs.readFileSync(path.join(ROOT, 'src/index.html'), 'utf8');
const page = tpl + '\n<script type="module">\n' + js + '\n</script>\n';
fs.writeFileSync(path.join(out, 'index.html'), '<!doctype html><html lang="sk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + page);
// local test wrapper (the artifact host adds this skeleton itself)
fs.writeFileSync(path.join(out, 'test.html'), '<!doctype html><html lang="sk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>[hidden]{display:none!important}</style></head><body>' + page + '</body></html>');
fs.rmSync(path.join(out, 'assets'), { recursive: true, force: true }); fs.rmSync(path.join(out, 'data'), { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'public/assets'), path.join(out, 'assets'), { recursive: true, filter: (f) => !f.endsWith('.hdr') });
fs.mkdirSync(path.join(out, 'data'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'data/game.json'), path.join(out, 'data/game.json'));
console.log('dist/index.html', (page.length / 1024).toFixed(0) + ' KB, bundle', (js.length / 1024).toFixed(0) + ' KB');
