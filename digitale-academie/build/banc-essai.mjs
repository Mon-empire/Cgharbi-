// Banc d'essai : sert v5/, redirige jsdelivr vers des modules locaux (three, lenis, opentype), et capture des images
// à des points précis du film (chapitre:p). Le rendu passe par SwiftShader : prévoir ~1 min de chargement.
// usage : node banc-essai.mjs sortie "hero:0,lieu:.42,campus:.4" [largeur hauteur]
//   env : Q=LOW|MEDIUM|HIGH|ULTRA (qualité), N=40 (images de stabilisation par prise), EVAL="expr" (affiche une valeur),
//         WAIT=ms (laisse finir les transitions CSS), HOVER="sélecteur" (survol avant la prise),
//         PRE="expr" (exécutée avant chaque prise, pour un test)
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = process.env.ROOT || path.resolve(HERE, '../v5');
const NM = process.env.NM || path.resolve(HERE, 'node_modules');   /* npm i three@0.169.0 lenis@1.1.13 opentype.js@1.3.4 playwright */
const [, , prefix = 'shot', spec = 'hero:0', W = '1280', H = '800'] = process.argv;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff': 'font/woff', '.mp3': 'audio/mpeg' };
const srv = http.createServer((q, s) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!fs.existsSync(f)) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s);
}).listen(0);
const port = srv.address().port;

const CDN = 'https://cdn.jsdelivr.net/npm/';
function vendor(url) {
  let rel = url.slice(CDN.length).replace(/\/\+esm$/, '');
  let file, base;
  if (rel === 'three@0.169.0') file = 'three/build/three.module.js';
  else if (rel.startsWith('three@0.169.0/')) file = 'three/' + rel.slice('three@0.169.0/'.length);
  else if (rel.startsWith('lenis@1.1.13/')) file = 'lenis/' + rel.slice('lenis@1.1.13/'.length);
  else if (rel.startsWith('opentype.js@1.3.4/')) file = 'opentype.js/' + rel.slice('opentype.js@1.3.4/'.length);
  let src = fs.readFileSync(path.join(NM, file), 'utf8');
  const dir = url.replace(/\/\+esm$/, '').replace(/[^/]+$/, '');
  src = src.replace(/(from\s*|import\s*\(?\s*)(['"])([^'"]+)\2/g, (m, a, qq, spec) => {
    if (spec === 'three') return `${a}${qq}${CDN}three@0.169.0/+esm${qq}`;
    if (spec.startsWith('.')) return `${a}${qq}${new URL(spec, dir).href}/+esm${qq}`;
    return m;
  });
  return src;
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', m => { if (m.type() !== 'debug') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
await page.addInitScript(() => { const raf = window.requestAnimationFrame.bind(window); const q = []; window.__pauseRAF = false; window.requestAnimationFrame = cb => { if (window.__pauseRAF) { q.push(cb); return 0; } return raf(cb); }; window.__resumeRAF = () => { window.__pauseRAF = false; q.splice(0).forEach(cb => raf(cb)); }; });
await page.route(CDN + '**', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: vendor(r.request().url()) }));
await page.goto(`http://localhost:${port}/index.html?qualite=${process.env.Q || 'MEDIUM'}`);
await page.waitForFunction(() => window.__v2 && window.__v2.scenes && window.__v2.scenes.terr, null, { timeout: 120000 });
await page.waitForTimeout(1500);
await page.evaluate(() => { window.__pauseRAF = true; });
await page.waitForTimeout(500);
await page.evaluate(() => { window.__v2.introAt = 5; });
for (const item of spec.split(',')) {
  const [ch, p] = item.split(':');
  await page.evaluate(([ch, p]) => {
    const el = document.querySelector(`[data-ch="${ch}"]`);
    const top = el.getBoundingClientRect().top + scrollY, TOP = parseFloat(getComputedStyle(document.getElementById('da-experience')).getPropertyValue('--top')) || 0;
    const y = top - TOP + (el.offsetHeight - (innerHeight - TOP)) * p;
    window.__v2Lenis?.stop?.();
    scrollTo(0, y);
  }, [ch, +p]);
  if (process.env.HOVER) { await page.evaluate(() => window.__v2.settle(20)); await page.hover(process.env.HOVER, { force: true }); }
  if (process.env.PRE) await page.evaluate(process.env.PRE);
  const t0 = Date.now();
  await page.evaluate(n => window.__v2.settle(n), +(process.env.N || 40));
  process.stderr.write(`settle ${Date.now() - t0}ms\n`);
  if (process.env.WAIT) { await page.waitForTimeout(+process.env.WAIT); await page.evaluate(() => window.__v2.settle(3)); }
  const name = `${prefix}-${ch}-${p}.png`;
  await page.screenshot({ path: name, timeout: 240000 });
  const st = await page.evaluate(() => JSON.stringify(window.__v2.state));
  console.log(name, st.slice(0, 160));
  if (process.env.EVAL) console.log('EVAL', await page.evaluate(process.env.EVAL));
}
console.log(logs.filter(l => !/GPU stall|swiftshader|WebGL-/.test(l)).slice(0, 30).join('\n'));
await browser.close(); srv.close();
