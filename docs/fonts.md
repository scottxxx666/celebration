# Bundled CJK fonts

Ko / Ja / Zh-Hans / Zh-Hant text uses self-hosted **Noto Sans** (region builds: KR, JP, SC, TC), subset to the characters the game shows, Regular (400) and Bold (700) each (bold is used by `TITLE_STYLE` and the ending message; italic is synthesised by the browser). English stays on Courier. System fonts remain in each stack as fallback (`LANGUAGES` in `src/i18n.js`), and `BootScene` loads the files through the CSS Font Loading API before the first scene builds text (`src/config/fonts.js` lists them; family names are `Celebration Noto XX` so an installed system Noto cannot collide).

## Source and license

- Source: https://github.com/notofonts/noto-cjk, tag `Sans2.004` (commit `523d033d6cb47f4a80c58a35753646f5c3608a78`), `Sans/SubsetOTF/{SC,TC,JP,KR}/NotoSans{SC,TC,JP,KR}-{Regular,Bold}.otf`.
- Copyright 2014-2021 Adobe (http://www.adobe.com/) (as recorded in the font's name table). Licensed under the SIL Open Font License 1.1; the text is in `public/assets/fonts/OFL.txt` (from `Sans/LICENSE` of that tag) and the copyright/license name records are kept in each subset.
- The multi-MB source OTFs are not committed.

## Regenerating

Needed after editing `src/config/strings.js` (any new character not already in the subset), a language label, or `FONT_FACES`:

```bash
# download the 8 OTFs from the tag above into any directory (or several), then:
uv run --with fonttools --with brotli python -I tools/subset-fonts.py --src DIR [--src DIR ...]
uv run --with fonttools --with brotli python -I tools/subset-fonts.py --check   # no sources needed
```

The charset per language is every value in `STRINGS[lang]`, its own `label`, printable ASCII and the UI glyphs listed in the script (`EXTRA`). Characters Noto itself lacks are written to `tools/ref/font-gaps.json` (currently none) and fall back to the system font. `--check` (also run by `yarn test:tools`) fails if a string uses a character missing from the committed subset.

Sizes (woff2): KR ~25 KB, JP ~37 KB, SC ~40 KB, TC ~46 KB per weight (~320 KB total).
