// ─────────────────────────────────────────────────────────────────────────────
// 05-input.js — keyboard, touch buttons, gamepad and canvas taps, all mapped to
// virtual keys:  left right up down | a b | jump | start pause back
//   Input.down.x     held now          Input.pressed.x   went down this tick
//   Input.released.x went up this tick Input.tap         {x,y} canvas tap (game px)
// Scenes read these; Input.endTick() clears the one-tick flags.
// ─────────────────────────────────────────────────────────────────────────────
const Input = (() => {
  const down = {}, pressed = {}, released = {};
  const api = { down, pressed, released, tap: null, usedTouch: false };
  // ── Rebindable keyboard controls ──
  // Each action has two key slots (KeyboardEvent.code). Saved in Save.data.keys.
  // Enter (confirm/start) and Escape (back/pause) are fixed so menus always work.
  const ACTIONS = [
    { id: 'left', label: 'LEFT', virt: ['left'] }, { id: 'right', label: 'RIGHT', virt: ['right'] },
    { id: 'up', label: 'UP', virt: ['up'] }, { id: 'down', label: 'DOWN', virt: ['down'] },
    { id: 'jump', label: 'JUMP', virt: ['a', 'jump'] }, { id: 'dash', label: 'DASH', virt: ['b'] },
    { id: 'pause', label: 'PAUSE', virt: ['pause'] },
  ];
  const DEFAULT_KEYS = { left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
    jump: ['Space', 'KeyZ'], dash: ['KeyX', 'ShiftLeft'], pause: ['KeyP', null] };
  const FIXED = { Enter: ['start'], NumpadEnter: ['start'], Escape: ['pause', 'back'] };
  let KEYMAP = {}, bindings = null, upJumps = true, capture = null;
  function setBindings(keys, upAlsoJumps = true) {
    bindings = {}; for (const a of ACTIONS) bindings[a.id] = ((keys && keys[a.id]) || DEFAULT_KEYS[a.id]).slice(0, 2);
    upJumps = upAlsoJumps; KEYMAP = {};
    for (const a of ACTIONS) for (const code of bindings[a.id]) if (code) {
      const v = a.id === 'up' && upJumps ? ['up', 'jump'] : a.virt;
      KEYMAP[code] = (KEYMAP[code] || []).concat(v);
    }
    Object.assign(KEYMAP, FIXED);
    Object.keys(down).forEach(k => set(k, false));
  }
  // Human-readable key name for the 5x7 font
  function keyName(code) {
    if (!code) return '-';
    const named = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'SPACE', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT',
      ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL', AltLeft: 'L-ALT', AltRight: 'R-ALT', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
      Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Tab: 'TAB', CapsLock: 'CAPS', Backspace: 'BKSP', MetaLeft: 'L-CMD', MetaRight: 'R-CMD' };
    if (named[code]) return named[code];
    return code.replace(/^Key|^Digit/, '').replace(/^Numpad/, 'NUM').toUpperCase().slice(0, 7);
  }
  // Next key press goes to cb(code) instead of the game (Escape → cb(null) = cancel)
  function captureNext(cb) { setTimeout(() => { capture = cb; }, 0); }
  const TOUCHMAP = { left: ['left'], right: ['right'], up: ['up'], down: ['down'], a: ['a', 'jump'], b: ['b'], start: ['start', 'pause'] };

  function set(k, v) {
    if (v) { if (!down[k]) pressed[k] = true; down[k] = true; }
    else { if (down[k]) released[k] = true; down[k] = false; }
  }
  const setAll = (keys, v) => keys && keys.forEach(k => set(k, v));

  function init(canvas) {
    window.addEventListener('keydown', e => {
      if (e.target && e.target.tagName === 'INPUT') return;
      if (capture) { e.preventDefault(); const cb = capture; capture = null; cb(e.code === 'Escape' ? null : e.code); return; }
      const m = KEYMAP[e.code]; if (!m) return;
      e.preventDefault(); Sound.unlock(); if (!e.repeat) setAll(m, true);
    });
    window.addEventListener('keyup', e => { const m = KEYMAP[e.code]; if (m) setAll(m, false); });
    window.addEventListener('blur', () => Object.keys(down).forEach(k => set(k, false)));

    // Touch pad: recompute held buttons from all active touches (lets thumbs slide between buttons)
    let held = new Set();
    function scan(e) {
      const now = new Set();
      for (const t of e.touches) {
        const el = document.elementFromPoint(t.clientX, t.clientY);
        const btn = el && el.closest && el.closest('[data-key]');
        if (btn) now.add(btn.dataset.key);
      }
      held.forEach(k => { if (!now.has(k)) { setAll(TOUCHMAP[k], false); mark(k, false); } });
      now.forEach(k => { if (!held.has(k)) { setAll(TOUCHMAP[k], true); mark(k, true); } });
      held = now;
    }
    function mark(k, on) { const el = document.querySelector('[data-key="' + k + '"]'); if (el) el.classList.toggle('on', on); }
    const pad = document.getElementById('pad');
    ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(ev => document.addEventListener(ev, e => {
      if (e.target && e.target.tagName === 'INPUT') return;
      api.usedTouch = true; document.body.classList.add('touch'); Sound.unlock();
      scan(e);
      if (e.target && (pad.contains(e.target) || e.target === canvas)) e.preventDefault();
    }, { passive: false }));
    // Mouse on the pad buttons (desktop testing)
    pad.addEventListener('mousedown', e => { const b = e.target.closest('[data-key]'); if (b) { Sound.unlock(); setAll(TOUCHMAP[b.dataset.key], true); const up = () => { setAll(TOUCHMAP[b.dataset.key], false); window.removeEventListener('mouseup', up); }; window.addEventListener('mouseup', up); } });

    window.addEventListener('pointerup', () => Sound.unlock());
    // Canvas taps / clicks → game coordinates
    canvas.addEventListener('pointerdown', e => {
      Sound.unlock();
      const r = canvas.getBoundingClientRect();
      api.tap = { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
    });
  }

  // Gamepad (standard mapping): d-pad / left stick, A = jump, B/X = dash, Start = pause
  const gp = {};
  function gset(name, keys, v) { if (!!gp[name] !== v) { gp[name] = v; setAll(keys, v); } }
  function pollGamepad() {
    if (!navigator.getGamepads) return;
    let p = null; try { for (const g of navigator.getGamepads()) if (g && g.connected) { p = g; break; } } catch (e) { return; }
    if (!p) return;
    const b = i => !!(p.buttons[i] && p.buttons[i].pressed), ax = i => p.axes[i] || 0;
    gset('l', ['left'], b(14) || ax(0) < -0.45); gset('r', ['right'], b(15) || ax(0) > 0.45);
    gset('u', ['up'], b(12) || ax(1) < -0.45); gset('d', ['down'], b(13) || ax(1) > 0.45);
    gset('a', ['a', 'jump'], b(0)); gset('b', ['b'], b(1) || b(2)); gset('s', ['start', 'pause'], b(9));
  }
  function endTick() { for (const k in pressed) pressed[k] = false; for (const k in released) released[k] = false; api.tap = null; }
  // true if the tap landed inside the rectangle (game px)
  function tapIn(x, y, w, h) { const t = api.tap; return !!t && t.x >= x && t.x < x + w && t.y >= y && t.y < y + h; }
  const confirm = () => pressed.a || pressed.start;
  const cancel = () => pressed.b || pressed.back;
  setBindings(null);
  Object.defineProperties(api, { bindings: { get: () => bindings }, upJumps: { get: () => upJumps }, capturing: { get: () => !!capture } });
  return Object.assign(api, { init, pollGamepad, endTick, tapIn, confirm, cancel, set, setBindings, keyName, captureNext, ACTIONS, DEFAULT_KEYS });
})();
