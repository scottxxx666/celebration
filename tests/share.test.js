import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shareText, shareLink, sharePlatforms } from '../src/share.js';
import { LANGUAGES } from '../src/i18n.js';
import { SHARE_URL } from '../src/config/gameConfig.js';

const run = { won: true, score: 123, pct: 100, difficulty: 'hard' };

test('win text carries score and difficulty, then the link on its own line', () => {
  const text = shareText(run, 'en');
  assert.equal(text, `I cleared CELEBRATION in 123s on Hard!\n${SHARE_URL}`);
});

test('loss text carries score, percent and difficulty', () => {
  const text = shareText({ won: false, score: 45, pct: 31, difficulty: 'easy' }, 'en');
  assert.equal(text, `I survived 45s (31% of the song) in CELEBRATION on Easy!\n${SHARE_URL}`);
});

test('every language fills every placeholder, for win and loss', () => {
  for (const lang of Object.keys(LANGUAGES)) {
    for (const won of [true, false]) {
      const text = shareText({ won, score: 77, pct: 42, difficulty: 'normal' }, lang);
      assert.doesNotMatch(text, /[{}]/, `${lang} won=${won}`);
      assert.ok(text.includes('77'), `${lang} score`);
      assert.ok(text.endsWith(`\n${SHARE_URL}`), `${lang} link`);
    }
  }
});

test('zh-Hant uses the localised difficulty label', () => {
  assert.ok(shareText(run, 'zh-Hant').includes('困難'));
});

test('x and threads links use their intent endpoints', () => {
  const x = new URL(shareLink('x', 'hi'));
  assert.equal(x.host, 'twitter.com');
  assert.equal(x.pathname, '/intent/tweet');
  const th = new URL(shareLink('threads', 'hi'));
  assert.equal(th.host, 'www.threads.com');
  assert.equal(th.pathname, '/intent/post');
});

test('text round-trips through the link, including CJK, newline and reserved characters', () => {
  const text = '我撐了 77 秒 & 100% #1\nhttps://a.b/c?d=e';
  for (const platform of ['x', 'threads']) {
    const url = new URL(shareLink(platform, text));
    assert.equal([...url.searchParams.keys()].join(), 'text');
    assert.equal(url.searchParams.get('text'), text);
    assert.equal(url.hash, '');
  }
});

test('an unknown platform throws', () => {
  assert.throws(() => shareLink('myspace', 'hi'), /Unknown share platform/);
});

test('share row is one generic icon with the share sheet, brand icons without', () => {
  assert.deepEqual(sharePlatforms(true), ['sheet']);
  assert.deepEqual(sharePlatforms(false), ['x', 'threads', 'ig']);
});
