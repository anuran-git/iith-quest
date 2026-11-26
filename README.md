# IITH Quest: Survive the Semester

An 8-bit style platformer about campus life at IIT Hyderabad. Pick a student,
run through eight levels (orientation, classes, assignments, Elan & nVision,
the jury, end-sems, placements, convocation), beat each boss mini-game, and
graduate with a CGPA, a placement offer and a report card you can share.

Student-made. Not an official IIT Hyderabad product.

## Play

Open `dist/index.html` in any modern browser, or host it (below).

| | Keyboard | Touch / gamepad |
|---|---|---|
| Move | ← → or A D | D-pad |
| *Rebind keys* | Options → Keyboard controls | |
| Jump | Space, Z or ↑ | A |
| Dash | X or Shift | B |
| Pause | P or Esc | Start |
| Menus | Arrows + Enter | Tap, or D-pad + A |

Progress, options and the Hall of Fame are saved in the browser on each device.

## Host it on Netlify

The **Hall of Fame is global** (shared by everyone who plays your link). That part runs as a
Netlify Function, and **functions do not work with drag-and-drop (Netlify Drop) deploys**, so use
the CLI or GitHub. Drag-and-drop still works for the game itself; the board then just shows
scores saved on each player's own device.

**Option A: Netlify CLI (no GitHub needed).** Needs Node.js 18+.
```
cd iith-quest
npm install
npx netlify-cli login
npx netlify-cli deploy --build --prod
```
First time it asks to create a new site or link an existing one (pick your current site to keep
its URL). Run the last command again whenever you change something.

**Option B: GitHub.** Push this folder to a GitHub repo, then in Netlify choose
*Add new site → Import an existing project*. `netlify.toml` builds the game and Netlify picks up
`netlify/functions/scores.mjs` automatically. Every push redeploys.

Scores are stored in Netlify Blobs (included with Netlify, nothing to set up). To delete a bad
entry: Netlify dashboard → your site → Blobs → `hall-of-fame` → `board`.

## Phones

The game fills the screen and asks for full screen on the first tap (Android/Chrome; the ⛶ button
toggles it). iPhone Safari has no page full screen: use Share → *Add to Home Screen*, then open it
from the home screen. The A/B buttons sit higher up, clear of floating badges at the bottom corners.

## Change it

Source is in `src/`; `node build.js` rebuilds `dist/index.html`. No dependencies.
See **CLAUDE.md** for the architecture, how to add levels, enemies and
mini-games, and the plan for a global scoreboard. `node tools/test.js` bot-plays
every level and takes screenshots (needs Playwright + Chrome).

## Hall of Fame admin
Players enter a 7-digit roll number (one device per number). To rename players, delete bad scores or free a roll number:
1. Netlify → Site configuration → Environment variables → add `ADMIN_KEY` (any secret, 8+ characters) → redeploy.
2. Open `https://<your-site>/admin.html` and enter that key.
