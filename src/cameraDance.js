import {
  DANCE_STEPS_PER_BEAT, DANCE_TILT_MIN_DEG, DANCE_TILT_MAX_DEG, DANCE_SHIFT_MIN_PX, DANCE_SHIFT_MAX_PX, DANCE_SNAP_MS,
  DANCE_SHAKE_PX, DANCE_SHAKE_DECAY_MS, DANCE_SHAKE_JITTER_MS,
} from './config/gameConfig.js';

const STILL = Object.freeze({ rotation: 0, x: 0, y: 0 });

// Deterministic 0..1 pseudo-random from a number: within a run the dance is stateless
// from song time; the caller's per-run seed is what makes each run dance differently.
function rand(seed) {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// A random side (±1) times a random size between min and max, from two rolls at `seed`.
function signedBetween(seed, min, max) {
  const side = rand(seed) < 0.5 ? -1 : 1;
  return side * (min + (max - min) * rand(seed + 0.5));
}

// Pose held on dance step `step` of the section: `tilt` in radians (negative = world leans
// counterclockwise) and `shift` in scroll px (negative = world slides right), each on its
// own random side at a random size between its two DANCE_TILT / DANCE_SHIFT bounds.
function stepPose(section, step, runSeed) {
  const seed = section.startMs + runSeed + step * 2;
  return {
    tilt: signedBetween(seed, DANCE_TILT_MIN_DEG, DANCE_TILT_MAX_DEG) * Math.PI / 180,
    shift: signedBetween(seed + 1, DANCE_SHIFT_MIN_PX, DANCE_SHIFT_MAX_PX),
  };
}

const UPRIGHT = Object.freeze({ tilt: 0, shift: 0 });

// Camera pose at songMs for a `dance` section: every 1/DANCE_STEPS_PER_BEAT beats from the
// section start the camera snaps (ease-out over DANCE_SNAP_MS) from the previous step's tilt
// and sideways slide to new random ones, and each snap kicks a shake — a random scroll offset re-rolled every
// DANCE_SHAKE_JITTER_MS, shrinking to nothing over DANCE_SHAKE_DECAY_MS. The first step
// snaps from upright and centred. `runSeed` picks the dance: the same seed gives the same moves,
// so GameScene rolls one per run. Returns { rotation, x, y } (radians, scroll px); all 0 outside the section.
export function dancePose(section, songMs, beatMs, runSeed = 0) {
  if (!section.dance || songMs < section.startMs || songMs >= section.endMs) return STILL;
  const stepMs = beatMs / DANCE_STEPS_PER_BEAT;
  const elapsed = songMs - section.startMs;
  const step = Math.floor(elapsed / stepMs);
  const sinceMs = elapsed - step * stepMs;

  const from = step === 0 ? UPRIGHT : stepPose(section, step - 1, runSeed);
  const to = stepPose(section, step, runSeed);
  const t = Math.min(1, sinceMs / DANCE_SNAP_MS);
  const eased = 1 - (1 - t) * (1 - t);

  const amp = DANCE_SHAKE_PX * Math.max(0, 1 - sinceMs / DANCE_SHAKE_DECAY_MS);
  const jitter = section.startMs + runSeed + Math.floor(elapsed / DANCE_SHAKE_JITTER_MS) * 2;
  return {
    rotation: from.tilt + (to.tilt - from.tilt) * eased,
    x: from.shift + (to.shift - from.shift) * eased + (rand(jitter + 0.25) * 2 - 1) * amp,
    y: (rand(jitter + 1.25) * 2 - 1) * amp,
  };
}
