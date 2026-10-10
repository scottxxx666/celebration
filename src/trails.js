import { TRAIL_ALPHA, TRAIL_LIFE_MS, TRAIL_COLORS } from './config/gameConfig.js';

// Opacity of an afterimage `ageMs` after it was stamped: TRAIL_ALPHA, falling
// linearly to 0 at TRAIL_LIFE_MS.
export function trailAlpha(ageMs) {
  const left = Math.min(1, Math.max(0, 1 - ageMs / TRAIL_LIFE_MS));
  return TRAIL_ALPHA * left;
}

// Tint for the index-th stamp round, cycling through TRAIL_COLORS.
export function trailColor(index) {
  return TRAIL_COLORS[index % TRAIL_COLORS.length];
}
