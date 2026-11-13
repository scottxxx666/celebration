#!/usr/bin/env python3
"""Turn the raw AI station-building image into the shipped public/assets/station-building.png.

    uv run --with pillow python tools/prep-station-image.py raw-v3.png [--out public/assets/station-building.png]

The raw image is a Codex image-model restyle of a flat export of the old procedural StationBuilding (see
docs/image-assets.md, "Station building"): the model only emits 1536x1024, so the layout reference was stretched to
that size and the result is resized back here to the exact 2x size the game draws it at (STATION_WIDTH x
(STATION_BOTTOM - WALL_LINE_TOP) logical px, 1640x944). Then the dark flat plinth band along the bottom (and the flat
sand column in the doorway under it), which the model repainted as plain slabs, is weathered: fine grain, low-frequency
tonal variation, sand dust fading down from the band's top edge and a lighter worn kerb edge. The rest is untouched.
Finally the image is palette-quantised to keep the PNG small.

Generate the raw image from temp/station-ai/ (style.png = the weathered-concrete photo, layout-ref.png = the layout
stretched to 1536x1024, prompt.txt = the shipped prompt):

    codex exec --skip-git-repo-check --sandbox workspace-write -i style.png -i layout-ref.png < prompt.txt
"""
import argparse
import os
import random

from PIL import Image, ImageChops, ImageDraw, ImageFilter

# 2x of STATION_WIDTH x (STATION_BOTTOM - WALL_LINE_TOP) in src/config/gameConfig.js / src/stationBuilding.js
SIZE = (1640, 944)
SEED = 20240611
PLINTH_SEARCH_FROM = 780      # the band starts somewhere below this row (it starts at ~840 in the shipped render)
PLINTH_DARK_LUM = 110         # mean luminance (left of the doorway) under which a row counts as plinth
PLINTH_PROBE_X = (20, 280)
GRAIN_SIGMA = 7
TONE_SIGMA = 9
TONE_CELL = 36                # px per low-frequency tone cell
DUST_PX = 64                  # sand dust fades down from the top edge over this many rows
DUST_ALPHA = 0.75
DOOR_X = (300, 600)           # 2x x-range of the doorway, whose sand column gets no kerb
KERB_PX = 4                   # lighter worn edge along the band's top
COLORS = 192                  # palette size of the shipped PNG


def find_plinth_top(im):
    px = im.convert('L').load()
    x0, x1 = PLINTH_PROBE_X
    for y in range(PLINTH_SEARCH_FROM, im.height):
        if sum(px[x, y] for x in range(x0, x1)) / (x1 - x0) < PLINTH_DARK_LUM:
            return y
    raise SystemExit('could not find the dark plinth band; pass --plinth-top')


def noise_layer(size, sigma, cell=1):
    w, h = size
    if cell == 1:
        return Image.effect_noise(size, sigma).convert('RGB')
    small = Image.effect_noise((w // cell + 2, h // cell + 2), sigma)
    return small.resize((w, h), Image.BICUBIC).convert('RGB')


def add_noise(region, layer):
    return ImageChops.add(region, layer, 1, -128)


def weather_plinth(im, top):
    w, h = im.size
    bh = h - top
    region = im.crop((0, top, w, h))
    region = add_noise(region, noise_layer((w, bh), GRAIN_SIGMA))
    region = add_noise(region, noise_layer((w, bh), TONE_SIGMA, TONE_CELL))
    # Sand dust: the colour of the wall just above the band, smeared sideways, fading down from the top edge
    strip = im.crop((0, top - 16, w, top - 8)).filter(ImageFilter.GaussianBlur(14)).resize((w, 1), Image.BOX)
    dust = strip.resize((w, bh), Image.NEAREST)
    mask = Image.new('L', (w, bh), 0)
    md = ImageDraw.Draw(mask)
    for i in range(min(DUST_PX, bh)):
        md.line([(0, i), (w, i)], fill=round(255 * DUST_ALPHA * (1 - i / DUST_PX) ** 1.5))
    region = Image.composite(dust, region, mask)
    # Worn kerb edge: a lighter line with a ragged lower edge
    rnd = random.Random(SEED)
    d = ImageDraw.Draw(region)
    for x in range(w):
        if DOOR_X[0] <= x < DOOR_X[1]:
            continue
        t = KERB_PX + rnd.randint(-1, 1)
        lift = rnd.randint(18, 40)
        for y in range(t):
            r, g, b = region.getpixel((x, y))
            k = lift * (1 - y / t)
            d.point((x, y), fill=(min(255, int(r + k)), min(255, int(g + k * 0.95)), min(255, int(b + k * 0.85))))
    out = im.copy()
    out.paste(region, (0, top))
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('src', help='raw AI image (1536x1024)')
    ap.add_argument('--out', default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                                                  'public', 'assets', 'station-building.png'))
    ap.add_argument('--plinth-top', type=int, help='row where the plinth band starts (default: auto-detected)')
    ap.add_argument('--colors', type=int, default=COLORS)
    args = ap.parse_args()

    im = Image.open(args.src).convert('RGB').resize(SIZE, Image.LANCZOS)
    top = args.plinth_top or find_plinth_top(im)
    im = weather_plinth(im, top)
    im = im.quantize(args.colors, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG)
    im.save(args.out, optimize=True)
    print(f'wrote {args.out} {SIZE[0]}x{SIZE[1]}, plinth top row {top}, {os.path.getsize(args.out) // 1024} KB')


if __name__ == '__main__':
    main()
