import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stationX } from '../src/stationBuilding.js';
import { wallX, WALL_OFFSCREEN_PAD } from '../src/wallBreak.js';
import {
  GAME_WIDTH, OBSTACLE_TIMING_SPEED, WALL_BREAK_MS, STATION_WIDTH, STATION_DEPTH, WALL_DEPTH, BIKE_DEPTH,
  STATION_DOOR_X, STATION_DOOR_W, STATION_CANOPY_OVERHANG,
} from '../src/config/gameConfig.js';

// Song time at which the wall's left edge is WALL_OFFSCREEN_PAD past the right screen edge
const enterMs = WALL_BREAK_MS - ((GAME_WIDTH + WALL_OFFSCREEN_PAD - wallX(WALL_BREAK_MS)) / OBSTACLE_TIMING_SPEED) * 1000;

test('stationX: hidden while still past the right edge', () => {
  assert.equal(stationX(enterMs - 1), null);
  assert.equal(stationX(0), null);
});

test('stationX: rides on the wall during the approach', () => {
  for (const ms of [enterMs + 1, WALL_BREAK_MS - 500, WALL_BREAK_MS - 1]) assert.equal(stationX(ms), wallX(ms));
});

test('stationX: gone from the impact on', () => {
  assert.equal(stationX(WALL_BREAK_MS), null);
  assert.equal(stationX(WALL_BREAK_MS + 2000), null);
});

test('the building always runs off the right screen edge while shown', () => {
  for (let ms = enterMs + 1; ms < WALL_BREAK_MS; ms += 10) {
    const x = stationX(ms);
    assert.ok(x + STATION_WIDTH >= GAME_WIDTH + WALL_OFFSCREEN_PAD, `right edge on-screen at ${ms}`);
  }
});

test('the entrance (canopy included) is on-screen by the impact', () => {
  const x = stationX(WALL_BREAK_MS - 1);
  assert.ok(x + STATION_DOOR_X - STATION_CANOPY_OVERHANG >= 0);
  assert.ok(x + STATION_DOOR_X + STATION_DOOR_W + STATION_CANOPY_OVERHANG <= GAME_WIDTH);
});

test('depth: above the scenery strips and bikes, below every row and the wall line', () => {
  assert.ok(STATION_DEPTH > -9.9 && STATION_DEPTH > BIKE_DEPTH);
  assert.ok(STATION_DEPTH < -6, 'below the disco dim, so it darkens with the world');
  assert.ok(STATION_DEPTH < -0.5 && STATION_DEPTH < WALL_DEPTH, 'below the back row\'s shadows and the wall');
});
