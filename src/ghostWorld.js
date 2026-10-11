import {
  GHOST_OFFSET_X, GHOST_OFFSET_Y, GHOST_ZOOM_STEP, GHOST_FADE_MS, GHOST_ON_BEATS, GHOST_OFF_BEATS,
} from './config/gameConfig.js';

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

// 0..1 strength of the ghost effect: it pulses from the section start — ghosted for
// GHOST_ON_BEATS beats, then clear for GHOST_OFF_BEATS — ramping in after each pulse's
// start and out before its end (or the section's end, if that cuts the pulse short);
// 0 outside ghost sections.
export function ghostFade(section, songMs, beatMs) {
  if (!section.ghost || songMs < section.startMs) return 0;
  const onMs = GHOST_ON_BEATS * beatMs;
  const pulseMs = (songMs - section.startMs) % (onMs + GHOST_OFF_BEATS * beatMs);
  const ramp = Math.min(pulseMs, onMs - pulseMs, section.endMs - songMs) / GHOST_FADE_MS;
  return Math.min(1, Math.max(0, ramp));
}
