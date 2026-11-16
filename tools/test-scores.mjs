// Unit test for the Hall of Fame function with an in-memory store.  node tools/test-scores.mjs
import { handle } from '../netlify/functions/scores.mjs';
const mem = new Map();
const store = { async get(k) { return mem.has(k) ? JSON.parse(mem.get(k)) : null; }, async setJSON(k, v) { mem.set(k, JSON.stringify(v)); } };
const post = (b, ip) => handle(new Request('http://x/api/scores', { method: 'POST', body: JSON.stringify(b) }), store, ip);
const get = () => handle(new Request('http://x/api/scores?limit=5'), store).then(r => r.json());
const ok = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
ok((await post({ name: 'anuran', char: 'boy', cgpa: 9.25, score: 44640, offer: 'SUPER DREAM OFFER' }, '1.1.1.1')).status === 200, 'valid post accepted');
ok((await post({ name: 'ANURAN', cgpa: 9, score: 500 }, '1.1.1.2')).status === 200, 'lower score from same name accepted (ignored)');
ok((await post({ name: 'RIYA', char: 'girl', cgpa: 9.6, score: 50000 }, '1.1.1.1')).status === 429, 'rate limited per IP');
ok((await post({ name: 'RIYA', char: 'girl', cgpa: 9.6, score: 50000 }, '2.2.2.2')).status === 200, 'second player accepted');
ok((await post({ name: 'HAX', cgpa: 11, score: 5 }, '3.3.3.3')).status === 400, 'cgpa > 10 rejected');
ok((await post({ name: 'HAX', cgpa: 5, score: 9e9 }, '3.3.3.4')).status === 400, 'absurd score rejected');
ok((await post({ name: '<script>', cgpa: 5, score: 5 }, '3.3.3.5')).status === 200, 'name sanitised');
const { entries } = await get();
ok(entries.length === 3 && entries[0].name === 'RIYA' && entries[1].score === 44640, 'sorted, one row per name: ' + entries.map(e => e.name + ':' + e.score).join(', '));
ok(entries[2].name === 'SCRIPT', 'sanitised name stored as SCRIPT');
