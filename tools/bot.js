// Level bot shared by tools/test.js and tools/debug.js. The function is serialised and run inside the page.
// Runs in the page. Plays level i holding right, simulating jumps ahead of time.
function botPlay(i, trace) {
  const Q = window.IITHQuest, I = Q.Input, TU = Q.TUNE, T = 16;
  Q.Game.auto = false;
  const sc = Q.PlayScene(i), d = sc.debug, L = d.L, p = d.p;
  d.god = true;
  const tile = (tx, ty) => Q.tileAt(L, tx, ty), solid = id => id === 1 || id === 2, stand = id => id === 1 || id === 2 || id === 3;
  const onMover = (x, feet) => d.movers.some(m => x >= m.x && x <= m.x + m.w && Math.abs(m.y - feet) < 3);
  function sim(hold) {   // returns landing {x,y} for a jump held `hold` frames, or null
    const b = { x: p.x, y: p.y, w: p.w, h: p.h, vx: p.vx, vy: -TU.jump };
    for (let f = 1; f < 140; f++) {
      b.vx = Math.min(b.vx + TU.accel, TU.run);
      if (f === hold + 1 && b.vy < -2.2) b.vy *= 0.5;
      b.vy = Math.min(b.vy + (b.vy < 0 && f <= hold ? TU.gravUp : TU.gravDown), TU.maxFall);
      const prevBottom = Q.moveBody(L, b);
      if (b.vy >= 0) for (const m of d.movers) if (b.x + b.w > m.x + 1 && b.x < m.x + m.w - 1 && prevBottom <= m.y + 4 && b.y + b.h >= m.y) { b.y = m.y - b.h; b.onGround = true; }
      if (b.onGround) {
        const hz = tile(Math.floor((b.x + 5) / T), Math.floor((b.y + b.h - 1) / T)) === 4 || tile(Math.floor((b.x + 1) / T), Math.floor((b.y + b.h - 1) / T)) === 4 || tile(Math.floor((b.x + 9) / T), Math.floor((b.y + b.h - 1) / T)) === 4;
        return hz ? null : b;
      }
      if (b.y > 12 * T + 30) return null;
    }
    return null;
  }
  const log = []; let frames = 0, hold = 0, deaths = 0, wasDying = false, stuckAt = null, lastX = 0, stuck = 0; const diedAt = [];
  const key = (k, v) => I.set(k, v);
  while (frames < 60 * 240 && d.state !== 'clear') {
    frames++;
    let right = true, jump = hold > 0;
    if (d.state === 'play' && p.onGround && hold <= 0) {
      const feet = p.y + p.h, front = p.x + p.w;
      const ax = Math.floor((front + 5) / T), r0 = Math.floor(p.y / T), r1 = Math.floor((feet - 1) / T);
      const wall = solid(tile(ax, r0)) || solid(tile(ax, r1));
      const hz = tile(Math.floor((front + 7) / T), r1) === 4;
      const gx = Math.floor((front - 1) / T);
      let gap = !onMover(front - 1, feet);
      if (gap) for (let yy = Math.floor((feet + 1) / T); yy < 12; yy++) if (stand(tile(gx, yy))) { gap = false; break; }
      if (wall || hz || gap) {
        let pickd = null;
        for (const h of [2, 6, 10, 15, 30]) { const b = sim(h); if (b && (b.x > p.x + 8 || b.y < p.y - 6)) { pickd = h; break; } }
        if (pickd) { hold = pickd; jump = true; } else if (gap || hz) right = false;   // wait (e.g. for a moving platform)
      }
    }
    if (hold > 0) hold--;
    key('right', right); key('jump', jump);
    sc.update(); I.endTick();
    if (trace && p.x >= trace[0] * T && p.x <= trace[1] * T) log.push([frames, p.x.toFixed(1), p.y.toFixed(1), p.vx.toFixed(2), p.vy.toFixed(2), p.onGround ? 'G' : '-', jump ? 'J' : '-', right ? 'R' : '-', d.state].join(' '));
    if (d.state === 'dying' && !wasDying) { deaths++; diedAt.push(Math.round(p.x / T)); }
    wasDying = d.state === 'dying';
    if (d.state === 'play') { if (Math.abs(p.x - lastX) < 0.01) stuck++; else stuck = 0; lastX = p.x; if (stuck > 60 * 25) { stuckAt = Math.round(p.x / T); break; } }
    if (deaths > 6) break;
  }
  key('right', false); key('jump', false); I.endTick();
  return { level: i + 1, name: L.name, cleared: d.state === 'clear', seconds: Math.round(frames / 60), deaths, diedAt: diedAt.join(','), stuckAt, widthTiles: L.w, credits: d.credits, total: L.totalCredits, log: trace ? log : undefined };
}

module.exports = { botPlay };
