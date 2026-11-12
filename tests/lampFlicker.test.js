import test from 'node:test';
import assert from 'node:assert/strict';
import { lampFlicker, firstCopyFromRight, copyScreenX } from '../src/lampFlicker.js';
import { LAMP_FLICKER_SLOTS_PER_BEAT } from '../src/config/gameConfig.js';

const BEAT = 398.5;
const SLOT = BEAT / LAMP_FLICKER_SLOTS_PER_BEAT;
const sweep = (fromMs, toMs, stepMs) => {
  const out = [];
  for (let t = fromMs; t < toMs; t += stepMs) out.push(lampFlicker(t, BEAT));
  return out;
};

test('stays within 0..1 over a long sweep', () => {
  for (const v of sweep(-5000, 300000, 7)) assert.ok(v >= 0 && v <= 1, String(v));
});

test('is deterministic', () => {
  assert.deepEqual(sweep(0, 20000, 13), sweep(0, 20000, 13));
});

test('is constant within a slot', () => {
  for (let slot = -50; slot < 2000; slot++) {
    const a = lampFlicker((slot + 0.05) * SLOT, BEAT);
    const b = lampFlicker((slot + 0.95) * SLOT, BEAT);
    assert.equal(a, b, `slot ${slot}`);
  }
});

test('is mostly off', () => {
  const values = sweep(0, 240000, SLOT);
  const onFraction = values.filter(v => v > 0).length / values.length;
  assert.ok(onFraction > 0.05 && onFraction < 0.35, `on fraction ${onFraction}`);
});

test('has bursts: some beat has at least 3 lit slots', () => {
  let found = false;
  for (let beat = 0; beat < 400 && !found; beat++) {
    let lit = 0;
    for (let s = 0; s < LAMP_FLICKER_SLOTS_PER_BEAT; s++) {
      if (lampFlicker((beat * LAMP_FLICKER_SLOTS_PER_BEAT + s + 0.5) * SLOT, BEAT) > 0) lit++;
    }
    found = lit >= 3;
  }
  assert.ok(found);
});

test('has dim blips outside bursts as well as bright burst levels', () => {
  const lit = sweep(0, 240000, SLOT).filter(v => v > 0);
  assert.ok(lit.some(v => v < 0.55));
  assert.ok(lit.some(v => v > 0.9));
});

test('handles negative song time', () => {
  for (const v of sweep(-60000, 0, 11)) assert.ok(Number.isFinite(v) && v >= 0 && v <= 1);
});

test('firstCopyFromRight: lamp lands at or past the right edge, previous copy before it', () => {
  const base = { stripLeft: -150, lampX: 1000, texWidth: 1600, scale: 0.5, rightEdge: 800 };
  for (const tilePositionX of [0, 1, 733.25, 1599.9, 1600, 98765.4321, -1, -5000.5, -123456.789]) {
    const k = firstCopyFromRight({ ...base, tilePositionX });
    assert.ok(Number.isInteger(k));
    const at = copy => copyScreenX({ ...base, tilePositionX, copy }) + base.lampX * base.scale;
    assert.ok(at(k) >= base.rightEdge, `tp ${tilePositionX}: ${at(k)}`);
    assert.ok(at(k - 1) < base.rightEdge, `tp ${tilePositionX}: ${at(k - 1)}`);
  }
});

test('copyScreenX: scrolling right-to-left by d texture px moves a copy left by d * scale', () => {
  const a = copyScreenX({ tilePositionX: 100, stripLeft: 10, texWidth: 1600, scale: 0.5, copy: 2 });
  const b = copyScreenX({ tilePositionX: 140, stripLeft: 10, texWidth: 1600, scale: 0.5, copy: 2 });
  assert.equal(a - b, 20);
  assert.equal(copyScreenX({ tilePositionX: 0, stripLeft: 10, texWidth: 1600, scale: 0.5, copy: 0 }), 10);
});
