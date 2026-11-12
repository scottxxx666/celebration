import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENERY_THEMES, multiplyColor } from '../src/config/sceneryThemes.js';

test('white tint is identity', () => {
  assert.equal(multiplyColor(0x123456, 0xffffff), 0x123456);
});

test('black tint gives black', () => {
  assert.equal(multiplyColor(0xffeedd, 0x000000), 0);
});

test('channels are independent', () => {
  assert.equal(multiplyColor(0xff8040, 0x808080), 0x804020);
  assert.equal(multiplyColor(0xffffff, 0xff0080), 0xff0080);
});

test('rounds to nearest', () => {
  // 1 * 128 / 255 = 0.50196 -> 1; 1 * 127 / 255 = 0.498 -> 0
  assert.equal(multiplyColor(0x010101, 0x808080), 0x010101);
  assert.equal(multiplyColor(0x010101, 0x7f7f7f), 0);
});

test('theme tints are valid colours', () => {
  for (const [name, theme] of Object.entries(SCENERY_THEMES)) {
    if (theme.tint === undefined) continue;
    assert.ok(Number.isInteger(theme.tint) && theme.tint >= 0 && theme.tint <= 0xffffff, name);
  }
});
