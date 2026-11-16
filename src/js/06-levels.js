// ─────────────────────────────────────────────────────────────────────────────
// 06-levels.js — the 8 levels, written with a small builder so they read like
// a storyboard. A level is a chain of ground segments and pits, left to right.
//
//   b.seg(n, s => {...})   n tiles of ground; `s` places things on it
//   b.pit(n, s => {...})   n tiles of gap;    `s` places platforms/coins over it
//   b.up(k) / b.down(k)    raise / lower the ground for what follows
//   b.goal('LABEL')        final stretch with the exit door
//
// Inside a segment, x = tiles from the segment start, h = tiles above ground
// (h=1 is standing height, h=0 is flush with the ground surface):
//   s.coins(x,h,n)  s.arc(x,h,n)        credits in a row / in a jump arc
//   s.plat(x,h,w)   one-way platform    s.wall(x,w,hh)  solid stack on ground
//   s.block(x,h,w)  floating solid      s.spikes(x,w)   hazard on ground
//   s.en(kind,x,h)  enemy: bug clock plane phone book zzz email speaker printer
//   s.item(kind,x,h) milk (GROW trial: grow; a hit shrinks you instead of costing a heart) | chai (heart) | maggi (invincible) | clock (+15s) | big (+5 credits)
//   s.spring(x)     s.mover(x,h,w,'x'|'y',rangeTiles,speed,skin)   s.check(x)
//   s.deco(type,x,{..})  s.sign(x,'TEXT')  s.hint(x,'TEXT',h)
//
// SAFE JUMP LIMITS (see TUNE): pits ≤ 3 tiles, steps up ≤ 2 tiles, platforms h ≤ 3
// from where the player stands. tools/test.js bot-plays every level to check.
// ─────────────────────────────────────────────────────────────────────────────
class LevelBuilder {
  constructor() { this.cols = []; this.x = 0; this.gy = GROUND_ROW; this.ents = []; this.decor = []; }
  _col(x) { while (this.cols.length <= x) this.cols.push(new Uint8Array(ROWS)); return this.cols[x]; }
  _set(x, row, id) { if (row >= 0 && row < ROWS && x >= 0) this._col(x)[row] = id; }
  _helper(x0) {
    const b = this, gy = this.gy, px = x => (x0 + x) * T, py = h => (gy - h) * T;
    const s = {
      coins(x, h, n) { for (let i = 0; i < n; i++) b.ents.push({ type: 'coin', x: px(x + i) + 4, y: py(h) + 4 }); return s; },
      arc(x, h, n) { for (let i = 0; i < n; i++) { const k = n > 1 ? (i / (n - 1)) * 2 - 1 : 0; b.ents.push({ type: 'coin', x: px(x) + i * 13 + 4, y: py(h) + 4 - Math.round((1 - k * k) * 16) }); } return s; },
      plat(x, h, w) { for (let i = 0; i < w; i++) b._set(x0 + x + i, gy - h, TILE.ONEWAY); return s; },
      wall(x, w, hh) { for (let i = 0; i < w; i++) for (let j = 0; j < hh; j++) b._set(x0 + x + i, gy - 1 - j, TILE.BLOCK); return s; },
      block(x, h, w) { for (let i = 0; i < w; i++) b._set(x0 + x + i, gy - h, TILE.BLOCK); return s; },
      spikes(x, w) { for (let i = 0; i < w; i++) b._set(x0 + x + i, gy - 1, TILE.HAZARD); return s; },
      en(kind, x, h = 1, o) { b.ents.push(Object.assign({ type: 'enemy', kind, x: px(x), y: py(h) }, o)); return s; },
      item(kind, x, h = 2) { b.ents.push({ type: 'item', kind, x: px(x) + 2, y: py(h) + 2 }); return s; },
      spring(x) { b.ents.push({ type: 'spring', x: px(x), y: py(1) + 8 }); return s; },
      mover(x, h, w, axis, range, speed, skin) { b.ents.push({ type: 'mover', x: px(x), y: py(h), w: w * T, axis, range: range * T, speed, skin }); return s; },
      check(x) { b.ents.push({ type: 'check', x: px(x) + 4, y: py(2) }); return s; },
      deco(type, x, o) { b.decor.push(Object.assign({ type, x: px(x), gy: gy * T }, o)); return s; },
      sign(x, text, col) { return s.deco('sign', x, { text, col }); },
      hint(x, text, h = 5) { b.decor.push({ type: 'hint', x: px(x), y: py(h), text }); return s; },
    };
    return s;
  }
  seg(n, fn) {
    const x0 = this.x;
    for (let i = 0; i < n; i++) { const c = this._col(x0 + i); for (let r = this.gy; r < ROWS; r++) c[r] = TILE.GROUND; }
    this.x += n; if (fn) fn(this._helper(x0)); return this;
  }
  pit(n, fn) { const x0 = this.x; this._col(x0 + n - 1); this.x += n; if (fn) fn(this._helper(x0)); return this; }
  up(k = 1) { this.gy -= k; return this; }
  down(k = 1) { this.gy += k; return this; }
  goal(label) {
    return this.seg(12, s => { this.ents.push({ type: 'goal', x: (this.x - 6) * T, y: this.gy * T - 40, label }); });
  }
  finish() {
    const w = this.cols.length, tiles = new Uint8Array(w * ROWS);
    this.cols.forEach((c, x) => { for (let y = 0; y < ROWS; y++) tiles[x + y * w] = c[y]; });
    return { w, tiles, ents: this.ents, decor: this.decor, spawn: { x: 5 * T, y: (GROUND_ROW - 2) * T } };
  }
}

// name/place show on cards; `time` is the deadline in seconds; `boss` picks the
// mini-game (see 08-minigames.js); `intro` is the briefing text.
const LEVELS = [
  {
    name: 'ORIENTATION DAY', place: 'MAIN GATE TO HOSTELS', theme: 'day', song: 'campus', time: 100, outfit: 'casual',
    intro: 'WELCOME TO IIT HYDERABAD! FIND YOUR HOSTEL BEFORE REGISTRATION CLOSES. GRAB CREDITS ON THE WAY.',
    boss: { type: 'catch', title: 'REGISTRATION RUSH', how: 'CATCH YOUR DOCUMENTS. DODGE THE SPAM FLYERS!', good: ['ID', 'KEY', 'FORM'], bad: 'SPAM', secs: 26 },
    build(b) {
      b.seg(18, s => s.deco('gate', 2).hint(8, 'ARROWS OR D-PAD TO MOVE').deco('lamp', 10).coins(11, 1, 4).deco('tree', 15))
       .seg(12, s => s.hint(1, 'SPACE OR A TO JUMP').item('milk', 3, 2).wall(6, 2, 1).coins(6, 3, 2).deco('bench', 9))
       .seg(14, s => s.deco('cycle', 1).hint(2, 'STOMP THE BUGS!').coins(4, 1, 3).en('bug', 9).deco('tree', 12))
       .pit(2, s => s.arc(-1, 3, 4))
       .seg(14, s => s.deco('lamp', 1).plat(3, 2, 3).coins(3, 3, 3).en('bug', 9).sign(11, 'HOSTELS >'))
       .up().seg(8, s => s.coins(2, 1, 4).deco('bush', 5))
       .up().seg(8, s => s.check(1).item('chai', 5, 2).deco('tree', 6))
       .down(2).seg(13, s => s.hint(1, 'X OR B TO DASH').spikes(7, 2).arc(6, 3, 4).deco('lamp', 11))
       .pit(3, s => s.arc(0, 3, 4))
       .seg(16, s => s.wall(4, 1, 2).plat(7, 3, 3).coins(7, 4, 3).en('bug', 12).deco('tree', 14).deco('vend', 1))
       .pit(2).seg(6, s => s.coins(1, 1, 4)).pit(3)
       .seg(15, s => s.en('bug', 4).plat(6, 2, 2).plat(9, 4, 2).item('big', 9, 5).en('bug', 11).deco('cycle', 13, { col: '#3aa6a6' }))
       .goal('HOSTEL OFFICE');
    },
  },
  {
    name: 'FIRST CLASSES', place: 'HOSTEL TO ACADEMIC BLOCK A', theme: 'morning', song: 'campus', time: 110, outfit: 'casual',
    intro: 'IT IS 8:52 AM AND CLASS STARTS AT 9. CROSS THE 3D PRINTED BRIDGE AND HOP ON THE DRIVERLESS SHUTTLE!',
    boss: { type: 'quiz', title: 'POP QUIZ', how: 'PICK THE RIGHT ANSWER BEFORE THE TIMER RUNS OUT.', cats: ['campus', 'campus', 'general'], secs: 13 },
    build(b) {
      b.seg(14, s => s.sign(2, '9 AM CLASS!').deco('cycle', 5).coins(6, 1, 5).deco('tree', 11))
       .seg(12, s => s.deco('lamp', 1).item('milk', 3, 2).en('bug', 5).plat(7, 2, 3).coins(7, 3, 3))
       .pit(3, s => s.arc(0, 3, 4))
       .seg(10, s => s.coins(1, 1, 3).en('plane', 6, 3).deco('vend', 8))
       .up().seg(6, s => s.coins(1, 1, 4))
       .up().seg(8, s => s.check(1).en('bug', 5).deco('bush', 2))
       .pit(3).seg(4, s => s.coins(1, 1, 2)).pit(3)
       .down(2).seg(8, s => s.sign(2, '3D PRINTED BRIDGE').deco('tree', 6))
       .pit(10, s => s.plat(0, 1, 2).plat(2, 2, 6).plat(8, 1, 2).coins(2, 3, 6).en('plane', 5, 5))
       .seg(12, s => s.en('bug', 3).plat(5, 2, 3).item('chai', 6, 3).en('bug', 9).deco('lamp', 11))
       .seg(4, s => s.sign(0, 'SHUTTLE STOP'))
       .pit(9, s => s.mover(0, 0, 3, 'x', 6, 0.6, 'shuttle').coins(3, 2, 4))
       .seg(14, s => s.wall(3, 1, 2).en('plane', 8, 3).coins(8, 1, 4).deco('tree', 12))
       .pit(3, s => s.arc(0, 3, 4)).seg(8, s => s.en('bug', 4)).pit(2)
       .seg(13, s => s.plat(2, 2, 2).plat(5, 4, 2).item('big', 5, 5).coins(8, 1, 3).deco('bench', 9))
       .goal('ACAD BLOCK A');
    },
  },
  {
    name: 'ASSIGNMENT WEEK', place: 'HOSTEL ROOM TO COMPUTER LAB', theme: 'night', song: 'night', time: 120, outfit: 'casual',
    intro: 'THREE SUBMISSIONS, ONE NIGHT. DODGE DEADLINES AND DISTRACTIONS AND REACH THE LAB BEFORE 11:59 PM.',
    boss: { type: 'mash', title: '11:59 PM SUBMISSION', how: 'MASH A TO FINISH THE REPORT. PRESS B TO CLOSE DISTRACTIONS!', secs: 24 },
    build(b) {
      b.seg(12, s => s.sign(2, 'DUE 11:59 PM').deco('lamp', 6).coins(7, 1, 4))
       .seg(12, s => s.plat(3, 2, 2).coins(3, 3, 2).item('milk', 6, 2).en('clock', 8).deco('lamp', 10))
       .pit(2).seg(5, s => s.en('phone', 2, 3)).pit(3, s => s.arc(0, 3, 4))
       .seg(14, s => s.spikes(4, 2).arc(3, 3, 4).en('clock', 10).deco('bench', 11))
       .up(2).seg(10, s => s.check(1).item('chai', 3, 3).coins(4, 1, 2).en('printer', 7))
       .pit(3, s => s.arc(0, 3, 4)).seg(6, s => s.en('phone', 3, 3)).pit(3)
       .down(2).seg(16, s => s.wall(3, 2, 2).spikes(5, 3).wall(8, 2, 2).coins(5, 5, 3).en('clock', 13).deco('lamp', 15))
       .seg(3).pit(4, s => s.mover(1, 0, 3, 'y', 3, 0.5))
       .up(3).seg(11, s => s.coins(1, 1, 4).item('clock', 3, 3).en('printer', 8))
       .down(3).seg(14, s => s.en('clock', 4).en('clock', 9).spikes(12, 1).deco('lamp', 2))
       .pit(3).seg(4, s => s.coins(1, 1, 2)).pit(3).seg(4, s => s.item('maggi', 1, 2)).pit(2)
       .seg(14, s => s.en('phone', 2, 4).plat(3, 2, 3).plat(7, 3, 3).item('big', 8, 5).en('clock', 11).deco('vend', 12))
       .goal('COMPUTER LAB');
    },
  },
  {
    name: 'ELAN & NVISION', place: 'FEST NIGHT ON THE GROUNDS', theme: 'fest', song: 'fest', time: 120, outfit: 'casual',
    intro: 'THE TECHNO-CULTURAL FEST IS HERE! BOUNCE ON SPRINGS, DODGE THE SPEAKERS AND MAKE IT TO THE MAIN STAGE.',
    boss: { type: 'rhythm', title: 'DANCE-OFF', how: 'HIT ← → A B WHEN THE NOTES REACH THE LINE!', notes: 30 },
    build(b) {
      b.seg(14, s => s.deco('banner', 1, { text: 'ELAN & NVISION' }).coins(5, 1, 6).item('milk', 12, 2).deco('stall', 10, { text: 'CHAI' }))
       .seg(11, s => s.hint(1, 'BOUNCE!').spring(4).coins(4, 4, 1).coins(4, 6, 1).plat(6, 5, 3).coins(6, 6, 3).en('phone', 9, 2))
       .pit(3, s => s.arc(0, 3, 4))
       .seg(9, s => s.deco('flags', 0, { w: 9 }).en('speaker', 6))
       .seg(12, s => s.deco('stage', 2, { text: 'OPEN MIC' }).coins(3, 1, 5).en('plane', 9, 3))
       .up().seg(6, s => s.coins(1, 1, 3))
       .up().seg(6, s => s.check(1).item('chai', 3, 2))
       .pit(3).seg(5, s => s.spring(2).coins(2, 5, 1)).pit(3)
       .down(2).seg(14, s => s.deco('stall', 1, { text: 'MAGGI', col: '#f2c14e' }).plat(5, 2, 3).item('maggi', 6, 3).en('speaker', 11))
       .pit(8, s => s.mover(0, 0, 3, 'x', 5, 0.7).coins(2, 2, 4))
       .seg(12, s => s.deco('flags', 1, { w: 10 }).en('phone', 3, 3).coins(4, 1, 5).en('phone', 8, 2))
       .seg(6, s => s.wall(2, 1, 1).wall(3, 1, 2).wall(4, 2, 3))
       .pit(6, s => s.plat(1, 3, 2).plat(4, 2, 2).coins(1, 4, 2).coins(4, 3, 2))
       .seg(14, s => s.spring(3).plat(5, 5, 4).item('big', 6, 6).coins(7, 6, 2).en('speaker', 10).deco('stall', 11, { text: 'DOSA', col: '#3aa6a6' }))
       .pit(2).seg(4, s => s.coins(1, 1, 2)).pit(3).seg(4, s => s.en('phone', 2, 3)).pit(3)
       .seg(13, s => s.deco('banner', 2, { text: 'PRO NITE', col: '#6b4a9c' }).coins(2, 1, 8).en('plane', 5, 3).en('phone', 9, 3))
       .goal('MAIN STAGE');
    },
  },
  {
    name: 'THE JURY', place: 'RUN TO THE DESIGN STUDIO', theme: 'day', song: 'campus', time: 130, outfit: 'casual',
    intro: 'PRESENTATION DAY. YOUR MODEL IS FRAGILE, THE PRINTER IS ANGRY AND THE JURY STARTS AT 2 PM SHARP.',
    boss: { type: 'timing', title: 'FACE THE JURY', how: 'PRESS A WHEN THE MARKER IS IN THE GREEN ZONE. ONE HIT PER SLIDE!', rounds: 6, labels: ['TITLE SLIDE', 'RESEARCH', 'CONCEPT', 'PROTOTYPE', 'TESTING', 'Q & A'] },
    build(b) {
      b.seg(12, s => s.sign(2, 'JURY AT 2 PM').coins(6, 1, 4).deco('tree', 10))
       .seg(12, s => s.deco('bench', 1).item('milk', 3, 2).en('book', 5).plat(8, 2, 3).coins(8, 3, 3))
       .pit(3).seg(6, s => s.en('printer', 3)).pit(3, s => s.arc(0, 3, 4))
       .up().seg(8, s => s.en('clock', 4).deco('bush', 6))
       .up(2).seg(8, s => s.check(1).coins(2, 1, 5).deco('tree', 5))
       .pit(7, s => s.plat(1, 0, 2).plat(5, 0, 2).coins(1, 2, 2).coins(5, 2, 2))
       .seg(10, s => s.en('book', 3).en('plane', 6, 4).item('chai', 8, 2))
       .down(3).seg(14, s => s.spikes(3, 2).arc(2, 3, 4).wall(6, 2, 2).spikes(8, 2).en('clock', 11).deco('lamp', 13))
       .seg(3).pit(4, s => s.mover(1, 0, 3, 'y', 4, 0.5))
       .up(4).seg(9, s => s.coins(1, 1, 4).en('printer', 6))
       .pit(3, s => s.arc(0, 3, 4)).seg(4, s => s.item('clock', 1, 2))
       .down(2).seg(8, s => s.en('book', 4))
       .down(2).seg(14, s => s.en('clock', 3).plat(2, 2, 2).plat(5, 3, 2).plat(8, 4, 2).item('big', 9, 5).coins(5, 4, 2).deco('vend', 12))
       .pit(3).seg(5, s => s.coins(1, 1, 3)).pit(3)
       .seg(12, s => s.en('plane', 3, 3).en('book', 7).coins(8, 1, 3).deco('tree', 10))
       .goal('DESIGN STUDIO');
    },
  },
  {
    name: 'END-SEM EXAMS', place: 'NIGHT-OUT AT THE KNOWLEDGE CENTRE', theme: 'dawn', song: 'night', time: 130, outfit: 'casual',
    intro: 'ONE NIGHT TO REVISE THE WHOLE SEMESTER. CHAI KEEPS YOU AWAKE. DO NOT TOUCH THE SLEEP CLOUDS!',
    boss: { type: 'quiz', title: 'END-SEM PAPER', how: 'FIVE QUESTIONS. LESS TIME. STAY SHARP.', cats: ['aptitude', 'general', 'campus', 'aptitude', 'general'], secs: 10 },
    build(b) {
      b.seg(12, s => s.sign(1, 'KNOWLEDGE CENTRE').deco('lamp', 7).coins(8, 1, 3))
       .seg(12, s => s.item('milk', 2, 2).en('book', 4).hint(6, 'AVOID THE ZZZ!').en('zzz', 9, 3).coins(8, 1, 3))
       .pit(3).seg(4, s => s.coins(1, 1, 2)).pit(3).seg(4, s => s.en('book', 2)).pit(2)
       .seg(14, s => s.wall(3, 2, 2).plat(7, 3, 3).item('chai', 8, 4).en('clock', 10).en('zzz', 12, 3).deco('lamp', 1))
       .up(2).seg(10, s => s.check(1).coins(2, 1, 3).en('book', 6))
       .pit(7, s => s.plat(1, 0, 2).plat(4, 1, 2).coins(1, 2, 2).coins(4, 3, 2))
       .seg(10, s => s.coins(2, 1, 6).en('zzz', 3, 3).en('zzz', 7, 4))
       .down(2).seg(14, s => s.spikes(3, 1).spikes(6, 1).spikes(9, 1).coins(4, 1, 2).coins(7, 1, 2).en('clock', 12).deco('lamp', 13))
       .pit(9, s => s.mover(0, 0, 3, 'x', 6, 0.8).en('zzz', 4, 4).coins(3, 2, 3))
       .seg(12, s => s.en('book', 3).plat(5, 2, 2).item('clock', 5, 4).en('book', 9))
       .seg(6, s => s.wall(2, 1, 1).wall(3, 3, 2))
       .pit(6, s => s.plat(1, 2, 2).plat(4, 2, 1).coins(1, 3, 2))
       .seg(13, s => s.spring(2).plat(4, 5, 3).item('big', 5, 6).coins(4, 6, 1).coins(6, 6, 1).en('clock', 9).deco('bench', 10))
       .pit(3).seg(4, s => s.en('phone', 2, 3)).pit(3)
       .seg(12, s => s.en('clock', 4).en('zzz', 8, 3).coins(2, 1, 4).deco('lamp', 10))
       .goal('EXAM HALL');
    },
  },
  {
    name: 'PLACEMENT SEASON', place: 'DASH TO THE INTERVIEW ROOM', theme: 'sunset', song: 'hustle', time: 140, outfit: 'formal',
    intro: 'FORMALS ON. RESUME PRINTED. REJECTION MAILS ARE FLYING, BUT YOUR SLOT IS IN TEN MINUTES. GO!',
    boss: { type: 'interview', title: 'THE INTERVIEW', how: 'ROUND 1: NAIL YOUR TIMING. ROUND 2: ANSWER THE PANEL.', rounds: 3, labels: ['HANDSHAKE', 'INTRODUCE YOURSELF', 'WALK THROUGH PROJECT'], cats: ['hr', 'aptitude', 'hr'], secs: 12 },
    build(b) {
      b.seg(12, s => s.sign(1, 'PLACEMENT CELL').coins(6, 1, 4).deco('tree', 10))
       .seg(12, s => s.en('email', 5, 3).item('milk', 7, 2).en('clock', 9).coins(2, 1, 3))
       .pit(3, s => s.arc(0, 3, 4)).seg(5, s => s.en('email', 2, 3)).pit(3).seg(5, s => s.en('printer', 3)).pit(3)
       .up().seg(6, s => s.coins(1, 1, 4))
       .up().seg(6, s => s.en('clock', 3))
       .up().seg(6, s => s.check(1).item('chai', 3, 2))
       .pit(8, s => s.mover(0, 0, 3, 'x', 5, 0.8).coins(2, 2, 4).en('email', 5, 4))
       .seg(6, s => s.en('book', 3))
       .down(3).seg(13, s => s.spikes(3, 2).arc(2, 3, 4).en('book', 7).en('clock', 10).deco('lamp', 12))
       .pit(4, s => s.mover(1, 0, 3, 'y', 3, 0.55))
       .up(3).seg(10, s => s.coins(1, 1, 4).en('printer', 7))
       .pit(3).seg(3, s => s.coins(1, 1, 1)).pit(3).seg(3, s => s.item('maggi', 1, 2)).pit(3)
       .down(3).seg(14, s => s.en('email', 3, 3).en('clock', 6).en('email', 10, 4).coins(4, 1, 6))
       .seg(13, s => s.en('book', 2).plat(2, 2, 2).plat(5, 3, 2).plat(8, 4, 2).item('big', 9, 5).en('book', 10).spikes(12, 1))
       .pit(7, s => s.plat(1, 0, 2).plat(5, 0, 2).coins(1, 2, 2).coins(5, 2, 2)).seg(6, s => s.item('clock', 2, 2).en('email', 4, 3)).pit(3)
       .seg(12, s => s.en('clock', 3).en('clock', 7).en('email', 9, 3).deco('tree', 10))
       .goal('INTERVIEW ROOM');
    },
  },
  {
    name: 'CONVOCATION DAY', place: 'VICTORY LAP ACROSS CAMPUS', theme: 'gold', song: 'party', time: 150, outfit: 'gown',
    intro: 'YOU MADE IT! ONE LAST RUN PAST EVERYTHING THAT TRIED TO STOP YOU. THE STAGE IS WAITING.',
    boss: { type: 'catch', title: 'CAP TOSS', how: 'CATCH THE CAPS AND DEGREES. DODGE THE BACKLOGS!', good: ['CAP', 'DEGREE', 'MEDAL'], bad: 'BACKLOG', secs: 28 },
    build(b) {
      b.seg(14, s => s.deco('banner', 1, { text: 'CONVOCATION', col: '#b3262e' }).coins(4, 1, 8).deco('tree', 12))
       .seg(12, s => s.deco('flags', 0, { w: 12 }).item('milk', 2, 2).en('bug', 4).plat(6, 2, 3).coins(6, 3, 3).en('plane', 9, 4))
       .pit(3, s => s.arc(0, 3, 4)).seg(4, s => s.coins(1, 1, 2)).pit(3).seg(6, s => s.en('clock', 3))
       .up().seg(6, s => s.coins(1, 1, 4))
       .up().seg(8, s => s.check(1).en('phone', 5, 3).item('chai', 3, 2))
       .pit(9, s => s.mover(0, 0, 3, 'x', 6, 0.8, 'shuttle').coins(3, 2, 4))
       .seg(10, s => s.en('book', 3).spring(6).plat(8, 5, 2).coins(8, 6, 2))
       .down(2).seg(14, s => s.spikes(3, 2).arc(2, 3, 4).wall(6, 2, 2).spikes(8, 2).en('printer', 12).deco('lamp', 0))
       .pit(4, s => s.mover(1, 0, 3, 'y', 3, 0.55))
       .up(3).seg(10, s => s.en('email', 4, 3).coins(2, 1, 6))
       .pit(3).seg(4, s => s.item('maggi', 1, 2)).pit(3)
       .down(3).seg(14, s => s.deco('stall', 1, { text: 'SELFIE' }).en('zzz', 5, 3).en('speaker', 9).coins(10, 1, 3))
       .pit(8, s => s.plat(1, 0, 2).plat(4, 1, 2).coins(1, 2, 2).coins(4, 3, 2))
       .seg(12, s => s.en('clock', 3).en('clock', 7).en('email', 9, 3).deco('tree', 10))
       .seg(14, s => s.spring(2).plat(4, 5, 3).item('big', 5, 6).plat(9, 5, 2).item('big', 9, 6).en('book', 11))
       .pit(3).seg(3, s => s.coins(1, 1, 1)).pit(3).seg(3, s => s.coins(1, 1, 1)).pit(3)
       .seg(16, s => s.deco('flags', 0, { w: 16 }).coins(2, 1, 10).en('bug', 6).en('bug', 11).item('chai', 8, 3))
       .goal('CONVOCATION HALL');
    },
  },
];

const levelCache = {};
function buildLevel(i) {
  if (levelCache[i]) return levelCache[i];
  const b = new LevelBuilder(); LEVELS[i].build(b);
  const L = Object.assign(b.finish(), LEVELS[i], { index: i });
  L.totalCredits = L.ents.reduce((n, e) => n + (e.type === 'coin' ? 1 : e.type === 'item' && e.kind === 'big' ? 5 : 0), 0);
  return levelCache[i] = L;
}
