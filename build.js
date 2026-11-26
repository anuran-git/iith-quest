// Build: copies src/public/* to dist/ and inlines src/styles.css and src/js/*.js (filename order) into src/index.html -> dist/index.html (one file).
// Usage: node build.js
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, 'src'), dist = path.join(__dirname, 'dist'), jsDir = path.join(src, 'js');
const js = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).sort().map(f => fs.readFileSync(path.join(jsDir, f), 'utf8')).join('\n');
const css = fs.readFileSync(path.join(src, 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8').replace('/*__STYLES__*/', () => css).replace('/*__GAME_JS__*/', () => js);
// SITE_URL: Netlify sets URL (your main site address) during builds; override with SITE_URL=https://... if you use a custom domain.
const site = (process.env.SITE_URL || process.env.URL || '').replace(/\/$/, '');
const out = html.split('__SITE_URL__').join(site);
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), out);
// static files (manifest, icons) are copied as-is
const pub = path.join(src, 'public');
if (fs.existsSync(pub)) for (const f of fs.readdirSync(pub)) fs.copyFileSync(path.join(pub, f), path.join(dist, f));
// robots.txt + sitemap.xml (sitemap needs the absolute URL, so only when it is known)
fs.writeFileSync(path.join(dist, 'robots.txt'), 'User-agent: *\nAllow: /\nDisallow: /admin.html\n' + (site ? 'Sitemap: ' + site + '/sitemap.xml\n' : ''));
if (site) fs.writeFileSync(path.join(dist, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' + site + '/</loc><lastmod>' + new Date().toISOString().slice(0, 10) + '</lastmod></url></urlset>\n');
console.log('site URL:', site || '(none - set by Netlify at deploy time)');
console.log('dist/index.html', (html.length / 1024).toFixed(1) + ' KB');
