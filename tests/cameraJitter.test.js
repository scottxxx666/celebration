import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jitterOffset } from '../src/cameraJitter.js';
import { dancePose } from '../src/cameraDance.js';
import {
  JITTER_KICKS_PER_BEAT, JITTER_PX, JITTER_DECAY_MS, DANCE_STEPS_PER_BEAT, DANCE_COMBO_START,
} from '../src/config/gameConfig.js';
import { SECTIONS } from '../src/config/sections.js';

const BEAT_MS = 400;
const KICK_MS = BEAT_MS / JITTER_KICKS_PER_BEAT;
const section = { jitter: true, startMs: 10000, endMs: 10000 + KICK_MS * 64 };
const offsetAt = (songMs, s = section) => jitterOffset(s, songMs, BEAT_MS);

test('the shake finishes before the next kick', () => {
  assert.ok(JITTER_DECAY_MS < KICK_MS);
});

test('no offset outside a jitter section', () => {
  assert.deepEqual(offsetAt(section.startMs + 5, { ...section, jitter: false }), { x: 0, y: 0 });
  assert.deepEqual(offsetAt(section.startMs - 1), { x: 0, y: 0 });
  assert.deepEqual(offsetAt(section.endMs), { x: 0, y: 0 });
});

test('each kick shakes within JITTER_PX, then holds still until the next', () => {
  for (let kick = 0; kick < 64; kick++) {
    let moved = false;
    for (let ms = 0; ms < KICK_MS; ms += 7) {
      const offset = offsetAt(section.startMs + kick * KICK_MS + ms);
      assert.ok(Math.abs(offset.x) <= JITTER_PX && Math.abs(offset.y) <= JITTER_PX);
      if (ms >= JITTER_DECAY_MS) assert.ok(offset.x === 0 && offset.y === 0); // === so a -0 offset passes
      moved ||= offset.x !== 0 || offset.y !== 0;
    }
    assert.ok(moved, `kick ${kick}`);
  }
});

test('the offset is a pure function of song time and the run seed', () => {
  const ms = section.startMs + 7 * KICK_MS + 33;
  assert.deepEqual(offsetAt(ms), offsetAt(ms));
  assert.deepEqual(jitterOffset(section, ms, BEAT_MS, 123.4), jitterOffset(section, ms, BEAT_MS, 123.4));
  assert.notDeepEqual(jitterOffset(section, ms, BEAT_MS, 12.34), jitterOffset(section, ms, BEAT_MS, 567.8));
});

test('works without dance, and leaves the dance pose alone', () => {
  const ms = section.startMs + 3 * KICK_MS + 14;
  assert.deepEqual(dancePose(section, ms, BEAT_MS), { rotation: 0, x: 0, y: 0, zoom: 1 });
  assert.notDeepEqual(offsetAt(ms), { x: 0, y: 0 });
});

test("in a section with both, the shake is over before the combo's head shake starts", () => {
  if (!SECTIONS.some(s => s.jitter && s.dance === 'combo')) return;
  assert.ok(JITTER_DECAY_MS <= BEAT_MS / DANCE_STEPS_PER_BEAT * DANCE_COMBO_START);
});
