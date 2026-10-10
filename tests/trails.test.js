import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trailAlpha, trailColor } from '../src/trails.js';
import { TRAIL_ALPHA, TRAIL_LIFE_MS, TRAIL_COLORS } from '../src/config/gameConfig.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} !== ${expected}`);

test('a fresh stamp starts at TRAIL_ALPHA', () => {
  assert.equal(trailAlpha(0), TRAIL_ALPHA);
});

test('alpha falls linearly over the lifetime', () => {
  near(trailAlpha(TRAIL_LIFE_MS / 2), TRAIL_ALPHA / 2);
  near(trailAlpha(TRAIL_LIFE_MS / 4), TRAIL_ALPHA * 0.75);
});

test('alpha is 0 at and past the end of life', () => {
  assert.equal(trailAlpha(TRAIL_LIFE_MS), 0);
  assert.equal(trailAlpha(TRAIL_LIFE_MS * 3), 0);
});

test('a negative age is clamped to TRAIL_ALPHA', () => {
  assert.equal(trailAlpha(-50), TRAIL_ALPHA);
});

test('colours cycle through TRAIL_COLORS and wrap', () => {
  TRAIL_COLORS.forEach((color, i) => assert.equal(trailColor(i), color));
  assert.equal(trailColor(TRAIL_COLORS.length), TRAIL_COLORS[0]);
  assert.equal(trailColor(TRAIL_COLORS.length * 5 + 2), TRAIL_COLORS[2]);
});
