// Global Hall of Fame for IITH Quest.
// Netlify Function (v2) at /api/scores, storing the board in Netlify Blobs (no extra account needed).
//   GET  /api/scores?limit=20  → { entries: [{ name, char, cgpa, score, offer, date }] }   best first
//   POST /api/scores           ← { name, char, cgpa, score, offer }                         → { ok, rank }
// One entry per name (best score kept). Basic validation + one submit per IP every 20 s.
// Scores come from the player's browser, so a determined cheater can still post a fake one:
// clear bad rows from the Netlify UI (Blobs → hall-of-fame → board) if that happens.
import { getStore } from '@netlify/blobs';

const KEEP = 100, MAX_SCORE = 150000, COOLDOWN_MS = 20000;
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

export function clean(e) {
  if (!e || typeof e !== 'object') return null;
  const name = String(e.name || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().slice(0, 10);
  const char = e.char === 'girl' ? 'girl' : 'boy';
  const cgpa = Number(e.cgpa), score = Math.round(Number(e.score));
  const offer = String(e.offer || '').toUpperCase().replace(/[^A-Z ]/g, '').trim().slice(0, 24);
  if (!name || !Number.isFinite(cgpa) || cgpa < 0 || cgpa > 10 || !Number.isFinite(score) || score < 0 || score > MAX_SCORE) return null;
  return { name, char, cgpa: Math.round(cgpa * 100) / 100, score, offer, date: Date.now() };
}

// Pure handler so it can be tested with an in-memory store (see tools/test-scores.mjs)
export async function handle(req, store, ip = 'unknown') {
  if (req.method === 'GET') {
    const limit = Math.min(50, Math.max(1, parseInt(new URL(req.url).searchParams.get('limit') || '20', 10) || 20));
    const board = (await store.get('board', { type: 'json' })) || [];
    return json({ entries: board.slice(0, limit) });
  }
  if (req.method === 'POST') {
    let body; try { body = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
    const entry = clean(body); if (!entry) return json({ error: 'invalid entry' }, 400);
    const rlKey = 'rl/' + ip.replace(/[^0-9a-fA-F:.]/g, '').slice(0, 45), last = await store.get(rlKey, { type: 'json' });
    if (last && Date.now() - last.t < COOLDOWN_MS) return json({ error: 'slow down' }, 429);
    await store.setJSON(rlKey, { t: Date.now() });
    let board = (await store.get('board', { type: 'json' })) || [];
    const prev = board.find(e => e.name === entry.name);
    if (!prev || entry.score > prev.score) board = board.filter(e => e.name !== entry.name).concat(entry);
    board.sort((a, b) => b.score - a.score || b.cgpa - a.cgpa);
    board = board.slice(0, KEEP);
    await store.setJSON('board', board);
    return json({ ok: true, rank: board.findIndex(e => e.name === entry.name) + 1 });
  }
  return json({ error: 'method not allowed' }, 405);
}

export default async (req, context) => handle(req, getStore({ name: 'hall-of-fame', consistency: 'strong' }), (context && context.ip) || 'unknown');
export const config = { path: '/api/scores' };
