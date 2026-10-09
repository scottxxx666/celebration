import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mobileDemoAction } from '../src/howToPlayDemo.js';

const run = (n, autoRun) => Array.from({ length: n }, (_, i) => mobileDemoAction(i, autoRun));

test('normal loop is six alternating taps, a swipe, then a rest', () => {
  assert.deepEqual(run(8, false), [
    'tapLeft', 'tapRight', 'tapLeft', 'tapRight', 'tapLeft', 'tapRight', 'swipe', 'rest',
  ]);
});

test('normal loop repeats every 8 ticks', () => {
  assert.deepEqual(run(8, false), run(16, false).slice(8));
});

test('easy loop never taps: swipe then two rest ticks, repeating', () => {
  assert.deepEqual(run(6, true), ['swipe', 'rest', 'rest', 'swipe', 'rest', 'rest']);
  assert.ok(run(48, true).every((a) => !a.startsWith('tap')));
});
