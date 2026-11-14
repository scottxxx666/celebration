#!/usr/bin/env python3
"""Post-process the AI concert stage so the pulse glow can relight it (docs/image-assets.md, "concert").

    python3 tools/prep-concert-lamps.py [public/assets/bg/scenery-concert.png] [--out PATH]

Run it on the output of tools/prep-scenery-image.py, in place by default. Two deterministic steps that
touch nothing else:

  1. The six LIT lamp lenses (lamp heads 0, 2, 3, 5, 7, 8 at x = 60 + 160 * i) are dimmed to a dull
     dark-glass look like the unlit heads, so at the pulse trough the lamps read as off and the additive
     glow images (lens + halo + hot core, tools/gen-concert-assets.py) light them up on the beat.
     Idempotent: only pixels still bright and saturated inside a lens ellipse are changed.
  2. The top row (and a short fade below it) is made exactly SKY, so `sky` in SCENERY_THEMES.concert
     equals the PNG's top row with no tolerance. Skipped when row 0 is already uniformly SKY.

Needs pillow.
"""
import argparse
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT = os.path.join(ROOT, "public", "assets", "bg", "scenery-concert.png")

SKY = (0, 1, 3)                 # == SCENERY_THEMES.concert.sky (0x000103)
SKY_FADE_ROWS = 8
LAMP_XS = tuple(60 + 160 * i for i in (0, 2, 3, 5, 7, 8))
# Lens ellipse measured on the AI art: centre (lamp x + 1, 92), the saturated lens spans x -10..+13, y 85..100
LENS_DX, LENS_CY, LENS_RX, LENS_RY = 1, 92, 16, 11
DULL = (22, 24, 28)             # unlit-head glass tone


def dim_lenses(im):
    px = im.load()
    w, h = im.size
    for lx in LAMP_XS:
        cx = lx + LENS_DX
        for y in range(LENS_CY - LENS_RY, LENS_CY + LENS_RY + 1):
            for x in range(cx - LENS_RX, cx + LENS_RX + 1):
                if ((x - cx) / LENS_RX) ** 2 + ((y - LENS_CY) / LENS_RY) ** 2 > 1:
                    continue
                p = px[x % w, y]
                m = max(0.0, min(1.0, (max(p) - 45) / 20.0))     # how "lit" the pixel is
                if m == 0:
                    continue
                lum = sum(p) / 3
                tone = tuple(int(c + lum * 0.06) for c in DULL)
                px[x % w, y] = tuple(round(a + (b - a) * m) for a, b in zip(p, tone))


def flatten_sky(im):
    px = im.load()
    w, _ = im.size
    if all(px[x, 0] == SKY for x in range(w)):
        return
    for y in range(SKY_FADE_ROWS):
        t = 1 - y / SKY_FADE_ROWS
        for x in range(w):
            p = px[x, y]
            px[x, y] = SKY if y == 0 else tuple(round(a + (b - a) * t) for a, b in zip(p, SKY))


def prep(im):
    im = im.convert("RGB")
    dim_lenses(im)
    flatten_sky(im)
    return im


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("path", nargs="?", default=DEFAULT)
    ap.add_argument("--out")
    args = ap.parse_args()
    prep(Image.open(args.path)).save(args.out or args.path)
    print("wrote", args.out or args.path)
