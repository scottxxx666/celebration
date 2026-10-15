import { JITTER_KICKS_PER_BEAT, JITTER_PX, JITTER_DECAY_MS, JITTER_REROLL_MS } from './config/gameConfig.js';
import { rand } from './cameraDance.js';

const STILL = Object.freeze({ x: 0, y: 0 });

// Camera scroll offset at songMs for a `jitter` section: every 1/JITTER_KICKS_PER_BEAT beats from
// the section start a kick shakes the camera — a random offset of up to JITTER_PX per axis,
// re-rolled every JITTER_REROLL_MS and shrinking to nothing over JITTER_DECAY_MS. Stateless from
// song time; `runSeed` picks the shake, like dancePose (GameScene passes the same per-run seed).
// Returns { x, y } in scroll px; still outside the section.
export function jitterOffset(section, songMs, beatMs, runSeed = 0) {
  if (!section.jitter || songMs < section.startMs || songMs >= section.endMs) return STILL;
  const kickMs = beatMs / JITTER_KICKS_PER_BEAT;
  const elapsed = songMs - section.startMs;
  const sinceMs = elapsed - Math.floor(elapsed / kickMs) * kickMs;

  const amp = JITTER_PX * Math.max(0, 1 - sinceMs / JITTER_DECAY_MS);
  const roll = section.startMs + runSeed + Math.floor(elapsed / JITTER_REROLL_MS) * 2;
  return {
    x: (rand(roll + 0.25) * 2 - 1) * amp,
    y: (rand(roll + 1.25) * 2 - 1) * amp,
  };
}
