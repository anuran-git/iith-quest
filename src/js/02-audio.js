// ─────────────────────────────────────────────────────────────────────────────
// 02-audio.js — chiptune audio with WebAudio. No audio files.
//   Sound.sfx('jump')        play a sound effect (see SFX table)
//   Sound.music('campus')    loop a song from SONGS (no-op if already playing)
//   Sound.stopMusic()
// Songs are strings of 8th-note steps: a note ("C5", "F#4", "Bb2"), "-" rest,
// "." hold previous note. Drums: k kick, s snare, h hat, x kick+snare.
// ─────────────────────────────────────────────────────────────────────────────
const SONGS = {
  campus: {
    bpm: 136, wave: 'square',
    lead: 'E5 G5 C6 G5 E5 G5 C6 - E5 A5 C6 A5 E5 A5 B5 - F5 A5 C6 A5 F5 A5 D6 C6 B5 G5 D5 G5 B5 D6 B5 - ' +
          'C6 . G5 E5 G5 . C6 D6 E6 . C6 A5 C6 . A5 G5 A5 . F5 A5 C6 . D6 C6 B5 D6 G6 D6 B5 G5 D5 -',
    bass: 'C3 - C3 G2 C3 - C3 G2 A2 - A2 E2 A2 - A2 E2 F2 - F2 C3 F2 - F2 C3 G2 - G2 D3 G2 - B2 D3',
    drums: 'k - h - s - h h',
  },
  night: {
    bpm: 112, wave: 'triangle',
    lead: 'A4 C5 E5 C5 A4 C5 E5 A5 A4 C5 F5 C5 A4 C5 F5 A5 G4 C5 E5 C5 G4 C5 E5 G5 G#4 B4 E5 B4 G#4 B4 E5 G#5 ' +
          'E5 . D5 C5 B4 . A4 - F5 . E5 D5 C5 . A4 - E5 . G5 E5 C5 . G4 - E5 . D5 B4 G#4 . E4 -',
    bass: 'A2 - E3 - A2 - E3 - F2 - C3 - F2 - C3 - C3 - G3 - C3 - G3 - E2 - B2 - E2 - B2 -',
    drums: 'k - - h s - - h',
  },
  fest: {
    bpm: 120, wave: 'square',
    lead: 'E5 E5 G5 E5 B5 A5 G5 E5 E5 E5 G5 E5 C6 B5 G5 E5 D5 D5 G5 D5 B5 A5 G5 D5 D5 F#5 A5 D6 A5 F#5 D5 - ' +
          'G5 . B5 . E6 . B5 G5 G5 . C6 . E6 . C6 G5 G5 . B5 . D6 . B5 G5 F#5 A5 D6 A5 F#5 A5 D6 -',
    bass: 'E2 E3 E2 E3 E2 E3 E2 E3 C2 C3 C2 C3 C2 C3 C2 C3 G2 G3 G2 G3 G2 G3 G2 G3 D2 D3 D2 D3 D2 D3 D2 D3',
    drums: 'k h x h k h x h',
  },
  boss: {
    bpm: 150, wave: 'square',
    lead: 'D5 F5 A5 F5 D5 F5 A5 D6 D5 F5 Bb5 F5 D5 F5 Bb5 D6 D5 G5 Bb5 G5 D5 G5 Bb5 D6 C#5 E5 A5 E5 C#5 E5 A5 C#6',
    bass: 'D2 D2 D3 D2 D2 D2 D3 D2 Bb1 Bb1 Bb2 Bb1 Bb1 Bb1 Bb2 Bb1 G1 G1 G2 G1 G1 G1 G2 G1 A1 A1 A2 A1 A1 A1 A2 A1',
    drums: 'k h s h k k s h',
  },
};
SONGS.title = Object.assign({}, SONGS.campus, { bpm: 108, wave: 'triangle', drums: 'k - - - s - - -' });
SONGS.hustle = Object.assign({}, SONGS.night, { bpm: 148, wave: 'square', drums: 'k h s h k h s h' });
SONGS.party = Object.assign({}, SONGS.campus, { bpm: 152, drums: 'k h x h k h x h' });

const Sound = (() => {
  let ac = null, master, mGain, sGain, noiseBuf = null;
  let cur = null, curName = '', step = 0, nextT = 0, timer = null;
  const opts = { music: true, sfx: true };

  function noteFreq(n) {
    const m = /^([A-G])([#b]?)(\d)$/.exec(n); if (!m) return 0;
    const semi = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 440 * Math.pow(2, (semi + (parseInt(m[3], 10) + 1) * 12 - 69) / 12);
  }
  function parseTrack(str) {  // → [{f, len} | null] per step
    const tok = str.trim().split(/\s+/), out = [];
    tok.forEach((t, i) => {
      if (t === '-' || t === '.') { out.push(null); return; }
      let len = 1; while (tok[i + len] === '.') len++;
      out.push({ f: noteFreq(t), len });
    });
    return out;
  }
  Object.values(SONGS).forEach(s => { s._lead = parseTrack(s.lead); s._bass = parseTrack(s.bass); s._drums = s.drums ? s.drums.trim().split(/\s+/) : []; });

  // Must be called from a user gesture (key/tap) at least once.
  function unlock() {
    try {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        ac = new AC();
        master = ac.createGain(); master.gain.value = 0.6; master.connect(ac.destination);
        mGain = ac.createGain(); mGain.connect(master);
        sGain = ac.createGain(); sGain.connect(master);
        noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.4, ac.sampleRate);
        const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        applyOpts();
      }
      if (ac.state === 'suspended') ac.resume();
    } catch (e) { ac = null; }
  }
  function applyOpts() { if (!ac) return; mGain.gain.value = opts.music ? 1 : 0; sGain.gain.value = opts.sfx ? 1 : 0; }
  function setOpts(o) { Object.assign(opts, o); applyOpts(); }

  function tone(f, t0, dur, type, vol, dest, slideTo) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.setValueAtTime(vol, t0 + dur * 0.6); g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(t0, dur, vol, dest, hp) {
    const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = noiseBuf;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    if (hp) { const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; s.connect(f); f.connect(g); } else s.connect(g);
    g.connect(dest); s.start(t0); s.stop(t0 + dur + 0.02);
  }

  // name → list of [freq, startOffsetSec, durSec, wave, slideTo] (or ['n', start, dur] for noise)
  const SFX = {
    jump: [[330, 0, .12, 'square', 660]],
    dash: [['n', 0, .1], [520, 0, .1, 'square', 260]],
    coin: [[988, 0, .06, 'square'], [1319, .06, .12, 'square']],
    big: [[784, 0, .07, 'square'], [988, .07, .07, 'square'], [1319, .14, .07, 'square'], [1568, .21, .16, 'square']],
    stomp: [[220, 0, .12, 'square', 70], ['n', 0, .08]],
    hurt: [[300, 0, .25, 'sawtooth', 80]],
    die: [[440, 0, .12, 'square'], [370, .12, .12, 'square'], [294, .24, .12, 'square'], [220, .36, .3, 'square', 110]],
    grow: [[392, 0, .06, 'square'], [523, .06, .06, 'square'], [392, .12, .06, 'square'], [659, .18, .06, 'square'], [523, .24, .06, 'square'], [784, .3, .14, 'square']],
    shrink: [[784, 0, .06, 'square'], [523, .07, .06, 'square'], [659, .14, .06, 'square'], [392, .21, .06, 'square'], [330, .28, .14, 'square']],
    woof: [[180, 0, .07, 'square', 120], [150, .09, .1, 'square', 90]],
    pet: [[659, 0, .07, 'triangle'], [880, .08, .07, 'triangle'], [1047, .16, .12, 'triangle']],
    bike: [[330, 0, .05, 'square'], [440, .05, .05, 'square'], [554, .1, .08, 'square']],
    heart: [[523, 0, .08, 'triangle'], [784, .08, .14, 'triangle']],
    power: [[523, 0, .07, 'square'], [659, .07, .07, 'square'], [784, .14, .07, 'square'], [1047, .21, .2, 'square']],
    clock: [[880, 0, .06, 'triangle'], [880, .1, .06, 'triangle'], [1175, .2, .14, 'triangle']],
    check: [[784, 0, .08, 'square'], [1047, .08, .08, 'square'], [1319, .16, .18, 'square']],
    spring: [[200, 0, .2, 'square', 900]],
    shoot: [[700, 0, .08, 'square', 350]],
    select: [[660, 0, .04, 'square']],
    confirm: [[660, 0, .06, 'square'], [990, .06, .1, 'square']],
    back: [[440, 0, .06, 'square'], [330, .06, .1, 'square']],
    good: [[1047, 0, .06, 'square'], [1319, .06, .1, 'square']],
    perfect: [[1319, 0, .05, 'square'], [1568, .05, .05, 'square'], [2093, .1, .12, 'square']],
    bad: [[160, 0, .2, 'sawtooth', 90]],
    tick: [[1200, 0, .03, 'square']],
    type: [[1500, 0, .02, 'square']],
    win: [[523, 0, .1, 'square'], [659, .1, .1, 'square'], [784, .2, .1, 'square'], [1047, .3, .1, 'square'], [784, .4, .1, 'square'], [1047, .5, .35, 'square']],
    lose: [[392, 0, .15, 'square'], [330, .15, .15, 'square'], [262, .3, .15, 'square'], [196, .45, .4, 'square']],
    boom: [['n', 0, .35], [120, 0, .3, 'triangle', 40]],
  };
  function sfx(name) {
    if (!ac || !opts.sfx) return;
    const def = SFX[name]; if (!def) return;
    const t = ac.currentTime + 0.005;
    try { def.forEach(p => p[0] === 'n' ? noise(t + p[1], p[2], 0.12, sGain) : tone(p[0], t + p[1], p[2], p[3], 0.09, sGain, p[4])); } catch (e) {}
  }

  function schedule() {
    if (!ac || !cur) return;
    const stepDur = 60 / cur.bpm / 2;
    if (nextT < ac.currentTime - 0.5) nextT = ac.currentTime + 0.05;   // recover after tab sleep
    while (nextT < ac.currentTime + 0.18) {
      const l = cur._lead[step % cur._lead.length], b = cur._bass[step % cur._bass.length];
      const d = cur._drums.length ? cur._drums[step % cur._drums.length] : '-';
      if (l) tone(l.f, nextT, stepDur * l.len * 0.92, cur.wave, 0.045, mGain);
      if (b) tone(b.f, nextT, stepDur * b.len * 0.9, 'triangle', 0.09, mGain);
      if (d === 'k' || d === 'x') tone(110, nextT, 0.09, 'triangle', 0.14, mGain, 45);
      if (d === 's' || d === 'x') noise(nextT, 0.09, 0.07, mGain, 1200);
      if (d === 'h') noise(nextT, 0.03, 0.035, mGain, 6000);
      nextT += stepDur; step++;
    }
  }
  function music(name) {
    if (curName === name) return;
    curName = name; cur = SONGS[name] || null; step = 0;
    if (ac) nextT = ac.currentTime + 0.08;
    if (!timer) timer = setInterval(() => { try { schedule(); } catch (e) {} }, 40);
  }
  function stopMusic() { cur = null; curName = ''; }

  return { unlock, sfx, music, stopMusic, setOpts, opts, get ready() { return !!ac; } };
})();
