// ─────────────────────────────────────────────────────────────────────────────
// 11-main.js — boot, fixed 60Hz loop, scene switching, screen layout and the
// two DOM dialogs (name entry, share card).
// ─────────────────────────────────────────────────────────────────────────────
const Game = (() => {
  const STEP = 1000 / 60;
  let canvas, ctx, scene = null, next = null, fade = 1, fadeDir = -1, modal = false, last = 0, acc = 0, auto = true;
  const $ = id => document.getElementById(id);

  function go(s) { next = s; fadeDir = 1; }
  function tick() {
    if (modal) { Input.endTick(); return; }
    if (fadeDir === 1) { fade += 0.125; if (fade >= 1) { fade = 1; scene = next; next = null; fadeDir = -1; } }
    else { if (fadeDir === -1) { fade -= 0.125; if (fade <= 0) { fade = 0; fadeDir = 0; } } if (scene) scene.update(); }
    Input.endTick();
  }
  function render() {
    if (scene) scene.draw(ctx);
    if (fade > 0) { ctx.fillStyle = 'rgba(11,10,18,' + (Math.ceil(fade * 4) / 4) + ')'; ctx.fillRect(0, 0, W, H); }
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (!auto) return;
    acc += Math.min(100, now - last); last = now;
    Input.pollGamepad();
    let n = 0; while (acc >= STEP && n < 5) { tick(); acc -= STEP; n++; }
    if (n) render();
  }

  // Fit the 320x180 canvas to the window at a whole number of device pixels.
  function layout() {
    const touch = document.body.classList.contains('touch'), vw = window.innerWidth, vh = window.innerHeight, portrait = vh > vw;
    let aw = vw - 40, ah = vh - 76;
    if (touch) { if (portrait) { aw = vw - 12; ah = vh * 0.48; } else { aw = vw; ah = vh; } }
    const dpr = window.devicePixelRatio || 1;
    let s = Math.max(0.5, Math.min(aw / W, ah / H));
    if (!touch && s * dpr >= 1) s = Math.floor(s * dpr) / dpr;   // phones: use every pixel (full screen) instead of whole-pixel snapping
    canvas.style.width = Math.round(W * s) + 'px'; canvas.style.height = Math.round(H * s) + 'px';
  }

  // ── DOM dialogs ──
  // Roll-number dialog. cb(roll) is called only once the number is valid and (when online) free.
  function askName(cur, cb, onCancel) {
    const box = $('nameBox'), inp = $('nameInput'), err = $('nameErr'), ok = $('nameOk');
    let busy = false;
    const close = () => { box.classList.remove('open'); modal = false; inp.blur(); };
    const done = async () => {
      if (busy) return;
      const v = inp.value.replace(/\D/g, '');
      if (!/^\d{7}$/.test(v)) { err.textContent = 'Enter exactly 7 digits.'; return; }
      busy = true; ok.textContent = '...'; err.textContent = '';
      const r = v === cur ? 'ok' : await Leaderboard.claim(v);
      busy = false; ok.textContent = 'OK';
      if (r === 'taken') { err.textContent = 'Roll number ' + v + ' is already taken. Pick yours, or ask the admin.'; return; }
      if (r === 'bad') { err.textContent = 'Enter exactly 7 digits.'; return; }
      close(); cb(v);
    };
    inp.value = cur || ''; err.textContent = ''; ok.textContent = 'OK'; box.classList.add('open'); modal = true;
    inp.oninput = () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 7); err.textContent = ''; };
    ok.onclick = done; inp.onkeydown = e => { if (e.key === 'Enter') done(); if (e.key === 'Escape') { close(); if (onCancel) onCancel(); } };
    $('nameCancel').onclick = () => { close(); if (onCancel) onCancel(); };
    try { inp.focus(); } catch (e) {}
  }
  function showShare(cnv, text) {
    const box = $('shareBox'), img = $('shareImg'), msg = $('shareMsg');
    let url = ''; try { url = cnv.toDataURL('image/png'); } catch (e) {}
    img.src = url; msg.textContent = 'Long-press or right-click the card to save it.';
    box.classList.add('open'); modal = true;
    // Inside an embedded preview frame, downloads and the share sheet are blocked: offer only what works there.
    const framed = window.self !== window.top;
    $('shareBtn').style.display = navigator.share && !framed ? '' : 'none'; $('saveBtn').style.display = framed ? 'none' : '';
    $('shareBtn').onclick = () => {
      cnv.toBlob(async blob => {
        try {
          const file = new File([blob], 'iith-quest-report-card.png', { type: 'image/png' });
          const page = /^https?:$/.test(location.protocol) ? location.href : undefined;
          if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], text, url: page });
          else await navigator.share({ text, url: page });
        } catch (e) { msg.textContent = 'Sharing is not available here. Save the image instead.'; }
      });
    };
    $('saveBtn').onclick = () => {
      try { const a = document.createElement('a'); a.href = url; a.download = 'iith-quest-report-card.png'; document.body.appendChild(a); a.click(); a.remove(); }
      catch (e) { msg.textContent = 'Could not download here. Long-press the image to save it.'; }
    };
    $('copyBtn').onclick = () => {
      const p = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(text) : Promise.reject();
      p.then(() => { msg.textContent = 'Caption copied!'; }).catch(() => { msg.textContent = text; });
    };
    $('shareClose').onclick = () => { box.classList.remove('open'); modal = false; };
  }

  // Desktop hint line under the screen, built from the current key bindings
  // ── Touch layout editor: drag the stick / A-B group; offsets saved per orientation ──
  const orient = () => innerWidth > innerHeight ? 'landscape' : 'portrait';
  function applyTouchPos() {
    const tp = (Save.data.opts.touchPos || {})[orient()] || {};
    for (const [id, k] of [['dpad', 'st'], ['ab', 'ab']]) { const v = tp[k] || [0, 0]; $(id).style.translate = v[0] + 'px ' + v[1] + 'px'; }
  }
  let editDone = null;
  function editTouch(onDone) {
    editDone = onDone; document.body.classList.add('touchedit');
    if (!Save.data.opts.touchPos) Save.data.opts.touchPos = {};
  }
  function setupEditor() {
    let drag = null;
    const start = (el, k, x, y) => { const o = orient(), tp = Save.data.opts.touchPos; tp[o] = tp[o] || {}; const v = tp[o][k] || [0, 0]; drag = { el, k, o, x, y, v0: v.slice(), r: el.getBoundingClientRect() }; };
    const move = (x, y) => {
      if (!drag) return; const d = drag, m = 6;
      const dx = clamp(x - d.x, m - d.r.left, innerWidth - m - d.r.right), dy = clamp(y - d.y, m - d.r.top, innerHeight - m - d.r.bottom);
      const v = [Math.round(d.v0[0] + dx), Math.round(d.v0[1] + dy)]; Save.data.opts.touchPos[d.o][d.k] = v; d.el.style.translate = v[0] + 'px ' + v[1] + 'px';
    };
    for (const [id, k] of [['dpad', 'st'], ['ab', 'ab']]) {
      const el = $(id);
      el.addEventListener('touchstart', e => { if (!document.body.classList.contains('touchedit')) return; e.preventDefault(); const t = e.changedTouches[0]; start(el, k, t.clientX, t.clientY); }, { passive: false });
      el.addEventListener('mousedown', e => { if (document.body.classList.contains('touchedit')) start(el, k, e.clientX, e.clientY); });
    }
    document.addEventListener('touchmove', e => { if (drag) { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: false });
    window.addEventListener('mousemove', e => move(e.clientX, e.clientY));
    const end = () => { if (drag) { drag = null; Save.store(); } };
    document.addEventListener('touchend', end); window.addEventListener('mouseup', end);
    const done = e => { e.preventDefault(); document.body.classList.remove('touchedit'); Save.store(); Sound.sfx('confirm'); const cb = editDone; editDone = null; if (cb) cb(); };
    const reset = e => { e.preventDefault(); const tp = Save.data.opts.touchPos || {}; delete tp[orient()]; applyTouchPos(); Save.store(); Sound.sfx('back'); };
    $('editDone').addEventListener('click', done); $('editReset').addEventListener('click', reset);
  }

  function updateHint() {
    const el = $('hint'); if (!el || !Input.bindings) return;
    const k = Input.bindings, n = Input.keyName, two = a => k[a][1] ? n(k[a][0]) + ' / ' + n(k[a][1]) : n(k[a][0]);
    el.textContent = n(k.left[0]) + ' ' + n(k.right[0]) + ' move · ' + two('jump') + ' jump · ' + two('dash') + ' dash · ' + two('pause') + ' pause · Options › Keyboard controls to change';
  }
  // Full screen on phones: requested on the first touch (Android/Chrome) and via the ⛶ button.
  // iPhone Safari has no page full screen; there, "Add to Home Screen" opens the game full screen (manifest).
  const fsEl = document.documentElement;
  const canFs = !!(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen) && window.self === window.top;
  const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  function enterFs() {
    if (!canFs || isFs()) return;
    try { const p = (fsEl.requestFullscreen || fsEl.webkitRequestFullscreen).call(fsEl, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  }
  function toggleFs() { if (isFs()) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) {} } else enterFs(); }
  function init() {
    canvas = $('game'); ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
    Save.load(); Input.init(canvas); setupEditor(); updateHint(); layout(); applyTouchPos();
    window.addEventListener('resize', () => { layout(); applyTouchPos(); }); window.addEventListener('orientationchange', () => setTimeout(layout, 200));
    document.addEventListener('touchstart', () => setTimeout(layout, 0), { once: true });
    document.body.classList.toggle('can-fs', canFs);
    document.addEventListener('touchend', e => { if (e.target.id !== 'fsBtn' && !e.target.closest('.modal')) enterFs(); }, { once: true });
    $('fsBtn').addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); toggleFs(); });
    $('fsBtn').addEventListener('click', toggleFs);
    const onFs = () => { document.body.classList.toggle('is-fs', isFs()); setTimeout(layout, 120); };
    document.addEventListener('fullscreenchange', onFs); document.addEventListener('webkitfullscreenchange', onFs);
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('contextmenu', e => { if (e.target === canvas) e.preventDefault(); });
    scene = TitleScene();
    last = performance.now(); requestAnimationFrame(frame);
  }

  // Debug / test handle (used by tools/test.js). Harmless in production.
  const api = { go, updateHint, applyTouchPos, editTouch, get editingTouch() { return document.body.classList.contains('touchedit'); }, askName, showShare, tick, render, layout, get scene() { return scene; }, set auto(v) { auto = v; }, init };
  window.IITHQuest = { Game: api, Save, Input, Sound, Leaderboard, LEVELS, buildLevel, PlayScene, BossScene, ResultScene, EndingScene, TitleScene, ControlsScene, scoreRun, MINIGAMES, TUNE, moveBody, tileAt, IntroScene, CharScene, LevelSelectScene, OptionsScene, HelpScene, BoardScene, Share, reportData };
  return api;
})();

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', Game.init); else Game.init();
