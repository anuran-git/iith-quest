// End-to-end: serves dist/ on a fake hosted origin and answers /api/scores with the real function code.
// node tools/test-board.mjs
import { handle } from '../netlify/functions/scores.mjs';
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const mem = new Map(), store = { async get(k) { return mem.has(k) ? JSON.parse(mem.get(k)) : null; }, async setJSON(k, v) { mem.set(k, JSON.stringify(v)); } };
await store.setJSON('board', [{ name: 'RIYA', char: 'girl', cgpa: 9.6, score: 61000, offer: 'SUPER DREAM OFFER', date: 1 }, { name: 'KABIR', char: 'boy', cgpa: 8.1, score: 39000, offer: 'DREAM OFFER', date: 1 }]);
const html = fs.readFileSync(new URL('../dist/index.html', import.meta.url));
let apiUp = true;
const br = await pw.chromium.launch({ executablePath: fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined, args: ['--no-sandbox'] });
const page = await br.newPage({ viewport: { width: 1000, height: 640 } }); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.route('https://iithquest.example/**', async route => {
  const req = route.request(), url = new URL(req.url());
  if (url.pathname === '/api/scores') {
    if (!apiUp) return route.abort();
    const r = await handle(new Request(req.url(), { method: req.method(), body: req.method() === 'POST' ? req.postData() : undefined }), store, '9.9.9.9');
    return route.fulfill({ status: r.status, contentType: 'application/json', body: await r.text() });
  }
  return route.fulfill({ status: 200, contentType: 'text/html', body: html });
});
await page.goto('https://iithquest.example/'); await page.waitForTimeout(400);
const log = await page.evaluate(async () => {
  const Q = window.IITHQuest, out = [];
  Q.Save.data.name = 'ANURAN'; Q.Save.data.char = 'boy';
  await Q.Leaderboard.submit({ name: 'ANURAN', char: 'boy', cgpa: 9.25, score: 44640, offer: 'SUPER DREAM OFFER', date: Date.now() });
  out.push('rank after submit: ' + Q.Leaderboard.rank);
  const top = await Q.Leaderboard.top(8); out.push('global=' + Q.Leaderboard.global + ' ' + top.map(e => e.name + ':' + e.score).join(', '));
  return out;
});
console.log(log.join('\n'));
await page.evaluate(() => { const Q = window.IITHQuest; Q.Game.go(Q.BoardScene()); }); await page.waitForTimeout(900);
await page.locator('#game').screenshot({ path: new URL('./shots/check-board-global.png', import.meta.url).pathname });
apiUp = false;
const off = await page.evaluate(async () => { const Q = window.IITHQuest; await Q.Leaderboard.submit({ name: 'ANURAN', char: 'boy', cgpa: 9.5, score: 47000, offer: 'X', date: 1 });
  const top = await Q.Leaderboard.top(8); return 'offline: global=' + Q.Leaderboard.global + ' note=' + Q.Leaderboard.note + ' pending=' + !!localStorage.getItem('iith-quest-pending-v1'); });
console.log(off);
apiUp = true;
const back = await page.evaluate(async () => { const Q = window.IITHQuest; const top = await Q.Leaderboard.top(8); return 'back online: ' + top.map(e => e.name + ':' + e.score).join(', ') + ' pending=' + !!localStorage.getItem('iith-quest-pending-v1'); });
console.log(back);
console.log('page errors:', errs.length ? errs : 'none'); await br.close();
