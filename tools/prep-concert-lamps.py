#!/usr/bin/env python3
"""Post-process the AI concert stage so the pulse glow can relight it (docs/image-assets.md, "concert").

    python3 tools/prep-concert-lamps.py [public/assets/bg/scenery-concert.png] [--out PATH]

Run it on the output of tools/prep-scenery-image.py, in place by default. Three deterministic steps that
touch nothing else:

  1. The six LIT lamp lenses (lamp heads 0, 2, 3, 5, 7, 8 at x = 60 + 160 * i) are dimmed to a dull
     dark-glass look like the unlit heads, so at the pulse trough the lamps read as off and the additive
     glow images (lens + halo + hot core, tools/gen-concert-assets.py) light them up on the beat.
     Idempotent: only pixels still bright and saturated inside a lens ellipse are changed.
  2. The coloured haze the AI art paints around each lit lens is neutralised inside a bounded ellipse
     (HAZE_RX x HAZE_RY around the lens): pixels that are tinted in the lamp's hue are
     pulled to the median tone of the ring just outside the ellipse, held at the dark tone out to 80% of the radius, then released smoothly (cubic) so there is no disc edge. Grey
     metal, other hues and everything outside the ellipse stay byte-identical. Idempotent (clamps).
  3. The top row (and a short fade below it) is made exactly SKY, so `sky` in SCENERY_THEMES.concert
     equals the PNG's top row with no tolerance. Skipped when row 0 is already uniformly SKY.

--save-lit [PATH] first writes the ORIGINAL (lit) lens patches to PATH (default tools/ref/concert-lamps-lit.png,
committed): tools/gen-concert-assets.py takes the glow lens from `lit - dimmed` so the relit lens at the pulse
peak reproduces the AI lens exactly. Re-save it whenever a new AI stage is prepped (run on the un-dimmed input).

Needs pillow.
"""
import argparse
import colorsys
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
LIT_PATCHES = os.path.join(ROOT, "tools", "ref", "concert-lamps-lit.png")
PATCH_W, PATCH_H = 2 * LENS_RX + 1, 2 * LENS_RY + 1
LAMP_HUES = (312, 185, 312, 185, 275, 185)   # degrees, per LAMP_XS: magenta, cyan, magenta, cyan, purple, cyan
HAZE_RX, HAZE_RY = 34, 30                    # bounded haze ellipse around the lens (inside the gaps)
HAZE_HUE_TOL = 45
HAZE_MIN_SAT = 0.5                           # max-min over max: grey metal is below this
HAZE_TOL = 3                                 # tinted haze is pulled to within this of the surround tone
HAZE_BODY_HW = 17                            # half-width of the lamp body above the lens, never touched
HAZE_HOLD = 0.8                              # fraction of the radius held at the dark tone before the smooth release


def lens_box(lx):
    cx = lx + LENS_DX
    return cx - LENS_RX, LENS_CY - LENS_RY, cx + LENS_RX + 1, LENS_CY + LENS_RY + 1


def in_lens(x, y, cx):
    return ((x - cx) / LENS_RX) ** 2 + ((y - LENS_CY) / LENS_RY) ** 2 <= 1


def save_lit_patches(im, path):
    sheet = Image.new("RGB", (PATCH_W * len(LAMP_XS), PATCH_H))
    for i, lx in enumerate(LAMP_XS):
        sheet.paste(im.crop(lens_box(lx)), (i * PATCH_W, 0))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sheet.save(path)


def surround_tone(px, w, cx):
    """Median RGB of the ring just outside the haze ellipse: the tone the haze is pulled toward."""
    ring = []
    for y in range(LENS_CY - HAZE_RY - 4, LENS_CY + HAZE_RY + 5):
        for x in range(cx - HAZE_RX - 4, cx + HAZE_RX + 5):
            d = (((x - cx) / HAZE_RX) ** 2 + ((y - LENS_CY) / HAZE_RY) ** 2) ** 0.5
            if 1.03 <= d <= 1.15 and y >= 0:
                ring.append(px[x % w, y])
    return tuple(sorted(p[c] for p in ring)[len(ring) // 2] for c in range(3))


def neutralise_haze(im):
    px = im.load()
    w, h = im.size
    for lx, hue in zip(LAMP_XS, LAMP_HUES):
        cx = lx + LENS_DX
        tone = surround_tone(px, w, cx)
        for y in range(LENS_CY - HAZE_RY, LENS_CY + HAZE_RY + 1):
            for x in range(cx - HAZE_RX, cx + HAZE_RX + 1):
                d2 = ((x - cx) / HAZE_RX) ** 2 + ((y - LENS_CY) / HAZE_RY) ** 2
                if d2 >= 1 or in_lens(x, y, cx) or (abs(x - cx) <= HAZE_BODY_HW and y < LENS_CY + 4):
                    continue                 # (the lamp body sits right above the lens: leave it alone)
                p = px[x % w, y]
                mx, mn = max(p), min(p)
                if mx == 0 or (mx - mn) / mx < HAZE_MIN_SAT or mx > 130:
                    continue
                ph = colorsys.rgb_to_hsv(*(c / 255 for c in p))[0] * 360
                if min(abs(ph - hue), 360 - abs(ph - hue)) > HAZE_HUE_TOL:
                    continue
                t = max(0.0, min(1.0, (d2 ** 0.5 - HAZE_HOLD) / (1 - HAZE_HOLD)))   # 0 inside the hold radius, 1 at the edge
                tol = HAZE_TOL + 300 * t ** 3            # how far from the surround tone a pixel may stay
                dist = max(abs(a - b) for a, b in zip(p, tone))
                if dist <= tol + 1:
                    continue
                k = tol / dist
                px[x % w, y] = tuple(round(b + (a - b) * k) for a, b in zip(p, tone))


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


def prep(im, save_lit=None):
    im = im.convert("RGB")
    if save_lit:
        save_lit_patches(im, save_lit)
    neutralise_haze(im)
    dim_lenses(im)
    flatten_sky(im)
    return im


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("path", nargs="?", default=DEFAULT)
    ap.add_argument("--out")
    ap.add_argument("--save-lit", nargs="?", const=LIT_PATCHES, default=None)
    args = ap.parse_args()
    prep(Image.open(args.path), args.save_lit).save(args.out or args.path)
    print("wrote", args.out or args.path)
