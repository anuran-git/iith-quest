// ─────────────────────────────────────────────────────────────────────────────
// 03-sprites.js — pixel art as text. Each character in a row is one pixel,
// looked up in a palette ('.' = transparent). All sprites face RIGHT (player)
// or LEFT (enemies); Art.flip() mirrors them.
// To restyle: edit the rows or the palettes. To use PNGs instead, replace
// Art.player()/Art.enemy/Art.item with canvases/images of the same size.
// ─────────────────────────────────────────────────────────────────────────────
function sprite(rows, pal) {
  const w = rows[0].length, h = rows.length;
  const [c, g] = makeCanvas(w, h);
  rows.forEach((row, y) => {
    if (row.length !== w) console.warn('sprite row width mismatch', y, row);
    for (let x = 0; x < w; x++) { const col = pal[row[x]]; if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } }
  });
  return c;
}

// ── Player parts (16 wide). head = 11 rows, torso = 6 rows, legs = 7 rows ──
const P_HEAD = {
  boy: [
    '................',
    '......KKKKK.....',
    '....KKHHHHHKK...',
    '...KHHHHHHHHHK..',
    '..KHHHHHHHHHHK..',
    '..KHHHHSHHSSHK..',
    '..KHHSSSSSSSSK..',
    '..KHSKGGKKGGK...',
    '...KSKGEKKGEK...',
    '...KSSSSSSSSSK..',
    '....KKSSSSSKK...',
  ],
  girl: [
    '................',
    '......KKKKK.....',
    '....KKHHHHHKK...',
    '...KHHHHHHHHHK..',
    '.KKHHHHHHHHHHK..',
    'KHHKHHHHSSHSSK..',
    'KHHKHHSSSSSSSK..',
    'KHHKHSSSESSESK..',
    '.KHKHSSSESSESK..',
    '.KHHKSsSSSSSSK..',
    '.KHK.KKSSSSKK...',
  ],
};
const P_TORSO = {
  n: [
    '....KKMMMMKK....',
    '..KKKMMMMMMMK...',
    '..KBBMMmMMMMK...',
    '..KBBMMmMMSSK...',
    '..KBbMMMMMMK....',
    '..KKKMMMMMMK....',
  ],
  f: [
    '....KKMMMMKK....',
    '..KKKMMMMMMMKK..',
    '..KBBMMMMmmmMSK.',
    '..KBBMMMMKKKKK..',
    '..KBbMMMMMMK....',
    '..KKKMMMMMMK....',
  ],
  b: [
    '....KKMMMMKK....',
    '..KKKMMMMMMMK...',
    '.KSmmMMMMMMMK...',
    '..KKBMMMMMMMK...',
    '..KBbMMMMMMK....',
    '..KKKMMMMMMK....',
  ],
};
const P_LEGS = {
  stand: [
    '....KPPPPPPK....',
    '....KPPPPPPK....',
    '....KPPKKPPK....',
    '....KPPKKPPK....',
    '....KPPKKPPK....',
    '....KWWKKWWWK...',
    '....KRRKKRRRK...',
  ],
  r1: [
    '....KPPPPPPK....',
    '...KPPPPPPPPK...',
    '..KPPPKKKPPPK...',
    '.KPPPK...KPPPK..',
    '.KWWK.....KPPK..',
    '.KRRK.....KWWWK.',
    '..KK......KRRRK.',
  ],
  r2: [
    '....KPPPPPPK....',
    '....KPPPPPPK....',
    '.....KPPPPK.....',
    '.....KPPPPK.....',
    '....KWWKPPK.....',
    '....KRRKWWWK....',
    '.....KKKRRRK....',
  ],
  r3: [
    '....KPPPPPPK....',
    '...KPPPPPPPK....',
    '..KPPKKPPPPK....',
    '.KWPK..KPPPK....',
    '.KRWK...KPPPK...',
    '..KK....KWWWK...',
    '........KRRRK...',
  ],
  jump: [
    '....KPPPPPPK....',
    '...KPPPPPPPPK...',
    '..KPPPKKKPPPK...',
    '..KWWK...KPPWK..',
    '..KRRK...KKWRK..',
    '...KK......KK...',
    '................',
  ],
};
const P_CAP = [   // graduation cap overlay (convocation outfit)
  '...KKKKKKKKKK...',
  '..KDDDDDDDDDDK..',
  '...KKKKKKKKKKY..',
  '.............Y..',
];
const P_PAL = {
  boy: { K: C.ink, H: '#2a2233', S: '#f0b98d', s: '#d9966a', G: '#cfe8f5', E: '#1a1423', M: '#9a2f4f', m: '#74203a', P: '#2c3350', W: '#f4efe6', R: '#c8323c', B: '#3b5d8f', b: '#2b4670', D: '#2a2438', Y: C.gold },
  girl: { K: C.ink, H: '#4a2618', S: '#f0b98d', s: '#e8928a', G: '#cfe8f5', E: '#1a1423', M: '#1f9a94', m: '#16746f', P: '#3a3560', W: '#f4efe6', R: '#e8833a', B: '#d9a441', b: '#a87a2a', D: '#2a2438', Y: C.gold },
};
const P_OUTFIT = {
  casual: {},
  formal: { M: '#e9edf3', m: '#b8c2d2', P: '#23283d', R: '#3a2a2a', W: '#3a2a2a' },
  gown: { M: '#2a2438', m: '#1c1828', P: '#2a2438' },
};

const Art = (() => {
  const flipped = new WeakMap(), cache = {};
  function flip(c) {
    let f = flipped.get(c); if (f) return f;
    const [fc, g] = makeCanvas(c.width, c.height);
    g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0);
    flipped.set(c, fc); return fc;
  }
  // player(kind 'boy'|'girl', outfit 'casual'|'formal'|'gown', palette overrides)
  //   → { idle, run:[4 frames], jump }  each a 16x24 canvas facing right
  function player(kind, outfit = 'casual', over) {
    const key = kind + '|' + outfit + '|' + JSON.stringify(over || {});
    if (cache[key]) return cache[key];
    const pal = Object.assign({}, P_PAL[kind], P_OUTFIT[outfit], over);
    const build = (torso, legs) => {
      const c = sprite(P_HEAD[kind].concat(P_TORSO[torso], P_LEGS[legs]), pal);
      if (outfit === 'gown') c.getContext('2d').drawImage(sprite(P_CAP, pal), 0, 0);
      return c;
    };
    return cache[key] = {
      idle: build('n', 'stand'),
      run: [build('f', 'r1'), build('n', 'r2'), build('b', 'r3'), build('n', 'r2')],
      jump: build('f', 'jump'),
    };
  }

  // ── Enemies (16x16, facing left). Second frame is generated: bottom rows mirrored ──
  const EPAL = { K: C.ink, W: '#f4efe6', w: '#c9c2b4', R: '#d33c3c', G: '#6fbf4a', g: '#3f8a34', E: '#1a1423', B: '#3a3f55', C: '#7fe0e8', P: '#7a4fb0', D: '#59607a', Z: '#f4efe6', Y: C.gold };
  const ENEMY_ROWS = {
    bug: [
      '................', '................', '................', '................',
      '..K........K....', '...K......K.....', '....KKKKKK......', '...KGGGGGGKK....',
      '..KGGgGGgGGGK...', '.KWEGGGGGGGGK...', '.KGGGGgGGGgGK...', '..KGGGGGGGGGK...',
      '...KKKKKKKKK....', '..K.K..K..K.K...', '.K..K..K..K..K..', '................',
    ],
    clock: [
      '................', '..KK......KK....', '.KRRK....KRRK...', '.KRRKKKKKKRRK...',
      '..KKWWWWWWKK....', '..KWWWWWWWWK....', '.KWKKWWWWKKWK...', '.KWWWKWWKWWWK...',
      '.KWWEWWWWEWWK...', '.KWWWWWWWWWWK...', '.KWWWKKKKWWWK...', '..KWWWWWWWWK....',
      '..KKWWWWWWKK....', '...KKKKKKKK.....', '..KK......KK....', '.KK........KK...',
    ],
    plane: [
      '................', '................', '................', '............KK..',
      '..........KKWK..', '........KKWWWK..', '......KKWWWWWK..', '....KKWWWWWWK...',
      '..KKWWWWWWWWK...', 'KKWWWWWWWWWK....', '..KKKwwwWWWK....', '.....KKwwWK.....',
      '.......KwWK.....', '........KKK.....', '................', '................',
    ],
    phone: [
      '................', '.RR..KKKKKKK....', 'RWWRKBBBBBBBK...', 'RWWRKBCCCCCBK...',
      '.RR.KBCCCCCBK...', '....KBCECECBK...', '....KBCCCCCBK...', '....KBCKKKCBK...',
      '....KBCCCCCBK...', '....KBCCCCCBK...', '....KBBBBBBBK...', '....KBBBKBBBK...',
      '.....KKKKKKK....', '................', '................', '................',
    ],
    book: [
      '................', '................', '................', '................',
      '..KKKKKKKKKKKK..', '.KPPPPPPPPPPPPK.', '.KPWWPPPPPWWPPK.', '.KPEWPPPPPEWPPK.',
      '.KPPPPPPPPPPPPK.', '.KPPPKKKKKKPPPK.', '.KPPPPPPPPPPPPK.', '.KWWWWWWWWWWWWK.',
      '.KKKKKKKKKKKKKK.', '..KK........KK..', '................', '................',
    ],
    zzz: [
      '................', '..ZZZ...........', '...Z............', '..ZZZ..KKKK.....',
      '.....KKDDDDKK...', '..KKKDDDDDDDDK..', '.KDDDDDDDDDDDDK.', 'KDDDKKDDDKKDDDDK',
      'KDDDDDDDDDDDDDDK', 'KDDDDDKKKDDDDDDK', '.KDDDDDDDDDDDDK.', '..KKDDDDDDDDKK..',
      '....KKKKKKKK....', '................', '................', '................',
    ],
    email: [
      '................', '................', '................', '.KKKKKKKKKKKKKK.',
      '.KWKWWWWWWWWKWK.', '.KWWKWWWWWWKWWK.', '.KWWWKWWWWKWWWK.', '.KWWWWKRRKWWWWK.',
      '.KWWWWRRRRWWWWK.', '.KWWWWRRRRWWWWK.', '.KWWWWWRRWWWWWK.', '.KWWWWWWWWWWWWK.',
      '.KKKKKKKKKKKKKK.', '................', '................', '................',
    ],
    speaker: [
      '................', '..KKKKKKKKKKKK..', '..KDDDDDDDDDDK..', '..KDDDKKKKDDDK..',
      '..KDDKYYYYKDDK..', '..KDDKYKKYKDDK..', '..KDDKYYYYKDDK..', '..KDDDKKKKDDDK..',
      '..KDDKKKKKKDDK..', '..KDKYYYYYYKDK..', '..KDKYYKKYYKDK..', '..KDKYYKKYYKDK..',
      '..KDKYYYYYYKDK..', '..KDDKKKKKKDDK..', '..KKKKKKKKKKKK..', '................',
    ],
    printer: [
      '................', '................', '....KKKKKKKK....', '....KWWWWWWK....',
      '....KWKKKKWK....', '..KKKWWWWWWKKK..', '.KDDDDDDDDDDDDK.', '.KDEDDDDDDDEDRK.',
      '.KDKKKKKKKKKKDK.', '.KDKWWWWWWWWKDK.', '.KDDDDDDDDDDDDK.', '.KKKKKKKKKKKKKK.',
      '..KWWWWWWWWWWK..', '..KWKKKKKKKWWK..', '..KKKKKKKKKKKK..', '................',
    ],
  };
  const enemy = {};
  Object.keys(ENEMY_ROWS).forEach(k => {
    const a = sprite(ENEMY_ROWS[k], EPAL);
    const rows2 = ENEMY_ROWS[k].map((r, i) => i >= 13 ? r.split('').reverse().join('') : r);
    enemy[k] = [a, sprite(rows2, EPAL)];
  });

  // ── Pickups ──
  const IPAL = { K: C.ink, W: '#f4efe6', O: '#b5713a', o: '#8d5527', Y: '#f2c14e', y: '#c9962e', R: '#d33c3c', B: '#4f8fd0', b: '#2f5f9a', G: '#6fbf4a' };
  const item = {
    chai: sprite([
      '..W..W....', '...W..W...', '..W..W....', 'KKKKKKKK..', 'KWOOOOOKKK', 'KWOOOOOK.K',
      'KOOOOOOK.K', 'KOOOOOOKKK', '.KOOOOK...', '.KooooK...', '..KKKK....', '..........',
    ], IPAL),
    maggi: sprite([
      '............', '.KKKKKKKKKK.', 'KYYYYYYYYYYK', 'KYRRRRRRRRYK', 'KYRWRRRRWRYK', 'KYRWWRRWWRYK',
      'KYRWRWWRWRYK', 'KYRWRRRRWRYK', 'KYRRRRRRRRYK', 'KYYYYYYYYYYK', '.KKKKKKKKKK.', '............',
    ], IPAL),
    clock: sprite([
      '...KKKKKK...', '..KBBBBBBK..', '.KBWWWWWWBK.', 'KBWWWKWWWWBK', 'KBWWWKWWWWBK', 'KBWWWKKKWWBK',
      'KBWWWWWWWWBK', 'KBWWWWWWWWBK', '.KBWWWWWWBK.', '..KBBBBBBK..', '...KKKKKK...', '............',
    ], IPAL),
    milk: sprite([   // GROW: badam milk
      '...KKKKKK...', '..KWWWWWWK..', '..KKKKKKKK..', '..KWWWWWWK..', '..KYYYYYYK..', '..KYyYYYYK..',
      '..KYYYYyYK..', '..KYYYYYYK..', '..KYyYYYYK..', '..KYYYYYYK..', '...KKKKKK...', '............',
    ], Object.assign({}, IPAL, { Y: '#f6e3a8', y: '#c9962e' })),
    big: sprite([
      '.....KK.....', '....KYYK....', '....KYYK....', 'KKKKYYYYKKKK', 'KYYYYYYYYYYK', '.KYYYYYYYYK.',
      '..KYYYYYYK..', '..KYYYYYYK..', '.KYYYKKYYYK.', '.KYYK..KYYK.', 'KYKK....KKYK', 'KK........KK',
    ], IPAL),
  };
  // Spinning credit coin: 4 frames, 8x8
  const coin = [8, 6, 2, 6].map(wd => {
    const [c, g] = makeCanvas(8, 8), x0 = (8 - wd) / 2;
    g.fillStyle = C.ink; g.fillRect(x0, 0, wd, 8); if (wd > 2) { g.clearRect(x0, 0, 1, 1); g.clearRect(x0 + wd - 1, 0, 1, 1); g.clearRect(x0, 7, 1, 1); g.clearRect(x0 + wd - 1, 7, 1, 1); }
    g.fillStyle = '#f2c14e'; if (wd > 2) g.fillRect(x0 + 1, 1, wd - 2, 6); else g.fillRect(x0, 1, wd, 6);
    if (wd >= 6) { g.fillStyle = '#fff3c4'; g.fillRect(x0 + 1, 1, 1, 6); g.fillStyle = '#a8761f'; g.fillRect(3, 2, 2, 1); g.fillRect(3, 5, 2, 1); g.fillRect(2, 3, 1, 2); }
    return c;
  });
  return { flip, player, enemy, item, coin };
})();
