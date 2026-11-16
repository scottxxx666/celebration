import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES, DEFAULT_LANGUAGE, parseLanguage, detectLanguage, translate } from '../src/i18n.js';
import { STRINGS } from '../src/config/strings.js';
import { DIFFICULTY_IDS } from '../src/difficulty.js';

const IDS = Object.keys(LANGUAGES);
const KEYS = Object.keys(STRINGS.en).sort();
const placeholders = (text) => (text.match(/\{\w+\}/g) ?? []).sort();

test('the five languages, in picker order, each with a name and a font stack', () => {
  assert.deepEqual(IDS, ['en', 'ko', 'ja', 'zh-Hans', 'zh-Hant']);
  for (const id of IDS) {
    assert.ok(LANGUAGES[id].label, `${id} label`);
    assert.ok(LANGUAGES[id].font, `${id} font`);
  }
  assert.ok(IDS.includes(DEFAULT_LANGUAGE));
});

test('the string table has exactly the configured languages', () => {
  assert.deepEqual(Object.keys(STRINGS).sort(), [...IDS].sort());
});

test('every language has exactly the English key set, with no empty text', () => {
  for (const id of IDS) {
    assert.deepEqual(Object.keys(STRINGS[id]).sort(), KEYS, id);
    for (const key of KEYS) assert.ok(STRINGS[id][key].trim(), `${id} ${key}`);
  }
});

test('every translation keeps the placeholders of the English text', () => {
  for (const id of IDS) {
    for (const key of KEYS) {
      assert.deepEqual(placeholders(STRINGS[id][key]), placeholders(STRINGS.en[key]), `${id} ${key}`);
    }
  }
});

test('multi-line strings keep their line count, so layouts sized for English still fit', () => {
  for (const id of IDS) {
    for (const key of ['howTo.rows', 'howTo.run', 'warning.body']) {
      assert.equal(STRINGS[id][key].split('\n').length, STRINGS.en[key].split('\n').length, `${id} ${key}`);
    }
  }
});

test('every difficulty has a label and a caption string', () => {
  for (const id of DIFFICULTY_IDS) {
    assert.ok(STRINGS.en[`difficulty.${id}`], `${id} label`);
    assert.ok(STRINGS.en[`difficulty.${id}.caption`], `${id} caption`);
  }
});

test('parseLanguage keeps valid ids and rejects everything else', () => {
  for (const id of IDS) assert.equal(parseLanguage(id), id);
  for (const raw of [null, undefined, '', 'fr', 'EN', 'zh', 'zh-hant', 'zh-TW', 42, {}]) {
    assert.equal(parseLanguage(raw), null, String(raw));
  }
});

test('detectLanguage maps plain and regional tags', () => {
  assert.equal(detectLanguage(['en-US']), 'en');
  assert.equal(detectLanguage(['ko-KR']), 'ko');
  assert.equal(detectLanguage(['ja']), 'ja');
});

test('detectLanguage picks the Chinese script from the script subtag, then the region', () => {
  for (const tag of ['zh-TW', 'zh-HK', 'zh-MO', 'zh-Hant', 'zh-Hant-TW', 'zh-hant-hk']) {
    assert.equal(detectLanguage([tag]), 'zh-Hant', tag);
  }
  for (const tag of ['zh', 'zh-CN', 'zh-SG', 'zh-Hans', 'zh-Hans-CN']) {
    assert.equal(detectLanguage([tag]), 'zh-Hans', tag);
  }
  // an explicit script beats the region
  assert.equal(detectLanguage(['zh-Hans-TW']), 'zh-Hans');
  assert.equal(detectLanguage(['zh-Hant-CN']), 'zh-Hant');
});

test('detectLanguage takes the first supported tag in preference order', () => {
  assert.equal(detectLanguage(['fr-FR', 'ja-JP', 'en']), 'ja');
  assert.equal(detectLanguage(['zh-TW', 'en-US']), 'zh-Hant');
});

test('detectLanguage falls back to the default', () => {
  for (const tags of [undefined, null, [], ['fr'], ['de-DE', 'es'], [null, 42]]) {
    assert.equal(detectLanguage(tags), DEFAULT_LANGUAGE, JSON.stringify(tags));
  }
  // a prefix match must not fire: "kok" (Konkani) is not Korean
  assert.equal(detectLanguage(['kok']), DEFAULT_LANGUAGE);
});

test('translate returns the text of the requested language', () => {
  assert.equal(translate('en', 'menu.start'), 'Start');
  assert.equal(translate('zh-Hant', 'menu.start'), '開始');
});

test('translate fills placeholders and leaves unknown ones visible', () => {
  assert.equal(
    translate('en', 'gameOver.stats', { pct: 42, score: 7, difficulty: 'Hard' }),
    'Song progress: 42% · 7s · Hard'
  );
  assert.equal(translate('en', 'gameOver.stats', { pct: 0, score: 0 }), 'Song progress: 0% · 0s · {difficulty}');
});

test('translate falls back to English, then to the key', () => {
  assert.equal(translate('xx', 'menu.start'), 'Start');
  assert.equal(translate('ja', 'no.such.key'), 'no.such.key');
});
