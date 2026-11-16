import { GAME_WIDTH, PLAYER_X, WIN_RUNOUT_SPEED, WIN_RUNOUT_PAD } from './config/gameConfig.js';

// Win run-out: the runner's x, elapsedMs after the run was won. The world has
// stopped scrolling, so the runner now crosses the screen instead.
export function runOutX(elapsedMs) {
  return PLAYER_X + WIN_RUNOUT_SPEED * (Math.max(0, elapsedMs) / 1000);
}

// True once the runner is fully past the right edge.
export function runOutDone(elapsedMs) {
  return runOutX(elapsedMs) >= GAME_WIDTH + WIN_RUNOUT_PAD;
}
