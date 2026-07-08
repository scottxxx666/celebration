# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev       # start dev server (http://localhost:5173)
yarn build     # production build to dist/
yarn preview   # preview production build locally
```

No test runner is configured.

## Architecture

**Stack:** Phaser 3 + Vite 6, vanilla JavaScript (ES modules).

**Scene lifecycle** (`src/main.js` bootstraps in order):
1. `BootScene` — asset loading; transitions to `MenuScene`
2. `MenuScene` — title menu with Start / How to Play; the confirming gesture unlocks the browser audio context before gameplay starts (keeps music in sync)
3. `GameScene` — main gameplay loop; owns physics, scrolling background, collision detection, score, and music (starts on create, plays once — no loop). **Song = level**: the track's COMPLETE event ends the run as a win; death or win goes through `endRun(won)`, which passes `{ won, score, progress }` to `GameOverScene`
4. `GameOverScene` — shows CLEAR! (win) or GAME OVER plus song progress % and survived seconds; SPACE restarts `GameScene`, ESC returns to `MenuScene`

**Game objects** (`src/objects/`):
- `Player` — alternating left/right key taps accelerate the player; up/down arrows snap between 5 rows
- `ObstacleSpawner` — spawns the authored waves from `src/config/waves.js`, timed off song time (passed in from the Conductor) so obstacles arrive at the player on the beat; scroll speed is the player's actual speed, while spawn timing uses a separate `timingSpeed`
- `Enemy` — chases from the left; its speed ramps from `ENEMY_SPEED` to `ENEMY_CRUISE_SPEED` anchored to song time, pinning the player into a narrow speed band near max. Tracks the player's row instantly during the intro; once beat sync is on it steps onto the row only on beat crossings, so row-dodging buys up to one beat of separation

**Fake-3D depth** (`src/rowLayout.js`): shared `rowLayout(row)` → `{y, scale, depth}` — the only
place row→y math lives; back rows render smaller (`ROW_SCALE_BACK`→`ROW_SCALE_FRONT`, per
`docs/art-brief.md`) and behind front rows (`setDepth(row)`; drop shadows at row − 0.5, background
layers below that). Scaling is visual only — collision boxes never scale.

**Beat clock** (`src/Conductor.js`): minimal music clock (`BPM` + `FIRST_BEAT_OFFSET_MS` from config); polled each frame by `GameScene` for beat/half-beat crossings, and the single read point for song time (`conductor.songMs`) — score, the beat-sync gate, the enemy ramp, and obstacle spawning all run on it; nothing else reads `music.seek`. The whole beat-sync layer — enemy row-stepping, the player's 8th-note squash pulse, and the walk-zone beat flash — switches on together at `BEAT_SYNC_START_MS` (song time, independent of the enemy speed ramp); before that the game behaves like the original intro.

**Speed/rhythm design** (`docs/speed-design.md`): once the enemy reaches cruise speed, obstacle spawn timing assumes the band average (`OBSTACLE_TIMING_SPEED`) instead of the instantaneous player speed, keeping on-beat arrival within ~±40ms. Before the ramp completes (sparse intro), timing uses the player's actual speed.

**Configuration** (`src/config/gameConfig.js`): single source of truth for canvas size, speed bounds, acceleration/deceleration rates, enemy ramp, and music constants (`BPM`, `FIRST_BEAT_OFFSET_MS` — TBD until the track is chosen). Tune gameplay here, not inline. Wave/beat maps live in `src/config/waves.js`.

**Song sections** (`src/config/sections.js`): authored, song-time-anchored spans (like `waves.js`) that layer effects on top of normal play; `sectionAt(songMs)` returns the containing section or a normal default. `speedMult` is a global world multiplier `GameScene` applies to background scroll, obstacle scroll/spawn timing, and enemy motion (not `Player.speed` — taps feel the same, only the world moves faster); `disco` swaps the beat-flash overlay to a cycling saturated palette and shows `DiscoLights` top-down beam cones that jump to a random position/slant/hue on every beat; `rotate` continuously spins the main camera counterclockwise (`ROTATE_BEATS_PER_TURN` beats per revolution, zoomed to `ROTATE_ZOOM` so the whole field stays visible) anchored to the section start, purely visual. Times are placeholders (track TBD), same as `BPM`; each effect is gated on section song-time, never on another system's runtime state (enemy ramp, beat-sync gate stay independent).
