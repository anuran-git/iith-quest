// Global Hall of Fame for IITH Quest.
// Netlify Function (v2) at /api/scores, storing data in Netlify Blobs (store "hall-of-fame").
//
// Players are identified by a 7-digit ROLL NUMBER. The first device to use a roll number claims it
// (it keeps a random secret token; only a hash is stored), so nobody else can post under that roll.
//   GET  /api/scores?limit=20                       → { entries: [{ name, roll, char, cgpa, score, offer, date }] }
//                                                     name = admin-set display name, else the roll number
//   POST { action:'claim', roll, token }            → { ok } | 409 { error:'taken' }
//   POST { roll, token, char, cgpa, score, offer }  → { ok, rank }   (best score per roll kept; 1 submit / IP / 20 s)
//   POST { action:'admin', key, op, roll, name }    → admin tools, see admin.html
//        op: 'list' | 'rename' (name '' clears it) | 'delete' (remove score) | 'release' (free the roll number)
// The admin key is the ADMIN_KEY environment variable in Netlify (Site configuration → Environment variables).
// Scores come from the player's browser, so a determined cheater can still post a fake one: delete it via admin.html.
import { getStore } from '@netlify/blobs';

const KEEP = 100, MAX_SCORE = 150000, COOLDOWN_MS = 20000, CLAIM_MS = 1500, ADMIN_FAIL_MS = 3000;
const ROLL = /^\d{7}$/, TOKEN = /^[A-Za-z0-9-]{16,64}$/;
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});
const ipKey = (p, ip) => p + String(ip).replace(/[^0-9a-fA-F:.]/g, '').slice(0, 45);
async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function sameKey(a, b) {   // constant-time compare
  a = String(a); b = String(b); let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
export const cleanName = n => String(n || '').toUpperCase().replace(/[^A-Z0-9 .]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);

export function clean(e) {
  if (!e || typeof e !== 'object') return null;
  const roll = String(e.roll || '').trim();
  const char = e.char === 'girl' ? 'girl' : 'boy';
  const cgpa = Number(e.cgpa), score = Math.round(Number(e.score));
  const offer = String(e.offer || '').toUpperCase().replace(/[^A-Z ]/g, '').trim().slice(0, 24);
  if (!ROLL.test(roll) || !Number.isFinite(cgpa) || cgpa < 0 || cgpa > 10 || !Number.isFinite(score) || score < 0 || score > MAX_SCORE) return null;
  return { roll, char, cgpa: Math.round(cgpa * 100) / 100, score, offer, date: Date.now() };
}

const rowId = e => e.roll || 'name:' + e.name;   // older rows (before roll numbers) only have a name
async function load(store) {
  return {
    board: (await store.get('board', { type: 'json' })) || [],
    aliases: (await store.get('aliases', { type: 'json' })) || {},
    claims: (await store.get('claims', { type: 'json' })) || {},
  };
}
const view = (e, aliases) => ({ name: (e.roll && aliases[e.roll]) || e.roll || e.name, roll: e.roll || '', char: e.char, cgpa: e.cgpa, score: e.score, offer: e.offer, date: e.date });

// Pure handler so it can be tested with an in-memory store (see tools/test-scores.mjs)
export async function handle(req, store, ip = 'unknown', adminKey = '') {
  if (req.method === 'GET') {
    const limit = Math.min(100, Math.max(1, parseInt(new URL(req.url).searchParams.get('limit') || '20', 10) || 20));
    const { board, aliases } = await load(store);
    return json({ entries: board.slice(0, limit).map(e => view(e, aliases)) });
  }
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  let body; try { body = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  if (!body || typeof body !== 'object') return json({ error: 'bad json' }, 400);

  // ── Admin ──
  if (body.action === 'admin') {
    if (!adminKey || adminKey.length < 8) return json({ error: 'admin disabled: set ADMIN_KEY (8+ characters) in Netlify' }, 403);
    const rk = ipKey('rla/', ip), last = await store.get(rk, { type: 'json' });
    if (last && Date.now() - last.t < ADMIN_FAIL_MS) return json({ error: 'slow down' }, 429);
    if (!sameKey(body.key, adminKey)) { await store.setJSON(rk, { t: Date.now() }); return json({ error: 'wrong admin key' }, 403); }
    const { board, aliases, claims } = await load(store), roll = String(body.roll || ''), id = String(body.id || roll);
    if (body.op === 'list') {
      const scored = new Set(board.map(e => e.roll).filter(Boolean));
      return json({ entries: board.map(e => Object.assign(view(e, aliases), { id: rowId(e), alias: (e.roll && aliases[e.roll]) || '', claimed: !!(e.roll && claims[e.roll]) })),
        unscored: Object.keys(claims).filter(r => !scored.has(r)).map(r => ({ roll: r, alias: aliases[r] || '' })) });
    }
    if (body.op === 'rename') {
      if (!ROLL.test(roll)) return json({ error: 'bad roll' }, 400);
      const n = cleanName(body.name); if (n) aliases[roll] = n; else delete aliases[roll];
      await store.setJSON('aliases', aliases); return json({ ok: true, name: n || roll });
    }
    if (body.op === 'delete') {
      const next = board.filter(e => rowId(e) !== id); if (next.length === board.length) return json({ error: 'not found' }, 404);
      await store.setJSON('board', next); return json({ ok: true });
    }
    if (body.op === 'release') {
      if (!claims[roll]) return json({ error: 'not claimed' }, 404);
      delete claims[roll]; await store.setJSON('claims', claims); return json({ ok: true });
    }
    return json({ error: 'unknown op' }, 400);
  }

  // ── Claim a roll number ──
  const roll = String(body.roll || '').trim(), token = String(body.token || '');
  if (!ROLL.test(roll)) return json({ error: 'roll number must be 7 digits' }, 400);
  if (!TOKEN.test(token)) return json({ error: 'bad token' }, 400);
  const th = await sha(token);
  if (body.action === 'claim') {
    const rk = ipKey('rlc/', ip), last = await store.get(rk, { type: 'json' });
    if (last && Date.now() - last.t < CLAIM_MS) return json({ error: 'slow down' }, 429);
    await store.setJSON(rk, { t: Date.now() });
    const claims = (await store.get('claims', { type: 'json' })) || {};
    if (claims[roll] && claims[roll] !== th) return json({ error: 'taken' }, 409);
    if (!claims[roll]) { claims[roll] = th; await store.setJSON('claims', claims); }
    return json({ ok: true });
  }

  // ── Submit a score ──
  const entry = clean(body); if (!entry) return json({ error: 'invalid entry' }, 400);
  const claims = (await store.get('claims', { type: 'json' })) || {};
  if (claims[roll] && claims[roll] !== th) return json({ error: 'taken' }, 409);
  const rk = ipKey('rl/', ip), last = await store.get(rk, { type: 'json' });
  if (last && Date.now() - last.t < COOLDOWN_MS) return json({ error: 'slow down' }, 429);
  await store.setJSON(rk, { t: Date.now() });
  if (!claims[roll]) { claims[roll] = th; await store.setJSON('claims', claims); }
  let board = (await store.get('board', { type: 'json' })) || [];
  const prev = board.find(e => e.roll === roll);
  if (!prev || entry.score > prev.score) board = board.filter(e => e.roll !== roll).concat(entry);
  board.sort((a, b) => b.score - a.score || b.cgpa - a.cgpa);
  board = board.slice(0, KEEP);
  await store.setJSON('board', board);
  return json({ ok: true, rank: board.findIndex(e => e.roll === roll) + 1 });
}

export default async (req, context) => handle(req, getStore({ name: 'hall-of-fame', consistency: 'strong' }),
  (context && context.ip) || 'unknown', (globalThis.Netlify && Netlify.env.get('ADMIN_KEY')) || process.env.ADMIN_KEY || '');
export const config = { path: '/api/scores' };
