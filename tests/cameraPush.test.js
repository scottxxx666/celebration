import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pushZoom } from '../src/cameraPush.js';
import { ZOOM_PUSH_IN_FRACTION } from '../src/config/gameConfig.js';
import { SECTIONS } from '../src/config/sections.js';

const BEAT_MS = 400;
const AMOUNT = 0.25;
const section = { zoomPush: { every: 1, amount: AMOUNT }, startMs: 10000, endMs: 10000 + BEAT_MS * 16 };
const zoomAt = (songMs, s = section) => pushZoom(s, songMs, BEAT_MS);
const CYCLE_MS = BEAT_MS;
const IN_START = CYCLE_MS * (1 - ZOOM_PUSH_IN_FRACTION);
const EPS = 0.5; // ms

test('IN fraction is a proper fraction', () => {
  assert.ok(ZOOM_PUSH_IN_FRACTION > 0 && ZOOM_PUSH_IN_FRACTION < 1);
});

test('no zoom outside the section or without the field', () => {
  assert.equal(zoomAt(section.startMs + IN_START + 10, { ...section, zoomPush: null }), 1);
  assert.equal(zoomAt(section.startMs + IN_START + 10, { startMs: section.startMs, endMs: section.endMs }), 1);
  assert.equal(zoomAt(section.startMs - 1), 1);
  assert.equal(zoomAt(section.endMs), 1);
});

test('cycle 0 holds exactly 1 through its out-phase, including the start', () => {
  for (let ms = 0; ms < IN_START; ms += 5) assert.equal(zoomAt(section.startMs + ms), 1);
});

test('the in-phase rises strictly and ends near 1 + amount just before each beat', () => {
  for (let cycle = 0; cycle < 16; cycle++) {
    const base = section.startMs + cycle * CYCLE_MS;
    let prev = 1;
    for (let ms = IN_START + 1; ms < CYCLE_MS; ms += 4) {
      const z = zoomAt(base + ms);
      assert.ok(z > prev, `cycle ${cycle} at ${ms}`);
      prev = z;
    }
    assert.ok(Math.abs(zoomAt(base + CYCLE_MS - EPS) - (1 + AMOUNT)) < 0.005, `cycle ${cycle}`);
  }
});

test('the out-phase starts at 1 + amount after a beat and falls strictly to 1', () => {
  for (let cycle = 1; cycle < 16; cycle++) {
    const base = section.startMs + cycle * CYCLE_MS;
    assert.ok(Math.abs(zoomAt(base + EPS) - (1 + AMOUNT)) < 0.005, `cycle ${cycle}`);
    let prev = Infinity;
    for (let ms = 0; ms < IN_START; ms += 4) {
      const z = zoomAt(base + ms);
      assert.ok(z < prev, `cycle ${cycle} at ${ms}`);
      prev = z;
    }
    assert.ok(Math.abs(zoomAt(base + IN_START - EPS) - 1) < 0.005, `cycle ${cycle}`);
  }
});

test('the zoom never leaves [1, 1 + amount]', () => {
  for (let ms = section.startMs; ms < section.endMs; ms += 3) {
    const z = zoomAt(ms);
    assert.ok(z >= 1 && z <= 1 + AMOUNT + 1e-9, `at ${ms}`);
  }
});

test('works for cycles longer than one beat', () => {
  const s = { zoomPush: { every: 4, amount: 0.1 }, startMs: 0, endMs: BEAT_MS * 32 };
  const cycleMs = BEAT_MS * 4;
  assert.equal(pushZoom(s, cycleMs * 0.5 - 1, BEAT_MS), 1);
  assert.ok(Math.abs(pushZoom(s, cycleMs * 2 - EPS, BEAT_MS) - 1.1) < 0.005);
  assert.ok(Math.abs(pushZoom(s, cycleMs * 2 + EPS, BEAT_MS) - 1.1) < 0.005);
  assert.ok(Math.abs(pushZoom(s, cycleMs * 2 + cycleMs * (1 - ZOOM_PUSH_IN_FRACTION) - EPS, BEAT_MS) - 1) < 0.005);
  for (let ms = 0; ms < s.endMs; ms += 7) {
    const z = pushZoom(s, ms, BEAT_MS);
    assert.ok(z >= 1 && z <= 1.1 + 1e-9);
  }
});

test('final_highlight2 pumps 25% every beat', () => {
  const s = SECTIONS.find(x => x.name === 'final_highlight2');
  assert.deepEqual(s.zoomPush, { every: 1, amount: 0.25 });
});
