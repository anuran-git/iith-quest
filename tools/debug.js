// Scratch helper: trace the bot around a tile range.  node tools/debug.js <levelIndex> <fromTile> <toTile>
const path = require('path'), fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const [lv, a, b] = process.argv.slice(2).map(Number);
(async () => {
  const br = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await br.newPage({ viewport: { width: 1000, height: 640 } });
  await page.goto('file://' + path.join(__dirname, '..', 'dist', 'index.html')); await page.waitForTimeout(400);
  const out = await page.evaluate(({ lv, a, b }) => {
    const Q = window.IITHQuest; Q.Game.auto = false;
    const L = Q.buildLevel(lv); const rows = [];
    for (let y = 0; y < 12; y++) { let s = ''; for (let x = a; x <= b; x++) s += '.#B=^'[L.tiles[x + y * L.w]]; rows.push(s); }
    return rows.join('\n');
  }, { lv, a, b });
  console.log(out);
  const { botPlay } = require('./bot');
  const r = await page.evaluate(`(${botPlay.toString()})(${lv}, [${a}, ${b}])`);
  console.log(r.log.slice(0, 160).join('\n')); delete r.log; console.log(r);
  await br.close();
})();
