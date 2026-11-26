// End-to-end: serves dist/ on a fake hosted origin, answers /api/scores with the real function code,
// and checks roll-number claiming, score submit, board display, admin rename and the admin page.
// node tools/test-board.mjs
import { handle } from '../netlify/functions/scores.mjs';
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const mem = new Map(), store = { async get(k) { return mem.has(k) ? JSON.parse(mem.get(k)) : null; }, async setJSON(k, v) { mem.set(k, JSON.stringify(v)); } };
const KEY = 'test-admin-key';
const files = { '/': '../dist/index.html', '/admin.html': '../dist/admin.html' };
const br = await pw.chromium.launch({ executablePath: fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined, args: ['--no-sandbox'] });
let ipN = 0;
async function newPage() {
  const page = await br.newPage({ viewport: { width: 1000, height: 640 } }); page.errs = []; page.on('pageerror', e => page.errs.push(e.message));
  await page.route('https://iithquest.example/**', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.pathname === '/api/scores') {
      const r = await handle(new Request(req.url(), { method: req.method(), body: req.method() === 'POST' ? req.postData() : undefined }), store, '10.0.0.' + (++ipN), KEY);
      return route.fulfill({ status: r.status, contentType: 'application/json', body: await r.text() });
    }
    const f = files[url.pathname]; if (!f) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, contentType: 'text/html', body: fs.readFileSync(new URL(f, import.meta.url)) });
  });
  return page;
}
const ok = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
const shot = p => new URL('./shots/' + p, import.meta.url).pathname; fs.mkdirSync(new URL('./shots/', import.meta.url), { recursive: true });

// Player 1 claims 2401001 through the dialog
const p1 = await newPage(); await p1.goto('https://iithquest.example/'); await p1.waitForTimeout(300);
await p1.evaluate(() => { window.__got = null; window.IITHQuest.Game.askName('', r => { window.__got = r; }); });
await p1.fill('#nameInput', '24ab01'); ok(await p1.inputValue('#nameInput') === '2401', 'dialog keeps digits only');
await p1.click('#nameOk'); ok((await p1.textContent('#nameErr')).includes('7 digits'), 'short roll rejected in dialog');
await p1.fill('#nameInput', '2401001'); await p1.click('#nameOk'); await p1.waitForTimeout(300);
ok(await p1.evaluate(() => window.__got) === '2401001', 'free roll accepted');
await p1.evaluate(async () => { const Q = window.IITHQuest; Q.Save.data.name = '2401001';
  await Q.Leaderboard.submit({ name: '2401001', roll: '2401001', token: Q.Save.data.token, char: 'boy', cgpa: 9.25, score: 44640, offer: 'SUPER DREAM OFFER', date: Date.now() }); });
ok(await p1.evaluate(() => window.IITHQuest.Leaderboard.rank) === 1, 'player 1 score posted, rank 1');

// Player 2 (different device) tries the same roll
const p2 = await newPage(); await p2.goto('https://iithquest.example/'); await p2.waitForTimeout(300);
await p2.evaluate(() => { window.__got = null; window.IITHQuest.Game.askName('', r => { window.__got = r; }); });
await p2.fill('#nameInput', '2401001'); await p2.click('#nameOk'); await p2.waitForTimeout(300);
ok((await p2.textContent('#nameErr')).includes('already taken') && await p2.evaluate(() => window.__got) === null, 'taken roll refused for another device');
await p2.screenshot({ path: shot('check-roll-taken.png') });
await p2.fill('#nameInput', '2402002'); await p2.click('#nameOk'); await p2.waitForTimeout(300);
ok(await p2.evaluate(() => window.__got) === '2402002', 'player 2 picks another roll');

// Admin renames 2401001 on the admin page
const pa = await newPage(); await pa.goto('https://iithquest.example/admin.html');
await pa.fill('#key', 'wrong-key'); await pa.click('#login button'); await pa.waitForTimeout(300);
ok((await pa.textContent('#msg')).includes('wrong admin key'), 'admin page rejects wrong key');
await pa.waitForTimeout(3100);
await pa.fill('#key', KEY); await pa.click('#login button'); await pa.waitForTimeout(400);
ok(await pa.locator('#rows tr').count() === 1, 'admin page lists the board');
await pa.fill('#rows tr input', 'Anuran M'); await pa.click('#rows tr button.go'); await pa.waitForTimeout(300);
ok((await pa.textContent('#msg')).includes('ANURAN M'), 'admin rename saved');
await pa.screenshot({ path: shot('check-admin.png'), fullPage: true });

// Board in game shows the new name, highlighted for player 1
await p1.evaluate(() => { const Q = window.IITHQuest; Q.Game.go(Q.BoardScene()); }); await p1.waitForTimeout(800);
const top = await p1.evaluate(async () => (await window.IITHQuest.Leaderboard.top(8)).map(e => e.name + '/' + e.roll).join(','));
ok(top === 'ANURAN M/2401001', 'board shows admin name: ' + top);
await p1.locator('#game').screenshot({ path: shot('check-board-global.png') });
for (const p of [p1, p2, pa]) ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
await br.close();
