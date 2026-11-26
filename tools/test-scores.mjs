// Unit test for the Hall of Fame function with an in-memory store.  node tools/test-scores.mjs
import { handle } from '../netlify/functions/scores.mjs';
const mem = new Map();
const store = { async get(k) { return mem.has(k) ? JSON.parse(mem.get(k)) : null; }, async setJSON(k, v) { mem.set(k, JSON.stringify(v)); } };
const KEY = 'admin-secret-123';
const post = (b, ip = '9.9.9.9') => handle(new Request('http://x/api/scores', { method: 'POST', body: JSON.stringify(b) }), store, ip, KEY);
const get = () => handle(new Request('http://x/api/scores?limit=10'), store).then(r => r.json());
const ok = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
const T1 = 'token-aaaaaaaaaaaaaaaa', T2 = 'token-bbbbbbbbbbbbbbbb';
const wait = ms => new Promise(r => setTimeout(r, ms));

ok((await post({ action: 'claim', roll: '2401001', token: T1 }, '1.1.1.1')).status === 200, 'claim free roll');
await wait(1600);
ok((await post({ action: 'claim', roll: '2401001', token: T1 }, '1.1.1.1')).status === 200, 're-claim by same device ok');
ok((await post({ action: 'claim', roll: '2401001', token: T2 }, '2.2.2.2')).status === 409, 'roll taken by another device');
ok((await post({ action: 'claim', roll: '24010', token: T2 }, '2.2.2.3')).status === 400, 'non-7-digit roll rejected');
ok((await post({ roll: '2401001', token: T1, char: 'boy', cgpa: 9.25, score: 44640, offer: 'SUPER DREAM OFFER' }, '1.1.1.1')).status === 200, 'score posted');
ok((await post({ roll: '2401001', token: T2, cgpa: 9.9, score: 99999 }, '3.3.3.3')).status === 409, 'cannot post under someone else\'s roll');
ok((await post({ roll: '2401001', token: T1, cgpa: 9, score: 500 }, '1.1.1.1')).status === 429, 'rate limited per IP');
ok((await post({ roll: '2402002', token: T2, char: 'girl', cgpa: 9.6, score: 50000, offer: 'DREAM OFFER' }, '4.4.4.4')).status === 200, 'second player (auto-claims)');
ok((await post({ roll: '2403003', token: T2, cgpa: 11, score: 5 }, '5.5.5.5')).status === 400, 'cgpa > 10 rejected');
let { entries } = await get();
ok(entries.length === 2 && entries[0].name === '2402002' && entries[1].roll === '2401001', 'board shows roll numbers: ' + entries.map(e => e.name + ':' + e.score).join(', '));

// admin
ok((await post({ action: 'admin', key: 'nope', op: 'list' }, '6.6.6.6')).status === 403, 'wrong admin key rejected');
ok((await post({ action: 'admin', key: KEY, op: 'list' }, '6.6.6.6')).status === 429, 'admin retry throttled after a wrong key');
ok((await post({ action: 'admin', key: KEY, op: 'rename', roll: '2402002', name: 'riya <s>' }, '7.7.7.7')).status === 200, 'admin rename');
({ entries } = await get());
ok(entries[0].name === 'RIYA S' && entries[0].roll === '2402002', 'renamed shows on board: ' + entries[0].name);
const list = await (await post({ action: 'admin', key: KEY, op: 'list' }, '7.7.7.7')).json();
ok(list.entries.length === 2 && list.entries[0].alias === 'RIYA S' && list.entries[0].claimed, 'admin list');
ok((await post({ action: 'admin', key: KEY, op: 'release', roll: '2401001' }, '7.7.7.7')).status === 200, 'admin release roll');
ok((await post({ action: 'claim', roll: '2401001', token: T2 }, '8.8.8.8')).status === 200, 'released roll can be claimed again');
ok((await post({ action: 'admin', key: KEY, op: 'delete', id: '2401001' }, '7.7.7.7')).status === 200, 'admin delete score');
({ entries } = await get());
ok(entries.length === 1, 'deleted row gone');
ok((await handle(new Request('http://x', { method: 'POST', body: JSON.stringify({ action: 'admin', key: 'x', op: 'list' }) }), store, '1', '')).status === 403, 'admin disabled without ADMIN_KEY');
