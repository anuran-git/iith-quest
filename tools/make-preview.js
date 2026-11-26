// Renders the link-preview image (src/public/og-image.png, 1200x630) from the game's title screen.
// node tools/make-preview.js   (needs a build first)
const fs = require('fs'), path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/npm-tools/node_modules/playwright'); }
(async () => {
  const b = await pw.chromium.launch({ executablePath: fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined, args: ['--no-sandbox'] });
  const pg = await b.newPage();
  await pg.goto('file://' + path.join(__dirname, '../dist/index.html')); await pg.waitForTimeout(1800);
  const url = await pg.evaluate(() => {
    const src = document.getElementById('game'), c = document.createElement('canvas'); c.width = 1200; c.height = 630;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const s = 1200 / src.width; g.drawImage(src, 0, (630 - src.height * s) / 2, 1200, src.height * s);   // crop top/bottom evenly
    return c.toDataURL('image/png');
  });
  fs.writeFileSync(path.join(__dirname, '../src/public/og-image.png'), Buffer.from(url.split(',')[1], 'base64'));
  console.log('src/public/og-image.png written'); await b.close();
})();
