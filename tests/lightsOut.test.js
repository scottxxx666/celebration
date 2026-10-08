import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lightsOutAt } from '../src/config/sections.js';

// Round numbers so the grid points are exact: a 0.125-beat blink is 100 ms
const BEAT = 800;
const FADE = 60;
const at = (lightsOut, ms, fadeMs = FADE) => lightsOutAt(lightsOut, ms, BEAT, fadeMs);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} !== ${expected}`);

const SIMPLE = { lit: 1, dark: 1, reveal: 'shadows' };
// The dance_break shapes from sections.js: blinks at 0 and 200 ms then dark to
// 800; blinks at 0, 200 and 400 ms then dark to 1600
const TWO_BURSTS = { lit: 0.125, gap: 0.125, bursts: 2, dark: 0.625, reveal: 'silhouettes' };
const THREE_BURSTS = { lit: 0.125, gap: 0.125, bursts: 3, dark: 1.375 };

test('fully lit until the fade begins: alpha 0, no reveal', () => {
  assert.deepEqual(at(SIMPLE, 0), { alpha: 0, reveal: null, litMs: 0 });
  assert.deepEqual(at(SIMPLE, 739), { alpha: 0, reveal: null, litMs: 739 });
});

test('the fade ends on the grid point where the lit part ends', () => {
  near(at(SIMPLE, 740).alpha, 0);
  near(at(SIMPLE, 770).alpha, 0.5);
  near(at(SIMPLE, 799.9).alpha, 59.9 / 60);
  assert.equal(at(SIMPLE, 800).alpha, 1);
  assert.equal(at(SIMPLE, 1599).alpha, 1);
});

test('reveal is on from the start of the fade through the dark', () => {
  assert.equal(at(SIMPLE, 740).reveal, 'shadows');
  assert.equal(at(SIMPLE, 800).reveal, 'shadows');
  assert.equal(at(SIMPLE, 1599).reveal, 'shadows');
  assert.equal(at(THREE_BURSTS, 500).reveal, null); // none authored
});

test('litMs counts through the fade and ends with the lit part', () => {
  assert.equal(at(SIMPLE, 770).litMs, 770);
  assert.equal(at(SIMPLE, 800).litMs, null);
  assert.equal(at(SIMPLE, 1600).litMs, 0); // next cycle
});

test('the lights snap back on at the cycle wrap', () => {
  assert.deepEqual(at(SIMPLE, 1600), { alpha: 0, reveal: null, litMs: 0 });
});

test('a blink shorter than the fade fades over its whole length from alpha 0', () => {
  const short = { lit: 0.05, dark: 1 }; // 40 ms blink
  assert.equal(at(short, 0).alpha, 0);
  near(at(short, 20).alpha, 0.5);
  assert.equal(at(short, 40).alpha, 1);
});

test('lit: 0 stays black with its reveal, with no dip at cycle wraps', () => {
  const blackout = { lit: 0, dark: 1, reveal: 'silhouettes' };
  for (const ms of [0, 1, 400, 799.99, 800, 800.01, 1600, 2000]) {
    assert.deepEqual(at(blackout, ms), { alpha: 1, reveal: 'silhouettes', litMs: null });
  }
});

test('a zero fade snaps to black at the end of the lit part', () => {
  assert.equal(at(SIMPLE, 799, 0).alpha, 0);
  assert.equal(at(SIMPLE, 800, 0).alpha, 1);
});

test('bursts: every blink starts lit and is black by its own end', () => {
  for (const start of [0, 200]) {
    assert.deepEqual(at(TWO_BURSTS, start), { alpha: 0, reveal: null, litMs: 0 });
    near(at(TWO_BURSTS, start + 39).alpha, 0);
    near(at(TWO_BURSTS, start + 70).alpha, 0.5);
    assert.equal(at(TWO_BURSTS, start + 70).reveal, 'silhouettes');
    near(at(TWO_BURSTS, start + 70).litMs, 70);
    assert.equal(at(TWO_BURSTS, start + 100).alpha, 1);
    assert.equal(at(TWO_BURSTS, start + 100).litMs, null);
  }
  // the gap between the blinks is black
  assert.equal(at(TWO_BURSTS, 150).alpha, 1);
  assert.equal(at(TWO_BURSTS, 199).alpha, 1);
});

test('bursts: the last blink flows into the long dark, then the cycle wraps', () => {
  // black from the end of blink 2 (300 ms) to the wrap at 800 ms
  for (const ms of [300, 301, 400, 500, 799]) {
    assert.deepEqual(at(TWO_BURSTS, ms), { alpha: 1, reveal: 'silhouettes', litMs: null });
  }
  assert.deepEqual(at(TWO_BURSTS, 800), { alpha: 0, reveal: null, litMs: 0 });
  near(at(TWO_BURSTS, 870).alpha, 0.5);
  assert.equal(at(TWO_BURSTS, 1000).alpha, 0); // blink 2 of the second cycle
});

test('three bursts per two beats', () => {
  for (const start of [0, 200, 400, 1600]) {
    assert.equal(at(THREE_BURSTS, start).alpha, 0);
    assert.equal(at(THREE_BURSTS, start).litMs, 0);
    assert.equal(at(THREE_BURSTS, start + 100).alpha, 1);
  }
  // no fourth blink: 600 ms is inside the long dark
  for (const ms of [500, 600, 700, 1000, 1599]) {
    assert.equal(at(THREE_BURSTS, ms).alpha, 1);
    assert.equal(at(THREE_BURSTS, ms).litMs, null);
  }
});
