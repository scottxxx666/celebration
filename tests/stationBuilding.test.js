import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stationX, STATION_BOTTOM } from '../src/stationBuilding.js';
import { wallX, WALL_OFFSCREEN_PAD } from '../src/wallBreak.js';
import {
  GAME_WIDTH, GAME_HEIGHT, OBSTACLE_TIMING_SPEED, NUM_ROWS, PLAYER_X, STATION_PLINTH_HEIGHT, STATION_DOOR_TOP, WALL_BREAK_MS, STATION_WIDTH, STATION_DEPTH, WALL_DEPTH, BIKE_DEPTH,
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

test('depth: covers every row, its shadows and afterimages; below the wall line, strobe and HUD', () => {
  // rows (players, obstacles) draw at depth row, shadows at row - 0.5, afterimages at row - 0.25
  assert.ok(STATION_DEPTH > NUM_ROWS - 1, 'above the front row, so obstacles right of the wall are hidden');
  assert.ok(STATION_DEPTH < WALL_DEPTH, 'below the wall line, which is its left side');
  assert.ok(STATION_DEPTH > BIKE_DEPTH && STATION_DEPTH > -6, 'above the scenery, bikes and disco dim');
});

test('the front covers the whole road down past the screen bottom', () => {
  assert.ok(STATION_BOTTOM >= GAME_HEIGHT + WALL_OFFSCREEN_PAD);
  assert.ok(STATION_DOOR_TOP < GAME_HEIGHT - STATION_PLINTH_HEIGHT, 'the doorway sits above the plinth');
});

test('the runner is left of the wall for the whole approach', () => {
  // The building covers only what is right of its left edge, and the wall's left edge never passes the runner's
  // centre before the impact (camera shake / zoom move both alike)
  for (let ms = enterMs + 1; ms < WALL_BREAK_MS; ms += 10) assert.ok(stationX(ms) > PLAYER_X);
});
