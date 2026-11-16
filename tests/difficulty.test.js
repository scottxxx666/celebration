import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIFFICULTY_IDS, DEFAULT_DIFFICULTY, parseDifficulty, stepDifficulty } from '../src/difficulty.js';

const IDS = DIFFICULTY_IDS;

test('difficulties are ordered easy, normal, hard and default to normal', () => {
  assert.deepEqual(IDS, ['easy', 'normal', 'hard']);
  assert.equal(DEFAULT_DIFFICULTY, 'normal');
});

test('parseDifficulty keeps valid ids', () => {
  for (const id of IDS) assert.equal(parseDifficulty(id), id);
});

test('parseDifficulty falls back to the default for null, garbage and wrong case', () => {
  for (const raw of [null, undefined, '', 'nightmare', 'Hard', 'EASY', 42, {}]) {
    assert.equal(parseDifficulty(raw), DEFAULT_DIFFICULTY, String(raw));
  }
});

test('stepDifficulty moves forward and backward', () => {
  assert.equal(stepDifficulty('easy', 1), 'normal');
  assert.equal(stepDifficulty('normal', 1), 'hard');
  assert.equal(stepDifficulty('hard', -1), 'normal');
  assert.equal(stepDifficulty('normal', -1), 'easy');
});

test('stepDifficulty wraps at both ends', () => {
  assert.equal(stepDifficulty('hard', 1), 'easy');
  assert.equal(stepDifficulty('easy', -1), 'hard');
});
