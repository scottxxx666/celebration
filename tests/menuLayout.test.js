import { test } from 'node:test';
import assert from 'node:assert/strict';
import { menuRowLayout, MENU_ROW_SPACING, MENU_CAPTION_OFFSET } from '../src/menuLayout.js';

const DIFFICULTY_ROW = 1;
const rows = [0, 1, 2].map((i) => menuRowLayout(i, DIFFICULTY_ROW));
const top = (r) => r.zoneY - r.zoneHeight / 2;
const bottom = (r) => r.zoneY + r.zoneHeight / 2;

test('touch zones tile: each ends exactly where the next begins', () => {
  assert.equal(bottom(rows[0]), top(rows[1]));
  assert.equal(bottom(rows[1]), top(rows[2]));
});

test('every zone has at least a full row of height around its label', () => {
  for (const r of rows) {
    assert.ok(r.y - top(r) >= MENU_ROW_SPACING / 2);
    assert.ok(bottom(r) - r.y >= MENU_ROW_SPACING / 2);
  }
});

test('the difficulty zone reaches past its caption, the others stay one row tall', () => {
  assert.ok(bottom(rows[DIFFICULTY_ROW]) > rows[DIFFICULTY_ROW].y + MENU_CAPTION_OFFSET);
  assert.equal(rows[0].zoneHeight, MENU_ROW_SPACING);
  assert.equal(rows[2].zoneHeight, MENU_ROW_SPACING);
});

test('rows below the difficulty row are pushed down to clear the caption', () => {
  assert.ok(rows[2].y - rows[1].y > MENU_ROW_SPACING);
  assert.equal(rows[1].y - rows[0].y, MENU_ROW_SPACING);
});
