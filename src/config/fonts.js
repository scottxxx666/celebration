// Bundled Noto Sans subsets for the CJK languages (see docs/fonts.md). The
// family names are deliberately not "Noto Sans XX" so an installed system Noto
// can never shadow them. tools/subset-fonts.py reads this table (via node) to
// know which source font feeds which file; BootScene loads every entry.
export const FONT_DIR = 'assets/fonts';

export const FONT_FACES = [
  { lang: 'ko', family: 'Celebration Noto KR', weight: '400', file: 'NotoSansKR-Regular.woff2', source: 'NotoSansKR-Regular.otf' },
  { lang: 'ko', family: 'Celebration Noto KR', weight: '700', file: 'NotoSansKR-Bold.woff2', source: 'NotoSansKR-Bold.otf' },
  { lang: 'ja', family: 'Celebration Noto JP', weight: '400', file: 'NotoSansJP-Regular.woff2', source: 'NotoSansJP-Regular.otf' },
  { lang: 'ja', family: 'Celebration Noto JP', weight: '700', file: 'NotoSansJP-Bold.woff2', source: 'NotoSansJP-Bold.otf' },
  { lang: 'zh-Hans', family: 'Celebration Noto SC', weight: '400', file: 'NotoSansSC-Regular.woff2', source: 'NotoSansSC-Regular.otf' },
  { lang: 'zh-Hans', family: 'Celebration Noto SC', weight: '700', file: 'NotoSansSC-Bold.woff2', source: 'NotoSansSC-Bold.otf' },
  { lang: 'zh-Hant', family: 'Celebration Noto TC', weight: '400', file: 'NotoSansTC-Regular.woff2', source: 'NotoSansTC-Regular.otf' },
  { lang: 'zh-Hant', family: 'Celebration Noto TC', weight: '700', file: 'NotoSansTC-Bold.woff2', source: 'NotoSansTC-Bold.otf' },
];

export function fontFamilyFor(lang) {
  return FONT_FACES.find((face) => face.lang === lang)?.family;
}
