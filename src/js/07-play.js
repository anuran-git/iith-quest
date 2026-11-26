// ─────────────────────────────────────────────────────────────────────────────
// 07-play.js — the platformer: physics, player, enemies, pickups, HUD.
// PlayScene(levelIndex) returns a scene { update(), draw(ctx) }.
// To add an enemy: add a sprite in 03-sprites.js, an entry in ENEMY_DEFS, and
// (if it needs new behaviour) a case in updateEnemy().
// ─────────────────────────────────────────────────────────────────────────────
const ENEMY_DEFS = {
  // box = hit box inside the 16x16 sprite [x, y, w, h]; stomp:false = cannot be jumped on
  bug:     { ai: 'walk', speed: 0.45, box: [2, 7, 11, 8] },
  clock:   { ai: 'walk', speed: 0.95, box: [2, 3, 11, 13] },
  book:    { ai: 'hop', speed: 0.6, every: 75, box: [1, 4, 14, 10] },
  plane:   { ai: 'fly', range: 44, amp: 8, rate: 0.022, box: [1, 4, 13, 9] },
  email:   { ai: 'fly', range: 56, amp: 20, rate: 0.03, box: [1, 3, 14, 10] },
  phone:   { ai: 'hover', amp: 16, rate: 0.045, box: [4, 1, 9, 12] },
  zzz:     { ai: 'drift', amp: 9, rate: 0.03, box: [1, 4, 14, 9], stomp: false },
  speaker: { ai: 'turret', every: 120, box: [2, 1, 12, 14] },
  printer: { ai: 'turret', every: 100, box: [1, 3, 14, 12] },
};

function tileAt(L, tx, ty) {
  if (tx < 0 || tx >= L.w) return TILE.BLOCK;
  if (ty < 0 || ty >= ROWS) return TILE.EMPTY;
  return L.tiles[tx + ty * L.w];
}
const isSolid = id => id === TILE.GROUND || id === TILE.BLOCK;

// Moves a body {x,y,w,h,vx,vy} through the tile grid. Sets onGround / hitWall.
function moveBody(L, b) {
  b.x += b.vx; b.hitWall = false;
  const y0 = Math.floor(b.y / T), y1 = Math.floor((b.y + b.h - 0.01) / T);
  if (b.vx > 0) {
    const tx = Math.floor((b.x + b.w - 0.01) / T);
    for (let ty = y0; ty <= y1; ty++) if (isSolid(tileAt(L, tx, ty))) { b.x = tx * T - b.w; b.vx = 0; b.hitWall = true; break; }
  } else if (b.vx < 0) {
    const tx = Math.floor(b.x / T);
    for (let ty = y0; ty <= y1; ty++) if (isSolid(tileAt(L, tx, ty))) { b.x = (tx + 1) * T; b.vx = 0; b.hitWall = true; break; }
  }
  const prevBottom = b.y + b.h;
  b.y += b.vy; b.onGround = false;
  const x0 = Math.floor(b.x / T), x1 = Math.floor((b.x + b.w - 0.01) / T);
  if (b.vy >= 0) {
    const ty = Math.floor((b.y + b.h - 0.01) / T);
    for (let tx = x0; tx <= x1; tx++) {
      const id = tileAt(L, tx, ty);
      if (isSolid(id) || (id === TILE.ONEWAY && prevBottom <= ty * T + 0.01)) { b.y = ty * T - b.h; b.vy = 0; b.onGround = true; break; }
    }
  } else {
    const ty = Math.floor(b.y / T);
    for (let tx = x0; tx <= x1; tx++) if (isSolid(tileAt(L, tx, ty))) { b.y = (ty + 1) * T; b.vy = 0; break; }
  }
  return prevBottom;
}

// GROW FEATURE (trial — remove by deleting the blocks marked GROW and the 'milk' items in 06-levels.js)
// Badam milk makes you BIG (like a mushroom); a hit while big shrinks you instead of costing a heart.
const SIZE = { small: { w: 10, h: 20 }, big: { w: 14, h: 28 } };
const _bigImg = new WeakMap();
function bigImg(img) {   // 16x24 sprite scaled 1.5x to 24x36 (nearest neighbour), cached
  let c = _bigImg.get(img); if (c) return c;
  const [bc, g] = makeCanvas(24, 36); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, 24, 36);
  _bigImg.set(img, bc); return bc;
}

function PlayScene(index) {
  const L = buildLevel(index);
  const sprites = Art.player(Save.data.char, L.outfit);
  const tiles = World.layers(L.theme).tiles;
  const camY = ROWS * T - H;
  const totalTime = L.time * 60;
  const p = { x: 0, y: 0, w: 10, h: 20, vx: 0, vy: 0, face: 1, onGround: false, coyote: 0, jbuf: 0, dashT: 0, dashCd: 0, airDash: false, inv: 0, power: 0, boost: 0, hp: TUNE.hearts, ride: null, big: false, growT: 0, wantBig: false };
  let coins, items, enemies, movers, springs, checks, goal;
  let shots = [], parts = [], texts = [];
  let cam = 0, frame = 0, timeLeft = totalTime, credits = 0, retries = 0, shake = 0;
  let state = 'ready', stateT = 0, paused = false, pauseMenu = null, ctrl = null, sub = null;
  let checkpoint = { x: L.spawn.x, y: L.spawn.y }, god = false;   // god: test-only invincibility

  function spawnEnemies() {
    enemies = L.ents.filter(e => e.type === 'enemy').map(e => ({ kind: e.kind, def: ENEMY_DEFS[e.kind], x: e.x, y: e.y, x0: e.x, y0: e.y, vx: 0, vy: 0, dir: -1, t: Math.floor(e.x) % 97, alive: true, dead: 0, onGround: false }));
    movers = L.ents.filter(e => e.type === 'mover').map(e => ({ x0: e.x, y0: e.y, x: e.x, y: e.y, w: e.w, h: 6, axis: e.axis, range: e.range, speed: e.speed, skin: e.skin, t: 0, dx: 0, dy: 0 }));
    shots = [];
  }
  function setup() {
    coins = L.ents.filter(e => e.type === 'coin').map(e => ({ x: e.x, y: e.y, got: false }));
    items = L.ents.filter(e => e.type === 'item').map(e => ({ kind: e.kind, x: e.x, y: e.y, got: false }));
    springs = L.ents.filter(e => e.type === 'spring').map(e => ({ x: e.x, y: e.y, t: 0 }));
    checks = L.ents.filter(e => e.type === 'check').map(e => ({ x: e.x, y: e.y, on: false }));
    goal = L.ents.find(e => e.type === 'goal');
    spawnEnemies(); placePlayer();
    cam = clamp(p.x - 130, 0, L.w * T - W);
    Sound.music(L.song);
  }
  function placePlayer() { p.x = checkpoint.x; p.y = checkpoint.y; p.vx = p.vy = 0; p.hp = TUNE.hearts; p.inv = retries ? 60 : 0; p.power = 0; p.dashT = 0; p.ride = null; p.face = 1; p.big = p.wantBig = false; p.growT = 0; p.w = SIZE.small.w; p.h = SIZE.small.h; }

  // ── effects ──
  function burst(x, y, col, n = 6) { for (let i = 0; i < n; i++) parts.push({ x, y, vx: rand(-1.5, 1.5), vy: rand(-2.2, 0.2), life: randi(14, 26), col }); }
  function say(x, y, str, col = C.white) { texts.push({ x, y, str, col, life: 55 }); }

  // GROW: resize around the feet / centre. Growing waits while something solid is overhead.
  function setSize(big) {
    const z = big ? SIZE.big : SIZE.small, nx = p.x + (p.w - z.w) / 2, ny = p.y + p.h - z.h;
    if (big) {
      const x0 = Math.floor(nx / T), x1 = Math.floor((nx + z.w - 0.01) / T), y0 = Math.floor(ny / T), y1 = Math.floor((ny + z.h - 0.01) / T);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (isSolid(tileAt(L, tx, ty))) { p.wantBig = true; return false; }
    }
    p.x = nx; p.y = ny; p.w = z.w; p.h = z.h; p.big = big; p.wantBig = false; p.growT = 40;
    Sound.sfx(big ? 'grow' : 'shrink'); return true;
  }
  function hurt() {
    if (god || p.inv > 0 || p.power > 0 || state !== 'play') return;
    if (p.big) {   // GROW: lose the size, keep the heart
      setSize(false); p.inv = TUNE.invuln; p.dashT = 0; shake = 6; burst(p.x + 5, p.y + 8, '#fff3c4', 8);
      say(p.x + 5, p.y - 10, 'SHRUNK!', '#ffb0b0'); return;
    }
    p.hp--; p.inv = TUNE.invuln; p.vx = -p.face * 2.2; p.vy = -3; p.dashT = 0; p.ride = null; shake = 8;
    burst(p.x + 5, p.y + 8, '#d33c3c', 8);
    if (p.hp <= 0) die('OUT OF ENERGY!'); else Sound.sfx('hurt');
  }
  function die(msg) {
    if (state !== 'play') return;
    state = 'dying'; stateT = 0; retries++; p.vy = -5.5; p.vx = 0; p.ride = null; shake = 10;
    Sound.sfx('die'); say(p.x + 5, p.y - 14, msg, '#ff8a8a');
  }

  // ── player ──
  function updatePlayer() {
    const I = Input;
    if (p.dashCd > 0) p.dashCd--;
    if (p.inv > 0) p.inv--;
    if (p.wantBig) setSize(true);   // GROW
    if (p.power > 0) { p.power--; if (frame % 4 === 0) parts.push({ x: p.x + rand(0, 10), y: p.y + rand(0, 20), vx: 0, vy: -0.4, life: 14, col: pick(['#f2c14e', '#fff3c4', '#e8833a']) }); }
    if (p.dashT > 0) {
      p.dashT--; p.vx = p.face * TUNE.dashSpeed; p.vy = 0;
      if (frame % 2 === 0) parts.push({ x: p.x + 5, y: p.y + rand(4, 18), vx: -p.face * 0.5, vy: 0, life: 10, col: '#f4efe6' });
    } else {
      const ax = (I.down.right ? 1 : 0) - (I.down.left ? 1 : 0);
      const max = TUNE.run * (p.power > 0 ? 1.2 : 1);
      if (ax) { p.vx = clamp(p.vx + ax * TUNE.accel, -max, max); p.face = ax; }
      else { p.vx *= p.onGround ? 0.72 : 0.92; if (Math.abs(p.vx) < 0.06) p.vx = 0; }
      if (p.boost > 0) p.boost--;   // springs float like a held jump
      p.vy = Math.min(p.vy + (p.vy < 0 && (I.down.jump || p.boost > 0) ? TUNE.gravUp : TUNE.gravDown), TUNE.maxFall);
    }
    p.coyote = p.onGround ? TUNE.coyote : p.coyote - 1;
    p.jbuf = I.pressed.jump ? TUNE.jumpBuffer : p.jbuf - 1;
    if (p.onGround) p.airDash = false;
    if (p.jbuf > 0 && p.coyote > 0) {
      p.vy = -TUNE.jump; p.jbuf = 0; p.coyote = 0; p.onGround = false; p.ride = null; p.dashT = 0;
      Sound.sfx('jump'); burst(p.x + 5, p.y + 20, '#d9e2e2', 3);
    }
    if (I.released.jump && p.vy < -2.2 && p.boost <= 0) p.vy *= 0.5;
    if (I.pressed.b && p.dashCd <= 0 && !p.airDash) {
      p.dashT = TUNE.dashTime; p.dashCd = TUNE.dashCooldown; if (!p.onGround) p.airDash = true; Sound.sfx('dash');
    }
    const prevBottom = moveBody(L, p);
    // moving platforms (one-way from above)
    if (p.ride && (p.x + p.w <= p.ride.x || p.x >= p.ride.x + p.ride.w)) p.ride = null;
    if (p.vy >= 0) for (const m of movers) {
      if (p.x + p.w > m.x + 1 && p.x < m.x + m.w - 1 && prevBottom <= m.y + 4 && p.y + p.h >= m.y) { p.y = m.y - p.h; p.vy = 0; p.onGround = true; p.ride = m; break; }
    }
    if (!p.onGround) p.ride = null;
    // hazards: spikes fill the lower half of their tile
    const hx0 = Math.floor((p.x + 2) / T), hx1 = Math.floor((p.x + p.w - 2.01) / T), hy = Math.floor((p.y + p.h - 1) / T);
    for (let tx = hx0; tx <= hx1; tx++) if (tileAt(L, tx, hy) === TILE.HAZARD && p.y + p.h > hy * T + 8) { hurt(); break; }
    if (p.y > ROWS * T + 30) die('MIND THE GAP!');
  }

  // ── enemies ──
  function updateEnemy(e) {
    const d = e.def; e.t++;
    if (d.ai === 'walk' || d.ai === 'hop') {
      const b = { x: e.x + 2, y: e.y + 4, w: 12, h: 12, vx: 0, vy: Math.min(e.vy + 0.4, 6) };
      if (d.ai === 'walk') b.vx = e.dir * d.speed;
      else {
        if (e.onGround && e.t % d.every === 0) {
          const ax = Math.floor((b.x + 6 + e.dir * 18) / T), ay = Math.floor((b.y + b.h + 2) / T);
          const below = tileAt(L, ax, ay);
          if (!isSolid(below) && below !== TILE.ONEWAY) e.dir *= -1;
          b.vy = -4.4;
        }
        b.vx = e.onGround && b.vy >= 0 ? 0 : e.dir * d.speed;
      }
      moveBody(L, b);
      e.x = b.x - 2; e.y = b.y - 4; e.vy = b.vy; e.onGround = b.onGround;
      if (b.hitWall) e.dir *= -1;
      else if (d.ai === 'walk' && b.onGround) {
        const fx = Math.floor((e.dir > 0 ? b.x + b.w + 1 : b.x - 1) / T);
        const under = tileAt(L, fx, Math.floor((b.y + b.h + 2) / T)), front = tileAt(L, fx, Math.floor((b.y + b.h - 2) / T));
        if ((!isSolid(under) && under !== TILE.ONEWAY) || front === TILE.HAZARD) e.dir *= -1;
      }
      if (e.y > ROWS * T + 40) e.alive = false;
    } else if (d.ai === 'fly') {
      e.x = e.x0 + Math.sin(e.t * d.rate) * d.range; e.y = e.y0 + Math.sin(e.t * d.rate * 2.3) * d.amp;
      e.dir = Math.cos(e.t * d.rate) > 0 ? 1 : -1;
    } else if (d.ai === 'hover') {
      e.y = e.y0 + Math.sin(e.t * d.rate) * d.amp;
    } else if (d.ai === 'drift') {
      const dx = p.x - e.x; if (Math.abs(dx) < 100) e.x = clamp(e.x + Math.sign(dx) * 0.25, e.x0 - 44, e.x0 + 44);
      e.y = e.y0 + Math.sin(e.t * d.rate) * d.amp;
    } else if (d.ai === 'turret') {
      const dx = p.x - e.x; e.dir = dx < 0 ? -1 : 1;
      if (e.t % d.every === 0 && Math.abs(dx) < 150) {
        shots.push({ x: e.x + 6, y: e.y + 2, vx: e.dir * 1.5, vy: -3.2, life: 160, kind: e.kind === 'speaker' ? 'note' : 'paper' });
        Sound.sfx('shoot');
      }
    }
  }
  function killEnemy(e) { e.alive = false; e.dead = 18; burst(e.x + 8, e.y + 8, '#f4efe6', 8); }

  function updateWorld() {
    // movers first, so the rider is carried before their own physics
    for (const m of movers) {
      const travel = m.range / m.speed, dwell = 40, period = 2 * (travel + dwell), ph = m.t++ % period;
      const off = ph < dwell ? 0 : ph < dwell + travel ? (ph - dwell) * m.speed : ph < 2 * dwell + travel ? m.range : m.range - (ph - 2 * dwell - travel) * m.speed;
      const nx = m.x0 + (m.axis === 'x' ? off : 0), ny = m.y0 - (m.axis === 'y' ? off : 0);
      m.dx = nx - m.x; m.dy = ny - m.y; m.x = nx; m.y = ny;
    }
    if (p.ride) { p.x += p.ride.dx; p.y = p.ride.y - p.h; }
    updatePlayer();
    if (state !== 'play') return;
    const box = { x: p.x, y: p.y, w: p.w, h: p.h };
    // pickups
    for (const c of coins) if (!c.got && overlap(box, { x: c.x, y: c.y, w: 8, h: 8 })) { c.got = true; credits++; Sound.sfx('coin'); burst(c.x + 4, c.y + 4, '#f2c14e', 3); }
    for (const it of items) if (!it.got && overlap(box, { x: it.x, y: it.y, w: 12, h: 12 })) {
      it.got = true; burst(it.x + 6, it.y + 6, '#fff3c4', 8);
      if (it.kind === 'chai') { p.hp = Math.min(TUNE.hearts, p.hp + 1); Sound.sfx('heart'); say(it.x + 6, it.y - 6, 'CHAI! +♥', '#ffb0b0'); }
      else if (it.kind === 'milk') {   // GROW
        if (p.big) { p.hp = Math.min(TUNE.hearts, p.hp + 1); Sound.sfx('heart'); say(it.x + 6, it.y - 6, 'BADAM MILK! +♥', '#fff3c4'); }
        else { setSize(true); say(it.x + 6, it.y - 6, 'BADAM MILK! GROW!', '#fff3c4'); }
      }
      else if (it.kind === 'maggi') { p.power = TUNE.powerTime; Sound.sfx('power'); say(it.x + 6, it.y - 6, 'MAGGI POWER!', '#f2c14e'); }
      else if (it.kind === 'clock') { timeLeft += 15 * 60; Sound.sfx('clock'); say(it.x + 6, it.y - 6, 'EXTENSION +15S', '#9fd8ff'); }
      else if (it.kind === 'big') { credits += 5; Sound.sfx('big'); say(it.x + 6, it.y - 6, '+5 CREDITS', '#f2c14e'); }
    }
    // springs
    for (const s of springs) { if (s.t > 0) s.t--; if (p.vy > 0 && overlap(box, { x: s.x + 1, y: s.y, w: 14, h: 8 })) { p.vy = -7.6; p.boost = 26; p.airDash = false; s.t = 12; Sound.sfx('spring'); } }
    // checkpoints
    for (const c of checks) if (!c.on && Math.abs(p.x - c.x) < 12 && Math.abs(p.y + p.h - (c.y + 32)) < 24) {
      c.on = true; checkpoint = { x: c.x - 2, y: c.y + 32 - SIZE.small.h - 1 }; Sound.sfx('check'); say(c.x, c.y - 6, 'CHECKPOINT', '#9be88a');
    }
    // enemies
    for (const e of enemies) {
      if (!e.alive) { if (e.dead > 0) e.dead--; continue; }
      if (e.x < cam - 48 || e.x > cam + W + 48) continue;
      updateEnemy(e);
      const b = e.def.box, eb = { x: e.x + b[0], y: e.y + b[1], w: b[2], h: b[3] };
      if (!overlap(box, eb)) continue;
      if (p.power > 0 || god) { killEnemy(e); Sound.sfx('stomp'); }
      else if (e.def.stomp !== false && p.vy > 0.4 && p.y + p.h - p.vy <= eb.y + eb.h * 0.6) {
        killEnemy(e); p.vy = Input.down.jump ? -5.2 : -3.6; p.airDash = false; Sound.sfx('stomp');
      } else hurt();
    }
    // turret shots
    for (const s of shots) {
      s.vy += 0.13; s.x += s.vx; s.y += s.vy; s.life--;
      if (isSolid(tileAt(L, Math.floor(s.x / T), Math.floor(s.y / T)))) s.life = 0;
      if (s.life > 0 && overlap(box, { x: s.x - 3, y: s.y - 3, w: 6, h: 6 })) { s.life = 0; hurt(); }
    }
    shots = shots.filter(s => s.life > 0);
    // goal
    if (goal && p.x + p.w > goal.x + 10 && p.onGround) { state = 'clear'; stateT = 0; Sound.stopMusic(); Sound.sfx('win'); }
    // deadline
    timeLeft--;
    if (timeLeft <= 600 && timeLeft > 0 && timeLeft % 60 === 0) Sound.sfx('tick');
    if (timeLeft <= 0) die('DEADLINE MISSED!');
  }

  function update() {
    if (paused) {
      if (Game.editingTouch) return;   // touch layout editor open
      if (ctrl) { ctrl.update(); return; }   // controls screen open from pause menu
      if (sub) { if (Input.pressed.back) { Sound.sfx('back'); sub = null; } else sub.update(); return; }   // touch controls sub-menu
      if (Input.pressed.pause) { paused = false; Sound.sfx('back'); return; }
      pauseMenu.update(); return;
    }
    frame++; stateT++;
    if (shake > 0) shake--;
    if (state === 'ready') { if (stateT > 80) { state = 'play'; stateT = 0; } }
    else if (state === 'play') {
      if (Input.pressed.pause || Input.pressed.start || Input.tapIn(W - 20, 0, 20, 18)) { openPause(); return; }
      if (p.growT > 0) p.growT--;   // GROW: brief freeze while changing size
      if (p.growT < 28) updateWorld();
    } else if (state === 'dying') {
      p.vy += 0.35; p.y += p.vy;
      if (stateT > 80) {
        if (timeLeft <= 0) timeLeft = Math.max(45 * 60, Math.floor(totalTime * 0.5));
        spawnEnemies(); placePlayer(); state = 'play'; stateT = 0;
      }
    } else if (state === 'clear') {
      p.vx = 1.2; p.vy = Math.min(p.vy + TUNE.gravDown, TUNE.maxFall); p.face = 1; if (p.x < goal.x + 12) moveBody(L, p); else p.vx = 0;
      if (stateT === 75) Game.go(BossScene({ level: index, credits, totalCredits: L.totalCredits, timeLeft, totalTime, retries, bossRetries: 0 }));
    }
    parts = parts.filter(q => { q.x += q.vx; q.y += q.vy; q.vy += 0.08; return --q.life > 0; });
    texts = texts.filter(t => { t.y -= 0.35; return --t.life > 0; });
    const target = clamp(p.x + 5 - 130 + p.face * 18, 0, L.w * T - W);
    cam += (target - cam) * 0.12;
  }

  function openPause() {
    paused = true; sub = null; Sound.sfx('select');
    pauseMenu = Menu([
      { label: 'RESUME', fn: () => { paused = false; } },
      { label: 'RESTART LEVEL', fn: () => Game.go(PlayScene(index)) },
      { label: () => 'MUSIC: ' + (Save.data.opts.music ? 'ON' : 'OFF'), fn: () => Save.toggle('music') },
      { label: () => 'SOUND FX: ' + (Save.data.opts.sfx ? 'ON' : 'OFF'), fn: () => Save.toggle('sfx') },
      ...(Input.usedTouch ? [{ label: 'TOUCH CONTROLS', fn: () => { sub = TouchMenu(() => { sub = null; }); } }] : []),
      { label: 'KEYBOARD CONTROLS', fn: () => { ctrl = ControlsScene(() => { ctrl = null; }); } },
      { label: 'QUIT TO MENU', fn: () => Game.go(TitleScene()) },
    ]);
  }

  // ── drawing ──
  function drawPlayer(ctx, ox) {
    if (p.inv > 0 && state === 'play' && (p.inv >> 2) % 2) return;
    let img = sprites.idle;
    if (state === 'dying' || !p.onGround) img = sprites.jump;
    else if (Math.abs(p.vx) > 0.3) img = sprites.run[(frame >> 2) % 4];
    // GROW: during the size change, flicker between the two sizes
    const showBig = p.growT > 28 ? ((p.growT >> 2) % 2 === 0) === p.big : p.big;
    if (showBig) img = bigImg(img);
    if (p.face < 0) img = Art.flip(img);
    const x = Math.round(p.x + p.w / 2 - img.width / 2 - ox), y = Math.round(p.y + p.h - img.height - camY);
    if (p.dashT > 0) { ctx.globalAlpha = 0.35; ctx.drawImage(img, x - p.face * 8, y); ctx.globalAlpha = 1; }
    ctx.drawImage(img, x, y);
  }
  function drawMover(ctx, m, ox) {
    const x = Math.round(m.x - ox), y = Math.round(m.y - camY);
    if (m.skin === 'shuttle') {
      ctx.fillStyle = C.ink; ctx.fillRect(x, y, m.w, 13); ctx.fillStyle = '#f4efe6'; ctx.fillRect(x + 1, y + 1, m.w - 2, 11);
      ctx.fillStyle = '#3aa6a6'; ctx.fillRect(x + 1, y + 8, m.w - 2, 2);
      ctx.fillStyle = '#2b4670'; for (let wx = x + 4; wx < x + m.w - 8; wx += 9) ctx.fillRect(wx, y + 3, 6, 4);
      ctx.fillStyle = C.ink; ctx.fillRect(x + 6, y + 12, 5, 3); ctx.fillRect(x + m.w - 11, y + 12, 5, 3);
      ctx.fillStyle = '#f2c14e'; ctx.fillRect(x + m.w - 3, y + 6, 2, 2);
    } else {
      ctx.fillStyle = C.ink; ctx.fillRect(x, y, m.w, 7); ctx.fillStyle = '#efe6d8'; ctx.fillRect(x + 1, y + 1, m.w - 2, 2);
      ctx.fillStyle = '#b3262e'; ctx.fillRect(x + 1, y + 3, m.w - 2, 3);
      ctx.fillStyle = '#f2c14e'; ctx.fillRect(x + 3, y + 4, 2, 1); ctx.fillRect(x + m.w - 5, y + 4, 2, 1);
    }
  }
  function drawHUD(ctx) {
    ctx.fillStyle = 'rgba(11,10,18,0.45)'; ctx.fillRect(0, 0, W, 15);
    for (let i = 0; i < TUNE.hearts; i++) Font.draw(ctx, '♥', 5 + i * 7, 4, i < p.hp ? '#ff5a6a' : '#4a3f55');
    ctx.drawImage(Art.coin[0], 32, 3); Font.draw(ctx, credits + '/' + L.totalCredits, 43, 4, '#fff3c4');
    const low = timeLeft < 20 * 60;
    Font.draw(ctx, fmtTime(timeLeft), W / 2, 4, low && (frame >> 3) % 2 ? '#ff5a6a' : C.white, { align: 'center' });
    Font.draw(ctx, 'L' + (index + 1) + ' ' + L.name, W - 24, 4, '#cfd6e6', { align: 'right' });
    ctx.fillStyle = C.white; ctx.fillRect(W - 14, 4, 2, 7); ctx.fillRect(W - 10, 4, 2, 7);   // pause icon
    if (p.dashCd > 0) { ctx.fillStyle = '#4a3f55'; ctx.fillRect(5, 13, 19, 1); ctx.fillStyle = '#7fe0e8'; ctx.fillRect(5, 13, Math.round(19 * (1 - p.dashCd / TUNE.dashCooldown)), 1); }
    if (p.power > 0) { ctx.fillStyle = '#f2c14e'; ctx.fillRect(0, 15, Math.round(W * p.power / TUNE.powerTime), 2); }
  }

  function draw(ctx) {
    const sx = shake > 0 ? randi(-1, 1) : 0, sy = shake > 0 ? randi(-1, 1) : 0;
    const ox = Math.round(cam) + sx;
    World.drawBackground(ctx, L.theme, cam, frame);
    ctx.save(); ctx.translate(0, sy);
    // decorations
    for (const d of L.decor) {
      if (d.type === 'hint') continue;
      const c = World.deco(d, L.theme), x = d.x - ox;
      if (x > W || x + c.width < 0) continue;
      ctx.drawImage(c, x, d.gy - c.height - camY);
    }
    // goal door
    if (goal) {
      const gx = goal.x - ox, gy = goal.y - camY;
      if (gx < W + 40) {
        ctx.fillStyle = C.ink; ctx.fillRect(gx, gy, 32, 40); ctx.fillStyle = '#efe6d8'; ctx.fillRect(gx + 1, gy + 1, 30, 39);
        ctx.fillStyle = '#b3262e'; ctx.fillRect(gx + 1, gy + 1, 30, 4); ctx.fillStyle = '#3d2434'; ctx.fillRect(gx + 6, gy + 9, 20, 31);
        ctx.fillStyle = '#f7d774'; ctx.fillRect(gx + 8, gy + 11, 16, 29); ctx.fillStyle = '#fff3c4'; ctx.fillRect(gx + 8, gy + 11, 5, 29);
        const lw = Font.width(goal.label) + 8;
        ctx.fillStyle = C.ink; ctx.fillRect(gx + 16 - lw / 2, gy - 14, lw, 12); ctx.fillStyle = '#f2c14e'; ctx.fillRect(gx + 17 - lw / 2, gy - 13, lw - 2, 10);
        Font.draw(ctx, goal.label, gx + 16, gy - 11, C.ink, { align: 'center' });
        if ((frame >> 4) % 2) Font.draw(ctx, '↓', gx + 16, gy - 26, '#fff3c4', { align: 'center', shadow: C.ink });
      }
    }
    // tiles
    const tx0 = Math.floor(ox / T);
    for (let tx = tx0; tx <= tx0 + W / T + 1; tx++) for (let ty = 0; ty < ROWS; ty++) {
      const id = tx >= 0 && tx < L.w ? L.tiles[tx + ty * L.w] : 0; if (!id) continue;
      const src = id === TILE.GROUND ? (ty > 0 && L.tiles[tx + (ty - 1) * L.w] === TILE.GROUND ? 1 : 0) : id;
      ctx.drawImage(tiles, src * T, 0, T, T, tx * T - ox, ty * T - camY, T, T);
    }
    // checkpoints, springs, movers
    for (const c of checks) {
      const x = c.x - ox, y = c.y - camY; if (x < -20 || x > W + 20) continue;
      ctx.fillStyle = C.ink; ctx.fillRect(x, y, 2, 32); ctx.fillStyle = '#c9ced6'; ctx.fillRect(x, y, 1, 32);
      ctx.fillStyle = C.ink; ctx.fillRect(x + 2, y + 1, 12, 9); ctx.fillStyle = c.on ? '#6fbf4a' : '#8a8f98'; ctx.fillRect(x + 2, y + 2, 11, 7);
      if (c.on) { ctx.fillStyle = '#f4efe6'; ctx.fillRect(x + 5, y + 5, 2, 2); ctx.fillRect(x + 7, y + 6, 1, 1); ctx.fillRect(x + 8, y + 5, 1, 1); ctx.fillRect(x + 9, y + 4, 1, 1); }
    }
    for (const s of springs) {
      const x = s.x - ox, y = s.y - camY, sq = s.t > 6 ? 3 : 0;
      ctx.fillStyle = C.ink; ctx.fillRect(x + 1, y + 5, 14, 3); ctx.fillStyle = '#8a8f98'; ctx.fillRect(x + 6, y + 2 + sq, 4, 3 - sq > 0 ? 3 - sq : 1);
      ctx.fillStyle = C.ink; ctx.fillRect(x, y - 1 + sq, 16, 3); ctx.fillStyle = '#e05a8a'; ctx.fillRect(x + 1, y + sq, 14, 1);
    }
    for (const m of movers) drawMover(ctx, m, ox);
    // pickups
    const cf = Art.coin[(frame >> 3) % 4];
    for (const c of coins) if (!c.got && c.x > ox - 10 && c.x < ox + W + 10) ctx.drawImage(cf, c.x - ox, c.y - camY);
    for (const it of items) if (!it.got && it.x > ox - 14 && it.x < ox + W + 14) { const im = Art.item[it.kind]; ctx.drawImage(im, it.x - ox + ((12 - im.width) >> 1), it.y - camY + Math.round(Math.sin(frame * 0.08 + it.x) * 1.5)); }
    // enemies
    for (const e of enemies) {
      if (e.x < ox - 20 || e.x > ox + W + 20) continue;
      if (!e.alive) { if (e.dead > 0) { ctx.globalAlpha = e.dead / 18; ctx.drawImage(Art.enemy[e.kind][0], 0, 0, 16, 16, Math.round(e.x - ox), Math.round(e.y - camY) + 10, 16, 6); ctx.globalAlpha = 1; } continue; }
      let img = Art.enemy[e.kind][(frame >> 3) % 2]; if (e.dir > 0) img = Art.flip(img);
      ctx.drawImage(img, Math.round(e.x - ox), Math.round(e.y - camY));
    }
    for (const s of shots) {
      const x = Math.round(s.x - ox), y = Math.round(s.y - camY);
      if (s.kind === 'note') { ctx.fillStyle = C.ink; ctx.fillRect(x - 3, y - 1, 5, 5); ctx.fillRect(x + 1, y - 6, 2, 6); ctx.fillStyle = '#f2c14e'; ctx.fillRect(x - 2, y, 3, 3); ctx.fillRect(x + 1, y - 5, 3, 2); }
      else { ctx.fillStyle = C.ink; ctx.fillRect(x - 3, y - 4, 7, 8); ctx.fillStyle = '#f4efe6'; ctx.fillRect(x - 2, y - 3, 5, 6); ctx.fillStyle = '#8a8f98'; ctx.fillRect(x - 1, y - 1, 3, 1); ctx.fillRect(x - 1, y + 1, 3, 1); }
    }
    drawPlayer(ctx, ox);
    for (const q of parts) { ctx.fillStyle = q.col; ctx.fillRect(Math.round(q.x - ox), Math.round(q.y - camY), 2, 2); }
    for (const t of texts) Font.draw(ctx, t.str, t.x - ox, t.y - camY, t.col, { align: 'center', shadow: C.ink });
    // tutorial hints
    for (const d of L.decor) if (d.type === 'hint' && Math.abs(p.x - d.x) < 96) {
      const w = Font.width(d.text) + 8, x = clamp(d.x - ox - w / 2, 2, W - w - 2), y = d.y - camY;
      ctx.fillStyle = 'rgba(11,10,18,0.75)'; ctx.fillRect(x, y, w, 12); Font.draw(ctx, d.text, x + 4, y + 3, '#fff3c4');
    }
    ctx.restore();
    drawHUD(ctx);
    if (state === 'ready') {
      const go = stateT > 50;
      Font.draw(ctx, go ? 'GO!' : 'READY?', W / 2, 70, go ? '#9be88a' : '#fff3c4', { align: 'center', scale: 3, shadow: C.ink });
    }
    if (state === 'clear') Font.draw(ctx, 'STAGE CLEAR!', W / 2, 66, '#fff3c4', { align: 'center', scale: 2, shadow: C.ink });
    if (paused && ctrl) { ctrl.draw(ctx); return; }
    if (paused) {
      ctx.fillStyle = 'rgba(11,10,18,0.78)'; ctx.fillRect(0, 0, W, H);
      Font.draw(ctx, 'PAUSED', W / 2, 24, '#fff3c4', { align: 'center', scale: 2, shadow: C.ink });
      if (sub) { Font.draw(ctx, 'TOUCH CONTROLS', W / 2, 52, '#9fe3f0', { align: 'center' }); sub.draw(ctx, W / 2, 72, 18); }
      else pauseMenu.draw(ctx, W / 2, 52, 15);
    }
  }

  setup();
  // `debug` is used by tools/test.js (bot play); not needed by the game itself
  return { update, draw, debug: { L, p, hurt: () => hurt(), get items() { return items; }, get state() { return state; }, get movers() { return movers; }, get enemies() { return enemies; }, get credits() { return credits; }, set god(v) { god = !!v; } } };
}
