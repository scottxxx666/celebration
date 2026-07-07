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
3. `GameScene` — main gameplay loop; owns physics, scrolling background, collision detection, score, and music (starts on create, stops in `endRun()`)
4. `GameOverScene` — displays final score; SPACE restarts `GameScene`, ESC returns to `MenuScene`

**Game objects** (`src/objects/`):
- `Player` — alternating left/right key taps accelerate the player; up/down arrows snap between 5 rows
- `ObstacleSpawner` — spawns the authored waves from `src/config/waves.js`, timed off the audio clock (`music.seek`) so obstacles arrive at the player on the beat; scroll speed is the player's actual speed, while spawn timing uses a separate `timingSpeed`
- `Enemy` — chases from the left; its speed ramps from `ENEMY_SPEED` to `ENEMY_CRUISE_SPEED` anchored to song time, pinning the player into a narrow speed band near max. Tracks the player's row instantly during the intro; once beat sync is on it steps onto the row only on beat crossings, so row-dodging buys up to one beat of separation

**Beat clock** (`src/Conductor.js`): minimal music clock (`BPM` + `FIRST_BEAT_OFFSET_MS` from config); polled each frame by `GameScene` for beat/half-beat crossings. The whole beat-sync layer — enemy row-stepping, the player's 8th-note squash pulse, and the walk-zone beat flash — switches on together at `BEAT_SYNC_START_MS` (song time, independent of the enemy speed ramp); before that the game behaves like the original intro.

**Speed/rhythm design** (`docs/speed-design.md`): once the enemy reaches cruise speed, obstacle spawn timing assumes the band average (`OBSTACLE_TIMING_SPEED`) instead of the instantaneous player speed, keeping on-beat arrival within ~±40ms. Before the ramp completes (sparse intro), timing uses the player's actual speed.

**Configuration** (`src/config/gameConfig.js`): single source of truth for canvas size, speed bounds, acceleration/deceleration rates, enemy ramp, and music constants (`BPM`, `FIRST_BEAT_OFFSET_MS` — TBD until the track is chosen). Tune gameplay here, not inline. Wave/beat maps live in `src/config/waves.js`.
