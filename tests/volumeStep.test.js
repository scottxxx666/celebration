import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepVolume } from '../src/volumeStep.js';

test('steps up and down by 0.1', () => {
  assert.equal(stepVolume(0.5, 1), 0.6);
  assert.equal(stepVolume(0.5, -1), 0.4);
});

test('clamps at 0 and 1', () => {
  assert.equal(stepVolume(1, 1), 1);
  assert.equal(stepVolume(0, -1), 0);
  assert.equal(stepVolume(0.95, 1), 1);
  assert.equal(stepVolume(0.05, -1), 0);
});

test('does not accumulate float error', () => {
  assert.equal(stepVolume(0.6, 1), 0.7);
  let v = 0;
  for (let i = 0; i < 10; i++) v = stepVolume(v, 1);
  assert.equal(v, 1);
  for (let i = 0; i < 10; i++) v = stepVolume(v, -1);
  assert.equal(v, 0);
});

test('reverse steps return to the start', () => {
  assert.equal(stepVolume(stepVolume(0.3, 1), -1), 0.3);
});

test('custom step size', () => {
  assert.equal(stepVolume(0.5, 1, 0.25), 0.75);
});
