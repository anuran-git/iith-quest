// ─────────────────────────────────────────────────────────────────────────────
// 00-config.js — constants, palette, tuning values, tiny helpers.
// Everything here is plain data: safe to tweak without touching game logic.
// ─────────────────────────────────────────────────────────────────────────────
const VERSION = '1.0.0';
const W = 320, H = 180;          // internal resolution (scaled up by CSS, pixelated)
const T = 16;                    // tile size in px
const ROWS = 12;                 // level height in tiles (192px; camera shows the lower 180)
const GROUND_ROW = 10;           // default row of the ground surface
const SAVE_KEY = 'iith-quest-save-v1';
const BOARD_KEY = 'iith-quest-board-v1';

// Tile ids used in level grids
const TILE = { EMPTY: 0, GROUND: 1, BLOCK: 2, ONEWAY: 3, HAZARD: 4 };

// Player feel. All speeds are px per 60Hz tick.
const TUNE = {
  run: 2.0, accel: 0.28, jump: 5.7, gravUp: 0.3, gravDown: 0.45, maxFall: 6,
  coyote: 7, jumpBuffer: 7, dashSpeed: 4.2, dashTime: 9, dashCooldown: 42,
  hearts: 3, invuln: 90, powerTime: 8 * 60,
};

// Core palette (IITH-inspired: brick red + cream bands, teal sky, paved grey)
const C = {
  ink: '#1a1423', white: '#f4efe6', cream: '#efe6d8', red: '#b3262e', redDark: '#7d1a25',
  maroon: '#8e2c4a', gold: '#f2c14e', orange: '#e8833a', teal: '#3aa6a6', sky: '#4fb3bf',
  green: '#4f9d4a', greenDark: '#2f6b3a', grey: '#8a8f98', greyDark: '#565b66',
  blue: '#3b5d8f', night: '#151a33', pink: '#e05a8a', purple: '#6b4a9c', black: '#0b0a12',
};

// Letter grades (IITH-style 10-point scale). `min` is the level percentage needed.
const GRADES = [
  { g: 'A+', p: 10, min: 90 }, { g: 'A', p: 10, min: 80 }, { g: 'A-', p: 9, min: 70 },
  { g: 'B', p: 8, min: 60 }, { g: 'B-', p: 7, min: 50 }, { g: 'C', p: 6, min: 40 },
  { g: 'C-', p: 5, min: 30 }, { g: 'D', p: 4, min: 0 },
];
function gradeFor(pct) { return GRADES.find(g => pct >= g.min) || GRADES[GRADES.length - 1]; }

// Placement outcome from final CGPA (fictional companies only)
const OFFERS = [
  { min: 9.2, title: 'SUPER DREAM OFFER', co: 'NEBULA LABS', line: 'THE RECRUITER CLAPPED. TWICE.' },
  { min: 8.2, title: 'DREAM OFFER', co: 'PIXELFORGE STUDIOS', line: 'DAY ONE PLACEMENT. LEGEND.' },
  { min: 7.2, title: 'CORE OFFER', co: 'DECCAN DYNAMICS', line: 'SOLID. THE FAMILY GROUP IS PROUD.' },
  { min: 6.0, title: 'STARTUP OFFER', co: 'CHAI & CODE CO.', line: 'EQUITY, SNACKS AND BIG DREAMS.' },
  { min: 0, title: 'OFF-CAMPUS HUSTLE', co: 'YOUR OWN PATH', line: 'THE STORY IS JUST STARTING.' },
];
function offerFor(cgpa) { return OFFERS.find(o => cgpa >= o.min); }

// Helpers
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function seeded(seed) { let s = seed >>> 0; return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }
function fmtTime(frames) { const s = Math.max(0, Math.ceil(frames / 60)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
