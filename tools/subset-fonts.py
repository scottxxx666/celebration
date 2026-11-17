"""Subset the Noto Sans CJK region fonts to the characters the game shows.

Reads STRINGS, the language labels and FONT_FACES from src/ through node (the
one place they live), so rerunning after editing src/config/strings.js is all
it takes. Source fonts are NOT committed (several MB each): download the
Regular + Bold OTFs listed in docs/fonts.md into any directory and pass it.

  uv run --with fonttools --with brotli python -I tools/subset-fonts.py --src DIR [--src DIR ...]
  uv run --with fonttools --with brotli python -I tools/subset-fonts.py --check

--check needs no source fonts: it fails when a character a language shows is
missing from the committed subset, except the ones recorded in
tools/ref/font-gaps.json as absent from Noto itself (the system fallback
renders those; they are reported).
"""
import argparse
import json
import os
import subprocess
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_OUT = os.path.join(ROOT, 'public', 'assets', 'fonts')
GAPS_FILE = os.path.join(ROOT, 'tools', 'ref', 'font-gaps.json')

# Printable ASCII plus UI glyphs (menu arrows, hint separators, quotes) that
# are not necessarily in any string.
ASCII = {chr(c) for c in range(0x20, 0x7F)}
EXTRA = set('◀▶↑↓←→·…–—‘’“”「」『』、。，：；！？（）')

NODE_DUMP = """
import { STRINGS } from './src/config/strings.js';
import { LANGUAGES } from './src/i18n.js';
import { FONT_FACES } from './src/config/fonts.js';
const labels = Object.fromEntries(Object.entries(LANGUAGES).map(([k, v]) => [k, v.label]));
console.log(JSON.stringify({ strings: STRINGS, labels, faces: FONT_FACES }));
"""


def load_config(root=ROOT):
    out = subprocess.run(['node', '--input-type=module', '-e', NODE_DUMP],
                         cwd=root, check=True, capture_output=True, text=True).stdout
    return json.loads(out)


def needed_chars(cfg, lang):
    """Every character `lang` can draw in its own font: all its strings, its own
    name (the picker shows each language's label in its own font), printable
    ASCII and the UI glyphs. Newlines are layout."""
    chars = set(ASCII) | EXTRA | set(cfg['labels'][lang])
    for text in cfg['strings'][lang].values():
        chars |= set(text)
    chars.discard('\n')
    return chars


def cmap_of(path):
    font = TTFont(path, lazy=True)
    try:
        return set(chr(c) for c in font.getBestCmap())
    finally:
        font.close()


def subset_font(src, dst, chars):
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.hinting = False
    opts.layout_features = ['kern', 'palt', 'locl']
    opts.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]  # keep copyright + license
    font = TTFont(src)
    sub = subset.Subsetter(opts)
    sub.populate(text=''.join(sorted(chars)))
    sub.subset(font)
    font.flavor = 'woff2'
    font.save(dst)
    font.close()


def faces_by_lang(cfg):
    by = {}
    for face in cfg['faces']:
        by.setdefault(face['lang'], []).append(face)
    return by


def find_source(face, src_dirs):
    for d in src_dirs:
        p = os.path.join(d, face['source'])
        if os.path.isfile(p):
            return p
    raise SystemExit(f"source font {face['source']} not found in {src_dirs}")


def generate(cfg, src_dirs, out_dir=FONT_OUT, gaps_file=GAPS_FILE):
    os.makedirs(out_dir, exist_ok=True)
    gaps = {}
    for lang, faces in faces_by_lang(cfg).items():
        need = needed_chars(cfg, lang)
        missing = set()
        for face in faces:
            src = find_source(face, src_dirs)
            missing |= need - cmap_of(src)
        keep = need - missing
        for face in faces:
            dst = os.path.join(out_dir, face['file'])
            subset_font(find_source(face, src_dirs), dst, keep)
            print(f"{face['file']}: {os.path.getsize(dst)} bytes, {len(keep)} chars")
        gaps[lang] = ''.join(sorted(missing))
        if missing:
            print(f"  {lang}: not in Noto (system fallback): {gaps[lang]!r}")
    with open(gaps_file, 'w', encoding='utf-8') as f:
        json.dump(gaps, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write('\n')


def check(cfg, out_dir=FONT_OUT, gaps_file=GAPS_FILE):
    """Return (problems, reported): problems fail the check; reported are the
    known Noto gaps still needed by the strings."""
    gaps = {}
    if os.path.isfile(gaps_file):
        with open(gaps_file, encoding='utf-8') as f:
            gaps = json.load(f)
    problems, reported = [], []
    for lang, faces in faces_by_lang(cfg).items():
        need = needed_chars(cfg, lang)
        known = set(gaps.get(lang, ''))
        for face in faces:
            path = os.path.join(out_dir, face['file'])
            if not os.path.isfile(path):
                problems.append(f"{face['file']}: missing file")
                continue
            absent = need - cmap_of(path)
            bad = absent - known
            if bad:
                problems.append(f"{face['file']}: lacks {''.join(sorted(bad))!r} "
                                f"(rerun tools/subset-fonts.py --src ...)")
            if absent & known:
                reported.append(f"{lang}: {''.join(sorted(absent & known))!r} not in Noto")
    return problems, sorted(set(reported))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--src', action='append', default=[], help='directory holding source OTFs (repeatable)')
    ap.add_argument('--check', action='store_true', help='verify committed subsets cover every string')
    args = ap.parse_args(argv)
    cfg = load_config()
    if args.check:
        problems, reported = check(cfg)
        for line in reported:
            print('note:', line)
        for line in problems:
            print('FAIL:', line)
        return 1 if problems else 0
    if not args.src:
        ap.error('--src is required unless --check')
    generate(cfg, args.src)
    return 0


if __name__ == '__main__':
    sys.exit(main())
