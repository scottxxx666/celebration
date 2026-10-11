import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dancePose } from '../src/cameraDance.js';
import {
  DANCE_STEPS_PER_BEAT, DANCE_TILT_MIN_DEG, DANCE_TILT_MAX_DEG, DANCE_SNAP_MS,
  DANCE_SHAKE_PX, DANCE_SHAKE_DECAY_MS,
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
  assert.deepEqual(poseAt(5000, { ...section, dance: false }), { rotation: 0, x: 0, y: 0 });
  assert.deepEqual(poseAt(section.startMs - 1), { rotation: 0, x: 0, y: 0 });
  assert.deepEqual(poseAt(section.endMs), { rotation: 0, x: 0, y: 0 });
});

test('every step settles on a tilt within the configured bounds, still', () => {
  for (let step = 0; step < STEPS; step++) {
    const pose = settled(step);
    const tilt = Math.abs(deg(pose.rotation));
    assert.ok(tilt >= DANCE_TILT_MIN_DEG - 1e-9 && tilt <= DANCE_TILT_MAX_DEG + 1e-9, `step ${step}: ${tilt}`);
    assert.ok(pose.x === 0 && pose.y === 0); // === so a -0 offset passes
  }
});

test('the tilt goes both left and right, at varying angles', () => {
  const tilts = Array.from({ length: STEPS }, (_, step) => settled(step).rotation);
  assert.ok(tilts.some(t => t < 0) && tilts.some(t => t > 0));
  assert.ok(new Set(tilts.map(t => t.toFixed(4))).size > STEPS / 2);
});

test('the first step snaps from upright; later steps from the previous pose', () => {
  assert.equal(poseAt(section.startMs).rotation, 0);
  const start = section.startMs + 5 * STEP_MS;
  assert.ok(Math.abs(poseAt(start).rotation - settled(4).rotation) < 1e-9);
});

test('each snap kicks a shake that stays within DANCE_SHAKE_PX', () => {
  let moved = false;
  for (let ms = 0; ms < DANCE_SHAKE_DECAY_MS; ms += 7) {
    const pose = poseAt(section.startMs + 3 * STEP_MS + ms);
    assert.ok(Math.abs(pose.x) <= DANCE_SHAKE_PX && Math.abs(pose.y) <= DANCE_SHAKE_PX);
    moved ||= pose.x !== 0 || pose.y !== 0;
  }
  assert.ok(moved);
});

test('the pose is a pure function of song time', () => {
  const ms = section.startMs + 7 * STEP_MS + 33;
  assert.deepEqual(poseAt(ms), poseAt(ms));
});
