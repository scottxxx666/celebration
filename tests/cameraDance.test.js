import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dancePose } from '../src/cameraDance.js';
import {
  DANCE_STEPS_PER_BEAT, DANCE_TILT_MIN_DEG, DANCE_TILT_MAX_DEG, DANCE_SHIFT_MIN_PX, DANCE_SHIFT_MAX_PX, DANCE_SNAP_MS,
  DANCE_SHAKE_PX, DANCE_SHAKE_DECAY_MS, DANCE_HEAD_SWINGS, DANCE_HEAD_SPAN,
  DANCE_ZOOM, DANCE_HAND_ZOOM_FROM, DANCE_HAND_ZOOM_TO, DANCE_HAND_TILT_DEG, DANCE_HAND_SWAY_BEATS,
  DANCE_HAND_DRIFT_X, DANCE_HAND_DRIFT_Y, DANCE_HAND_CALM,
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

// dance: 'headshake'
const headSection = { ...section, dance: 'headshake' };
const HEAD_MS = STEP_MS * DANCE_HEAD_SPAN;
const headAt = (step, ms) => poseAt(headSection.startMs + step * STEP_MS + ms, headSection);

test('headshake: every step starts upright and rests upright after its span', () => {
  for (let step = 0; step < STEPS; step++) {
    assert.ok(Math.abs(headAt(step, 0).rotation) < 1e-9);
    if (DANCE_HEAD_SPAN < 1) assert.deepEqual(headAt(step, (HEAD_MS + STEP_MS) / 2), { rotation: 0, x: 0, y: 0, zoom: DANCE_ZOOM });
  }
});

test('headshake: each shake swings to both sides, each swing smaller than the last', () => {
  for (let step = 0; step < STEPS; step++) {
    // Peak of each half-wave, sampled at its middle
    const peaks = Array.from({ length: DANCE_HEAD_SWINGS }, (_, i) =>
      headAt(step, HEAD_MS * (i + 0.5) / DANCE_HEAD_SWINGS).rotation);
    for (let i = 1; i < peaks.length; i++) {
      assert.ok(peaks[i] * peaks[i - 1] < 0, `step ${step}: swing ${i} is on the other side`);
      assert.ok(Math.abs(peaks[i]) < Math.abs(peaks[i - 1]), `step ${step}: swing ${i} is smaller`);
    }
  }
});

test('headshake: stays within the tilt and slide bounds, slides the way it leans, never jitters', () => {
  for (let step = 0; step < STEPS; step++) {
    for (let ms = 0; ms < STEP_MS; ms += 9) {
      const pose = headAt(step, ms);
      assert.ok(Math.abs(deg(pose.rotation)) <= DANCE_TILT_MAX_DEG + 1e-9);
      assert.ok(Math.abs(pose.x) <= DANCE_SHIFT_MAX_PX + 1e-9);
      assert.ok(pose.x * pose.rotation <= 0, 'clockwise lean slides the world right (negative scroll)');
      assert.equal(pose.y, 0);
    }
  }
});

test('headshake: the first side is random per step and differs between runs', () => {
  const firstSides = seed => Array.from({ length: STEPS }, (_, step) => Math.sign(
    dancePose(headSection, headSection.startMs + step * STEP_MS + HEAD_MS / (2 * DANCE_HEAD_SWINGS), BEAT_MS, seed).rotation));
  const a = firstSides(12.34);
  const b = firstSides(567.8);
  assert.ok(a.includes(-1) && a.includes(1));
  assert.ok(a.some((side, i) => side !== b[i]));
});

// dance: 'handheld'
const handSection = { ...section, dance: 'handheld' };
const HAND_SPAN_MS = handSection.endMs - handSection.startMs;
const handAt = (progress, seed = 0) => dancePose(handSection, handSection.startMs + HAND_SPAN_MS * progress, BEAT_MS, seed);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} !== ${expected}`);

test('the per-beat modes hold DANCE_ZOOM', () => {
  assert.equal(settled(3).zoom, DANCE_ZOOM);
  assert.equal(headAt(3, 20).zoom, DANCE_ZOOM);
});

test('handheld: the zoom pulls back from FROM to TO, fastest at the start', () => {
  near(handAt(0).zoom, DANCE_HAND_ZOOM_FROM);
  near(handAt(1 - 1e-12).zoom, DANCE_HAND_ZOOM_TO);
  let prev = handAt(0).zoom;
  for (let p = 0.05; p < 1; p += 0.05) {
    const zoom = handAt(p).zoom;
    assert.ok(Math.sign(zoom - prev) === Math.sign(DANCE_HAND_ZOOM_TO - DANCE_HAND_ZOOM_FROM), `monotonic at ${p}`);
    prev = zoom;
  }
  const firstHalf = Math.abs(handAt(0.5).zoom - handAt(0).zoom);
  const secondHalf = Math.abs(handAt(1 - 1e-12).zoom - handAt(0.5).zoom);
  assert.ok(firstHalf > secondHalf);
});

test('handheld: starts rolled over and rocks to both sides within the bounds', () => {
  const maxRoll = DANCE_HAND_TILT_DEG * Math.PI / 180;
  assert.ok(Math.abs(handAt(0).rotation) >= maxRoll / 2 - 1e-9);
  const rolls = [];
  for (let p = 0; p < 1; p += 0.002) {
    const pose = handAt(p);
    rolls.push(pose.rotation);
    assert.ok(Math.abs(pose.rotation) <= maxRoll + 1e-9);
    assert.ok(Math.abs(pose.x) <= DANCE_HAND_DRIFT_X + 1e-9 && Math.abs(pose.y) <= DANCE_HAND_DRIFT_Y + 1e-9);
  }
  assert.ok(rolls.some(r => r < 0) && rolls.some(r => r > 0));
});

test('handheld: successive rocks land on alternating sides', () => {
  const swayMs = BEAT_MS * DANCE_HAND_SWAY_BEATS;
  const rocks = Math.floor(HAND_SPAN_MS * DANCE_HAND_CALM / swayMs);
  assert.ok(rocks >= 2, 'the test section must fit at least two rocks');
  for (let rock = 1; rock < rocks; rock++) {
    const here = dancePose(handSection, handSection.startMs + rock * swayMs, BEAT_MS).rotation;
    const before = dancePose(handSection, handSection.startMs + (rock - 1) * swayMs, BEAT_MS).rotation;
    assert.ok(here * before < 0, `rock ${rock}`);
  }
});

test('handheld: steady and level from DANCE_HAND_CALM on, still pulling back', () => {
  for (let p = DANCE_HAND_CALM; p < 1; p += 0.01) {
    const pose = handAt(p);
    assert.ok(pose.rotation === 0 && pose.x === 0 && pose.y === 0, `calm at ${p}`);
  }
  if (DANCE_HAND_CALM < 1) assert.notEqual(handAt(DANCE_HAND_CALM).zoom, handAt(1 - 1e-12).zoom);
});

test('handheld: a different run seed moves differently on the same pull-back', () => {
  const a = handAt(0.2, 12.34);
  const b = handAt(0.2, 567.8);
  assert.equal(a.zoom, b.zoom);
  assert.ok(a.x !== b.x && a.rotation !== b.rotation);
});
