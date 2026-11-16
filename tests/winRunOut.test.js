import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runOutX, runOutDone } from '../src/winRunOut.js';
import { GAME_WIDTH, PLAYER_X, WIN_RUNOUT_SPEED, WIN_RUNOUT_PAD } from '../src/config/gameConfig.js';

const exitMs = ((GAME_WIDTH + WIN_RUNOUT_PAD - PLAYER_X) / WIN_RUNOUT_SPEED) * 1000;

test('the run-out starts at the player position, so nothing jumps on the win frame', () => {
  assert.equal(runOutX(0), PLAYER_X);
  assert.equal(runOutDone(0), false);
});

test('the runner moves right at the run-out speed', () => {
  assert.equal(runOutX(1000), PLAYER_X + WIN_RUNOUT_SPEED);
  assert.ok(runOutX(200) > runOutX(100));
});

test('a negative elapsed time stays at the player position', () => {
  assert.equal(runOutX(-50), PLAYER_X);
});

test('the run-out is done only once the runner is past the right edge plus the pad', () => {
  assert.equal(runOutDone(exitMs - 1), false);
  assert.equal(runOutDone(exitMs), true);
  assert.equal(runOutDone(exitMs + 500), true);
  assert.ok(runOutX(exitMs - 1) > GAME_WIDTH, 'the pad keeps the sprite running past the edge itself');
});

test('the run-out speed can actually leave the screen', () => {
  assert.ok(WIN_RUNOUT_SPEED > 0);
});
