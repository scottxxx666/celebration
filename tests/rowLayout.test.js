import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rowLayout, rowBoundaryYs } from '../src/rowLayout.js';
import { NUM_ROWS, WALK_ZONE_TOP, GAME_HEIGHT } from '../src/config/gameConfig.js';

test('there is one divider between each pair of adjacent rows', () => {
  assert.equal(rowBoundaryYs().length, NUM_ROWS - 1);
});

test('each divider sits midway between the two row centres it separates', () => {
  rowBoundaryYs().forEach((y, i) => {
    assert.equal(y, (rowLayout(i).y + rowLayout(i + 1).y) / 2);
  });
});

test('dividers stay strictly inside the walk zone (no line on its outer edges)', () => {
  for (const y of rowBoundaryYs()) {
    assert.ok(y > WALK_ZONE_TOP && y < GAME_HEIGHT);
  }
});
