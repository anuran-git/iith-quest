// ─────────────────────────────────────────────────────────────────────────────
// 08-minigames.js — the "boss" challenge at the end of each level.
// Every mini-game is a factory (cfg) → { update(), draw(ctx), done, score }
// where score is 0..1. Register new ones in MINIGAMES and reference them from
// a level's `boss: { type: '...' }`. BossScene wraps intro → game → verdict.
// ─────────────────────────────────────────────────────────────────────────────

// Question bank. First option is the correct one (shuffled when shown).
const QUESTIONS = {
  campus: [
    ['WHERE IS THE IIT HYDERABAD CAMPUS?', 'KANDI, SANGAREDDY', 'GACHIBOWLI', 'SECUNDERABAD', 'WARANGAL'],
    ['IN WHICH YEAR WAS IIT HYDERABAD FOUNDED?', '2008', '2001', '2012', '1995'],
    ['WHAT IS THE ANNUAL TECHNO-CULTURAL FEST OF IITH CALLED?', 'ELAN & NVISION', 'MOOD INDIGO', 'SAARANG', 'KSHITIJ'],
    ['MILAN AT IITH IS A CHAMPIONSHIP BETWEEN...', 'HOSTELS', 'DEPARTMENTS', 'OTHER IITS', 'FACULTY TEAMS'],
    ['DIESTA AT IITH IS A FEST BETWEEN...', 'DEPARTMENTS', 'HOSTELS', 'ALUMNI BATCHES', 'CLUBS'],
    ['WHICH COUNTRY PARTNERED IN SETTING UP IIT HYDERABAD?', 'JAPAN', 'GERMANY', 'USA', 'FRANCE'],
    ['UDH AND LDH ON CAMPUS ARE...', 'DINING HALLS', 'LECTURE HALLS', 'HOSTELS', 'LABS'],
    ['IN THE IITH MOTTO, TECHNOLOGY IS FOR...', 'HUMANITY', 'HYDERABAD', 'HONOUR', 'HARMONY'],
    ['WHICH 3D PRINTED STRUCTURE STANDS ON CAMPUS?', 'A PEDESTRIAN BRIDGE', 'A CLOCK TOWER', 'A WATER TANK', 'A BUS STOP'],
    ['TIHAN AT IITH WORKS ON...', 'AUTONOMOUS NAVIGATION', 'QUANTUM COMPUTING', 'OCEAN ENERGY', 'ANCIENT TEXTS'],
    ['WHICH NATIONAL HIGHWAY RUNS PAST THE CAMPUS?', 'NH-65', 'NH-44', 'NH-16', 'NH-48'],
  ],
  general: [
    ['WHICH COLOUR MODEL DO SCREENS USE?', 'RGB', 'CMYK', 'PANTONE', 'RYB'],
    ['WHAT DOES UX STAND FOR?', 'USER EXPERIENCE', 'ULTRA EXTENDED', 'UNIFIED EXCHANGE', 'USER EXPORT'],
    ['BINARY 1010 IN DECIMAL IS...', '10', '8', '12', '5'],
    ['WHAT DOES CPU STAND FOR?', 'CENTRAL PROCESSING UNIT', 'CORE POWER UNIT', 'COMPUTER PRIMARY UNIT', 'CENTRAL PROGRAM UTILITY'],
    ['WHICH DATA STRUCTURE IS FIRST-IN, FIRST-OUT?', 'QUEUE', 'STACK', 'TREE', 'HEAP'],
    ['THE SI UNIT OF FORCE IS THE...', 'NEWTON', 'JOULE', 'WATT', 'PASCAL'],
    ['HTML IS MAINLY USED TO...', 'STRUCTURE WEB PAGES', 'STYLE WEB PAGES', 'QUERY DATABASES', 'COMPILE CODE'],
    ['THE CHEMICAL SYMBOL FOR IRON IS...', 'FE', 'IR', 'IN', 'I'],
    ['HOW MANY BITS MAKE ONE BYTE?', '8', '4', '16', '10'],
    ["FITTS'S LAW PREDICTS THE TIME TO...", 'REACH A TARGET', 'LOAD A PAGE', 'LEARN AN INTERFACE', 'READ A LINE'],
    ['A PROTOTYPE IS MAINLY BUILT TO...', 'TEST AN IDEA EARLY', 'REPLACE RESEARCH', 'DECORATE THE DESK', 'SKIP TESTING'],
  ],
  aptitude: [
    ['WHAT COMES NEXT: 2, 4, 8, 16, ...', '32', '24', '20', '30'],
    ['15% OF 200 IS...', '30', '15', '45', '35'],
    ['5 MACHINES MAKE 5 PARTS IN 5 MIN. 100 MACHINES MAKE 100 PARTS IN...', '5 MIN', '100 MIN', '20 MIN', '1 MIN'],
    ['A TRAIN COVERS 60 KM IN 45 MIN. ITS SPEED IS...', '80 KM/H', '60 KM/H', '75 KM/H', '90 KM/H'],
    ['WHAT IS 12 X 12?', '144', '124', '132', '154'],
    ['WHAT COMES NEXT: 1, 1, 2, 3, 5, 8, ...', '13', '11', '12', '15'],
    ['THE AVERAGE OF 4, 8 AND 12 IS...', '8', '6', '10', '12'],
    ['THE ANGLES OF A TRIANGLE ADD UP TO...', '180 DEGREES', '90 DEGREES', '270 DEGREES', '360 DEGREES'],
    ['IF A = 1 AND Z = 26, THEN I + I + T = ?', '38', '29', '47', '36'],
    ['THE SQUARE ROOT OF 169 IS...', '13', '11', '17', '19'],
    ['3 CHAIS COST RS 45. 7 CHAIS COST...', 'RS 105', 'RS 90', 'RS 115', 'RS 135'],
  ],
  hr: [
    ['TELL US ABOUT YOURSELF.', 'A CRISP STORY OF MY WORK', 'MY WHOLE LIFE SINCE KG', 'JUST READ MY RESUME', 'WHO WANTS TO KNOW?'],
    ['WHAT IS YOUR BIGGEST WEAKNESS?', 'ONE I AM ACTIVELY FIXING', 'I AM TOO PERFECT', 'MONDAYS', 'I HAVE NONE'],
    ['WHY SHOULD WE HIRE YOU?', 'MY SKILLS FIT THIS ROLE', 'I NEED THE MONEY', 'MY MOM SAID SO', 'YOU CALLED ME HERE'],
    ['A TEAMMATE MISSES A DEADLINE. YOU...', 'TALK, THEN HELP REPLAN', 'COMPLAIN TO THE PROF', 'DO NOTHING', 'POST IT ON THE GROUP'],
    ['WHERE DO YOU SEE YOURSELF IN 5 YEARS?', 'GROWING INTO A LEAD ROLE', 'IN YOUR CHAIR', 'ON A BEACH', 'STILL IN THIS ROOM'],
    ['ANY QUESTIONS FOR US?', 'ASK ABOUT TEAM AND ROLE', 'NO, I AM GOOD', 'WHEN IS LUNCH?', 'CAN I LEAVE NOW?'],
  ],
};

function panel(ctx, x, y, w, h, fill = '#221a33', edge = '#f4efe6') {
  ctx.fillStyle = C.ink; ctx.fillRect(x, y, w, h); ctx.fillStyle = edge; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = fill; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
}
function timeBar(ctx, frac, y = 22) {
  ctx.fillStyle = C.ink; ctx.fillRect(40, y, 240, 5); ctx.fillStyle = frac < 0.25 ? '#ff5a6a' : '#9be88a'; ctx.fillRect(41, y + 1, Math.round(238 * clamp(frac, 0, 1)), 3);
}

// ── CATCH: move left/right, catch good cards, avoid bad ones ──
function CatchGame(cfg, env) {
  const total = cfg.secs * 60;
  let t = 0, px = W / 2 - 8, face = 1, moving = false, items = [], next = 40, caught = 0, goodTotal = 0, badHits = 0, flash = 0;
  const g = {
    done: false, score: 0,
    update() {
      t++; if (flash > 0) flash--;
      let ax = (Input.down.right ? 1 : 0) - (Input.down.left ? 1 : 0);
      px = clamp(px + ax * 2.8, 4, W - 20); if (ax) face = ax; moving = !!ax;
      if (t < total && --next <= 0) {
        const prog = t / total, good = Math.random() < 0.7, label = good ? pick(cfg.good) : cfg.bad, w = Font.width(label) + 8;
        items.push({ x: rand(6, W - w - 6), y: -12, w, vy: 1 + prog * 1.0 + rand(0, 0.3), good, label });
        if (good) goodTotal++; next = Math.round(lerp(44, 22, prog));
      }
      items = items.filter(it => {
        it.y += it.vy;
        if (it.y + 11 > 128 && it.y < 150 && it.x < px + 18 && it.x + it.w > px - 2) {
          if (it.good) { caught++; Sound.sfx('coin'); } else { badHits++; flash = 14; Sound.sfx('bad'); }
          return false;
        }
        return it.y < H;
      });
      if (t >= total && !items.length) { g.done = true; g.score = clamp(caught / Math.max(1, goodTotal) - badHits * 0.08, 0, 1); }
    },
    draw(ctx) {
      ctx.fillStyle = '#8fa7ab'; ctx.fillRect(0, 150, W, 30); ctx.fillStyle = '#c6d6d6'; ctx.fillRect(0, 150, W, 2);
      ctx.fillStyle = '#7b9297'; for (let x = 7; x < W; x += 16) ctx.fillRect(x, 152, 1, 28);
      items.forEach(it => {
        ctx.fillStyle = C.ink; ctx.fillRect(Math.round(it.x), Math.round(it.y), it.w, 11);
        ctx.fillStyle = it.good ? '#fff3c4' : '#d33c3c'; ctx.fillRect(Math.round(it.x) + 1, Math.round(it.y) + 1, it.w - 2, 9);
        Font.draw(ctx, it.label, it.x + 4, it.y + 2, it.good ? C.ink : '#fff3c4');
      });
      let img = moving ? env.sprites.run[(t >> 2) % 4] : env.sprites.idle; if (face < 0) img = Art.flip(img);
      if (!(flash > 0 && (flash >> 1) % 2)) ctx.drawImage(img, Math.round(px), 126);
      timeBar(ctx, 1 - t / total);
      Font.draw(ctx, 'CAUGHT ' + caught, 8, 8, '#fff3c4', { shadow: C.ink });
      if (badHits) Font.draw(ctx, cfg.bad + ' X' + badHits, W - 8, 8, '#ff8a8a', { align: 'right', shadow: C.ink });
    },
  };
  return g;
}

// ── QUIZ: multiple choice against a timer ──
function QuizGame(cfg) {
  const used = {};
  const qs = cfg.cats.map(cat => {
    used[cat] = used[cat] || shuffle(QUESTIONS[cat]);
    const raw = used[cat].pop(), opts = shuffle(raw.slice(1));
    return { q: raw[0], opts, ans: opts.indexOf(raw[1]), cat };
  });
  const per = cfg.secs * 60;
  let qi = 0, sel = 0, t = per, phase = 'ask', pt = 0, correct = 0, picked = -1;
  const rowY = i => 80 + i * 22;
  function answer(i) { picked = i; phase = 'show'; pt = 0; if (i === qs[qi].ans) { correct++; Sound.sfx('good'); } else Sound.sfx('bad'); }
  const g = {
    done: false, score: 0,
    update() {
      if (phase === 'ask') {
        t--;
        if (Input.pressed.up) { sel = (sel + 3) % 4; Sound.sfx('select'); }
        if (Input.pressed.down) { sel = (sel + 1) % 4; Sound.sfx('select'); }
        for (let i = 0; i < 4; i++) if (Input.tapIn(30, rowY(i), 260, 19)) { sel = i; answer(i); return; }
        if (Input.confirm()) answer(sel); else if (t <= 0) answer(-1);
      } else if (++pt > 75) {
        if (++qi >= qs.length) { g.done = true; g.score = correct / qs.length; }
        else { phase = 'ask'; t = per; sel = 0; picked = -1; }
      }
    },
    draw(ctx) {
      const q = qs[Math.min(qi, qs.length - 1)];
      Font.draw(ctx, 'QUESTION ' + (Math.min(qi, qs.length - 1) + 1) + '/' + qs.length, 8, 8, '#fff3c4', { shadow: C.ink });
      Font.draw(ctx, 'RIGHT: ' + correct, W - 8, 8, '#9be88a', { align: 'right', shadow: C.ink });
      timeBar(ctx, t / per);
      panel(ctx, 20, 32, 280, 42);
      const lines = Font.wrap(q.q, 44); lines.forEach((l, i) => Font.draw(ctx, l, W / 2, 53 - lines.length * 4.5 + i * 9 - 0, C.white, { align: 'center' }));
      q.opts.forEach((o, i) => {
        let fill = '#2c2440', edge = '#6b6480', col = C.white;
        if (phase === 'ask' && i === sel) { fill = '#47196b'; edge = '#f2c14e'; }
        if (phase === 'show') { if (i === q.ans) { fill = '#2f6b3a'; edge = '#9be88a'; } else if (i === picked) { fill = '#7d1a25'; edge = '#ff8a8a'; } else col = '#8a8f98'; }
        panel(ctx, 30, rowY(i), 260, 19, fill, edge);
        Font.draw(ctx, 'ABCD'[i] + '.', 38, rowY(i) + 6, '#f2c14e'); Font.draw(ctx, o, 54, rowY(i) + 6, col);
      });
      if (phase === 'show') Font.draw(ctx, picked === q.ans ? 'CORRECT!' : picked < 0 ? 'TIME UP!' : 'NOT QUITE...', W / 2, 169, picked === q.ans ? '#9be88a' : '#ff8a8a', { align: 'center', shadow: C.ink });
    },
  };
  return g;
}

// ── MASH: hammer A to fill the bar, B closes pop-up distractions ──
function MashGame(cfg) {
  const total = cfg.secs * 60, POPS = ['MEME FROM ROOMMATE', 'MESS MENU: BIRYANI!', 'GROUP CHAT: 99+ NEW', 'WIFI RECONNECTING...', 'NEW REEL FOR YOU', 'UPDATE AND RESTART?'];
  let t = 0, prog = 0, popup = null, nextPop = rand(160, 240), endT = 0, bump = 0;
  const g = {
    done: false, score: 0,
    update() {
      if (endT) { if (++endT > 70) g.done = true; return; }
      t++; if (bump > 0) bump--;
      if (popup) {
        if (Input.pressed.b || Input.tapIn(popup.x, popup.y, 150, 40)) { popup = null; nextPop = rand(150, 280); Sound.sfx('select'); }
        else if (Input.pressed.a) Sound.sfx('bad');
      } else {
        if (Input.pressed.a || Input.tap) { prog += 1.9; bump = 3; Sound.sfx('type'); }
        prog = Math.max(0, prog - 0.022);
        if (--nextPop <= 0) { popup = { text: pick(POPS), x: randi(30, 140), y: randi(52, 96) }; Sound.sfx('bad'); }
      }
      if (prog >= 100) { prog = 100; endT = 1; g.score = 0.6 + 0.4 * clamp((total - t) / (total * 0.5), 0, 1); Sound.sfx('win'); }
      else if (t >= total) { endT = 1; g.score = prog / 100 * 0.6; Sound.sfx('lose'); }
    },
    draw(ctx) {
      panel(ctx, 30, 30, 260, 118, '#f4efe6', '#3a3f55');
      ctx.fillStyle = '#3b5d8f'; ctx.fillRect(32, 32, 256, 11); Font.draw(ctx, 'REPORT_FINAL_V7.DOC', 37, 34, C.white);
      const rows = Math.floor(prog / 100 * 54);   // "typed" lines
      ctx.fillStyle = '#565b66';
      for (let i = 0; i < rows; i++) { const r = i % 9, c = Math.floor(i / 9); ctx.fillRect(40 + c * 41, 50 + r * 8, 22 + ((i * 7) % 13), 3); }
      ctx.fillStyle = C.ink; ctx.fillRect(40, 128, 240, 12); ctx.fillStyle = '#9be88a'; ctx.fillRect(41, 129 + (bump ? 1 : 0), Math.round(238 * prog / 100), 10);
      Font.draw(ctx, Math.floor(prog) + '%', W / 2, 131, prog > 50 ? C.ink : C.white, { align: 'center' });
      const secs = Math.max(0, Math.ceil((total - t) / 60));
      Font.draw(ctx, '11:59 PM IN ' + secs + 'S', 8, 8, secs < 8 ? '#ff8a8a' : '#fff3c4', { shadow: C.ink });
      timeBar(ctx, 1 - t / total);
      if (popup) {
        panel(ctx, popup.x, popup.y, 150, 40, '#fff3c4', '#d33c3c');
        Font.draw(ctx, popup.text, popup.x + 75, popup.y + 8, C.ink, { align: 'center' });
        Font.draw(ctx, 'PRESS B TO CLOSE', popup.x + 75, popup.y + 24, '#b3262e', { align: 'center' });
      } else if (!endT && (t >> 3) % 2) Font.draw(ctx, 'MASH A!', W / 2, 158, '#f2c14e', { align: 'center', scale: 2, shadow: C.ink });
      if (endT) Font.draw(ctx, prog >= 100 ? 'SUBMITTED!' : 'PORTAL CLOSED!', W / 2, 156, prog >= 100 ? '#9be88a' : '#ff8a8a', { align: 'center', scale: 2, shadow: C.ink });
    },
  };
  return g;
}

// ── RHYTHM: four lanes (← → A B), hit notes on the line ──
function RhythmGame(cfg, env) {
  const LANES = [{ key: 'left', label: '←', col: '#e05a8a' }, { key: 'right', label: '→', col: '#7fe0e8' }, { key: 'a', label: 'A', col: '#f2c14e' }, { key: 'b', label: 'B', col: '#9be88a' }];
  const LX = i => 172 + i * 34, HIT = 140, SPEED = 1.5;
  const notes = []; let tt = 150, last = -1;
  for (let i = 0; i < cfg.notes; i++) {
    let lane = randi(0, 3); if (lane === last && Math.random() < 0.6) lane = (lane + randi(1, 3)) % 4; last = lane;
    notes.push({ t: tt, lane, hit: 0 }); tt += (i > cfg.notes * 0.45 && i % 4 !== 3) ? 15 : 30;
  }
  let t = 0, perfect = 0, good = 0, combo = 0, verdict = '', vt = 0, press = [0, 0, 0, 0];
  const g = {
    done: false, score: 0,
    update() {
      t++; if (vt > 0) vt--;
      LANES.forEach((ln, i) => {
        if (press[i] > 0) press[i]--;
        if (!(Input.pressed[ln.key] || Input.tapIn(LX(i) - 2, 20, 34, 160))) return;
        press[i] = 6;
        let best = null; notes.forEach(n => { if (!n.hit && n.lane === i && Math.abs(n.t - t) <= 11 && (!best || Math.abs(n.t - t) < Math.abs(best.t - t))) best = n; });
        if (best) { const d = Math.abs(best.t - t); best.hit = 1; combo++; if (d <= 4) { perfect++; verdict = 'PERFECT!'; Sound.sfx('perfect'); } else { good++; verdict = 'GOOD'; Sound.sfx('good'); } vt = 24; }
      });
      notes.forEach(n => { if (!n.hit && t - n.t > 11) { n.hit = -1; combo = 0; verdict = 'MISS'; vt = 24; } });
      if (t > tt + 60) { g.done = true; g.score = (perfect + good * 0.65) / notes.length; }
    },
    draw(ctx) {
      // stage + dancer
      ctx.fillStyle = '#2a2233'; ctx.fillRect(10, 126, 140, 40); ctx.fillStyle = '#47196b'; ctx.fillRect(10, 126, 140, 3);
      const beat = (t % 30) < 15;
      [['#e05a8a', 30], ['#7fe0e8', 80], ['#f2c14e', 130]].forEach((l, i) => { ctx.globalAlpha = 0.18 + (((t / 30 | 0) + i) % 3 === 0 ? 0.18 : 0); ctx.fillStyle = l[0]; ctx.beginPath(); ctx.moveTo(l[1], 20); ctx.lineTo(l[1] + 26, 126); ctx.lineTo(l[1] - 26, 126); ctx.fill(); });
      ctx.globalAlpha = 1;
      let img = combo > 0 ? env.sprites.run[(t / 15 | 0) % 4] : env.sprites.idle; if ((t / 60 | 0) % 2) img = Art.flip(img);
      ctx.drawImage(img, 0, 0, 16, 24, 56, 78 - (beat && combo > 0 ? 3 : 0), 32, 48);
      for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? '#1a1423' : '#2c2440'; World.disc(ctx, 14 + i * 16, 172 - ((i + (beat ? 1 : 0)) % 2) * 2, 7, ctx.fillStyle); }
      Font.draw(ctx, 'COMBO ' + combo, 80, 30, '#fff3c4', { align: 'center', shadow: C.ink });
      if (vt > 0) Font.draw(ctx, verdict, 80, 46, verdict === 'MISS' ? '#ff8a8a' : '#9be88a', { align: 'center', scale: 2, shadow: C.ink });
      // lanes
      LANES.forEach((ln, i) => {
        ctx.fillStyle = 'rgba(11,10,18,0.6)'; ctx.fillRect(LX(i), 18, 30, 162);
        ctx.fillStyle = press[i] ? ln.col : '#4a3f55'; ctx.fillRect(LX(i), HIT - 2, 30, 14); ctx.fillStyle = C.ink; ctx.fillRect(LX(i) + 1, HIT - 1, 28, 12);
        Font.draw(ctx, ln.label, LX(i) + 15, HIT + 2, press[i] ? C.white : ln.col, { align: 'center' });
      });
      notes.forEach(n => {
        if (n.hit === 1) return; const y = HIT - (n.t - t) * SPEED; if (y < 12 || y > H) return;
        const ln = LANES[n.lane]; ctx.globalAlpha = n.hit === -1 ? 0.3 : 1;
        ctx.fillStyle = C.ink; ctx.fillRect(LX(n.lane) + 3, y - 1, 24, 12); ctx.fillStyle = ln.col; ctx.fillRect(LX(n.lane) + 4, y, 22, 10);
        Font.draw(ctx, ln.label, LX(n.lane) + 15, y + 2, C.ink, { align: 'center' }); ctx.globalAlpha = 1;
      });
      timeBar(ctx, 1 - t / (tt + 60), 8);
    },
  };
  return g;
}

// ── TIMING: stop the marker in the green zone, once per slide ──
function TimingGame(cfg, env) {
  const X0 = 50, X1 = 270, REACT = { 1: ['NICE!', 'LOVELY', 'CLEAR!'], 0.7: ['GOOD', 'OKAY', 'GO ON'], 0.3: ['HMM...', 'LOUDER?', 'WHY?'], 0: ['...', 'NEXT.', 'OH NO'] };
  const jury = [Art.player('boy', 'formal', { H: '#8a8f98', M: '#5a6a8a', m: '#44506a' }), Art.player('girl', 'formal', { H: '#2a2233', M: '#8e2c4a', m: '#74203a' }), Art.player('boy', 'formal', { H: '#4a2618', M: '#3a6a5a', m: '#2a5044' })];
  let round = 0, t = 0, phase = 'aim', pt = 0, sum = 0, last = 0, zc, zw, speed, pos = X0, dir = 1, bubble = [];
  function setRound() { const k = round / Math.max(1, cfg.rounds - 1); zw = lerp(46, 20, k); speed = lerp(2.2, 4.2, k); zc = rand(X0 + 40, X1 - 40); pos = X0; dir = 1; t = 0; }
  setRound();
  function judge(v) { last = v; sum += v; phase = 'show'; pt = 0; bubble = REACT[v]; Sound.sfx(v === 1 ? 'perfect' : v >= 0.7 ? 'good' : v > 0 ? 'select' : 'bad'); }
  const g = {
    done: false, score: 0,
    update() {
      if (phase === 'aim') {
        t++; pos += dir * speed; if (pos > X1) { pos = X1; dir = -1; } if (pos < X0) { pos = X0; dir = 1; }
        if (Input.pressed.a || Input.tap) { const d = Math.abs(pos - zc); judge(d <= zw * 0.2 ? 1 : d <= zw / 2 ? 0.7 : d <= zw * 0.9 ? 0.3 : 0); }
        else if (t > 420) judge(0);
      } else if (++pt > 70) {
        if (++round >= cfg.rounds) { g.done = true; g.score = sum / cfg.rounds; } else { phase = 'aim'; setRound(); }
      }
    },
    draw(ctx) {
      const r = Math.min(round, cfg.rounds - 1);
      // projected slide
      panel(ctx, 104, 24, 166, 60, '#f4efe6', '#3a3f55');
      Font.draw(ctx, 'SLIDE ' + (r + 1) + '/' + cfg.rounds, 187, 31, '#8a8f98', { align: 'center' });
      Font.draw(ctx, cfg.labels[r] || 'SLIDE', 187, 46, C.ink, { align: 'center', scale: cfg.labels[r] && cfg.labels[r].length > 12 ? 1 : 2 });
      ctx.fillStyle = '#b3262e'; ctx.fillRect(127, 68, 120, 3); ctx.fillStyle = '#c9c2b4'; ctx.fillRect(127, 74, 80, 2);
      // jury (seated, facing the presenter) and the presenter
      jury.forEach((j, i) => big(ctx, j.idle, 4 + i * 28, 70, 2));
      ctx.fillStyle = '#5a4630'; ctx.fillRect(2, 104, 96, 16); ctx.fillStyle = '#8a5a34'; ctx.fillRect(2, 104, 96, 3);
      big(ctx, Art.flip(env.sprites.idle), 280, 72, 2);
      if (phase === 'show') bubble.forEach((b, i) => { if (pt > i * 10) Font.draw(ctx, b, 20 + i * 28, 58 - i % 2 * 9, last >= 0.7 ? '#9be88a' : last > 0 ? '#fff3c4' : '#ff8a8a', { align: 'center', shadow: C.ink }); });
      // meter
      ctx.fillStyle = C.ink; ctx.fillRect(X0 - 3, 136, X1 - X0 + 6, 18); ctx.fillStyle = '#4a3f55'; ctx.fillRect(X0 - 2, 137, X1 - X0 + 4, 16);
      ctx.fillStyle = '#c9962e'; ctx.fillRect(zc - zw * 0.9, 137, zw * 1.8, 16);
      ctx.fillStyle = '#6fbf4a'; ctx.fillRect(zc - zw / 2, 137, zw, 16); ctx.fillStyle = '#c8f5a8'; ctx.fillRect(zc - zw * 0.2, 137, zw * 0.4, 16);
      ctx.fillStyle = C.ink; ctx.fillRect(Math.round(pos) - 2, 132, 5, 26); ctx.fillStyle = C.white; ctx.fillRect(Math.round(pos) - 1, 133, 3, 24);
      Font.draw(ctx, 'CONFIDENCE', W / 2, 124, '#fff3c4', { align: 'center', shadow: C.ink });
      if (phase === 'show') Font.draw(ctx, last === 1 ? 'PERFECT!' : last >= 0.7 ? 'GOOD!' : last > 0 ? 'SHAKY...' : 'MISSED!', W / 2, 162, last >= 0.7 ? '#9be88a' : last > 0 ? '#fff3c4' : '#ff8a8a', { align: 'center', scale: 2, shadow: C.ink });
      else if ((t >> 4) % 2) Font.draw(ctx, 'PRESS A', W / 2, 164, '#f2c14e', { align: 'center', shadow: C.ink });
      Font.draw(ctx, 'SCORE ' + Math.round(sum / cfg.rounds * 100) + '%', 8, 8, '#fff3c4', { shadow: C.ink });
    },
  };
  return g;
}

// Runs several mini-games back to back; score is their average.
function SequenceGame(parts) {
  let i = 0, sum = 0;
  const g = {
    done: false, score: 0,
    update() { const cur = parts[i]; cur.update(); if (cur.done) { sum += cur.score; if (++i >= parts.length) { g.done = true; g.score = sum / parts.length; i = parts.length - 1; } } },
    draw(ctx) { parts[i].draw(ctx); },
  };
  return g;
}

const MINIGAMES = {
  catch: CatchGame, quiz: QuizGame, mash: MashGame, rhythm: RhythmGame, timing: TimingGame,
  interview: (cfg, env) => SequenceGame([TimingGame(cfg, env), QuizGame(cfg)]),
};

// Boss round wrapper: briefing → mini-game → verdict (retry if below PASS).
function BossScene(run) {
  const L = LEVELS[run.level], cfg = L.boss, PASS = 0.35;
  const env = { sprites: Art.player(Save.data.char, L.outfit) };
  let phase = 'intro', t = 0, game = null, menu = null;
  function start() { game = MINIGAMES[cfg.type](cfg, env); phase = 'play'; t = 0; Sound.music(cfg.type === 'rhythm' ? 'fest' : 'boss'); }
  function finish(score) { run.boss = score; Game.go(ResultScene(run)); }
  return {
    update() {
      t++;
      if (phase === 'intro') { if (t > 20 && (Input.confirm() || Input.tap)) { Sound.sfx('confirm'); start(); } }
      else if (phase === 'play') {
        game.update();
        if (game.done) {
          phase = 'outro'; t = 0; Sound.stopMusic();
          const ok = game.score >= PASS; Sound.sfx(ok ? 'win' : 'lose');
          menu = ok ? Menu([{ label: 'CONTINUE', fn: () => finish(game.score) }])
            : Menu([{ label: 'TRY AGAIN', fn: () => { run.bossRetries++; start(); } }].concat(run.bossRetries >= 1 ? [{ label: 'TAKE GRACE MARKS', fn: () => finish(PASS) }] : []));
        }
      } else if (t > 30) menu.update();
    },
    draw(ctx) {
      World.drawBackground(ctx, L.theme, 40, t); ctx.fillStyle = 'rgba(11,10,18,0.6)'; ctx.fillRect(0, 0, W, H);
      if (phase === 'intro') {
        Font.draw(ctx, 'BOSS ROUND', W / 2, 26, '#ff8a8a', { align: 'center', shadow: C.ink });
        Font.draw(ctx, cfg.title, W / 2, 44, '#fff3c4', { align: 'center', scale: cfg.title.length > 15 ? 2 : 3, shadow: C.ink });
        panel(ctx, 30, 84, 260, 50);
        const lines = Font.wrap(cfg.how, 40); lines.forEach((l, i) => Font.draw(ctx, l, W / 2, 109 - lines.length * 4.5 + i * 9, C.white, { align: 'center' }));
        if ((t >> 4) % 2) Font.draw(ctx, 'PRESS A / TAP TO START', W / 2, 150, '#f2c14e', { align: 'center', shadow: C.ink });
      } else if (phase === 'play') game.draw(ctx);
      else {
        const ok = game.score >= PASS;
        Font.draw(ctx, cfg.title, W / 2, 30, '#cfd6e6', { align: 'center', shadow: C.ink });
        Font.draw(ctx, Math.round(game.score * 100) + '%', W / 2, 52, ok ? '#9be88a' : '#ff8a8a', { align: 'center', scale: 4, shadow: C.ink });
        Font.draw(ctx, ok ? (game.score > 0.85 ? 'OUTSTANDING!' : game.score > 0.6 ? 'WELL DONE!' : 'YOU SCRAPED THROUGH') : 'NOT ENOUGH TO PASS', W / 2, 96, '#fff3c4', { align: 'center', shadow: C.ink });
        if (t > 30) menu.draw(ctx, W / 2, 122);
      }
    },
  };
}
