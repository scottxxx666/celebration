import test from 'node:test';
import assert from 'node:assert/strict';
import { crowdFrame } from '../src/crowdSway.js';
import { CROWD_SWAPS_PER_BEAT } from '../src/config/gameConfig.js';

const BEAT = 400;

test('alternates every beat at one swap per beat', () => {
  assert.equal(crowdFrame(0, BEAT, 1), 0);
  assert.equal(crowdFrame(BEAT - 1, BEAT, 1), 0);
  assert.equal(crowdFrame(BEAT, BEAT, 1), 1);
  assert.equal(crowdFrame(2 * BEAT, BEAT, 1), 0);
  assert.equal(crowdFrame(2 * BEAT + 1, BEAT, 1), 0);
});

test('two swaps per beat flips every half beat', () => {
  assert.equal(crowdFrame(0, BEAT, 2), 0);
  assert.equal(crowdFrame(BEAT / 2, BEAT, 2), 1);
  assert.equal(crowdFrame(BEAT, BEAT, 2), 0);
});

test('negative time keeps the alternation (floor/mod)', () => {
  assert.equal(crowdFrame(-1, BEAT, 1), 1);
  assert.equal(crowdFrame(-BEAT, BEAT, 1), 1);
  assert.equal(crowdFrame(-BEAT - 1, BEAT, 1), 0);
  assert.equal(crowdFrame(-3 * BEAT, BEAT, 1), 1);
});

test('0 (or negative) swaps pins frame 0', () => {
  for (const t of [-900, 0, 150, BEAT, 7 * BEAT]) {
    assert.equal(crowdFrame(t, BEAT, 0), 0);
    assert.equal(crowdFrame(t, BEAT, -1), 0);
  }
});

test('stateless: same time, same frame; one period apart is the same', () => {
  assert.equal(crowdFrame(1234, BEAT, 1), crowdFrame(1234, BEAT, 1));
  assert.equal(crowdFrame(1234, BEAT, 1), crowdFrame(1234 + 2 * BEAT, BEAT, 1));
});

test('configured default is one swap per beat', () => {
  assert.equal(CROWD_SWAPS_PER_BEAT, 1);
});
