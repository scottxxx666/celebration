import { GHOST_OFFSET_X, GHOST_OFFSET_Y, GHOST_ZOOM_STEP, GHOST_FADE_MS } from './config/gameConfig.js';

// Ghost `index` of `count`: spread evenly around an ellipse, orbiting it once as
// `phase` runs 0..1. `zoom` is the extra zoom fraction (caller applies 1 + zoom).
export function ghostOffset(index, count, phase) {
  const angle = Math.PI * 2 * (phase + index / count);
  return {
    x: Math.cos(angle) * GHOST_OFFSET_X,
    y: Math.sin(angle) * GHOST_OFFSET_Y,
    zoom: GHOST_ZOOM_STEP * (index + 1),
  };
}

// 0..1 strength of the ghost effect: ramps in after the section start and out
// before its end, whichever is smaller; 0 outside ghost sections.
export function ghostFade(section, songMs) {
  if (!section.ghost) return 0;
  const ramp = Math.min(songMs - section.startMs, section.endMs - songMs) / GHOST_FADE_MS;
  return Math.min(1, Math.max(0, ramp));
}
