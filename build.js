// Build: copies src/public/* to dist/ and inlines src/styles.css and src/js/*.js (filename order) into src/index.html -> dist/index.html (one file).
// Usage: node build.js
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, 'src'), dist = path.join(__dirname, 'dist'), jsDir = path.join(src, 'js');
const js = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).sort().map(f => fs.readFileSync(path.join(jsDir, f), 'utf8')).join('\n');
const css = fs.readFileSync(path.join(src, 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8').replace('/*__STYLES__*/', () => css).replace('/*__GAME_JS__*/', () => js);
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), html);
// static files (manifest, icons) are copied as-is
const pub = path.join(src, 'public');
if (fs.existsSync(pub)) for (const f of fs.readdirSync(pub)) fs.copyFileSync(path.join(pub, f), path.join(dist, f));
console.log('dist/index.html', (html.length / 1024).toFixed(1) + ' KB');
