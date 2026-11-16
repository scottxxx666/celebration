import { STRINGS } from './config/strings.js';

const STORAGE_KEY = 'celebration.language';

// `label` is the language's own name (shown on the picker); `font` its system
// font stack. Each CJK language lists its own fonts first: Han characters share
// code points across Japanese and both Chinese scripts but are drawn differently,
// so one shared stack would show the wrong regional glyphs. English keeps
// Phaser's default Courier, so its layouts are unchanged.
export const LANGUAGES = {
  en: { label: 'English', font: 'Courier' },
  ko: {
    label: '한국어',
    font: '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans CJK KR", "Noto Sans KR", sans-serif',
  },
  ja: {
    label: '日本語',
    font: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, "Noto Sans CJK JP", "Noto Sans JP", sans-serif',
  },
  'zh-Hans': {
    label: '简体中文',
    font: '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", sans-serif',
  },
  'zh-Hant': {
    label: '繁體中文',
    font: '"PingFang TC", "Microsoft JhengHei", "Noto Sans CJK TC", "Noto Sans TC", sans-serif',
  },
};
const IDS = Object.keys(LANGUAGES);

export const DEFAULT_LANGUAGE = 'en';

// A stored id, or null when it is missing or not one of ours.
export function parseLanguage(raw) {
  return IDS.includes(raw) ? raw : null;
}

const TRADITIONAL_REGIONS = ['tw', 'hk', 'mo'];

// Best match for the browser's preference list (navigator.languages, BCP 47
// tags, most preferred first). Chinese without a script subtag goes by region:
// Taiwan / Hong Kong / Macau are Traditional, everything else Simplified.
export function detectLanguage(tags) {
  for (const tag of tags ?? []) {
    if (typeof tag !== 'string') continue;
    const [primary, ...rest] = tag.toLowerCase().split('-');
    if (primary === 'en') return 'en';
    if (primary === 'ko') return 'ko';
    if (primary === 'ja') return 'ja';
    if (primary === 'zh') {
      if (rest.includes('hant')) return 'zh-Hant';
      if (rest.includes('hans')) return 'zh-Hans';
      return rest.some((part) => TRADITIONAL_REGIONS.includes(part)) ? 'zh-Hant' : 'zh-Hans';
    }
  }
  return DEFAULT_LANGUAGE;
}

// The text for `key` in `lang`, {name} placeholders filled from `params`.
// A key missing from a language falls back to English, then to the key itself.
export function translate(lang, key, params = {}) {
  const text = STRINGS[lang]?.[key] ?? STRINGS[DEFAULT_LANGUAGE][key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

// Chosen language, lazy-loaded into a module cache that is the read source of
// truth (same shape as difficulty.js). Until the player has picked one, the
// browser's preference stands in — `chosen` tells the two apart, so BootScene
// knows whether to show the picker.
let current = null;
let chosen = false;

function load() {
  if (current !== null) return;
  let saved = null;
  try {
    saved = parseLanguage(localStorage.getItem(STORAGE_KEY));
  } catch {
    // Safari private mode etc. — fall through to detection
  }
  chosen = saved !== null;
  current = saved ?? detectLanguage(globalThis.navigator?.languages);
}

export function getLanguage() {
  load();
  return current;
}

export function hasChosenLanguage() {
  load();
  return chosen;
}

export function setLanguage(id) {
  current = parseLanguage(id) ?? DEFAULT_LANGUAGE;
  chosen = true;
  try {
    localStorage.setItem(STORAGE_KEY, current);
  } catch {
    // the session cache still holds the choice
  }
  syncDocument();
}

export function t(key, params) {
  return translate(getLanguage(), key, params);
}

// Font stack for `lang` (default: the current language).
export function fontFor(lang = getLanguage()) {
  return LANGUAGES[lang].font;
}

// The page outside the canvas: <html lang> (which also steers the browser's own
// CJK fallback when none of a stack's fonts is installed) and the portrait
// "rotate your device" overlay in index.html. No-op in Node.
export function syncDocument() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = getLanguage();
  const overlay = document.getElementById('rotate-overlay');
  if (overlay) overlay.textContent = `↻ ${t('rotate')}`;
}
