import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, stageAt, stageThemeNames } from '../src/config/stages.js';
import { SCENERY_THEMES } from '../src/config/sceneryThemes.js';

test('stages are strictly ascending and start at 0', () => {
  assert.equal(STAGES[0].startMs, 0);
  for (let i = 1; i < STAGES.length; i++) {
    assert.ok(STAGES[i].startMs > STAGES[i - 1].startMs, `${STAGES[i].name} not after ${STAGES[i - 1].name}`);
  }
});

test('every stage theme is a complete SCENERY_THEMES entry', () => {
  for (const { name, theme } of STAGES) {
    const t = SCENERY_THEMES[theme];
    assert.ok(t, `${name}: unknown theme ${theme}`);
    for (const layer of ['road', 'scenery']) {
      assert.ok(t[layer].key && t[layer].file, `${name}: ${layer} needs key and file`);
    }
    assert.equal(typeof t.sky, 'number');
    assert.equal(typeof t.ground, 'number');
  }
});

test('negative song time (latency at run start) and 0 are the first stage', () => {
  assert.equal(stageAt(-250), STAGES[0]);
  assert.equal(stageAt(0), STAGES[0]);
});

test('each boundary: before is the previous stage, exactly at and after is the new one', () => {
  for (let i = 1; i < STAGES.length; i++) {
    const { startMs } = STAGES[i];
    assert.equal(stageAt(startMs - 1), STAGES[i - 1]);
    assert.equal(stageAt(startMs), STAGES[i]);
    assert.equal(stageAt(startMs + 1), STAGES[i]);
  }
});

test('past the song end stays on the last stage', () => {
  assert.equal(stageAt(10 * 60 * 1000), STAGES[STAGES.length - 1]);
});

test('stageThemeNames dedupes themes', () => {
  const names = stageThemeNames();
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(new Set(names), new Set(STAGES.map(s => s.theme)));
});
