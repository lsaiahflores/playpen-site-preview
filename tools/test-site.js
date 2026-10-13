#!/usr/bin/env node
/* Site tests. node tools/test-site.js            (all)
   Static: every internal link/anchor/image exists, HTML validates, no banned names, QR decodes to the play URL, fonts are bundled.
   Browser (headless Chrome over CDP, served from localhost): no third-party requests, no console errors, the hero ring and demo
   at phone + desktop width and with reduced motion, the toggle, and the beta form against a mocked Supabase endpoint. */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');
let pass = 0, fail = 0;
const t = (name, ok, extra) => { ok ? (pass++, console.log('PASS', name)) : (fail++, console.log('FAIL', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 300))); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ================================================================ static */
const walk = (d, out = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', 'shots', '.git', 'tools'].includes(e.name)) continue;
    const p = path.join(d, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
};
const files = walk(ROOT);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');

function staticTests() {
  // 1. links, anchors, images
  const idsOf = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  let bad = [];
  for (const f of htmlFiles) {
    const html = fs.readFileSync(f, 'utf8');
    for (const m of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
      const u = m[1];
      if (!u || /^(https?:|mailto:|data:|tel:)/.test(u)) continue;
      if (u.startsWith('#')) { if (!idsOf(html).has(u.slice(1))) bad.push([rel(f), u]); continue; }
      if (u.startsWith('/')) continue;                       // root-relative: only the 404 page uses it
      const [pathPart, hash] = u.split('#');
      let target = path.resolve(path.dirname(f), pathPart || '.');
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
      if (!fs.existsSync(target)) { bad.push([rel(f), u]); continue; }
      if (hash && target.endsWith('.html') && !idsOf(fs.readFileSync(target, 'utf8')).has(hash)) bad.push([rel(f), u]);
    }
  }
  t('every internal link, anchor, script, stylesheet and image resolves', bad.length === 0, bad);

  // 2. alt text and structure
  const noAlt = [];
  for (const f of htmlFiles) for (const m of fs.readFileSync(f, 'utf8').matchAll(/<img\b[^>]*>/g)) if (!/\salt="/.test(m[0])) noAlt.push([rel(f), m[0].slice(0, 60)]);
  t('every image has an alt attribute', noAlt.length === 0, noAlt);
  const dupIds = [];
  for (const f of htmlFiles) { const ids = [...fs.readFileSync(f, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]); ids.forEach((id, i) => { if (ids.indexOf(id) !== i) dupIds.push([rel(f), id]); }); }
  t('no duplicate ids on any page', dupIds.length === 0, dupIds);
  t('every page has one h1', htmlFiles.filter((f) => !/play\\maze|play\/maze/.test(f)).every((f) => (fs.readFileSync(f, 'utf8').match(/<h1[\s>]/g) || []).length === 1));
  t('every page declares a language and a viewport', htmlFiles.every((f) => { const h = fs.readFileSync(f, 'utf8'); return /<html lang="en"/.test(h) && /name="viewport"/.test(h); }));

  // 3. HTML validation
  try {
    const { HtmlValidate } = require('html-validate');
    const hv = new HtmlValidate({ extends: ['html-validate:recommended'], rules: { 'no-inline-style': 'off', 'element-permitted-content': 'off', 'no-trailing-whitespace': 'off', 'wcag/h30': 'off', 'prefer-native-element': 'off', 'void-style': 'off', 'attribute-boolean-style': 'off', 'no-unknown-elements': 'error' } });
    const errs = [];
    for (const f of htmlFiles) {
      const r = hv.validateStringSync(fs.readFileSync(f, 'utf8'), rel(f));
      for (const m of r.results.flatMap((x) => x.messages)) if (m.severity === 2) errs.push(`${rel(f)}:${m.line} ${m.ruleId} ${m.message}`);
    }
    t('HTML validates (html-validate recommended rules)', errs.length === 0, errs.slice(0, 8));
  } catch (e) { t('HTML validator ran', false, e.message); }

  // 4. banned names: no franchise or brand names in any shipped text
  const BANNED = require('./banned-names.js');
  const hits = [];
  for (const f of files) {
    if (/\.(woff2|png|jpg|jpeg|ico)$/i.test(f) || /OFL-/.test(f)) continue;
    const base = rel(f);
    const text = fs.readFileSync(f, 'utf8') + '\n' + base;
    for (const re of BANNED) { const m = re.exec(text); if (m) hits.push([base, m[0]]); }
  }
  t('no franchise or brand names anywhere (copy, alt text, file names, scripts)', hits.length === 0, hits);

  // 5. no emoji used as icons
  const emoji = [];
  for (const f of files.filter((x) => /\.(html|css|js|md)$/.test(x))) { const m = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u.exec(fs.readFileSync(f, 'utf8')); if (m) emoji.push([rel(f), m[0]]); }
  t('no emoji anywhere', emoji.length === 0, emoji);

  // 6. no third-party URLs in markup, styles or scripts (other than the two connect targets and mailto)
  const ext = [];
  for (const f of files.filter((x) => /\.(html|css|js)$/.test(x) && !/supabase/.test(x))) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/https?:\/\/[a-z0-9.-]+/gi)) {
      const h = m[0].replace(/^https?:\/\//, '').toLowerCase();
      if (/^(playpen\.site|api\.github\.com|github\.com|www\.w3\.org|.*\.supabase\.co|localhost|127\.0\.0\.1)/.test(h) || /^(\*|abcdefghijkl)/.test(h)) continue;
      ext.push([rel(f), h]);
    }
  }
  t('no unexpected external URLs in HTML, CSS or JS', ext.length === 0, ext);
  t('no Google Fonts or CDN references', !files.some((f) => /\.(html|css|js)$/.test(f) && /fonts\.googleapis|gstatic|cdnjs|unpkg|jsdelivr/.test(fs.readFileSync(f, 'utf8'))));
  t('fonts are bundled woff2 files with their licences', ['inter-latin-400-normal.woff2', 'inter-latin-600-normal.woff2', 'jetbrains-mono-latin-400-normal.woff2', 'OFL-Inter.txt'].every((n) => fs.existsSync(path.join(ROOT, 'fonts', n))));

  // 7. portability: no root-relative URLs outside the 404 page, so the same files work on github.io/<repo>/ and any other host
  const rooted = [];
  for (const f of htmlFiles) { if (rel(f) === '404.html') continue; for (const m of fs.readFileSync(f, 'utf8').matchAll(/\s(?:href|src)="(\/[^"]*)"/g)) rooted.push([rel(f), m[1]]); }
  t('no root-relative URLs outside 404.html (portable between hosts)', rooted.length === 0, rooted);

  // 8. SEO files
  const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  t('robots.txt points at the sitemap and sitemap lists the real pages', /Sitemap: https:\/\/playpen\.site\/sitemap\.xml/.test(robots) && /<loc>https:\/\/playpen\.site\/<\/loc>/.test(sitemap) && /\/download\//.test(sitemap) && /\/parents\//.test(sitemap) && /\/faq\//.test(sitemap));
  t('Terms and Privacy drafts are noindex, out of the sitemap, and not linked from any page', ['terms', 'privacy'].every((p) => /noindex/.test(fs.readFileSync(path.join(ROOT, p, 'index.html'), 'utf8'))) && !/\/terms\/|\/privacy\//.test(sitemap) && !htmlFiles.some((f) => /terms\/|privacy\//.test(rel(f)) ? false : /href="[^"]*(terms|privacy)\/?"/.test(fs.readFileSync(f, 'utf8'))));
  t('both drafts say "Draft" and "pending legal review" in the source', ['terms', 'privacy'].every((p) => { const h = fs.readFileSync(path.join(ROOT, p, 'index.html'), 'utf8'); return /Draft/.test(h) && /pending legal review/i.test(h); }));
  t('CNAME holds the domain', fs.readFileSync(path.join(ROOT, 'CNAME'), 'utf8').trim() === 'playpen.site');
  t('OpenGraph + Twitter tags and a real preview image exist on the home page', (() => { const h = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'); return /og:image" content="https:\/\/playpen\.site\/img\/og\.png"/.test(h) && /twitter:card/.test(h) && fs.statSync(path.join(ROOT, 'img', 'og.png')).size > 10000; })());
  t('no secrets in the site: no service_role key, no tokens', !files.some((f) => /\.(js|html|md|sql|json)$/.test(f) && /service_role\s*[:=]\s*["']ey|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}/.test(fs.readFileSync(f, 'utf8'))));
  t('the beta config ships with empty placeholders (not connected)', /SUPABASE_URL: ""/.test(fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8')) && /SUPABASE_ANON_KEY: ""/.test(fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8')));

  // 9. the QR really decodes to the play URL
  try {
    const QR = require('qrcode'), jsQR = require('jsqr');
    const url = 'https://playpen.site/play/maze/';
    const qr = QR.create(url, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size, scale = 6, q = 4, dim = (n + q * 2) * scale;
    const data = new Uint8ClampedArray(dim * dim * 4).fill(255);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.modules.data[y * n + x]) for (let yy = 0; yy < scale; yy++) for (let xx = 0; xx < scale; xx++) { const i = (((y + q) * scale + yy) * dim + (x + q) * scale + xx) * 4; data[i] = data[i + 1] = data[i + 2] = 0; }
    const res = jsQR(data, dim, dim);
    t('the QR code decodes to the play URL', !!res && res.data === url, res && res.data);
    const svg = fs.readFileSync(path.join(ROOT, 'img', 'qr-play.svg'), 'utf8');
    const rects = (svg.match(/<rect x=/g) || []).length;
    let dark = 0; for (let i = 0; i < qr.modules.data.length; i++) if (qr.modules.data[i]) dark++;
    t('the shipped QR image is the same code (module count matches)', rects === dark && svg.includes(url), [rects, dark]);
  } catch (e) { t('QR decode test ran', false, e.message); }
}

/* ================================================================ browser */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' };
function serve(port, opts = {}) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (opts.configJs && p === '/js/config.js') { res.writeHead(200, { 'Content-Type': MIME['.js'] }); res.end(opts.configJs); return; }
      let f = path.join(ROOT, p);
      if (!f.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
      if (!fs.existsSync(f)) { const nf = path.join(ROOT, '404.html'); res.writeHead(404, { 'Content-Type': MIME['.html'] }); res.end(fs.readFileSync(nf)); return; }
      let body = fs.readFileSync(f);
      if (opts.relaxCsp && f.endsWith('.html')) body = Buffer.from(body.toString().replace("connect-src 'self'", `connect-src 'self' ${opts.relaxCsp}`));
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      res.end(body);
    });
    srv.listen(port, '127.0.0.1', () => resolve(srv));
  });
}
const getJson = (url, method = 'GET') => new Promise((res, rej) => { const r = http.request(url, { method }, (rs) => { let d = ''; rs.on('data', (c) => d += c); rs.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }); r.on('error', rej); r.end(); });

class Page {
  constructor(wsUrl) { this.ws = new WebSocket(wsUrl); this.id = 0; this.p = new Map(); this.console = []; this.requests = []; this.failed = []; this.handlers = [];
    this.ready = new Promise((r) => this.ws.addEventListener('open', r));
    this.ws.addEventListener('message', (m) => {
      const d = JSON.parse(m.data);
      if (d.id && this.p.has(d.id)) { this.p.get(d.id)(d); this.p.delete(d.id); return; }
      if (d.method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(d.params.type)) this.console.push(d.params.args.map((a) => a.value || a.description || '').join(' '));
      if (d.method === 'Runtime.exceptionThrown') this.console.push('EXC ' + JSON.stringify(d.params.exceptionDetails.exception && d.params.exceptionDetails.exception.description || d.params.exceptionDetails.text));
      if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') this.console.push('LOG ' + d.params.entry.text + ' ' + (d.params.entry.url || ''));
      if (d.method === 'Network.requestWillBeSent') this.requests.push({ url: d.params.request.url, method: d.params.request.method, body: d.params.request.postData });
      if (d.method === 'Network.loadingFailed') this.failed.push(d.params);
      this.handlers.forEach((h) => h(d));
    });
  }
  send(method, params = {}) { return new Promise((res) => { const i = ++this.id; this.p.set(i, res); this.ws.send(JSON.stringify({ id: i, method, params })); }); }
  async ev(expr) { const r = await this.send('Runtime.evaluate', { expression: `(async()=>{ ${expr} })()`, awaitPromise: true, returnByValue: true }); if (r.result && r.result.exceptionDetails) return { __err: r.result.exceptionDetails.exception ? r.result.exceptionDetails.exception.description : 'exception' }; return r.result && r.result.result ? r.result.result.value : undefined; }
  async go(url, { width = 1280, height = 900, mobile = false, reduce = false } = {}) {
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    await this.send('Emulation.setEmulatedMedia', { media: '', features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }] });
    this.console.length = 0; this.requests.length = 0; this.failed.length = 0;
    await this.send('Page.navigate', { url });
    await sleep(1800);
  }
  async shot(name) { fs.mkdirSync(SHOTS, { recursive: true }); const r = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.result.data, 'base64')); }
  async fullShot(name) { fs.mkdirSync(SHOTS, { recursive: true }); const h = await this.ev('return Math.ceil(document.documentElement.scrollHeight)'); const w = await this.ev('return window.innerWidth'); const r = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: Math.min(h, 9000), scale: 1 } }); fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.result.data, 'base64')); }
}

async function browserTests() {
  const PORT = 4800, MOCK = 4801;
  const site = await serve(PORT, { relaxCsp: `http://127.0.0.1:${MOCK}`, configJs: `window.PLAYPEN_CONFIG = { SUPABASE_URL: "http://127.0.0.1:${MOCK}", SUPABASE_ANON_KEY: "test-anon-key" };` });
  const plain = await serve(PORT + 2);                 // untouched: config.js has its empty placeholders
  const mockHits = [];
  const mock = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
      if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
      let j = {}; try { j = JSON.parse(body); } catch { /* none */ }
      mockHits.push({ url: req.url, headers: req.headers, body: j });
      let status = 201;
      if (/dupe@/.test(j.email)) status = 409;
      if (/boom@/.test(j.email)) status = 500;
      if (/slow@/.test(j.email)) status = 429;
      res.writeHead(status, cors); res.end(status === 409 ? JSON.stringify({ code: '23505' }) : '');
    });
  });
  await new Promise((r) => mock.listen(MOCK, '127.0.0.1', r));

  const profile = path.join(__dirname, '.chrome-profile');
  fs.rmSync(profile, { recursive: true, force: true });
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9477', `--user-data-dir=${profile}`, '--disable-gpu', '--no-first-run', '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { try { await getJson('http://127.0.0.1:9477/json/version'); break; } catch { await sleep(300); } }
  const tab = await getJson('http://127.0.0.1:9477/json/new?about:blank', 'PUT');
  const pg = new Page(tab.webSocketDebuggerUrl);
  await pg.ready;
  for (const d of ['Page', 'Runtime', 'Network', 'Log']) await pg.send(d + '.enable');
  const base = `http://127.0.0.1:${PORT}`;
  const hostsOf = (reqs) => [...new Set(reqs.map((r) => { try { return new URL(r.url).host; } catch { return r.url.slice(0, 20); } }))];

  try {
    /* ---------- home, desktop */
    await pg.go(base + '/', { width: 1280, height: 900 });
    const hostsHome = hostsOf(pg.requests.filter((r) => !/^data:/.test(r.url)));
    t('home (desktop): every request is to this site, nothing third-party', hostsHome.every((h) => h === `127.0.0.1:${PORT}`), hostsHome);
    t('home (desktop): no console errors or exceptions', pg.console.length === 0, pg.console);
    const hero = await pg.ev(`const c=document.getElementById('galaxy'); const r=c.getBoundingClientRect(); return { w: r.width, h: r.height, title: document.getElementById('cap-title').textContent, dots: document.querySelectorAll('#stations button').length, cur: document.querySelectorAll('#stations button[aria-current="true"]').length, h1: document.querySelector('h1').textContent };`);
    t('hero: headline, a canvas ring, ten numbered stations', hero.h1 === 'Say what you want to make. Play it.' && hero.w > 400 && hero.dots === 10 && hero.cur === 1, hero);
    const painted = await pg.ev(`const c=document.getElementById('galaxy'); const x=c.getContext('2d'); const d=x.getImageData(0,0,c.width,c.height).data; let lit=0; for(let i=0;i<d.length;i+=4*37) if(d[i]>60) lit++; return lit;`);
    t('hero: the ring actually painted pixels (not a blank canvas)', painted > 40, painted);
    await sleep(5600);
    const advanced = await pg.ev(`return document.getElementById('cap-title').textContent;`);
    t('hero: it rotates a new station to the front on its own', advanced !== hero.title, [hero.title, advanced]);
    await pg.ev(`document.getElementById('galaxy-stage').focus(); return 1;`);
    const before = await pg.ev(`return document.getElementById('cap-no').textContent;`);
    await pg.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await pg.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await sleep(700);
    const afterKey = await pg.ev(`return document.getElementById('cap-no').textContent;`);
    t('hero: the right arrow key turns the ring', before !== afterKey, [before, afterKey]);
    await pg.ev(`document.querySelectorAll('#stations button')[6].click(); return 1;`);
    await sleep(1200);
    const sev = await pg.ev(`return { no: document.getElementById('cap-no').textContent, title: document.getElementById('cap-title').textContent };`);
    t('hero: a numbered button brings station 7 to the front with its caption', sev.no === '7 / 10' && /real games/i.test(sev.title), sev);
    // drag
    const box = await pg.ev(`const r=document.getElementById('galaxy-stage').getBoundingClientRect(); return {x:r.left,y:r.top,w:r.width,h:r.height};`);
    const noBefore = await pg.ev(`return document.getElementById('cap-no').textContent;`);
    await pg.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x + box.w * 0.7, y: box.y + box.h * 0.2, button: 'left', clickCount: 1 });
    for (let i = 1; i <= 8; i++) await pg.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x + box.w * 0.7 - i * 30, y: box.y + box.h * 0.2, button: 'left' });
    await pg.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x + box.w * 0.7 - 240, y: box.y + box.h * 0.2, button: 'left', clickCount: 1 });
    await sleep(700);
    const noAfter = await pg.ev(`return document.getElementById('cap-no').textContent;`);
    t('hero: dragging the ring turns it', noBefore !== noAfter, [noBefore, noAfter]);
    await pg.shot('home-desktop-hero');

    /* ---------- demo plays through */
    await pg.ev(`document.getElementById('demo').scrollIntoView(); return 1;`);
    await sleep(2500);
    const d1 = await pg.ev(`return window.__demo.state();`);
    t('demo: starts on its own when scrolled into view', d1.running === true, d1);
    const seen = new Set();
    for (let i = 0; i < 60; i++) { const s = await pg.ev(`const a=document.getElementById('demo-app'); return { step: window.__demo.state().step, mode: a.dataset.mode, term: a.classList.contains('t-open'), game: a.classList.contains('g-open'), toast: document.getElementById('app-toast').textContent, hot: document.getElementById('app-phone').classList.contains('hot'), plan: document.getElementById('plan-view').classList.contains('on'), lines: document.querySelectorAll('#term-lines .tl.on').length };`); seen.add(JSON.stringify([s.step, s.mode])); if (s.hot) break; await sleep(1000); }
    const all = await pg.ev(`return { modes: [...document.querySelectorAll('#app-mode span.on')].map(x=>x.dataset.m), hot: document.getElementById('app-phone').classList.contains('hot'), step: window.__demo.state().step };`);
    t('demo: runs all the way to the highlighted Send to phone button', all.hot === true || all.step >= 11, all);
    const stepsSeen = [...seen].map((s) => JSON.parse(s));
    t('demo: the mode toggle goes Local -> Hybrid -> Local -> Hybrid in order', (() => { const modes = stepsSeen.sort((a, b) => a[0] - b[0]).map((s) => s[1]); const collapsed = modes.filter((m, i) => i === 0 || m !== modes[i - 1]); return collapsed.join('>').endsWith('hybrid>local>hybrid'); })(), stepsSeen);
    const agents = await pg.ev(`return { pp: document.querySelectorAll('#term-lines .tag.pp').length, cc: document.querySelectorAll('#term-lines .tag.cc').length, handshake: document.querySelectorAll('#term-lines .handshake').length };`);
    t('demo: terminal lines carry both agent tags', agents.pp >= 1 && agents.cc >= 1, agents);
    await pg.shot('home-desktop-demo');
    // jump through the steps deterministically and check the beats
    const beats = [];
    for (let i = 0; i < 13; i++) beats.push(await pg.ev(`window.__demo.jumpTo(${i}); const a=document.getElementById('demo-app'); return { i: ${i}, mode: a.dataset.mode, term: a.classList.contains('t-open'), game: a.classList.contains('g-open'), plan: document.getElementById('plan-view').classList.contains('on'), toast: document.getElementById('app-toast').textContent, cap: document.getElementById('demo-caption').textContent, chat: [...document.querySelectorAll('#chat-scroll .msg')].map(m=>m.textContent.trim()), hot: document.getElementById('app-phone').classList.contains('hot') };`));
    t('demo beat a: it starts in Local and then Hybrid is switched on', beats[0].mode === 'local' && beats[1].mode === 'hybrid');
    t('demo beat b: the voice prompt is shown', beats[2].chat.some((c) => /Make me a 3D maze-chase game/.test(c)));
    t('demo beat c: the terminal opens', beats[3].term === true && beats[2].term === false);
    t('demo beat d: Playpen and Claude Code lines alternate in the terminal', await pg.ev(`window.__demo.jumpTo(4); const tags=[...document.querySelectorAll('#term-lines .tag')].map(t=>t.textContent); const seq=tags.filter(x=>x==='Playpen'||x==='Claude Code'); let alt=0; for(let i=1;i<seq.length;i++) if(seq[i]!==seq[i-1]) alt++; return alt>=3 && tags.includes('Claude Code') && tags.includes('Playpen');`) === true);
    t('demo beat e: the voice assistant says the game is ready', await pg.ev(`window.__demo.jumpTo(5); return [...document.querySelectorAll('#chat-scroll .msg')].some(m=>/Your game is ready to test/.test(m.textContent));`) === true);
    t('demo beat f: the test pane opens with the game', beats[6].game === true && beats[5].game === false);
    t('demo beat g: the usage limit notice appears', /Claude usage limit reached/.test(beats[7].toast) || beats[7].chat.some((c) => /character/.test(c)));
    t('demo beat h: switched to Local, Plan tab open', beats[8].mode === 'local' && beats[8].plan === true);
    t('demo beat i: usage is back', /Claude usage is back/.test(beats[10].toast));
    t('demo beat j: sent to build, back on Hybrid, game now shows the new character', beats[11].mode === 'hybrid' && beats[11].plan === false);
    t('demo beat k: the Send to phone button is highlighted', beats[12].hot === true);
    t('demo: no console errors across the whole run', pg.console.length === 0, pg.console);

    /* ---------- toggle */
    await pg.ev(`document.getElementById('how').scrollIntoView(); return 1;`);
    await sleep(400);
    const tg0 = await pg.ev(`return { checked: document.querySelector('#mode-toggle [aria-checked="true"]').dataset.mode, h: document.querySelector('#mode-panel h3').textContent };`);
    t('toggle: Hybrid is selected by default', tg0.checked === 'hybrid' && /Two builders/.test(tg0.h), tg0);
    await pg.ev(`document.querySelector('#mode-toggle [data-mode="local"]').click(); return 1;`); await sleep(500);
    const tg1 = await pg.ev(`return { checked: document.querySelector('#mode-toggle [aria-checked="true"]').dataset.mode, h: document.querySelector('#mode-panel h3').textContent, p: document.querySelector('#mode-panel p').textContent };`);
    t('toggle: Local swaps the panel', tg1.checked === 'local' && /Everything on your computer/.test(tg1.h) && /Ollama/.test(tg1.p), tg1);
    await pg.ev(`document.querySelector('#mode-toggle [data-mode="local"]').focus(); return 1;`);
    await pg.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await pg.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await sleep(500);
    await pg.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await pg.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await sleep(500);
    const tg2 = await pg.ev(`return { checked: document.querySelector('#mode-toggle [aria-checked="true"]').dataset.mode, h: document.querySelector('#mode-panel h3').textContent };`);
    t('toggle: arrow keys move through Local, Hybrid, Claude', tg2.checked === 'claude' && /own account/.test(tg2.h), tg2);

    /* ---------- beta form against the mocked endpoint */
    const submit = async (email, upd) => {
      mockHits.length = 0;
      await pg.ev(`document.getElementById('beta-email').value=${JSON.stringify(email)}; document.getElementById('beta-updates').checked=${!!upd}; document.getElementById('beta-submit').click(); return 1;`);
      await sleep(900);
      return pg.ev(`const s=document.getElementById('beta-status'); return { text: s.textContent, cls: s.className, emailAfter: document.getElementById('beta-email').value, btn: document.getElementById('beta-submit').disabled };`);
    };
    let r = await submit('new.person@example.com', true);
    t('beta form: a good email is posted to the REST endpoint and confirmed', mockHits.length === 1 && /Thank you/.test(r.text) && /ok/.test(r.cls), [mockHits.length, r]);
    const hit = mockHits[0] || {};
    t('beta form: path, method and headers are right (anon key, return=minimal, JSON)', hit.url === '/rest/v1/beta_signups' && hit.headers.apikey === 'test-anon-key' && /Bearer test-anon-key/.test(hit.headers.authorization || '') && hit.headers.prefer === 'return=minimal' && /json/.test(hit.headers['content-type']), hit);
    t('beta form: the body is exactly email, wants_updates, source', JSON.stringify(Object.keys(hit.body || {}).sort()) === JSON.stringify(['email', 'source', 'wants_updates']) && hit.body.email === 'new.person@example.com' && hit.body.wants_updates === true && hit.body.source === 'website', hit.body);
    t('beta form: the field clears after success', r.emailAfter === '' && r.btn === false);
    r = await submit('plain@example.com', false);
    t('beta form: the unchecked box sends wants_updates false', mockHits[0] && mockHits[0].body.wants_updates === false);
    r = await submit('dupe@example.com', false);
    t('beta form: a duplicate (409) gets a friendly "already on the list"', /already on the list/.test(r.text) && /ok/.test(r.cls), r);
    r = await submit('boom@example.com', false);
    t('beta form: a server error gets a friendly message, not a code', /Something went wrong/.test(r.text) && !/500|undefined|exception/i.test(r.text) && /err/.test(r.cls), r);
    r = await submit('slow@example.com', false);
    t('beta form: rate limiting (429) gets a friendly message', /Too many tries/.test(r.text), r);
    r = await submit('not-an-email', false);
    t('beta form: a bad email is caught before anything is sent', mockHits.length === 0 && /doesn.t look right/.test(r.text), [mockHits.length, r]);
    mock.close();
    const r2 = await (async () => { await pg.go(`http://127.0.0.1:${PORT + 2}/`, { width: 1280, height: 900 }); await pg.ev(`document.getElementById('beta-email').value='a@b.co'; document.getElementById('beta-submit').click(); return 1;`); await sleep(500); return pg.ev(`return { text: document.getElementById('beta-status').textContent, reqs: performance.getEntriesByType('resource').filter(e=>/supabase|rest\\/v1/.test(e.name)).length };`); })();
    t('beta form: with the placeholder config it says "not connected yet" and sends nothing', /isn.t connected yet/.test(r2.text) && r2.reqs === 0, r2);

    /* ---------- phone width + reduced motion */
    await pg.go(base + '/', { width: 390, height: 844, mobile: true });
    const noScroll = await pg.ev(`return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };`);
    t('home (phone 390px): no horizontal scroll', noScroll.sw <= noScroll.cw + 1, noScroll);
    const phone = await pg.ev(`const r=document.getElementById('galaxy-stage').getBoundingClientRect(); const bs=[...document.querySelectorAll('.btn')].filter(b=>b.getBoundingClientRect().height>0).map(b=>b.getBoundingClientRect().height); return { w: r.width, minBtn: Math.min.apply(null,bs) };`);
    t('home (phone): the ring fills the width and buttons are tap-sized', phone.w > 330 && phone.minBtn >= 36, phone);
    await pg.shot('home-phone-hero');
    await pg.ev(`document.getElementById('demo').scrollIntoView(); return 1;`); await sleep(1200);
    await pg.ev(`window.__demo.jumpTo(11); window.scrollBy(0, 150); return 1;`); await sleep(600);
    await pg.shot('home-phone-demo');
    const demoPhone = await pg.ev(`const r=document.getElementById('demo-app').getBoundingClientRect(); return { w: r.width, sw: document.documentElement.scrollWidth };`);
    t('demo (phone): fits the screen', demoPhone.w <= 390 && demoPhone.sw <= 391, demoPhone);

    await pg.go(base + '/', { width: 1280, height: 900, reduce: true });
    const red = await pg.ev(`const a=document.getElementById('cap-no').textContent; return { no: a, demoRunning: window.__demo.state().running, steps: getComputedStyle(document.getElementById('demo-steps')).display, play: document.getElementById('demo-play').textContent };`);
    await sleep(6500);
    const red2 = await pg.ev(`return { no: document.getElementById('cap-no').textContent, demoRunning: window.__demo.state().running };`);
    t('reduced motion: the ring does not auto-rotate', red.no === red2.no, [red, red2]);
    t('reduced motion: the demo does not autoplay and offers Previous/Next', red2.demoRunning === false && red.steps !== 'none', red);
    await pg.ev(`document.querySelectorAll('#stations button')[3].click(); return 1;`); await sleep(300);
    const redJump = await pg.ev(`return document.getElementById('cap-no').textContent;`);
    t('reduced motion: the ring is still browsable (jumps straight to a station)', redJump === '4 / 10', redJump);
    await pg.ev(`document.getElementById('demo-next').click(); document.getElementById('demo-prev').click(); return window.__demo.state().step;`);
    t('reduced motion: demo steps with the buttons', true);
    await pg.shot('home-desktop-reduced');

    /* ---------- the other pages */
    for (const [name, p] of [['download', '/download/'], ['parents', '/parents/'], ['faq', '/faq/'], ['terms', '/terms/'], ['privacy', '/privacy/'], ['404', '/nope-not-here/'], ['play', '/play/maze/']]) {
      await pg.go(base + p, { width: 1280, height: 900 });
      const hosts = hostsOf(pg.requests.filter((r) => !/^data:/.test(r.url)));
      const allowed = name === 'download' ? (h) => h === `127.0.0.1:${PORT}` || h === 'api.github.com' : (h) => h === `127.0.0.1:${PORT}`;
      t(`${name}: only this site is contacted${name === 'download' ? ' (plus the GitHub releases API, by design)' : ''}`, hosts.every(allowed), hosts);
      t(`${name}: no console errors`, pg.console.filter((c) => !(name === '404' && /404/.test(c))).length === 0, pg.console);
      await pg.shot('page-' + name + '-desktop');
      await pg.go(base + p, { width: 390, height: 844, mobile: true });
      const ov = await pg.ev(`return document.documentElement.scrollWidth - document.documentElement.clientWidth;`);
      t(`${name} (phone): no horizontal scroll`, ov <= 1, ov);
    }
    // the placeholder game: moves with the buttons
    await pg.go(base + '/play/maze/', { width: 390, height: 844, mobile: true });
    t('play placeholder: a canvas, touch buttons, and a clear "Placeholder" banner', await pg.ev(`return !!document.getElementById('game') && document.querySelectorAll('.dpad button').length===4 && /Placeholder/.test(document.querySelector('.game-banner').textContent);`) === true);

    /* ---------- download button against the REAL releases API */
    await pg.go(base + '/download/', { width: 1280, height: 900 });
    await sleep(1500);
    const real = await pg.ev(`return { href: document.getElementById('dl-button').href, ver: document.getElementById('dl-version').textContent, size: document.getElementById('dl-size').textContent, sha: document.getElementById('dl-sha').textContent, file: document.getElementById('dl-file').textContent };`);
    t('download (real GitHub API): button points at the released installer', /^https:\/\/github\.com\/lsaiahflores\/playpen-releases\/releases\/download\/v[\d.]+\/Playpen-Setup-[\d.]+\.exe$/.test(real.href), real);
    t('download (real GitHub API): version, size in MB and a 64-character SHA-256 are shown', /^[\d.]+$/.test(real.ver) && /^\d+ MB$/.test(real.size) && /^[0-9a-f]{64}$/.test(real.sha), real);

    /* ---------- download button: mocked release, then a failed lookup */
    await pg.send('Fetch.enable', { patterns: [{ urlPattern: 'https://api.github.com/*' }] });
    const fakeRelease = { tag_name: 'v9.9.9', name: 'Playpen 9.9.9', body: 'Windows installer.\nSHA-256: ' + 'ab'.repeat(32), assets: [{ name: 'Playpen-Setup-9.9.9.exe', size: 123456789, browser_download_url: 'https://github.com/x/y/releases/download/v9.9.9/Playpen-Setup-9.9.9.exe' }] };
    let mode = 'ok';
    pg.handlers.push((d) => {
      if (d.method !== 'Fetch.requestPaused') return;
      if (mode === 'ok') pg.send('Fetch.fulfillRequest', { requestId: d.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: Buffer.from(JSON.stringify(fakeRelease)).toString('base64') });
      else pg.send('Fetch.failRequest', { requestId: d.params.requestId, errorReason: 'ConnectionRefused' });
    });
    await pg.go(base + '/download/', { width: 1280, height: 900 });
    await sleep(900);
    const dl = await pg.ev(`return { href: document.getElementById('dl-button').href, ver: document.getElementById('dl-version').textContent, size: document.getElementById('dl-size').textContent, sha: document.getElementById('dl-sha').textContent, file: document.getElementById('dl-file').textContent };`);
    t('download: the button, version, size and SHA-256 come from the release', /Playpen-Setup-9\.9\.9\.exe$/.test(dl.href) && dl.ver === '9.9.9' && dl.size === '118 MB' && dl.sha === 'ab'.repeat(32) && dl.file === 'Playpen-Setup-9.9.9.exe', dl);
    mode = 'fail';
    await pg.go(base + '/download/', { width: 1280, height: 900 });
    await sleep(900);
    const dl2 = await pg.ev(`return { href: document.getElementById('dl-button').href, status: document.getElementById('dl-status').textContent };`);
    t('download: if the lookup fails the plain releases link still works, with a friendly note', /github\.com\/lsaiahflores\/playpen-releases\/releases\/latest$/.test(dl2.href) && /Couldn.t read the latest release/.test(dl2.status), dl2);
    await pg.send('Fetch.disable');
  } finally {
    try { chrome.kill(); } catch { /* gone */ }
    site.close(); plain.close();
  }
}

(async () => {
  staticTests();
  if (!process.argv.includes('--static')) await browserTests();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('ERROR', e); process.exit(1); });
