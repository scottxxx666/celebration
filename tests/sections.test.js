import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotateTurns, sectionAt, strobeRate, strobeScale } from '../src/config/sections.js';
import { ROTATE_BEATS_PER_TURN, TRACK_BEAT_MS } from '../src/config/gameConfig.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} !== ${expected}`);

const ramped = { strobeRamp: 0.25, startMs: 1000, endMs: 2000 };

test('a section without a ramp scales the strobe by 1 anywhere', () => {
  const flat = { strobeRamp: 1, startMs: 1000, endMs: 2000 };
  assert.equal(strobeScale(flat, 0), 1);
  assert.equal(strobeScale(flat, 1500), 1);
  assert.equal(strobeScale(flat, 5000), 1);
});

test('the default section (no startMs/endMs) yields exactly 1, not NaN', () => {
  assert.equal(strobeScale(sectionAt(0), 0), 1);
});

test('the ramp rises linearly from strobeRamp at the start to 1 at the end', () => {
  near(strobeScale(ramped, 1000), 0.25);
  near(strobeScale(ramped, 1500), 0.625);
  near(strobeScale(ramped, 2000), 1);
});

test('the ramp clamps outside the section', () => {
  near(strobeScale(ramped, 0), 0.25);
  near(strobeScale(ramped, 3000), 1);
});

test('the ready section strobes in stepped rates and ramps up', () => {
  const ready = sectionAt(84641);
  assert.equal(ready.name, 'ready');
  assert.deepEqual(ready.strobe, [[6, 1], [3, 2], [3, 4], [1, 8]]);
  near(strobeScale(ready, ready.startMs), ready.strobeRamp);
  assert.ok(strobeScale(ready, (ready.startMs + ready.endMs) / 2) > ready.strobeRamp);
});

const BEAT = 400;
const stepped = { strobe: [[2, 1], [2, 4]], startMs: 1000 };

test('a numeric strobe is returned as-is and the default section is off', () => {
  assert.equal(strobeRate({ strobe: 2, startMs: 1000 }, 0, BEAT), 2);
  assert.equal(strobeRate({ strobe: 2, startMs: 1000 }, 9999, BEAT), 2);
  assert.equal(strobeRate(sectionAt(0), 0, BEAT), 0);
});

test('stepped strobe switches rate at the step boundary', () => {
  assert.equal(strobeRate(stepped, 1000, BEAT), 1);
  assert.equal(strobeRate(stepped, 1799, BEAT), 1);
  assert.equal(strobeRate(stepped, 1800, BEAT), 4);
  assert.equal(strobeRate(stepped, 2599, BEAT), 4);
});

test('the last strobe step holds past the listed steps', () => {
  assert.equal(strobeRate(stepped, 5000, BEAT), 4);
});

test('the ready strobe steps fill the section and only speed up', () => {
  const ready = sectionAt(84641);
  const total = ready.strobe.reduce((sum, [beats]) => sum + beats, 0);
  assert.ok(Math.abs((ready.endMs - ready.startMs) / TRACK_BEAT_MS - total) < 0.01);
  const rates = ready.strobe.map(([, rate]) => rate);
  rates.forEach((rate, i) => assert.ok(i === 0 || rate >= rates[i - 1]));
  assert.equal(strobeRate(ready, ready.startMs, TRACK_BEAT_MS), rates[0]);
  assert.equal(strobeRate(ready, ready.endMs - 1, TRACK_BEAT_MS), rates[rates.length - 1]);
});

const spin = { startMs: 1000 };

test('rotate spins forward through the first turn', () => {
  near(rotateTurns(spin, 1000, 400), 0);
  near(rotateTurns(spin, 1100, 400), 0.25);
  near(rotateTurns(spin, 1400, 400), 1);
});

test('rotate runs in reverse through the second turn, back to upright', () => {
  near(rotateTurns(spin, 1500, 400), 0.75);
  near(rotateTurns(spin, 1700, 400), 0.25);
  near(rotateTurns(spin, 1800, 400), 0);
});

test('rotate keeps alternating direction on later turns', () => {
  near(rotateTurns(spin, 1900, 400), 0.25);
  near(rotateTurns(spin, 2300, 400), 0.75);
});

test('the final highlight is one turn out and one turn back, ending upright', () => {
  const final = sectionAt(123697);
  const turnMs = TRACK_BEAT_MS * ROTATE_BEATS_PER_TURN;
  assert.ok(final.rotate);
  assert.ok(Math.abs((final.endMs - final.startMs) / turnMs - 2) < 0.01);
  assert.ok(rotateTurns(final, final.endMs - 1, turnMs) < 0.01);
});
