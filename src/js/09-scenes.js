// ─────────────────────────────────────────────────────────────────────────────
// 09-scenes.js — menus and story screens. A scene is { update(), draw(ctx) };
// switch with Game.go(SomeScene()). Flow:
//   Title → CharSelect → Intro(level) → Play → Boss → Result → Intro(next) … → Ending
// ─────────────────────────────────────────────────────────────────────────────

// Vertical menu. items: [{ label: 'TEXT' | () => 'TEXT', fn }]. Works with
// up/down + A/Enter and with direct taps.
function Menu(items) {
  const m = {
    sel: 0, items, rects: [],
    update() {
      const n = items.length;
      if (Input.pressed.up) { m.sel = (m.sel + n - 1) % n; Sound.sfx('select'); }
      if (Input.pressed.down) { m.sel = (m.sel + 1) % n; Sound.sfx('select'); }
      for (let i = 0; i < m.rects.length; i++) { const r = m.rects[i]; if (r && Input.tapIn(r[0], r[1], r[2], r[3])) { m.sel = i; Sound.sfx('confirm'); items[i].fn(); return; } }
      if (Input.confirm()) { Sound.sfx('confirm'); items[m.sel].fn(); }
    },
    draw(ctx, cx, y, gap = 14) {
      items.forEach((it, i) => {
        const label = typeof it.label === 'function' ? it.label() : it.label, w = Font.width(label), on = i === m.sel;
        if (on) { ctx.fillStyle = 'rgba(242,193,78,0.18)'; ctx.fillRect(cx - w / 2 - 13, y + i * gap - 3, w + 26, 13); Font.draw(ctx, '>', cx - w / 2 - 10, y + i * gap, '#f2c14e'); }
        Font.draw(ctx, label, cx, y + i * gap, on ? '#f2c14e' : C.white, { align: 'center', shadow: C.ink });
        m.rects[i] = [cx - 75, y + i * gap - 3, 150, gap];
      });
    },
  };
  return m;
}

// Scrolling campus backdrop used behind menus
function drawBackdrop(ctx, theme, t, dim) {
  World.drawBackground(ctx, theme, t * 0.6, t);
  const tl = World.layers(theme).tiles, off = Math.floor(t * 1.2) % T;
  for (let x = -off; x < W; x += T) { ctx.drawImage(tl, 0, 0, T, T, x, World.BASE, T, T); ctx.drawImage(tl, T, 0, T, T, x, World.BASE + T, T, T); }
  if (dim) { ctx.fillStyle = 'rgba(11,10,18,' + dim + ')'; ctx.fillRect(0, 0, W, H); }
}
function big(ctx, img, x, y, s) { ctx.drawImage(img, 0, 0, img.width, img.height, x, y, img.width * s, img.height * s); }

function TitleScene() {
  let t = 0, confirmNew = null;
  const prog = Save.hasProgress();
  const items = [];
  if (prog) items.push({ label: 'CONTINUE', fn: () => Game.go(Save.data.unlocked >= LEVELS.length ? LevelSelectScene() : IntroScene(Save.data.unlocked)) });
  items.push({ label: 'NEW GAME', fn: () => { if (prog) confirmNew = Menu([{ label: 'NO, KEEP MY PROGRESS', fn: () => { confirmNew = null; } }, { label: 'YES, START OVER', fn: () => { Save.reset(); Game.go(CharScene()); } }]); else Game.go(CharScene()); } });
  if (prog) items.push({ label: 'LEVEL SELECT', fn: () => Game.go(LevelSelectScene()) });
  items.push({ label: 'HALL OF FAME', fn: () => Game.go(BoardScene()) }, { label: 'OPTIONS', fn: () => Game.go(OptionsScene()) }, { label: 'HOW TO PLAY', fn: () => Game.go(HelpScene()) });
  const menu = Menu(items);
  const boy = Art.player('boy'), girl = Art.player('girl');
  Sound.music('title');
  return {
    update() { t++; if (confirmNew) { if (Input.cancel()) confirmNew = null; else confirmNew.update(); } else menu.update(); },
    draw(ctx) {
      drawBackdrop(ctx, 'day', t);
      big(ctx, boy.run[(t >> 2) % 4], 20, World.BASE - 48, 2); big(ctx, girl.run[((t >> 2) + 2) % 4], 268, World.BASE - 48, 2);
      ctx.fillStyle = 'rgba(11,10,18,0.55)'; ctx.fillRect(0, 10, W, 50);
      Font.draw(ctx, 'IITH', 44, 16, '#f4efe6', { scale: 4, shadow: '#7d1a25' }); Font.draw(ctx, 'QUEST', 160, 16, '#f2c14e', { scale: 4, shadow: '#7d1a25' });
      Font.draw(ctx, 'SURVIVE THE SEMESTER', W / 2, 49, '#9fe3f0', { align: 'center' });
      const h = (confirmNew ? 2 : items.length) * 13 + 10;
      ctx.fillStyle = 'rgba(11,10,18,0.72)'; ctx.fillRect(78, 64, 164, confirmNew ? h + 14 : h);
      if (confirmNew) { Font.draw(ctx, 'ERASE SAVED PROGRESS?', W / 2, 69, '#ff8a8a', { align: 'center' }); confirmNew.draw(ctx, W / 2, 84, 13); }
      else menu.draw(ctx, W / 2, 70, 13);
      Font.draw(ctx, 'V' + VERSION, W - 4, H - 9, '#565b66', { align: 'right' });
    },
  };
}

function CharScene() {
  let t = 0, focus = 1;   // 0 = name row, 1 = start
  const kinds = ['boy', 'girl'], art = { boy: Art.player('boy'), girl: Art.player('girl') };
  const cardX = i => 70 + i * 104;
  function begin() { Save.store(); Sound.sfx('confirm'); Game.go(IntroScene(0)); }
  function editName() { Game.askName(Save.data.name, n => { Save.data.name = n; Save.store(); }); }
  return {
    update() {
      t++;
      if (Input.pressed.left || Input.pressed.right) { Save.data.char = Save.data.char === 'boy' ? 'girl' : 'boy'; Sound.sfx('select'); }
      if (Input.pressed.up || Input.pressed.down) { focus = 1 - focus; Sound.sfx('select'); }
      kinds.forEach((k, i) => { if (Input.tapIn(cardX(i), 30, 76, 92) && Save.data.char !== k) { Save.data.char = k; Sound.sfx('select'); } });
      if (Input.tapIn(60, 128, 200, 13)) { focus = 0; editName(); return; }
      if (Input.tapIn(100, 144, 120, 16)) { begin(); return; }
      if (Input.cancel()) { Sound.sfx('back'); Game.go(TitleScene()); return; }
      if (Input.confirm()) { if (focus === 0) editName(); else begin(); }
    },
    draw(ctx) {
      drawBackdrop(ctx, 'day', t, 0.6);
      Font.draw(ctx, 'CHOOSE YOUR STUDENT', W / 2, 10, '#fff3c4', { align: 'center', scale: 2, shadow: C.ink });
      kinds.forEach((k, i) => {
        const on = Save.data.char === k, x = cardX(i);
        panel(ctx, x, 30, 76, 92, on ? '#47196b' : '#221a33', on ? '#f2c14e' : '#6b6480');
        ctx.globalAlpha = on ? 1 : 0.55; big(ctx, on ? art[k].run[(t >> 2) % 4] : art[k].idle, x + 14, 34, 3); ctx.globalAlpha = 1;
        Font.draw(ctx, k === 'boy' ? 'BOY' : 'GIRL', x + 38, 110, on ? '#f2c14e' : '#8a8f98', { align: 'center' });
      });
      Font.draw(ctx, '←', 56, 72, '#f2c14e', { align: 'center' }); Font.draw(ctx, '→', 264, 72, '#f2c14e', { align: 'center' });
      const nm = 'NAME: ' + (Save.data.name || '(TAP TO SET)');
      Font.draw(ctx, nm, W / 2, 131, focus === 0 ? '#f2c14e' : C.white, { align: 'center', shadow: C.ink });
      panel(ctx, 100, 144, 120, 16, focus === 1 ? '#b3262e' : '#3d2434', focus === 1 ? '#f2c14e' : '#8a8f98');
      Font.draw(ctx, 'START SEMESTER', W / 2, 149, C.white, { align: 'center' });
      Font.draw(ctx, '← → CHOOSE   ↑ ↓ NAME   A START   B BACK', W / 2, 167, '#8a8f98', { align: 'center' });
    },
  };
}

function LevelSelectScene() {
  let t = 0, sel = Math.min(Save.data.unlocked, LEVELS.length - 1);
  const X = i => 11 + (i % 4) * 76, Y = i => 34 + Math.floor(i / 4) * 64;
  function open(i) { if (i <= Save.data.unlocked) { Sound.sfx('confirm'); Game.go(IntroScene(i)); } else Sound.sfx('bad'); }
  return {
    update() {
      t++;
      const prev = sel;
      if (Input.pressed.left) sel = (sel + 7) % 8; if (Input.pressed.right) sel = (sel + 1) % 8;
      if (Input.pressed.up || Input.pressed.down) sel = (sel + 4) % 8;
      if (sel !== prev) Sound.sfx('select');
      for (let i = 0; i < 8; i++) if (Input.tapIn(X(i), Y(i), 70, 58)) { sel = i; open(i); return; }
      if (Input.cancel()) { Sound.sfx('back'); Game.go(TitleScene()); return; }
      if (Input.confirm()) open(sel);
    },
    draw(ctx) {
      drawBackdrop(ctx, 'day', t, 0.7);
      Font.draw(ctx, 'SELECT LEVEL', W / 2, 10, '#fff3c4', { align: 'center', scale: 2, shadow: C.ink });
      LEVELS.forEach((lv, i) => {
        const locked = i > Save.data.unlocked, on = i === sel, best = Save.data.levels[i];
        panel(ctx, X(i), Y(i), 70, 58, on ? '#47196b' : '#221a33', on ? '#f2c14e' : locked ? '#4a3f55' : '#8a8f98');
        Font.draw(ctx, 'L' + (i + 1), X(i) + 6, Y(i) + 6, locked ? '#565b66' : '#9fe3f0');
        if (best) Font.draw(ctx, best.grade, X(i) + 64, Y(i) + 6, '#f2c14e', { align: 'right' });
        Font.wrap(lv.name, 11).forEach((l, k) => Font.draw(ctx, l, X(i) + 35, Y(i) + 19 + k * 9, locked ? '#565b66' : C.white, { align: 'center' }));
        if (locked) Font.draw(ctx, 'LOCKED', X(i) + 35, Y(i) + 45, '#7d1a25', { align: 'center' });
        else if (best) Font.draw(ctx, best.pct + '%', X(i) + 35, Y(i) + 45, '#9be88a', { align: 'center' });
        else Font.draw(ctx, 'NEW!', X(i) + 35, Y(i) + 45, '#f2c14e', { align: 'center' });
      });
      const cg = Save.cgpa();
      Font.draw(ctx, (cg ? 'CGPA ' + cg.toFixed(2) + '   ' : '') + 'A PLAY   B BACK', W / 2, 166, '#cfd6e6', { align: 'center', shadow: C.ink });
    },
  };
}

function IntroScene(i) {
  const L = LEVELS[i]; let t = 0;
  const art = Art.player(Save.data.char, L.outfit);
  Sound.music(L.song);
  return {
    update() {
      t++;
      if (Input.cancel()) { Sound.sfx('back'); Game.go(TitleScene()); return; }
      if (t > 20 && (Input.confirm() || Input.tap)) { Sound.sfx('confirm'); Game.go(PlayScene(i)); }
    },
    draw(ctx) {
      drawBackdrop(ctx, L.theme, t, 0.62);
      Font.draw(ctx, 'LEVEL ' + (i + 1) + ' OF ' + LEVELS.length, 16, 14, '#f2c14e', { shadow: C.ink });
      Font.draw(ctx, L.name, 16, 26, C.white, { scale: 2, shadow: '#7d1a25' });
      Font.draw(ctx, L.place, 16, 46, '#9fe3f0', { shadow: C.ink });
      let y = Font.para(ctx, L.intro, 16, 62, 36, '#e6e0d4', { shadow: C.ink });
      Font.draw(ctx, 'DEADLINE  ' + fmtTime(L.time * 60), 16, y + 6, '#ff8a8a', { shadow: C.ink });
      Font.draw(ctx, 'BOSS      ' + L.boss.title, 16, y + 17, '#ff8a8a', { shadow: C.ink });
      big(ctx, art.run[(t >> 2) % 4], 252, 56, 3);
      if ((t >> 4) % 2) Font.draw(ctx, 'PRESS A / TAP TO START', W / 2, 160, '#f2c14e', { align: 'center', shadow: C.ink });
    },
  };
}

function ResultScene(run) {
  const L = LEVELS[run.level], res = Save.record(run);
  const last = run.level === LEVELS.length - 1;
  const rows = [
    ['CREDITS', run.credits + '/' + run.totalCredits], ['TIME LEFT', fmtTime(run.timeLeft)],
    ['BOSS ROUND', Math.round(run.boss * 100) + '%'], ['RETRIES', String(run.retries + run.bossRetries)],
  ];
  let t = 0; const SHOW = rows.length * 22 + 30;
  Sound.music('title');
  return {
    update() {
      t++;
      if (t < SHOW && t % 22 === 0) Sound.sfx('tick');
      if (t === SHOW) Sound.sfx('big');
      if (t < SHOW) { if (Input.confirm() || Input.tap) t = SHOW; return; }
      if (t > SHOW + 20 && (Input.confirm() || Input.tap)) { Sound.sfx('confirm'); Game.go(last ? EndingScene() : IntroScene(run.level + 1)); }
    },
    draw(ctx) {
      drawBackdrop(ctx, L.theme, t, 0.7);
      Font.draw(ctx, 'LEVEL ' + (run.level + 1) + ' CLEARED', W / 2, 10, '#9be88a', { align: 'center', scale: 2, shadow: C.ink });
      Font.draw(ctx, L.name, W / 2, 30, '#cfd6e6', { align: 'center' });
      panel(ctx, 20, 44, 170, 70);
      rows.forEach((r, i) => { if (t > (i + 1) * 22) { Font.draw(ctx, r[0], 30, 52 + i * 15, '#9fe3f0'); Font.draw(ctx, r[1], 180, 52 + i * 15, C.white, { align: 'right' }); } });
      panel(ctx, 200, 44, 100, 70, '#47196b', '#f2c14e');
      Font.draw(ctx, 'GRADE', 250, 50, '#f2c14e', { align: 'center' });
      if (t >= SHOW) {
        Font.draw(ctx, res.grade, 250, 64, C.white, { align: 'center', scale: 4, shadow: '#7d1a25' });
        Font.draw(ctx, res.pct + '%' + (res.best ? '  NEW BEST' : ''), 250, 100, '#9be88a', { align: 'center' });
        Font.draw(ctx, 'CGPA SO FAR  ' + Save.cgpa().toFixed(2), W / 2, 124, '#fff3c4', { align: 'center', shadow: C.ink });
        if (run.level === 6) Font.draw(ctx, 'RESULT: ' + offerFor(Save.cgpa()).title + '!', W / 2, 137, '#f2c14e', { align: 'center', shadow: C.ink });
        if (t > SHOW + 20 && (t >> 4) % 2) Font.draw(ctx, last ? 'PRESS A FOR CONVOCATION' : 'PRESS A / TAP FOR NEXT LEVEL', W / 2, 158, '#f2c14e', { align: 'center', shadow: C.ink });
      }
    },
  };
}

// The shareable report card (also rendered into the share image)
function reportData() {
  const cg = Save.cgpa(), off = offerFor(cg);
  return { name: Save.data.name || 'STUDENT', char: Save.data.char, cgpa: cg, score: Save.totalScore(), offer: off, grades: LEVELS.map((_, i) => Save.data.levels[i] ? Save.data.levels[i].grade : '-') };
}
function drawReportCard(ctx, x, y, d, t = 0) {
  panel(ctx, x, y, 300, 112, '#f4efe6', '#7d1a25');
  ctx.fillStyle = '#b3262e'; ctx.fillRect(x + 2, y + 2, 296, 13); Font.draw(ctx, 'IITH QUEST  -  SEMESTER REPORT CARD', x + 150, y + 5, '#fff3c4', { align: 'center' });
  big(ctx, Art.player(d.char, 'gown').idle, x + 12, y + 22, 2);
  Font.draw(ctx, d.name, x + 8, y + 74, C.ink);
  Font.draw(ctx, 'CGPA', x + 64, y + 22, '#7d1a25'); Font.draw(ctx, d.cgpa.toFixed(2), x + 64, y + 32, C.ink, { scale: 3 });
  Font.draw(ctx, 'SCORE', x + 64, y + 60, '#7d1a25'); Font.draw(ctx, String(d.score), x + 100, y + 60, C.ink);
  ctx.fillStyle = '#efe0b8'; ctx.fillRect(x + 158, y + 20, 134, 50); ctx.fillStyle = '#c9962e'; ctx.fillRect(x + 158, y + 20, 134, 1); ctx.fillRect(x + 158, y + 69, 134, 1);
  Font.draw(ctx, 'PLACEMENT', x + 225, y + 25, '#7d1a25', { align: 'center' });
  Font.draw(ctx, d.offer.title, x + 225, y + 37, C.ink, { align: 'center' });
  Font.draw(ctx, d.offer.co, x + 225, y + 48, '#3b5d8f', { align: 'center' });
  Font.draw(ctx, '★ ★ ★', x + 225, y + 59, '#c9962e', { align: 'center' });
  d.grades.forEach((g, i) => {
    const gx = x + 10 + i * 35.5; ctx.fillStyle = '#3d2434'; ctx.fillRect(gx, y + 86, 32, 20); ctx.fillStyle = '#fff8e8'; ctx.fillRect(gx + 1, y + 87, 30, 18);
    Font.draw(ctx, 'L' + (i + 1), gx + 3, y + 89, '#8a8f98'); Font.draw(ctx, g, gx + 28, y + 96, '#b3262e', { align: 'right' });
  });
}

function EndingScene() {
  let t = 0, fw = [];
  const d = reportData(), art = Art.player(Save.data.char, 'gown');
  Leaderboard.submit({ name: d.name, char: d.char, cgpa: Math.round(d.cgpa * 100) / 100, score: d.score, offer: d.offer.title, date: Date.now() });
  const menu = Menu([
    { label: 'SHARE REPORT CARD', fn: () => Share.open(d) },
    { label: 'HALL OF FAME', fn: () => Game.go(BoardScene()) },
    { label: 'BACK TO MENU', fn: () => Game.go(TitleScene()) },
  ]);
  Sound.music('party');
  return {
    update() {
      t++;
      if (t % 26 === 1) { const x = rand(30, W - 30), y = rand(16, 70), col = pick(['#f2c14e', '#e05a8a', '#7fe0e8', '#9be88a', '#f4efe6']); for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2, s = rand(0.8, 2); fw.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: randi(24, 40), col }); } if (t < 400 && t % 52 === 1) Sound.sfx('boom'); }
      fw = fw.filter(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.04; return --p.life > 0; });
      if (t < 150) { if (Input.confirm() || Input.tap) t = 150; return; }
      menu.update();
    },
    draw(ctx) {
      drawBackdrop(ctx, t < 150 ? 'gold' : 'fest', t, t < 150 ? 0 : 0.35);
      fw.forEach(p => { ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); });
      if (t < 150) {
        const hop = Math.abs(Math.sin(t * 0.12)) * 14;
        big(ctx, hop > 2 ? art.jump : art.idle, W / 2 - 24, World.BASE - 72 - hop, 3);
        Font.draw(ctx, 'CONGRATULATIONS!', W / 2, 20, '#fff3c4', { align: 'center', scale: 3, shadow: '#7d1a25' });
        Font.draw(ctx, d.name + ', YOU GRADUATED!', W / 2, 50, C.white, { align: 'center', shadow: C.ink });
      } else { drawReportCard(ctx, 10, 6, d, t); menu.draw(ctx, W / 2, 128, 14); }
    },
  };
}

function OptionsScene() {
  let t = 0, confirmReset = false;
  const menu = Menu([
    { label: () => 'MUSIC: ' + (Save.data.opts.music ? 'ON' : 'OFF'), fn: () => Save.toggle('music') },
    { label: () => 'SOUND FX: ' + (Save.data.opts.sfx ? 'ON' : 'OFF'), fn: () => Save.toggle('sfx') },
    { label: () => 'CRT SCANLINES: ' + (Save.data.opts.crt ? 'ON' : 'OFF'), fn: () => Save.toggle('crt') },
    { label: 'KEYBOARD CONTROLS', fn: () => Game.go(ControlsScene()) },
    { label: () => confirmReset ? 'SURE? PRESS AGAIN TO ERASE' : 'RESET PROGRESS', fn: () => { if (confirmReset) { Save.reset(); confirmReset = false; Sound.sfx('lose'); } else confirmReset = true; } },
    { label: 'BACK', fn: () => Game.go(TitleScene()) },
  ]);
  return {
    update() { t++; if (Input.cancel()) { Sound.sfx('back'); Game.go(TitleScene()); return; } const s = menu.sel; menu.update(); if (menu.sel !== s) confirmReset = false; },
    draw(ctx) {
      drawBackdrop(ctx, 'night', t, 0.55);
      Font.draw(ctx, 'OPTIONS', W / 2, 16, '#fff3c4', { align: 'center', scale: 2, shadow: C.ink });
      menu.draw(ctx, W / 2, 54, 18);
      Font.draw(ctx, 'PROGRESS IS SAVED ON THIS DEVICE', W / 2, 160, '#8a8f98', { align: 'center' });
    },
  };
}

function HelpScene() {
  let t = 0;
  const k = Input.bindings, n = c => Input.keyName(c), two = (a, b) => b ? n(a) + '  OR  ' + n(b) : n(a);
  const rows = [['MOVE', n(k.left[0]) + ' ' + n(k.right[0]) + (k.left[1] && k.right[1] ? '  OR  ' + n(k.left[1]) + ' ' + n(k.right[1]) : ''), 'D-PAD'],
    ['JUMP', two(k.jump[0], k.jump[1]), 'A BUTTON'], ['DASH', two(k.dash[0], k.dash[1]), 'B BUTTON'], ['PAUSE', two(k.pause[0], k.pause[1] || 'Escape'), 'START']];
  const legend = [[Art.coin[0], 'CREDIT'], [Art.item.big, '+5'], [Art.item.milk, 'GROW'], [Art.item.chai, '+1 ♥'], [Art.item.maggi, 'INVINCIBLE'], [Art.item.clock, '+15 SEC']];
  return {
    update() { t++; if (t > 10 && (Input.cancel() || Input.confirm() || Input.tap)) { Sound.sfx('back'); Game.go(TitleScene()); } },
    draw(ctx) {
      drawBackdrop(ctx, 'morning', t, 0.72);
      Font.draw(ctx, 'HOW TO PLAY', W / 2, 8, '#fff3c4', { align: 'center', scale: 2, shadow: C.ink });
      Font.draw(ctx, 'KEYBOARD', 132, 30, '#f2c14e', { align: 'center' }); Font.draw(ctx, 'TOUCH / PAD', 250, 30, '#f2c14e', { align: 'center' });
      rows.forEach((r, i) => { Font.draw(ctx, r[0], 20, 42 + i * 11, '#9fe3f0'); Font.draw(ctx, r[1], 132, 42 + i * 11, C.white, { align: 'center' }); Font.draw(ctx, r[2], 250, 42 + i * 11, C.white, { align: 'center' }); });
      legend.forEach((l, i) => { const x = 8 + i * 51; ctx.drawImage(l[0], x + 24 - (l[0].width >> 1), 92); Font.draw(ctx, l[1], x + 24, 108, '#e6e0d4', { align: 'center' }); });
      Font.draw(ctx, 'JUMP ON ENEMIES TO STOMP THEM. SLEEP CLOUDS', W / 2, 124, C.white, { align: 'center' });
      Font.draw(ctx, "CAN'T BE STOMPED. BEAT THE DEADLINE, THEN THE BOSS.", W / 2, 134, C.white, { align: 'center' });
      Font.draw(ctx, 'CREDITS + SPEED + BOSS SCORE = YOUR GRADE.', W / 2, 144, '#9be88a', { align: 'center' });
      Font.draw(ctx, 'FAN-MADE. NOT AN OFFICIAL IIT HYDERABAD PRODUCT.', W / 2, 160, '#8a8f98', { align: 'center' });
      Font.draw(ctx, 'PRESS ANY BUTTON TO GO BACK', W / 2, 170, '#f2c14e', { align: 'center' });
    },
  };
}

function BoardScene() {
  let t = 0, list = null;
  const me = Save.data.name || 'STUDENT';
  Leaderboard.top(8).then(l => { list = l; }).catch(() => { list = []; });
  return {
    update() { t++; if (t > 10 && (Input.cancel() || Input.confirm() || Input.tap)) { Sound.sfx('back'); Game.go(TitleScene()); } },
    draw(ctx) {
      drawBackdrop(ctx, 'fest', t, 0.6);
      Font.draw(ctx, 'HALL OF FAME', W / 2, 8, '#fff3c4', { align: 'center', scale: 2, shadow: C.ink });
      Font.draw(ctx, '#', 22, 32, '#f2c14e'); Font.draw(ctx, 'NAME', 40, 32, '#f2c14e'); Font.draw(ctx, 'CGPA', 150, 32, '#f2c14e', { align: 'right' }); Font.draw(ctx, 'SCORE', 205, 32, '#f2c14e', { align: 'right' }); Font.draw(ctx, 'PLACEMENT', 215, 32, '#f2c14e');
      if (!list) Font.draw(ctx, 'LOADING...', W / 2, 80, C.white, { align: 'center' });
      else if (!list.length) { Font.draw(ctx, 'NO GRADUATES YET.', W / 2, 74, C.white, { align: 'center' }); Font.draw(ctx, 'FINISH ALL 8 LEVELS TO GET ON THE BOARD!', W / 2, 88, '#9fe3f0', { align: 'center' }); }
      else list.forEach((e, i) => {
        const y = 45 + i * 13, mine = e.name === me && e.char === Save.data.char, col = mine ? '#9be88a' : i === 0 ? '#fff3c4' : C.white;
        if (mine) { ctx.fillStyle = 'rgba(155,232,138,0.14)'; ctx.fillRect(16, y - 3, 288, 12); }
        Font.draw(ctx, String(i + 1), 22, y, '#9fe3f0'); Font.draw(ctx, String(e.name).slice(0, 10), 40, y, col);
        Font.draw(ctx, Number(e.cgpa).toFixed(2), 150, y, col, { align: 'right' }); Font.draw(ctx, String(e.score), 205, y, col, { align: 'right' }); Font.draw(ctx, String(e.offer).replace(' OFFER', '').slice(0, 17), 215, y, '#9be88a');
      });
      if (list && Leaderboard.global && Leaderboard.rank > 8) Font.draw(ctx, 'YOUR RANK: #' + Leaderboard.rank, W / 2, 148, '#9be88a', { align: 'center' });
      Font.draw(ctx, list ? Leaderboard.note : '', W / 2, 158, Leaderboard.global ? '#9fe3f0' : '#8a8f98', { align: 'center' });
      Font.draw(ctx, 'PRESS ANY BUTTON TO GO BACK', W / 2, 169, '#f2c14e', { align: 'center' });
    },
  };
}

// Keyboard remapping. Rows = actions (2 key slots each) + options. A/Enter on a slot → press the new key.
// Esc cancels, Delete clears a second slot. Taking a key already in use swaps the two bindings.
function ControlsScene() {
  let t = 0, row = 0, col = 0, waiting = false, msg = '';
  const acts = Input.ACTIONS, extra = ['UP ALSO JUMPS', 'RESET TO DEFAULTS', 'BACK'], N = acts.length + extra.length;
  const keys = () => { const k = {}; for (const a of acts) k[a.id] = Input.bindings[a.id].slice(); return k; };
  const rectOf = (r, c) => c < 0 ? [60, 34 + r * 12 - 2, 200, 11] : [c ? 214 : 134, 34 + r * 12 - 2, 72, 11];
  function assign(r, c, code) {
    const k = keys(), a = acts[r].id, old = k[a][c];
    if (code === 'Delete') { if (c === 1 || k[a][1]) { if (c === 0) { k[a][0] = k[a][1]; } k[a][c === 0 ? 1 : c] = null; msg = 'CLEARED'; } else { msg = 'EACH ACTION NEEDS A KEY'; return; } }
    else if (code === 'Enter' || code === 'NumpadEnter') { msg = 'ENTER IS RESERVED FOR MENUS'; return; }
    else {
      for (const b of acts) for (let j = 0; j < 2; j++) if (k[b.id][j] === code && !(b.id === a && j === c)) {
        k[b.id][j] = old; msg = Input.keyName(code) + ' SWAPPED WITH ' + b.label;
        if (!k[b.id][0]) { k[b.id][0] = k[b.id][1]; k[b.id][1] = null; }
      }
      k[a][c] = code; if (!msg) msg = acts[r].label + ' = ' + Input.keyName(code);
    }
    Save.setKeys(k); Sound.sfx('confirm');
  }
  function activate() {
    msg = '';
    if (row < acts.length) { waiting = true; Sound.sfx('select'); Input.captureNext(code => { waiting = false; if (code) assign(row, col, code); else { msg = 'CANCELLED'; Sound.sfx('back'); } }); }
    else if (row === acts.length) { Save.toggle('upJumps'); Sound.sfx('confirm'); }
    else if (row === acts.length + 1) { Save.data.opts.upJumps = true; Save.setKeys(null); msg = 'DEFAULTS RESTORED'; Sound.sfx('confirm'); }
    else { Sound.sfx('back'); Game.go(OptionsScene()); }
  }
  return {
    update() {
      t++; if (waiting) return;
      if (Input.pressed.up) { row = (row + N - 1) % N; Sound.sfx('select'); }
      if (Input.pressed.down) { row = (row + 1) % N; Sound.sfx('select'); }
      if (row < acts.length && (Input.pressed.left || Input.pressed.right)) { col ^= 1; Sound.sfx('select'); }
      for (let r = 0; r < N; r++) for (const c of r < acts.length ? [0, 1] : [-1]) { const q = rectOf(r, c); if (Input.tapIn(q[0], q[1], q[2], q[3])) { row = r; col = Math.max(0, c); activate(); return; } }
      if (Input.pressed.back) { Sound.sfx('back'); Game.go(OptionsScene()); return; }
      if (t > 8 && Input.confirm()) activate();
    },
    draw(ctx) {
      drawBackdrop(ctx, 'night', t, 0.7);
      Font.draw(ctx, 'KEYBOARD CONTROLS', W / 2, 8, '#fff3c4', { align: 'center', scale: 2, shadow: C.ink });
      Font.draw(ctx, 'KEY 1', 170, 24, '#f2c14e', { align: 'center' }); Font.draw(ctx, 'KEY 2', 250, 24, '#f2c14e', { align: 'center' });
      acts.forEach((a, r) => {
        const y = 34 + r * 12; Font.draw(ctx, a.label, 64, y, row === r ? '#f2c14e' : '#9fe3f0');
        for (let c = 0; c < 2; c++) {
          const q = rectOf(r, c), on = row === r && col === c;
          ctx.fillStyle = on ? (waiting ? '#7d1a25' : 'rgba(242,193,78,0.25)') : 'rgba(255,255,255,0.06)'; ctx.fillRect(q[0], q[1], q[2], q[3]);
          const label = on && waiting ? ((t >> 4) % 2 ? 'PRESS KEY' : '') : Input.keyName(Input.bindings[a.id][c]);
          Font.draw(ctx, label, q[0] + 36, y, on ? '#fff3c4' : C.white, { align: 'center' });
        }
      });
      extra.forEach((e, i) => {
        const r = acts.length + i, y = 34 + r * 12 + 4, on = row === r;
        const label = i === 0 ? e + ': ' + (Input.upJumps ? 'ON' : 'OFF') : e;
        if (on) { ctx.fillStyle = 'rgba(242,193,78,0.18)'; ctx.fillRect(60, y - 3, 200, 11); }
        Font.draw(ctx, label, W / 2, y, on ? '#f2c14e' : C.white, { align: 'center' });
      });
      Font.draw(ctx, waiting ? 'PRESS THE NEW KEY  -  ESC TO CANCEL' : (msg || '← → PICK SLOT   ENTER CHANGE   DEL CLEAR'), W / 2, 170, waiting ? '#fff3c4' : msg ? '#9be88a' : '#8a8f98', { align: 'center' });
    },
  };
}
