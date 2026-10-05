// Affiche de démarrage : rend la première image de l'ouverture (héro p = 0, avant la naissance du logo), interface masquée.
// usage : node affiche.mjs sortie 1600 1080   (puis convertir en JPEG vers v5/assets/img/seuil-poster.jpg ; portrait : 760 1640)
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = process.env.ROOT || path.resolve(HERE, '../v5');
const NM = process.env.NM || path.resolve(HERE, 'node_modules');
const [, , prefix = 'poster', W = '1600', H = '1080'] = process.argv;
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
await page.evaluate(() => { window.__v2.introAt = 0; const st = document.createElement('style'); st.textContent = '.v2-stage,.v2-nav,.v2-ctrl,.v2-inter,.v2-status{visibility:hidden!important}'; document.head.append(st); scrollTo(0, 0); });
await page.evaluate(() => window.__v2.settle(60));
await page.locator('canvas.v2-gl').screenshot({ path: prefix + '.png', timeout: 240000 });
console.log('poster', prefix);
console.log(logs.filter(l => !/GPU stall|swiftshader|WebGL-/.test(l)).slice(0, 30).join('\n'));
await browser.close(); srv.close();
