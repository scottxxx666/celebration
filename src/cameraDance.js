import {
  DANCE_STEPS_PER_BEAT, DANCE_TILT_MIN_DEG, DANCE_TILT_MAX_DEG, DANCE_SNAP_MS,
  DANCE_SHAKE_PX, DANCE_SHAKE_DECAY_MS, DANCE_SHAKE_JITTER_MS,
} from './config/gameConfig.js';

const STILL = Object.freeze({ rotation: 0, x: 0, y: 0 });

// Deterministic 0..1 pseudo-random from a number: the dance looks random but is
// stateless from song time, so ?t= seeks and restarts land on the same moves.
function rand(seed) {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Tilt (radians, signed: negative = world leans counterclockwise) held on dance step
// `step` of the section: a random side at a random angle between the two DANCE_TILT bounds.
function stepTilt(section, step) {
  const seed = section.startMs + step * 2;
  const side = rand(seed) < 0.5 ? -1 : 1;
  const deg = DANCE_TILT_MIN_DEG + (DANCE_TILT_MAX_DEG - DANCE_TILT_MIN_DEG) * rand(seed + 1);
  return side * deg * Math.PI / 180;
}

// Camera pose at songMs for a `dance` section: every 1/DANCE_STEPS_PER_BEAT beats from the
// section start the camera snaps (ease-out over DANCE_SNAP_MS) from the previous step's tilt
// to a new random one, and each snap kicks a shake — a random scroll offset re-rolled every
// DANCE_SHAKE_JITTER_MS, shrinking to nothing over DANCE_SHAKE_DECAY_MS. The first step
// snaps from upright. Returns { rotation, x, y } (radians, scroll px); all 0 outside the section.
export function dancePose(section, songMs, beatMs) {
  if (!section.dance || songMs < section.startMs || songMs >= section.endMs) return STILL;
  const stepMs = beatMs / DANCE_STEPS_PER_BEAT;
  const elapsed = songMs - section.startMs;
  const step = Math.floor(elapsed / stepMs);
  const sinceMs = elapsed - step * stepMs;

  const from = step === 0 ? 0 : stepTilt(section, step - 1);
  const to = stepTilt(section, step);
  const t = Math.min(1, sinceMs / DANCE_SNAP_MS);
  const eased = 1 - (1 - t) * (1 - t);

  const amp = DANCE_SHAKE_PX * Math.max(0, 1 - sinceMs / DANCE_SHAKE_DECAY_MS);
  const jitter = section.startMs + Math.floor(elapsed / DANCE_SHAKE_JITTER_MS) * 2;
  return {
    rotation: from + (to - from) * eased,
    x: (rand(jitter + 0.5) * 2 - 1) * amp,
    y: (rand(jitter + 1.5) * 2 - 1) * amp,
  };
}
