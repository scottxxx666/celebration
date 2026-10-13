import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dancePose, spinRotation } from '../src/cameraDance.js';
import {
  DANCE_STEPS_PER_BEAT, DANCE_TILT_MIN_DEG, DANCE_TILT_MAX_DEG, DANCE_SHIFT_MIN_PX, DANCE_SHIFT_MAX_PX, DANCE_SNAP_MS,
  DANCE_SHAKE_PX, DANCE_SHAKE_DECAY_MS,
  DANCE_COMBO_START, DANCE_COMBO_SWINGS, DANCE_COMBO_TILT_DEG, DANCE_COMBO_SHIFT_PX,
  DANCE_ZOOM, ROTATE_BEATS_PER_MOVE, ROTATE_MIN_DEG, ROTATE_MAX_DEG,
} from '../src/config/gameConfig.js';

const BEAT_MS = 400;
const STEP_MS = BEAT_MS / DANCE_STEPS_PER_BEAT;
const STEPS = 64;
const section = { dance: true, startMs: 10000, endMs: 10000 + STEP_MS * STEPS };
const poseAt = (songMs, s = section) => dancePose(s, songMs, BEAT_MS);
const deg = rad => rad * 180 / Math.PI;
// Settled pose of a step: past both the snap and the shake
const SETTLED_MS = Math.max(DANCE_SNAP_MS, DANCE_SHAKE_DECAY_MS);
const settled = step => poseAt(section.startMs + step * STEP_MS + SETTLED_MS);

test('the settled pose fits inside a step', () => {
  assert.ok(SETTLED_MS < STEP_MS, 'snap + shake must finish before the next step');
});

test('no pose outside a dance section', () => {
  assert.deepEqual(poseAt(5000, { ...section, dance: false }), { rotation: 0, x: 0, y: 0, zoom: 1 });
  assert.deepEqual(poseAt(section.startMs - 1), { rotation: 0, x: 0, y: 0, zoom: 1 });
  assert.deepEqual(poseAt(section.endMs), { rotation: 0, x: 0, y: 0, zoom: 1 });
});

test('every step settles on a tilt and a slide within the configured bounds, still', () => {
  for (let step = 0; step < STEPS; step++) {
    const pose = settled(step);
    const tilt = Math.abs(deg(pose.rotation));
    assert.ok(tilt >= DANCE_TILT_MIN_DEG - 1e-9 && tilt <= DANCE_TILT_MAX_DEG + 1e-9, `step ${step}: ${tilt}`);
    const shift = Math.abs(pose.x);
    assert.ok(shift >= DANCE_SHIFT_MIN_PX - 1e-9 && shift <= DANCE_SHIFT_MAX_PX + 1e-9, `step ${step}: ${shift}`);
    assert.ok(pose.y === 0); // === so a -0 offset passes
  }
});

test('the tilt goes both left and right, at varying angles', () => {
  const tilts = Array.from({ length: STEPS }, (_, step) => settled(step).rotation);
  assert.ok(tilts.some(t => t < 0) && tilts.some(t => t > 0));
  assert.ok(new Set(tilts.map(t => t.toFixed(4))).size > STEPS / 2);
});

test('the slide goes both left and right, not always on the tilt side', () => {
  const poses = Array.from({ length: STEPS }, (_, step) => settled(step));
  assert.ok(poses.some(p => p.x < 0) && poses.some(p => p.x > 0));
  assert.ok(poses.some(p => p.x * p.rotation > 0) && poses.some(p => p.x * p.rotation < 0));
});

test('the first step snaps from upright; later steps from the previous pose', () => {
  assert.equal(poseAt(section.startMs).rotation, 0);
  assert.ok(Math.abs(poseAt(section.startMs).x) <= DANCE_SHAKE_PX);
  const start = section.startMs + 5 * STEP_MS;
  assert.ok(Math.abs(poseAt(start).rotation - settled(4).rotation) < 1e-9);
});

test('each snap kicks a shake that stays within DANCE_SHAKE_PX', () => {
  let moved = false;
  const maxX = DANCE_SHAKE_PX + DANCE_SHIFT_MAX_PX;
  for (let ms = 0; ms < DANCE_SHAKE_DECAY_MS; ms += 7) {
    const pose = poseAt(section.startMs + 3 * STEP_MS + ms);
    assert.ok(Math.abs(pose.x) <= maxX && Math.abs(pose.y) <= DANCE_SHAKE_PX);
    moved ||= pose.y !== 0;
  }
  assert.ok(moved);
});

test('the pose is a pure function of song time and the run seed', () => {
  const ms = section.startMs + 7 * STEP_MS + 33;
  assert.deepEqual(poseAt(ms), poseAt(ms));
  assert.deepEqual(dancePose(section, ms, BEAT_MS, 123.4), dancePose(section, ms, BEAT_MS, 123.4));
});

test('a different run seed gives a different dance, within the same bounds', () => {
  const tiltsOf = seed => Array.from({ length: STEPS }, (_, step) =>
    dancePose(section, section.startMs + step * STEP_MS + SETTLED_MS, BEAT_MS, seed).rotation);
  const a = tiltsOf(12.34);
  const b = tiltsOf(567.8);
  assert.ok(a.filter((tilt, i) => Math.abs(tilt - b[i]) > 1e-6).length > STEPS / 2);
  for (const tilt of [...a, ...b]) {
    const size = Math.abs(deg(tilt));
    assert.ok(size >= DANCE_TILT_MIN_DEG - 1e-9 && size <= DANCE_TILT_MAX_DEG + 1e-9);
  }
  assert.ok(a.some(t => t < 0) && a.some(t => t > 0) && b.some(t => t < 0) && b.some(t => t > 0));
});

// dance: 'combo'
const comboSection = { ...section, dance: 'combo' };
const COMBO_START_MS = STEP_MS * DANCE_COMBO_START;
const comboAt = (step, ms) => poseAt(comboSection.startMs + step * STEP_MS + ms, comboSection);
const poseModeAt = (step, ms) => poseAt(section.startMs + step * STEP_MS + ms);

test('combo: the head shake starts after the snap and the jitter', () => {
  assert.ok(COMBO_START_MS >= SETTLED_MS);
});

test('combo: identical to the pose dance until the head shake starts', () => {
  for (let step = 0; step < STEPS; step++) {
    for (let ms = 0; ms <= COMBO_START_MS; ms += 7) assert.deepEqual(comboAt(step, ms), poseModeAt(step, ms));
  }
});

test('combo: the shake swings around the held pose, further into its lean first, each swing smaller', () => {
  const shakeMs = STEP_MS - COMBO_START_MS;
  for (let step = 0; step < STEPS; step++) {
    const held = poseModeAt(step, SETTLED_MS);
    // Offset from the held pose at the middle of each swing
    const swings = Array.from({ length: DANCE_COMBO_SWINGS }, (_, i) => {
      const pose = comboAt(step, COMBO_START_MS + shakeMs * (i + 0.5) / DANCE_COMBO_SWINGS);
      assert.ok((pose.x - held.x) * (pose.rotation - held.rotation) <= 0, 'slides the way it leans');
      assert.ok(Math.abs(pose.x - held.x) <= DANCE_COMBO_SHIFT_PX + 1e-9);
      assert.ok(pose.y === 0, 'no jitter left');
      return deg(pose.rotation - held.rotation);
    });
    assert.ok(swings[0] * held.rotation > 0, `step ${step}: leans further first`);
    swings.forEach((swing, i) => {
      assert.ok(Math.abs(swing) <= DANCE_COMBO_TILT_DEG + 1e-9);
      if (i === 0) return;
      assert.ok(swing * swings[i - 1] < 0, `step ${step}: swing ${i} is on the other side`);
      assert.ok(Math.abs(swing) < Math.abs(swings[i - 1]), `step ${step}: swing ${i} is smaller`);
    });
  }
});

test('combo: settles back onto the pose, so the next snap starts from it', () => {
  for (let step = 1; step < STEPS; step++) {
    const start = comboAt(step, 0);
    const held = poseModeAt(step - 1, SETTLED_MS);
    assert.ok(Math.abs(start.rotation - held.rotation) < 1e-9);
    const end = comboAt(step - 1, STEP_MS - 1e-6);
    assert.ok(Math.abs(end.rotation - held.rotation) < 1e-6 && Math.abs(end.x - held.x) < 1e-6);
  }
});

test('every mode holds DANCE_ZOOM', () => {
  assert.equal(settled(3).zoom, DANCE_ZOOM);
  assert.equal(comboAt(3, 20).zoom, DANCE_ZOOM);
});

const MOVE_MS = BEAT_MS * ROTATE_BEATS_PER_MOVE;
const SPIN_MOVES = 32;
const spin = { rotate: true, startMs: 20000, endMs: 20000 + MOVE_MS * SPIN_MOVES };
const spinDeg = (songMs, seed = 0) => deg(spinRotation(spin, songMs, BEAT_MS, seed));
// Degrees turned during move `i` (the end of the move is read just short of the next one)
const turnOf = (i, seed = 0) => spinDeg(spin.startMs + (i + 1) * MOVE_MS - 1e-6, seed) - spinDeg(spin.startMs + i * MOVE_MS, seed);

test('no spin outside a rotate section', () => {
  assert.equal(spinRotation({ ...spin, rotate: false }, spin.startMs + 100, BEAT_MS), 0);
  assert.equal(spinRotation(spin, spin.startMs - 1, BEAT_MS), 0);
  assert.equal(spinRotation(spin, spin.endMs, BEAT_MS), 0);
});

test('every move turns by an angle inside the bounds, in both directions', () => {
  const turns = Array.from({ length: SPIN_MOVES - 1 }, (_, i) => turnOf(i));
  for (const turn of turns) {
    assert.ok(Math.abs(turn) >= ROTATE_MIN_DEG - 0.01 && Math.abs(turn) <= ROTATE_MAX_DEG + 0.01, `turn ${turn}`);
  }
  assert.ok(turns.some(turn => turn < 0) && turns.some(turn => turn > 0));
});

test('each move starts where the last one finished', () => {
  for (let i = 1; i < SPIN_MOVES; i++) {
    const at = spin.startMs + i * MOVE_MS;
    assert.ok(Math.abs(spinDeg(at) - spinDeg(at - 1e-6)) < 0.01, `jump at move ${i}`);
  }
});

test('the turn is halfway through at the middle of its move', () => {
  const start = spinDeg(spin.startMs + 3 * MOVE_MS);
  assert.ok(Math.abs(spinDeg(spin.startMs + 3.5 * MOVE_MS) - start - turnOf(3) / 2) < 0.01);
});

test('the last move turns back to upright by the short way', () => {
  const end = spinDeg(spin.endMs - 1e-6);
  assert.ok(Math.abs(end - Math.round(end / 360) * 360) < 0.01, `ends at ${end}`);
  assert.ok(Math.abs(turnOf(SPIN_MOVES - 1)) <= 180.01);
});

test('the spin differs per run seed and repeats for the same seed', () => {
  const at = spin.startMs + 5.5 * MOVE_MS;
  assert.equal(spinDeg(at, 7), spinDeg(at, 7));
  assert.notEqual(spinDeg(at, 7), spinDeg(at, 8));
});
