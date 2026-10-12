import {
  DANCE_STEPS_PER_BEAT, DANCE_TILT_MIN_DEG, DANCE_TILT_MAX_DEG, DANCE_SHIFT_MIN_PX, DANCE_SHIFT_MAX_PX, DANCE_SNAP_MS,
  DANCE_SHAKE_PX, DANCE_SHAKE_DECAY_MS, DANCE_SHAKE_JITTER_MS, DANCE_HEAD_SWINGS, DANCE_HEAD_SPAN, DANCE_ZOOM,
  DANCE_COMBO_START, DANCE_COMBO_SWINGS, DANCE_COMBO_TILT_DEG, DANCE_COMBO_SHIFT_PX,
  DANCE_HAND_ZOOM_FROM, DANCE_HAND_ZOOM_TO, DANCE_HAND_TILT_DEG, DANCE_HAND_SWAY_BEATS,
  DANCE_HAND_DRIFT_X, DANCE_HAND_DRIFT_Y, DANCE_HAND_DRIFT_BEATS, DANCE_HAND_CALM,
} from './config/gameConfig.js';

const STILL = Object.freeze({ rotation: 0, x: 0, y: 0, zoom: 1 });
const REST = Object.freeze({ ...STILL, zoom: DANCE_ZOOM }); // upright, mid-dance

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

// -1..1 swing of a head shake `progress` (0..1) of the way through it: `swings` half-waves,
// alternating sides, under an envelope that falls linearly to 0 at the end.
function headSwing(progress, swings = DANCE_HEAD_SWINGS) {
  if (progress >= 1) return 0;
  return Math.sin(Math.PI * swings * progress) * (1 - progress);
}

// -1..1 swing of the `dance: 'combo'` head shake `stepProgress` (0..1) of the way through a step:
// nothing until DANCE_COMBO_START, then one shake filling the rest of the step.
function comboSwing(stepProgress) {
  if (stepProgress <= DANCE_COMBO_START) return 0;
  return headSwing((stepProgress - DANCE_COMBO_START) / (1 - DANCE_COMBO_START), DANCE_COMBO_SWINGS);
}

const smoothstep = t => t * t * (3 - 2 * t);

// Smooth -1..1 wander: random targets at every integer `t`, eased between.
function wander(seed, t) {
  const i = Math.floor(t);
  const a = rand(seed + i) * 2 - 1;
  const b = rand(seed + i + 1) * 2 - 1;
  return a + (b - a) * smoothstep(t - i);
}

// `dance: 'handheld'` — one move over the whole section rather than a step per beat: the zoom
// pulls back from DANCE_HAND_ZOOM_FROM to DANCE_HAND_ZOOM_TO (fast, then slower), the camera
// rocks continuously between rolls on alternating sides (a new one every DANCE_HAND_SWAY_BEATS,
// starting rolled over) and wanders in x/y, and the rock and wander shrink linearly to nothing
// by DANCE_HAND_CALM of the way through, leaving a steady level pull-back.
function handheldPose(section, songMs, beatMs, runSeed) {
  const elapsed = songMs - section.startMs;
  const progress = elapsed / (section.endMs - section.startMs);
  const energy = Math.max(0, 1 - progress / DANCE_HAND_CALM);
  const seed = section.startMs + runSeed;

  const firstSide = rand(seed) < 0.5 ? -1 : 1;
  const rollAt = rock => (rock % 2 ? -firstSide : firstSide) * (0.5 + 0.5 * rand(seed + 1 + rock));
  const rocks = elapsed / (beatMs * DANCE_HAND_SWAY_BEATS);
  const rock = Math.floor(rocks);
  const roll = rollAt(rock) + (rollAt(rock + 1) - rollAt(rock)) * smoothstep(rocks - rock);

  const drift = elapsed / (beatMs * DANCE_HAND_DRIFT_BEATS);
  const pulled = 1 - (1 - progress) * (1 - progress);
  return {
    rotation: roll * DANCE_HAND_TILT_DEG * Math.PI / 180 * energy,
    x: wander(seed + 0.25, drift) * DANCE_HAND_DRIFT_X * energy,
    y: wander(seed + 0.75, drift) * DANCE_HAND_DRIFT_Y * energy,
    zoom: DANCE_HAND_ZOOM_FROM * (DANCE_HAND_ZOOM_TO / DANCE_HAND_ZOOM_FROM) ** pulled,
  };
}

// Camera pose at songMs for a `dance` section: every 1/DANCE_STEPS_PER_BEAT beats from the
// section start the camera snaps (ease-out over DANCE_SNAP_MS) from the previous step's tilt
// and sideways slide to new random ones, and each snap kicks a shake — a random scroll offset re-rolled every
// DANCE_SHAKE_JITTER_MS, shrinking to nothing over DANCE_SHAKE_DECAY_MS. The first step
// snaps from upright and centred. `runSeed` picks the dance: the same seed gives the same moves,
// so GameScene rolls one per run. With `dance: 'headshake'` each step is instead one head shake:
// the step's rolled tilt swings side to side around upright (headSwing) over DANCE_HEAD_SPAN of the
// step, the slide follows the lean as if pivoting on a neck below the screen, and there is no jitter;
// with `dance: 'combo'` the snapped pose also gets a small head shake around it late in the step
// (comboSwing), leaning further first and settling back onto the pose before the next snap;
// `dance: 'handheld'` is handheldPose above. Returns { rotation, x, y, zoom } (radians, scroll px, base zoom);
// upright at zoom 1 outside the section.
export function dancePose(section, songMs, beatMs, runSeed = 0) {
  if (!section.dance || songMs < section.startMs || songMs >= section.endMs) return STILL;
  if (section.dance === 'handheld') return handheldPose(section, songMs, beatMs, runSeed);
  const stepMs = beatMs / DANCE_STEPS_PER_BEAT;
  const elapsed = songMs - section.startMs;
  const step = Math.floor(elapsed / stepMs);
  const sinceMs = elapsed - step * stepMs;

  if (section.dance === 'headshake') {
    const swing = headSwing(sinceMs / (stepMs * DANCE_HEAD_SPAN));
    if (swing === 0) return REST;
    const { tilt, shift } = stepPose(section, step, runSeed);
    // World leaning clockwise (positive tilt) slides right (negative scroll)
    return { rotation: tilt * swing, x: -Math.sign(tilt) * Math.abs(shift) * swing, y: 0, zoom: DANCE_ZOOM };
  }

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
