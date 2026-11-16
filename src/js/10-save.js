// ─────────────────────────────────────────────────────────────────────────────
// 10-save.js — progress (localStorage), grading, the scoreboard adapter and
// the share card.
// ─────────────────────────────────────────────────────────────────────────────

// Turns a finished run into a percentage, letter grade and score.
//   run = { level, credits, totalCredits, timeLeft, totalTime, retries, boss (0..1), bossRetries }
function scoreRun(run) {
  const creditRatio = run.totalCredits ? Math.min(1, run.credits / run.totalCredits) : 1;
  const timeRatio = clamp(run.timeLeft / (run.totalTime * 0.5), 0, 1);       // full marks with half the time left
  const pct = clamp(Math.round(100 * (0.45 * creditRatio + 0.2 * timeRatio + 0.35 * run.boss) - 7 * run.retries - 5 * run.bossRetries), 0, 100);
  const gr = gradeFor(pct);
  const score = Math.max(0, run.credits * 100 + Math.round(run.timeLeft / 60) * 10 + Math.round(run.boss * 2000) - run.retries * 300 - run.bossRetries * 200);
  return { pct, grade: gr.g, pts: gr.p, score };
}

const Save = (() => {
  const fresh = () => ({ v: 1, char: 'boy', name: '', unlocked: 0, levels: {}, opts: { music: true, sfx: true, crt: true, upJumps: true }, keys: null });
  let data = fresh();
  function apply() { Sound.setOpts({ music: data.opts.music, sfx: data.opts.sfx }); document.body.classList.toggle('crt', !!data.opts.crt);
    Input.setBindings(data.keys, data.opts.upJumps !== false); if (typeof Game !== 'undefined' && Game.updateHint) Game.updateHint(); }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (d && d.v === 1) data = Object.assign(fresh(), d, { opts: Object.assign(fresh().opts, d.opts) });
    } catch (e) { /* storage unavailable: play without saving */ }
    apply();
  }
  function store() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) {} }
  function toggle(k) { data.opts[k] = !data.opts[k]; apply(); store(); }
  function setKeys(keys) { data.keys = keys; apply(); store(); }
  function reset() { data = Object.assign(fresh(), { opts: data.opts, keys: data.keys, char: data.char, name: data.name }); store(); }
  function record(run) {
    const r = scoreRun(run), prev = data.levels[run.level];
    r.best = !prev || r.score > prev.score;
    if (r.best) data.levels[run.level] = { grade: r.grade, pts: r.pts, pct: r.pct, score: r.score };
    data.unlocked = Math.max(data.unlocked, run.level + 1);
    store(); return r;
  }
  function cgpa() { const v = Object.values(data.levels); return v.length ? v.reduce((s, l) => s + l.pts, 0) / v.length : 0; }
  function totalScore() { return Object.values(data.levels).reduce((s, l) => s + l.score, 0); }
  const hasProgress = () => data.unlocked > 0;
  return { get data() { return data; }, load, store, toggle, setKeys, reset, record, cgpa, totalScore, hasProgress };
})();

// ── Scoreboard ──────────────────────────────────────────────────────────────
// The game only talks to Leaderboard.top(n) and Leaderboard.submit(entry).
//   entry = { name, char, cgpa, score, offer, date }
// RemoteBoard = global Hall of Fame (Netlify Function at /api/scores, see netlify/functions/scores.mjs).
// LocalBoard  = this device only; used as fallback when offline or when the game runs outside Netlify.
const LocalBoard = {
  read() { try { return JSON.parse(localStorage.getItem(BOARD_KEY) || '[]') || []; } catch (e) { return []; } },
  async top(n) { return this.read().slice(0, n); },
  async submit(entry) {
    let list = this.read().filter(e => !(e.name === entry.name && e.score <= entry.score));   // keep each name's best
    if (!list.some(e => e.name === entry.name)) list.push(entry);
    list.sort((a, b) => b.score - a.score);
    try { localStorage.setItem(BOARD_KEY, JSON.stringify(list.slice(0, 20))); } catch (e) {}
  },
};
const BOARD_URL = '/api/scores', PENDING_KEY = 'iith-quest-pending-v1';
const RemoteBoard = {
  available: /^https?:$/.test(location.protocol) && !/claude\.ai|claudeusercontent|localhost|127\.0\.0\.1/.test(location.hostname),
  async call(opts) {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 7000);
    try { const r = await fetch(BOARD_URL + (opts ? '' : '?limit=20'), Object.assign({ signal: ctl.signal, headers: { 'content-type': 'application/json' } }, opts || {}));
      if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
    finally { clearTimeout(to); }
  },
  async top(n) { return ((await this.call()).entries || []).slice(0, n); },
  async submit(entry) { return this.call({ method: 'POST', body: JSON.stringify(entry) }); },
};
const Leaderboard = {
  note: '', global: false, rank: 0,
  async top(n) {
    if (RemoteBoard.available) {
      try {
        await this.flush();
        const list = await RemoteBoard.top(n); this.global = true;
        this.note = 'GLOBAL HALL OF FAME  -  ALL PLAYERS'; return list;
      } catch (e) { this.note = 'OFFLINE  -  SHOWING SCORES ON THIS DEVICE'; }
    } else this.note = 'SCORES ON THIS DEVICE (GLOBAL BOARD WORKS ONCE HOSTED)';
    this.global = false; return LocalBoard.top(n).catch(() => []);
  },
  async submit(entry) {
    await LocalBoard.submit(entry).catch(() => {});
    if (!RemoteBoard.available) return;
    try { const r = await RemoteBoard.submit(entry); this.rank = r.rank || 0; try { localStorage.removeItem(PENDING_KEY); } catch (e) {} }
    catch (e) { try { localStorage.setItem(PENDING_KEY, JSON.stringify(entry)); } catch (e2) {} }   // retry next time the board opens
  },
  async flush() {
    let p = null; try { p = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null'); } catch (e) {}
    if (!p) return;
    try { const r = await RemoteBoard.submit(p); this.rank = r.rank || this.rank; localStorage.removeItem(PENDING_KEY); } catch (e) {}
  },
};

// ── Share card: renders the report card to a PNG and opens the share dialog ──
const Share = {
  render(d) {
    const [c, g] = makeCanvas(W, H);
    drawBackdrop(g, 'fest', 40, 0.4);
    Font.draw(g, 'I SURVIVED THE SEMESTER AT IITH!', W / 2, 10, '#fff3c4', { align: 'center', shadow: C.ink });
    drawReportCard(g, 10, 26, d);
    Font.draw(g, 'CAN YOU BEAT MY CGPA? PLAY IITH QUEST', W / 2, 148, '#9fe3f0', { align: 'center', shadow: C.ink });
    const host = /^https?:$/.test(location.protocol) && !/claude|localhost/.test(location.host) ? location.host + (location.pathname.length > 1 ? location.pathname : '') : '';
    if (host) Font.draw(g, host, W / 2, 162, '#f2c14e', { align: 'center', shadow: C.ink });
    const [out, og] = makeCanvas(W * 4, H * 4); og.drawImage(c, 0, 0, W * 4, H * 4);
    return out;
  },
  open(d) {
    const text = 'I graduated from IITH Quest with a CGPA of ' + d.cgpa.toFixed(2) + ' and a ' + d.offer.title.toLowerCase() + '. Can you beat it?';
    Game.showShare(Share.render(d), text);
  },
};
