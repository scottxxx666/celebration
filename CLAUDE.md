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
1. `BootScene` — asset loading placeholder; transitions to `GameScene`
2. `GameScene` — main gameplay loop; owns physics, scrolling background, collision detection, and score
3. `GameOverScene` — displays final score and restarts to `GameScene`

**Game objects** (`src/objects/`):
- `Player` — alternating left/right key taps accelerate the player; up/down arrows control vertical position
- `ObstacleSpawner` — spawns random obstacles from the right on a timer; cleans up off-screen ones

**Configuration** (`src/config/gameConfig.js`): single source of truth for canvas size, speed bounds, acceleration/deceleration rates, and spawn intervals. Tune gameplay here, not inline.
