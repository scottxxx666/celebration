import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ghostFade, ghostOffset } from '../src/ghostWorld.js';
import { GHOST_FADE_MS, GHOST_OFFSET_X, GHOST_OFFSET_Y, GHOST_ON_BEATS, GHOST_OFF_BEATS } from '../src/config/gameConfig.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} !== ${expected}`);

const BEAT_MS = 500;
const ON_MS = GHOST_ON_BEATS * BEAT_MS;
const CYCLE_MS = ON_MS + GHOST_OFF_BEATS * BEAT_MS;
const section = { ghost: true, startMs: 10000, endMs: 10000 + CYCLE_MS * 4 };
const fadeAt = (songMs, s = section) => ghostFade(s, songMs, BEAT_MS);

test('a non-ghost section has no fade anywhere', () => {
  assert.equal(fadeAt(5000, { ghost: false, startMs: 0, endMs: 10000 }), 0);
});

test('fade is 0 before the section and ramps in from its start', () => {
  assert.equal(fadeAt(9000), 0);
  assert.equal(fadeAt(10000), 0);
  near(fadeAt(10000 + GHOST_FADE_MS / 2), 0.5);
  assert.equal(fadeAt(10000 + GHOST_FADE_MS), 1);
});

test('each pulse holds at 1, ramps out, then stays clear until the next one', () => {
  for (let pulse = 0; pulse < 4; pulse++) {
    const start = section.startMs + pulse * CYCLE_MS;
    assert.equal(fadeAt(start + ON_MS / 2), 1, `pulse ${pulse} middle`);
    near(fadeAt(start + ON_MS - GHOST_FADE_MS / 2), 0.5);
    assert.equal(fadeAt(start + ON_MS), 0, `pulse ${pulse} end`);
    assert.equal(fadeAt(start + ON_MS + (CYCLE_MS - ON_MS) / 2), 0, `pulse ${pulse} clear`);
  }
});

test('fade is 0 at/after the section end', () => {
  assert.equal(fadeAt(section.endMs), 0);
  assert.equal(fadeAt(section.endMs + 5000), 0);
});

test('a section ending mid-pulse ramps out before its end', () => {
  const cut = { ghost: true, startMs: 0, endMs: ON_MS / 2 };
  for (let t = 0; t <= cut.endMs; t += 10) {
    const limit = Math.min(t, cut.endMs - t) / GHOST_FADE_MS;
    assert.ok(fadeAt(t, cut) <= limit + 1e-9, `t=${t}`);
  }
  near(fadeAt(cut.endMs - GHOST_FADE_MS / 2, cut), 0.5);
});

test('ghosts are evenly spaced in angle around the orbit', () => {
  const count = 3;
  const angles = [0, 1, 2].map(i => {
    const o = ghostOffset(i, count, 0.1);
    return Math.atan2(o.y / GHOST_OFFSET_Y, o.x / GHOST_OFFSET_X);
  });
  near((angles[1] - angles[0] + 2 * Math.PI) % (2 * Math.PI), (2 * Math.PI) / count);
  near((angles[2] - angles[1] + 2 * Math.PI) % (2 * Math.PI), (2 * Math.PI) / count);
});

test('phase 0 and phase 1 give the same offset', () => {
  const a = ghostOffset(1, 2, 0);
  const b = ghostOffset(1, 2, 1);
  near(a.x, b.x);
  near(a.y, b.y);
  assert.equal(a.zoom, b.zoom);
});

test('offsets stay within the configured radii', () => {
  for (let phase = 0; phase <= 1; phase += 0.05) {
    for (let i = 0; i < 2; i++) {
      const o = ghostOffset(i, 2, phase);
      assert.ok(Math.abs(o.x) <= GHOST_OFFSET_X + 1e-9);
      assert.ok(Math.abs(o.y) <= GHOST_OFFSET_Y + 1e-9);
    }
  }
});

test('zoom grows with the ghost index', () => {
  assert.ok(ghostOffset(0, 3, 0).zoom > 0);
  assert.ok(ghostOffset(1, 3, 0).zoom > ghostOffset(0, 3, 0).zoom);
  assert.ok(ghostOffset(2, 3, 0).zoom > ghostOffset(1, 3, 0).zoom);
});
