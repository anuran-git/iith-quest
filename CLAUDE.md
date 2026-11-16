# IITH Quest — project guide (for Claude models and humans)

8-bit platformer about campus life at IIT Hyderabad. Vanilla JS + Canvas 2D, no dependencies, no asset files
(art, font and music are generated in code). Ships as ONE file: `dist/index.html`. Version 1.1.0: 8 levels, each
with a boss mini-game, grades/CGPA, placement result, ending, share card, local Hall of Fame.

## Commands
- `node build.js` — inlines `src/styles.css` + `src/js/*.js` (filename order) into `src/index.html` → `dist/index.html`.
- `node tools/test.js` — headless Chrome: a god-mode bot must clear every level (`ALL LEVELS CLEARED`, page errors
  `none`) and screenshots land in `tools/shots/`. Run after every change. `node tools/debug.js <level> <from> <to>`
  traces the bot over a tile range.
- `node tools/test-scores.mjs` — unit test for the Hall of Fame function (in-memory store).
- `node tools/test-board.mjs` — browser test of the global board on a fake hosted origin, incl. offline fallback.
- `node tools/make-icons.js` — re-renders home-screen icons into `src/public/`.
- Never edit `dist/` by hand. `src/public/*` (manifest, icons) is copied into `dist/` by the build.

## Rules
- All JS files share one global scope (no modules); load order = filename order. `window.IITHQuest` exposes
  internals for tests.
- Internal resolution 320x180 (`W`,`H`), 16px tiles, 12 rows, ground row 10. Fixed 60 Hz tick; speeds are px/tick
  (`TUNE` in 00-config.js).
- Every screen must work with keyboard, touch pad (d-pad, A, B, START), gamepad, and direct taps (`Input.tapIn`).
- Text uses the 5x7 bitmap font (uppercase). Keep the palette and the red/white IITH building look.
- Fan-made: no official IITH logo, no real company or brand names.
- Each file starts with a header comment explaining its API and how to extend it. Read that first.

## Files (src/js)
| File | Holds | Typical change |
|---|---|---|
| `00-config.js` | constants, palette, `TUNE` physics, helpers | game feel |
| `01-font.js` | bitmap font, text drawing | new glyph |
| `02-audio.js` | `Sound.sfx`, `Sound.music`, `SONGS` | new tune / sfx |
| `03-sprites.js` | pixel art as text maps, palettes, outfits | new sprite |
| `04-world.js` | `THEMES`, parallax backgrounds, tiles, decorations | new theme |
| `05-input.js` | `Input` virtual keys, touch, gamepad, taps | controls |
| `06-levels.js` | **level builder + the 8 `LEVELS`** (builder cheat-sheet in header) | levels |
| `07-play.js` | physics, player, `ENEMY_DEFS`, pickups, HUD, `PlayScene` | enemies, mechanics |
| `08-minigames.js` | `QUESTIONS`, Catch/Quiz/Mash/Rhythm/Timing/Sequence games, `MINIGAMES`, `BossScene` | bosses, quiz content |
| `09-scenes.js` | title, character select, intro, result, ending, options, help, Hall of Fame, level select | menus, story text |
| `10-save.js` | `Save` (localStorage), `scoreRun` grading, `Leaderboard` adapter, `Share` card | scoring, scoreboard |
| `11-main.js` | boot, loop, `layout()`, name + share dialogs | shell |
`src/index.html` is the page shell (canvas, touch pad, dialogs); `src/styles.css` the console/phone layout.

## Global Hall of Fame
- Server: `netlify/functions/scores.mjs` (Netlify Function v2 at `/api/scores`, storage = Netlify Blobs store
  `hall-of-fame`, key `board`, top 100, best score per name, validation, 20 s per-IP cooldown). Logic lives in the
  exported `handle(req, store, ip)` so it can be tested without Netlify.
- Client: `RemoteBoard` / `Leaderboard` in `10-save.js`. Uses the API only on a hosted http(s) origin; otherwise
  (file://, claude.ai preview, offline) it falls back to `LocalBoard`. Failed submits are kept in localStorage
  and retried when the board is next opened. `BoardScene` highlights the player's own row.
- Scores are computed client-side, so they can be faked by a determined user. Stronger options if needed:
  server-side replay checks, or signed runs.

## Keyboard remapping
`05-input.js`: `ACTIONS`, `DEFAULT_KEYS`, `setBindings(keys, upAlsoJumps)`, `keyName(code)`, `captureNext(cb)`.
Bindings live in `Save.data.keys` (2 slots per action); Enter and Escape are fixed. Screen: `ControlsScene`
(Options → Keyboard controls). Help screen and the desktop hint line read the current bindings.

## Mobile
`styles.css` phone blocks keep the bottom ~96px right / ~70px left clear (Netlify badge, home bar). On touch
devices `layout()` scales without whole-pixel snapping so the game fills the screen. `11-main.js` requests
full screen on first touch and wires the ⛶ button; `src/public/manifest.webmanifest` gives full screen when
added to the home screen (iOS).

## Trial feature: GROW (may be removed)
Badam milk (`item('milk', …)`) makes the player 1.5x size; a hit while big shrinks instead of costing a heart.
To remove: delete every block commented `GROW` in `07-play.js`, the `milk` sprite in `03-sprites.js`, the
`grow`/`shrink` SFX in `02-audio.js`, all `.item('milk', x, h)` calls in `06-levels.js`, and the milk entry in the
help legend (`09-scenes.js`, restore 5 items at 60px spacing). Run the tests.

## Hosting
The global board needs a CLI (`npx netlify-cli deploy --build --prod`) or Git deploy; Netlify Drop does not run
functions. `netlify.toml` runs `node build.js` and publishes `dist`; functions are found in `netlify/functions`.
