// ─────────────────────────────────────────────────────────────────────────────
// 01-font.js — 5x7 bitmap font (uppercase only; lowercase is auto-uppercased).
// Each glyph = 7 row values, 5 bits per row (16 = leftmost pixel).
// To add a glyph: add an entry to GLYPHS. Special icons: ♥ ← → ↑ ↓ ★ •
// ─────────────────────────────────────────────────────────────────────────────
const GLYPHS = {
  'A': [14, 17, 17, 31, 17, 17, 17], 'B': [30, 17, 17, 30, 17, 17, 30], 'C': [14, 17, 16, 16, 16, 17, 14],
  'D': [30, 17, 17, 17, 17, 17, 30], 'E': [31, 16, 16, 30, 16, 16, 31], 'F': [31, 16, 16, 30, 16, 16, 16],
  'G': [14, 17, 16, 23, 17, 17, 15], 'H': [17, 17, 17, 31, 17, 17, 17], 'I': [14, 4, 4, 4, 4, 4, 14],
  'J': [7, 2, 2, 2, 2, 18, 12], 'K': [17, 18, 20, 24, 20, 18, 17], 'L': [16, 16, 16, 16, 16, 16, 31],
  'M': [17, 27, 21, 21, 17, 17, 17], 'N': [17, 25, 21, 19, 17, 17, 17], 'O': [14, 17, 17, 17, 17, 17, 14],
  'P': [30, 17, 17, 30, 16, 16, 16], 'Q': [14, 17, 17, 17, 21, 18, 13], 'R': [30, 17, 17, 30, 20, 18, 17],
  'S': [15, 16, 16, 14, 1, 1, 30], 'T': [31, 4, 4, 4, 4, 4, 4], 'U': [17, 17, 17, 17, 17, 17, 14],
  'V': [17, 17, 17, 17, 17, 10, 4], 'W': [17, 17, 17, 21, 21, 21, 10], 'X': [17, 17, 10, 4, 10, 17, 17],
  'Y': [17, 17, 10, 4, 4, 4, 4], 'Z': [31, 1, 2, 4, 8, 16, 31],
  '0': [14, 17, 19, 21, 25, 17, 14], '1': [4, 12, 4, 4, 4, 4, 14], '2': [14, 17, 1, 2, 4, 8, 31],
  '3': [31, 2, 4, 2, 1, 17, 14], '4': [2, 6, 10, 18, 31, 2, 2], '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [6, 8, 16, 30, 17, 17, 14], '7': [31, 1, 2, 4, 8, 8, 8], '8': [14, 17, 17, 14, 17, 17, 14],
  '9': [14, 17, 17, 15, 1, 2, 12],
  ' ': [0, 0, 0, 0, 0, 0, 0], '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8],
  '!': [4, 4, 4, 4, 4, 0, 4], '?': [14, 17, 1, 2, 4, 0, 4], ':': [0, 12, 12, 0, 12, 12, 0],
  ';': [0, 12, 12, 0, 12, 4, 8], "'": [4, 4, 8, 0, 0, 0, 0], '"': [10, 10, 10, 0, 0, 0, 0],
  '-': [0, 0, 0, 31, 0, 0, 0], '+': [0, 4, 4, 31, 4, 4, 0], '/': [1, 1, 2, 4, 8, 16, 16],
  '(': [2, 4, 8, 8, 8, 4, 2], ')': [8, 4, 2, 2, 2, 4, 8], '%': [24, 25, 2, 4, 8, 19, 3],
  '&': [12, 18, 20, 8, 21, 18, 13], '*': [0, 4, 21, 14, 21, 4, 0], '#': [10, 10, 31, 10, 31, 10, 10],
  '=': [0, 0, 31, 0, 31, 0, 0], '<': [2, 4, 8, 16, 8, 4, 2], '>': [8, 4, 2, 1, 2, 4, 8],
  '_': [0, 0, 0, 0, 0, 0, 31], '@': [14, 17, 1, 13, 21, 21, 14],
  '♥': [10, 31, 31, 31, 14, 4, 0], '←': [0, 4, 8, 31, 8, 4, 0], '→': [0, 4, 2, 31, 2, 4, 0],
  '↑': [4, 14, 21, 4, 4, 4, 4], '↓': [4, 4, 4, 4, 21, 14, 4], '★': [4, 4, 31, 14, 14, 10, 17],
  '•': [0, 0, 14, 14, 14, 0, 0],
};
const Font = (() => {
  const chars = Object.keys(GLYPHS);
  const index = {}; chars.forEach((ch, i) => index[ch] = i);
  const atlases = {};
  function atlas(color) {
    if (atlases[color]) return atlases[color];
    const [c, g] = makeCanvas(chars.length * 6, 7);
    g.fillStyle = color;
    chars.forEach((ch, i) => GLYPHS[ch].forEach((row, y) => { for (let x = 0; x < 5; x++) if (row & (16 >> x)) g.fillRect(i * 6 + x, y, 1, 1); }));
    return atlases[color] = c;
  }
  const width = (str, scale = 1) => str.length * 6 * scale - scale;
  // draw(ctx, 'TEXT', x, y, color, { align:'left|center|right', scale:1, shadow:'#000' })
  function draw(ctx, str, x, y, color = C.white, o = {}) {
    str = String(str).toUpperCase();
    const s = o.scale || 1;
    if (o.align === 'center') x -= width(str, s) / 2; else if (o.align === 'right') x -= width(str, s);
    x = Math.round(x); y = Math.round(y);
    if (o.shadow) draw(ctx, str, x + s, y + s, o.shadow, { scale: s });
    const a = atlas(color);
    for (let i = 0; i < str.length; i++) {
      const gi = index[str[i]];
      if (gi === undefined || str[i] === ' ') continue;
      ctx.drawImage(a, gi * 6, 0, 5, 7, x + i * 6 * s, y, 5 * s, 7 * s);
    }
  }
  // wrap('long text', maxCharsPerLine) → array of lines
  function wrap(str, max) {
    const out = []; let line = '';
    String(str).split(' ').forEach(w => { if (line && (line + ' ' + w).length > max) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); });
    if (line) out.push(line); return out;
  }
  // paragraph helper: draws wrapped lines, returns next y
  function para(ctx, str, x, y, max, color, o = {}) {
    wrap(str, max).forEach(l => { draw(ctx, l, x, y, color, o); y += 9 * (o.scale || 1); }); return y;
  }
  return { draw, width, wrap, para };
})();
