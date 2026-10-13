import {
  DANCE_STEPS_PER_BEAT, DANCE_TILT_MIN_DEG, DANCE_TILT_MAX_DEG, DANCE_SHIFT_MIN_PX, DANCE_SHIFT_MAX_PX, DANCE_SNAP_MS,
  DANCE_SHAKE_PX, DANCE_SHAKE_DECAY_MS, DANCE_SHAKE_JITTER_MS, DANCE_ZOOM,
  DANCE_COMBO_START, DANCE_COMBO_SWINGS, DANCE_COMBO_TILT_DEG, DANCE_COMBO_SHIFT_PX,
} from './config/gameConfig.js';

const STILL = Object.freeze({ rotation: 0, x: 0, y: 0, zoom: 1 });

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

// -1..1 swing of the `dance: 'combo'` head shake `stepProgress` (0..1) of the way through a step:
// nothing until DANCE_COMBO_START, then DANCE_COMBO_SWINGS half-waves on alternating sides filling
// the rest of the step, under an envelope that falls linearly to 0 at its end.
function comboSwing(stepProgress) {
  if (stepProgress <= DANCE_COMBO_START) return 0;
  const progress = (stepProgress - DANCE_COMBO_START) / (1 - DANCE_COMBO_START);
  return Math.sin(Math.PI * DANCE_COMBO_SWINGS * progress) * (1 - progress);
}

// Camera pose at songMs for a `dance` section: every 1/DANCE_STEPS_PER_BEAT beats from the
// section start the camera snaps (ease-out over DANCE_SNAP_MS) from the previous step's tilt
// and sideways slide to new random ones, and each snap kicks a shake — a random scroll offset re-rolled every
// DANCE_SHAKE_JITTER_MS, shrinking to nothing over DANCE_SHAKE_DECAY_MS. The first step
// snaps from upright and centred. `runSeed` picks the dance: the same seed gives the same moves,
// so GameScene rolls one per run. With `dance: 'combo'` the snapped pose also gets a small head shake around it late in the step
// (comboSwing), leaning further first and settling back onto the pose before the next snap.
// Returns { rotation, x, y, zoom } (radians, scroll px, base zoom);
// upright at zoom 1 outside the section.
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
  // Signed by the pose's tilt, so the shake leans further the same way first
  const wobble = section.dance === 'combo' ? Math.sign(to.tilt) * comboSwing(sinceMs / stepMs) : 0;
  return {
    rotation: from.tilt + (to.tilt - from.tilt) * eased + wobble * DANCE_COMBO_TILT_DEG * Math.PI / 180,
    x: from.shift + (to.shift - from.shift) * eased - wobble * DANCE_COMBO_SHIFT_PX + (rand(jitter + 0.25) * 2 - 1) * amp,
    y: (rand(jitter + 1.25) * 2 - 1) * amp,
    zoom: DANCE_ZOOM,
  };
}
