import { ZOOM_PUSH_IN_FRACTION } from './config/gameConfig.js';

// Zoom multiplier at songMs for a `zoomPush: { every, amount }` section (a zoom pump). Beats count
// from the section start in cycles of `every`; p is the position within a cycle, 0..1. In the last
// ZOOM_PUSH_IN_FRACTION of the cycle (p >= 1 - IN) the zoom rises from 1 to 1 + amount with an
// ease-in quad, peaking exactly on the cycle boundary (the beat); in the rest it falls back with an
// ease-out quad, 1 + amount * (1 - t)^2 with t = p / (1 - IN). Cycle 0's out-phase stays at 1 (no
// peak came before the section start, so nothing jumps on entry). The last in-phase ends at the
// section end, where the zoom snaps back to 1. Stateless from song time; 1 outside the section.
export function pushZoom(section, songMs, beatMs) {
  const push = section.zoomPush;
  if (!push || songMs < section.startMs || songMs >= section.endMs) return 1;
  const { every, amount } = push;
  const cycles = (songMs - section.startMs) / beatMs / every;
  const cycle = Math.floor(cycles);
  const p = cycles - cycle;
  const outEnd = 1 - ZOOM_PUSH_IN_FRACTION;
  if (p >= outEnd) {
    const t = (p - outEnd) / ZOOM_PUSH_IN_FRACTION;
    return 1 + amount * t * t;
  }
  if (cycle < 1) return 1;
  const left = 1 - p / outEnd;
  return 1 + amount * left * left;
}
