// Renders the home-screen icons (src/public/icon-192.png, icon-512.png) from the game's own sprites.
// node tools/make-icons.js   (run node build.js first)
const path = require('path'), fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/npm-tools/node_modules/playwright'); }
(async () => {
  const b = await pw.chromium.launch({ executablePath: fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined, args: ['--no-sandbox'] });
  const pg = await b.newPage(); await pg.goto('file://' + path.join(__dirname, '..', 'dist', 'index.html')); await pg.waitForTimeout(300);
  for (const n of [192, 512]) {
    const url = await pg.evaluate(n => {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      g.fillStyle = '#2f9fb3'; g.fillRect(0, 0, 64, 64);
      for (const [x, w, h] of [[2, 18, 34], [44, 18, 30]]) { g.fillStyle = '#f4efe6'; g.fillRect(x, 48 - h, w, h); g.fillStyle = '#b3262e'; for (let y = 48 - h + 3; y < 46; y += 6) g.fillRect(x, y, w, 2); }
      g.fillStyle = '#8d999c'; g.fillRect(0, 48, 64, 16); g.fillStyle = '#b9c3c4'; g.fillRect(0, 48, 64, 2);
      g.drawImage(Art.player('boy').run[0], 10, 12, 24, 36); g.drawImage(Art.flip(Art.player('girl').idle), 30, 12, 24, 36);
      const o = document.createElement('canvas'); o.width = o.height = n; const og = o.getContext('2d'); og.imageSmoothingEnabled = false; og.drawImage(c, 0, 0, n, n);
      return o.toDataURL('image/png');
    }, n);
    fs.writeFileSync(path.join(__dirname, '..', 'src', 'public', 'icon-' + n + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  }
  await b.close(); console.log('icons written');
})();
