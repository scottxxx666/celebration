import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, stageAt, stageBlend, stageThemeNames } from '../src/config/stages.js';
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

// First boundary whose theme differs from the previous stage's
const changeIndex = STAGES.findIndex((s, i) => i > 0 && s.theme !== STAGES[i - 1].theme);
const FADE_MS = 1000;

test('stageBlend: before a boundary is settled on the previous theme', () => {
  const prev = STAGES[changeIndex - 1].theme;
  const b = stageBlend(STAGES[changeIndex].startMs - 1, FADE_MS);
  assert.deepEqual(b, { from: prev, to: prev, t: 1 });
});

test('stageBlend: exactly at startMs the fade begins from the previous theme', () => {
  const b = stageBlend(STAGES[changeIndex].startMs, FADE_MS);
  assert.deepEqual(b, { from: STAGES[changeIndex - 1].theme, to: STAGES[changeIndex].theme, t: 0 });
});

test('stageBlend: mid-fade is halfway', () => {
  const b = stageBlend(STAGES[changeIndex].startMs + FADE_MS / 2, FADE_MS);
  assert.equal(b.from, STAGES[changeIndex - 1].theme);
  assert.equal(b.to, STAGES[changeIndex].theme);
  assert.ok(Math.abs(b.t - 0.5) < 1e-9);
});

test('stageBlend: at startMs + fadeMs the fade is done', () => {
  const { theme, startMs } = STAGES[changeIndex];
  assert.deepEqual(stageBlend(startMs + FADE_MS, FADE_MS), { from: theme, to: theme, t: 1 });
});

test('stageBlend: first stage (including negative song time) never fades', () => {
  const first = STAGES[0].theme;
  assert.deepEqual(stageBlend(0, FADE_MS), { from: first, to: first, t: 1 });
  assert.deepEqual(stageBlend(-250, FADE_MS), { from: first, to: first, t: 1 });
});

test('stageBlend: fadeMs 0 is a hard cut', () => {
  const { theme, startMs } = STAGES[changeIndex];
  assert.deepEqual(stageBlend(startMs, 0), { from: theme, to: theme, t: 1 });
});
