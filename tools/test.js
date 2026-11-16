// Headless check: bot-plays all levels (god mode, geometry only) and saves screenshots to tools/shots/.
// Usage: node tools/test.js   (needs Playwright + Chrome)
const path = require('path'), fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const { botPlay } = require('./bot');
(async () => {
  const out = path.join(__dirname, 'shots'); fs.mkdirSync(out, { recursive: true });
  const br = await pw.chromium.launch({ executablePath: fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined, args: ['--no-sandbox'] });
  const errs = [];
  const open = async vp => { const c = await br.newContext(vp); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.join(__dirname, '..', 'dist', 'index.html')); await p.waitForTimeout(600); return p; };
  const page = await open({ viewport: { width: 1000, height: 640 } });
  await page.screenshot({ path: path.join(out, 'check-title.png') });
  const n = await page.evaluate(() => window.IITHQuest.LEVELS.length);
  let ok = true;
  for (let i = 0; i < n; i++){ const r = await page.evaluate(`(${botPlay.toString()})(${i})`); delete r.log; if (!r.cleared) ok = false; console.log(JSON.stringify(r)); }
  // one real frame of each level
  for (let i = 0; i < n; i++){ await page.evaluate(i => { const Q = window.IITHQuest; Q.Game.auto = false; const s = Q.PlayScene(i); for (let k = 0; k < 90; k++){ s.update(); Q.Input.endTick(); } s.draw(document.getElementById('game').getContext('2d')); }, i);
    await page.locator('#game').screenshot({ path: path.join(out, 'check-L' + (i + 1) + '.png') }); }
  const ph = await open({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await ph.screenshot({ path: path.join(out, 'check-phone.png') });
  console.log(ok ? 'ALL LEVELS CLEARED' : 'SOME LEVELS FAILED', '| page errors:', errs.length ? errs : 'none');
  await br.close();
})();
