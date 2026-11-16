// ─────────────────────────────────────────────────────────────────────────────
// 04-world.js — everything drawn procedurally for the world: sky + parallax
// campus backgrounds, the tileset and decorations. Each level picks a THEME.
// Add a theme by adding an entry to THEMES; add a decoration by adding a
// drawer to DECO (it draws into a canvas whose bottom edge sits on the ground).
// ─────────────────────────────────────────────────────────────────────────────
const THEMES = {
  day:     { sky: ['#3f9fb0', '#58b7c3', '#86d3d4', '#c2ebde'], far: '#6cb9c4', dark: 0, clouds: 1 },
  morning: { sky: ['#ef9a68', '#f7bd83', '#fbd9a5', '#fdeccb'], far: '#e3a174', dark: 0, clouds: 1, sun: 1 },
  night:   { sky: ['#0b0e22', '#12173a', '#1b2350', '#2a3468'], far: '#1a2148', dark: 0.5, stars: 1, moon: 1 },
  fest:    { sky: ['#160b2e', '#2a1250', '#47196b', '#7a2a7c'], far: '#2a1250', dark: 0.4, stars: 1, beams: 1 },
  sunset:  { sky: ['#3b2a5c', '#8d4470', '#e8805d', '#f9c97c'], far: '#6d3b66', dark: 0.2, sun: 1 },
  dawn:    { sky: ['#141b3c', '#27336b', '#4f5fa3', '#8f9fd0'], far: '#27336b', dark: 0.42, stars: 1 },
  gold:    { sky: ['#4a9fd8', '#7cc3ea', '#bfe3f2', '#fbf0c4'], far: '#7fb6d6', dark: 0, clouds: 1 },
};

const World = (() => {
  const layerCache = {}, decoCache = {};
  const BASE = GROUND_ROW * T - (ROWS * T - H);   // screen y of the ground line (148)

  function disc(g, cx, cy, r, col) {
    g.fillStyle = col;
    for (let y = -r; y <= r; y++) { const hw = Math.floor(Math.sqrt(r * r - y * y)); g.fillRect(cx - hw, cy + y, hw * 2 + 1, 1); }
  }
  function darken(g, w, h, amt) {
    if (!amt) return;
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(10,12,40,' + amt + ')'; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
  }

  // IITH-style block: cream slabs + brick-red bands with dark windows
  function building(g, x, base, w, h, rnd, wins) {
    const top = base - h;
    for (let y = top; y < base; y++) { g.fillStyle = (y - top) % 10 < 3 ? '#efe6d8' : '#b3262e'; g.fillRect(x, y, w, 1); }
    g.fillStyle = '#3d2434';
    for (let fy = top + 4; fy < base - 6; fy += 10) for (let wx = x + 3; wx < x + w - 6; wx += 6) { g.fillRect(wx, fy, 3, 4); wins.push([wx, fy]); }
    g.fillStyle = 'rgba(50,10,35,0.3)'; g.fillRect(x + w - 5, top, 5, h);
    g.fillStyle = '#d9cfbf'; g.fillRect(x - 1, top - 2, w + 2, 2);
    g.fillStyle = '#3d2434'; g.fillRect(x + (w >> 1) - 4, base - 9, 8, 9);
    if (rnd() < 0.75) {   // stepped upper block + antenna
      const uw = Math.floor(w * 0.5), ux = x + Math.floor(rnd() * (w - uw)), ut = top - 14;
      for (let y = ut; y < top - 2; y++) { g.fillStyle = (y - ut) % 10 < 3 ? '#efe6d8' : '#b3262e'; g.fillRect(ux, y, uw, 1); }
      g.fillStyle = '#d9cfbf'; g.fillRect(ux - 1, ut - 2, uw + 2, 2);
      g.fillStyle = '#5a5f6a'; g.fillRect(ux + (uw >> 1), ut - 9, 1, 7); g.fillStyle = '#d33c3c'; g.fillRect(ux + (uw >> 1), ut - 10, 1, 1);
    }
  }
  function smallTree(g, x, base, dark) {
    g.fillStyle = '#5c4027'; g.fillRect(x + 5, base - 10, 3, 10);
    disc(g, x + 6, base - 15, 7, dark ? '#2a5c36' : '#3f8a3a'); disc(g, x + 2, base - 11, 5, dark ? '#234f30' : '#2f6b3a');
    disc(g, x + 11, base - 12, 5, dark ? '#2a5c36' : '#357a3a'); disc(g, x + 5, base - 18, 3, dark ? '#3a7444' : '#63b24f');
  }

  // layers(themeName) → { sky, far, mid, tiles }
  function layers(name) {
    if (layerCache[name]) return layerCache[name];
    const th = THEMES[name], rnd = seeded(name.length * 7919 + name.charCodeAt(0) * 31);
    // sky
    const [sky, sg] = makeCanvas(W, H);
    const bands = [0, 46, 86, 120, H];
    for (let i = 0; i < 4; i++) {
      sg.fillStyle = th.sky[i]; sg.fillRect(0, bands[i], W, bands[i + 1] - bands[i]);
      if (i > 0) for (let x = 0; x < W; x += 2) { sg.fillStyle = th.sky[i - 1]; sg.fillRect(x, bands[i], 1, 1); sg.fillRect(x + 1, bands[i] + 1, 1, 1); }
    }
    if (th.stars) for (let i = 0; i < 60; i++) { sg.fillStyle = rnd() < 0.3 ? '#fff6c8' : '#cfd6ff'; sg.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * 95), 1, 1); }
    if (th.moon) { disc(sg, 262, 30, 10, '#f4efe6'); disc(sg, 258, 27, 2, '#d9d2c2'); disc(sg, 266, 34, 1, '#d9d2c2'); }
    if (th.sun) { disc(sg, 250, 74, 13, '#fff2c9'); disc(sg, 250, 74, 10, '#fffbe6'); }
    if (th.beams) {
      [['rgba(224,90,138,0.16)', 60, -40], ['rgba(127,224,232,0.14)', 150, 30], ['rgba(242,193,78,0.13)', 240, -20], ['rgba(224,90,138,0.12)', 290, 50]].forEach(b => {
        sg.fillStyle = b[0]; sg.beginPath(); sg.moveTo(b[1], H); sg.lineTo(b[1] + b[2] - 22, 0); sg.lineTo(b[1] + b[2] + 22, 0); sg.closePath(); sg.fill();
      });
    }
    // far skyline (+ clouds)
    const [far, fg] = makeCanvas(640, H);
    if (th.clouds) for (let i = 0; i < 7; i++) {
      const cx = 30 + i * 88 + Math.floor(rnd() * 30), cy = 18 + Math.floor(rnd() * 40);
      disc(fg, cx, cy, 7, '#ffffff'); disc(fg, cx + 9, cy + 2, 6, '#ffffff'); disc(fg, cx - 9, cy + 3, 5, '#ffffff'); fg.fillStyle = '#ffffff'; fg.fillRect(cx - 14, cy + 4, 30, 4);
    }
    for (let x = 4; x < 610;) {
      const w = 14 + Math.floor(rnd() * 20), h = 22 + Math.floor(rnd() * 46);
      fg.fillStyle = th.far; fg.fillRect(x, BASE - h, w, h + 40);
      fg.fillStyle = 'rgba(255,255,255,0.10)'; fg.fillRect(x, BASE - h, w, 2); fg.fillRect(x, BASE - h, 2, h);
      fg.fillStyle = th.dark ? 'rgba(247,215,116,0.35)' : 'rgba(255,255,255,0.16)';
      for (let wy = BASE - h + 5; wy < BASE - 4; wy += 6) for (let wx = x + 3; wx < x + w - 3; wx += 5) if (rnd() < 0.45) fg.fillRect(wx, wy, 2, 2);
      x += w + Math.floor(rnd() * 12);
    }
    // mid: IITH buildings + trees
    const [mid, mg] = makeCanvas(640, H), wins = [];
    for (let x = 8; x < 560;) {
      const w = 46 + Math.floor(rnd() * 36), h = 52 + Math.floor(rnd() * 42);
      building(mg, x, BASE + 2, w, h, rnd, wins);
      x += w + 6; smallTree(mg, x, BASE + 2, th.dark); if (rnd() < 0.6) smallTree(mg, x + 14, BASE + 2, th.dark);
      x += 26 + Math.floor(rnd() * 22);
    }
    darken(mg, 640, H, th.dark);
    if (th.dark) wins.forEach(p => { if (rnd() < 0.4) { mg.fillStyle = rnd() < 0.8 ? '#f7d774' : '#9fe3f0'; mg.fillRect(p[0], p[1], 3, 4); } });
    // tileset: [ground top, ground fill, block, one-way, hazard]
    const [tiles, tg] = makeCanvas(T * 5, T);
    tg.fillStyle = '#8fa7ab'; tg.fillRect(0, 0, 16, 16); tg.fillStyle = '#c6d6d6'; tg.fillRect(0, 0, 16, 2);
    tg.fillStyle = '#738c91'; tg.fillRect(0, 2, 16, 1); tg.fillStyle = '#7b9297'; tg.fillRect(7, 3, 1, 13); tg.fillRect(15, 3, 1, 13); tg.fillRect(0, 9, 16, 1);
    tg.fillStyle = '#6f858b'; tg.fillRect(16, 0, 16, 16); tg.fillStyle = '#5f757b'; tg.fillRect(16, 7, 16, 1); tg.fillRect(16, 15, 16, 1); tg.fillRect(19, 0, 1, 7); tg.fillRect(27, 8, 1, 7);
    tg.fillStyle = '#b3262e'; tg.fillRect(32, 0, 16, 16); tg.fillStyle = '#efe6d8'; tg.fillRect(32, 0, 16, 4); tg.fillStyle = '#8a1c25'; tg.fillRect(32, 9, 16, 1); tg.fillRect(37, 5, 1, 4); tg.fillRect(44, 10, 1, 5);
    tg.fillStyle = '#5e1220'; tg.fillRect(32, 15, 16, 1); tg.fillRect(47, 4, 1, 12); tg.fillStyle = '#d9cfbf'; tg.fillRect(32, 3, 16, 1);
    tg.fillStyle = '#efe6d8'; tg.fillRect(48, 0, 16, 2); tg.fillStyle = '#b3262e'; tg.fillRect(48, 2, 16, 3); tg.fillStyle = '#5e1220'; tg.fillRect(48, 5, 16, 1); tg.fillRect(50, 6, 2, 2); tg.fillRect(60, 6, 2, 2);
    for (let i = 0; i < 4; i++) {
      const x0 = 64 + i * 4;
      tg.fillStyle = '#dfe6ea'; tg.fillRect(x0 + 1, 8, 2, 8); tg.fillRect(x0, 12, 4, 4);
      tg.fillStyle = '#8a96a0'; tg.fillRect(x0 + 1, 8, 1, 4); tg.fillRect(x0, 12, 1, 4); tg.fillStyle = '#ffffff'; tg.fillRect(x0 + 2, 7, 1, 2);
    }
    darken(tg, T * 5, T, th.dark * 0.7);
    return layerCache[name] = { sky, far, mid, tiles };
  }

  function drawBackground(ctx, name, camX, frame) {
    const L = layers(name);
    ctx.drawImage(L.sky, 0, 0);
    let fx = -Math.floor(camX * 0.15) % 640; ctx.drawImage(L.far, fx, 0); ctx.drawImage(L.far, fx + 640, 0);
    let mx = -Math.floor(camX * 0.45) % 640; ctx.drawImage(L.mid, mx, 0); ctx.drawImage(L.mid, mx + 640, 0);
  }

  // ── Decorations ── each drawer returns a canvas; its bottom edge sits on the ground.
  const FLAGC = ['#d33c3c', '#f2c14e', '#3aa6a6', '#e05a8a', '#f4efe6'];
  const DECO = {
    tree(d, th) {
      const [c, g] = makeCanvas(30, 42); const dk = th.dark;
      g.fillStyle = '#6b4a2b'; g.fillRect(13, 24, 4, 18); g.fillStyle = '#4f3620'; g.fillRect(16, 24, 1, 18);
      disc(g, 15, 15, 11, '#3f8a3a'); disc(g, 7, 21, 7, '#2f6b3a'); disc(g, 23, 20, 7, '#357a3a'); disc(g, 12, 10, 5, '#63b24f'); disc(g, 20, 13, 3, '#56a548');
      darken(g, 30, 42, dk); return c;
    },
    bush(d, th) { const [c, g] = makeCanvas(20, 10); disc(g, 6, 7, 5, '#2f6b3a'); disc(g, 13, 6, 6, '#3f8a3a'); disc(g, 12, 4, 2, '#63b24f'); g.clearRect(0, 10, 20, 4); darken(g, 20, 10, th.dark); return c; },
    lamp(d, th) {
      const [c, g] = makeCanvas(16, 44);
      g.fillStyle = '#3a3f4d'; g.fillRect(7, 6, 2, 38); g.fillRect(5, 42, 6, 2); g.fillRect(3, 4, 10, 2);
      darken(g, 16, 44, th.dark);
      g.fillStyle = th.dark ? '#ffe9a0' : '#f4efe6'; g.fillRect(4, 6, 8, 3);
      if (th.dark) { g.fillStyle = 'rgba(255,233,160,0.16)'; g.beginPath(); g.moveTo(4, 9); g.lineTo(12, 9); g.lineTo(16, 44); g.lineTo(0, 44); g.fill(); }
      return c;
    },
    bench(d, th) { const [c, g] = makeCanvas(24, 11); g.fillStyle = '#8a5a34'; g.fillRect(0, 0, 24, 2); g.fillRect(0, 5, 24, 2); g.fillStyle = '#3a3f4d'; g.fillRect(2, 2, 2, 9); g.fillRect(20, 2, 2, 9); darken(g, 24, 11, th.dark); return c; },
    cycle(d, th) {
      const [c, g] = makeCanvas(22, 13);
      [5, 16].forEach(cx => { disc(g, cx, 8, 4, '#2a2233'); disc(g, cx, 8, 2, 'rgba(0,0,0,0)'); g.clearRect(cx - 2, 6, 5, 5); g.fillStyle = '#8a8f98'; g.fillRect(cx, 8, 1, 1); });
      g.fillStyle = d.col || '#d33c3c'; g.fillRect(5, 7, 6, 1); g.fillRect(10, 3, 1, 5); g.fillRect(10, 4, 6, 1); g.fillRect(15, 2, 1, 6); g.fillRect(6, 4, 1, 4);
      g.fillStyle = '#2a2233'; g.fillRect(8, 2, 4, 1); g.fillRect(14, 1, 4, 1);
      darken(g, 22, 13, th.dark); return c;
    },
    sign(d, th) {
      const w = Math.max(24, d.text.length * 6 + 9), [c, g] = makeCanvas(w, 28);
      g.fillStyle = '#5a4630'; g.fillRect((w >> 1) - 1, 13, 2, 15);
      g.fillStyle = C.ink; g.fillRect(0, 0, w, 14); g.fillStyle = d.col || '#efe6d8'; g.fillRect(1, 1, w - 2, 12);
      g.fillStyle = '#b3262e'; g.fillRect(1, 1, w - 2, 2);
      Font.draw(g, d.text, w / 2, 5, C.ink, { align: 'center' });
      darken(g, w, 28, th.dark * 0.6); return c;
    },
    banner(d, th) {
      const w = d.text.length * 6 + 18, [c, g] = makeCanvas(w, 46);
      g.fillStyle = '#3a3f4d'; g.fillRect(1, 0, 2, 46); g.fillRect(w - 3, 0, 2, 46);
      g.fillStyle = d.col || '#e05a8a'; g.fillRect(3, 3, w - 6, 15); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(3, 16, w - 6, 2);
      Font.draw(g, d.text, w / 2, 7, '#fff8e8', { align: 'center' });
      darken(g, w, 46, th.dark * 0.4); return c;
    },
    flags(d, th) {
      const w = (d.w || 6) * T, [c, g] = makeCanvas(w, 40);
      g.fillStyle = '#3a3f4d'; g.fillRect(0, 0, 2, 40); g.fillRect(w - 2, 0, 2, 40);
      for (let x = 2; x < w - 2; x++) { const y = 3 + Math.round(Math.sin((x / w) * Math.PI) * 6); g.fillStyle = '#2a2233'; g.fillRect(x, y, 1, 1); if (x % 8 === 4) { g.fillStyle = FLAGC[(x >> 3) % 5]; g.fillRect(x - 2, y + 1, 5, 2); g.fillRect(x - 1, y + 3, 3, 2); g.fillRect(x, y + 5, 1, 1); } }
      return c;
    },
    stall(d, th) {
      const [c, g] = makeCanvas(36, 32);
      g.fillStyle = '#5a4630'; g.fillRect(2, 8, 2, 24); g.fillRect(32, 8, 2, 24);
      for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? '#efe6d8' : (d.col || '#d33c3c'); g.fillRect(i * 4, 0, 4, 9); g.fillRect(i * 4 + 1, 9, 2, 1); }
      g.fillStyle = '#8a5a34'; g.fillRect(2, 20, 32, 12); g.fillStyle = '#6b4a2b'; g.fillRect(2, 20, 32, 2);
      darken(g, 36, 32, th.dark * 0.5);
      Font.draw(g, d.text || 'CHAI', 18, 23, '#fff3c4', { align: 'center' });
      return c;
    },
    vend(d, th) {
      const [c, g] = makeCanvas(14, 24);
      g.fillStyle = C.ink; g.fillRect(0, 0, 14, 24); g.fillStyle = '#3b5d8f'; g.fillRect(1, 1, 12, 22);
      darken(g, 14, 24, th.dark * 0.5);
      g.fillStyle = '#bfe8f0'; g.fillRect(2, 2, 7, 12); g.fillStyle = '#d33c3c'; g.fillRect(3, 4, 2, 2); g.fillStyle = '#f2c14e'; g.fillRect(6, 4, 2, 2); g.fillStyle = '#6fbf4a'; g.fillRect(3, 8, 2, 2); g.fillStyle = '#e8833a'; g.fillRect(6, 8, 2, 2);
      g.fillStyle = '#f2c14e'; g.fillRect(10, 4, 2, 3); g.fillStyle = C.ink; g.fillRect(3, 17, 8, 4);
      return c;
    },
    gate(d, th) {
      const [c, g] = makeCanvas(112, 64);
      [2, 94].forEach(px => {
        g.fillStyle = C.ink; g.fillRect(px, 14, 16, 50); g.fillStyle = '#6b6480'; g.fillRect(px + 1, 14, 14, 50);
        g.fillStyle = '#565070'; g.fillRect(px + 10, 14, 5, 50); g.fillStyle = '#8a84a0'; g.fillRect(px + 1, 24, 14, 2); g.fillRect(px + 1, 46, 14, 2);
      });
      g.fillStyle = C.ink; g.fillRect(0, 0, 112, 16); g.fillStyle = '#f4efe6'; g.fillRect(1, 1, 110, 14);
      g.fillStyle = '#b3262e'; g.fillRect(1, 1, 110, 2); g.fillRect(1, 13, 110, 2);
      Font.draw(g, d.text || 'IIT HYDERABAD', 56, 5, '#7d1a25', { align: 'center' });
      darken(g, 112, 64, th.dark * 0.6); return c;
    },
    stage(d, th) {
      const [c, g] = makeCanvas(72, 50);
      g.fillStyle = '#2a2233'; g.fillRect(0, 0, 72, 4); g.fillRect(2, 4, 3, 46); g.fillRect(67, 4, 3, 46); g.fillRect(0, 38, 72, 12);
      g.fillStyle = '#47196b'; g.fillRect(5, 4, 62, 34);
      [['#e05a8a', 14], ['#7fe0e8', 36], ['#f2c14e', 58]].forEach(l => { g.fillStyle = l[0]; g.fillRect(l[1] - 2, 4, 4, 3); g.globalAlpha = 0.22; g.beginPath(); g.moveTo(l[1] - 2, 7); g.lineTo(l[1] + 2, 7); g.lineTo(l[1] + 10, 38); g.lineTo(l[1] - 10, 38); g.fill(); g.globalAlpha = 1; });
      Font.draw(g, d.text || 'ELAN', 36, 41, '#fff3c4', { align: 'center' });
      return c;
    },
  };
  function deco(d, themeName) {
    const key = themeName + '|' + d.type + '|' + (d.text || '') + '|' + (d.col || '') + '|' + (d.w || '');
    if (decoCache[key]) return decoCache[key];
    return decoCache[key] = DECO[d.type](d, THEMES[themeName]);
  }
  return { layers, drawBackground, deco, disc, BASE };
})();
