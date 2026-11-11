#!/usr/bin/env python3
"""Generate the suburb night road per docs/image-assets.md.

    uv run --with pillow python tools/gen-suburb-road.py [--preview DIR]

Writes public/assets/bg/road-suburb.png  1600x540  tiles left<->right, not vertically
and prints the seam check plus the top/bottom row average (paste the bottom into
SCENERY_THEMES.suburb.ground; pass the top to prep-scenery-image.py --horizon).

--preview also dumps an 800x450 in-game mock and the swapped-halves seam check to DIR.
Helpers (lerp, wrap_blur, wrapped, vgradient, noise_gray) come from gen-night-assets.py.
"""
import importlib.util
import math
import os
import random
import sys

from PIL import Image, ImageChops, ImageDraw

_HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location(
    "gen_night_assets", os.path.join(_HERE, "gen-night-assets.py"))
night = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(night)
lerp, wrap_blur, wrapped = night.lerp, night.wrap_blur, night.wrapped
vgradient, noise_gray = night.vgradient, night.noise_gray

W = night.W
ROAD_H = night.ROAD_H
NUM_LANES = night.NUM_LANES
LANE_H = night.LANE_H
ROOT = night.ROOT
OUT = night.OUT

ROAD_TOP = (30, 36, 40)
ROAD_BOTTOM = (54, 62, 66)

# Subtle curb: only a few levels above ROAD_TOP, so it hints at a kerb without
# drawing a light band under the houses (the scenery horizon fades into its top row)
CURB_H = 14
CURB_COLOR = (38, 44, 47)
CURB_LIP = (42, 48, 51)
CURB_JOINT_PERIOD = 200  # divides W
CURB_SHADOW_ALPHA = 60

PAINT = (200, 206, 204)
LINE_THICK = 6
DASH_PERIOD = 100  # divides W
DASH_LEN = 60


def over(base, layer):
    return Image.alpha_composite(base, layer)


def make_road():
    road = vgradient(W, ROAD_H, ROAD_TOP, ROAD_BOTTOM, ease=lambda t: t ** 0.9)

    # aggregate grain, overlay-blended around mid grey; fades toward the far edge
    for block, strength, seed in ((1, 0.30, 11), (2, 0.34, 1), (8, 0.22, 2), (20, 0.14, 3)):
        n = noise_gray(W, ROAD_H, block, seed)
        n = n.point(lambda v: 128 + (v - 128) // 3)
        n = wrap_blur(n.convert("RGB"), 0.6 if block <= 2 else 2.0)
        grainy = ImageChops.overlay(road, n)
        mask = Image.linear_gradient("L").resize((W, ROAD_H))
        mask = mask.point(lambda v, s=strength: int(v * s * 0.8 + 255 * s * 0.2))
        road = Image.composite(grainy, road, mask)
    road = road.convert("RGBA")

    # moonlit damp sheen: huge, soft, low-alpha cool patches
    sheen = Image.new("RGBA", (W, ROAD_H), (0, 0, 0, 0))

    def draw_sheen(d, dx):
        r = random.Random(501)
        for _ in range(7):
            cx = r.randrange(0, W) + dx
            cy = r.randrange(60, ROAD_H - 30)
            rw, rh = r.randrange(120, 260), r.randrange(30, 60)
            d.ellipse([cx - rw, cy - rh, cx + rw, cy + rh],
                      fill=(90, 140, 170, r.randrange(14, 24)))

    wrapped(draw_sheen, sheen)
    road = over(road, wrap_blur(sheen, 40.0))

    # stone chips: sparse light speckles, denser toward the far (top) edge
    chips = Image.new("RGBA", (W, ROAD_H), (0, 0, 0, 0))
    cd = ImageDraw.Draw(chips, "RGBA")
    r = random.Random(902)
    for _ in range(9000):
        x = r.randrange(0, W)
        y = int(ROAD_H * r.random() ** 0.8)
        if r.random() > 0.55 + 0.45 * (1 - y / ROAD_H):
            continue
        a = r.randrange(26, 70)
        cd.point((x, y), fill=(150, 175, 185, a))
        if r.random() < 0.3:
            cd.point(((x + 1) % W, y), fill=(150, 175, 185, a // 2))
    road = over(road, chips)

    # cracks: thin branching networks, alligator clusters in a few spots
    cracks = Image.new("RGBA", (W, ROAD_H), (0, 0, 0, 0))

    def branch(d, r, x, y, ang, depth, a):
        pts = [(x, y)]
        for _s in range(r.randrange(3, 7)):
            ang += r.uniform(-0.8, 0.8)
            ln = r.randrange(8, 34)
            x += math.cos(ang) * ln
            y += math.sin(ang) * ln * 0.45
            pts.append((x, y))
            if depth < 2 and r.random() < 0.35:
                branch(d, r, x, y, ang + r.choice((-1, 1)) * r.uniform(0.6, 1.3), depth + 1, a)
        d.line(pts, fill=(8, 10, 12, a), width=1)

    def draw_cracks(d, dx):
        r = random.Random(77)
        for _ in range(14):
            branch(d, r, r.randrange(0, W) + dx, r.randrange(40, ROAD_H - 10),
                   r.uniform(-0.5, 0.5), 0, r.randrange(40, 70))
        for cx, cy in ((260, 140), (900, 330), (1330, 470)):
            for _ in range(9):
                branch(d, r, cx + r.randrange(-60, 60) + dx, cy + r.randrange(-30, 30),
                       r.uniform(0, 6.28), 1, r.randrange(34, 60))

    wrapped(draw_cracks, cracks)
    road = over(road, wrap_blur(cracks, 0.5))

    # tar-sealed seams: wider soft dark squiggles
    tar = Image.new("RGBA", (W, ROAD_H), (0, 0, 0, 0))

    def draw_tar(d, dx):
        r = random.Random(333)
        for _ in range(5):
            x = r.randrange(0, W) + dx
            y = r.randrange(40, ROAD_H - 20)
            pts = [(x, y)]
            for _s in range(r.randrange(8, 14)):
                x += r.randrange(20, 50)
                y += r.randrange(-12, 12)
                pts.append((x, y))
            d.line(pts, fill=(8, 10, 12, 70), width=4, joint="curve")

    wrapped(draw_tar, tar)
    road = over(road, wrap_blur(tar, 1.6))

    # curb: faint concrete strip at the very top, soft gutter shadow below
    curb = Image.new("RGBA", (W, ROAD_H), (0, 0, 0, 0))
    cd = ImageDraw.Draw(curb)
    for y in range(CURB_H):
        cd.line([(0, y), (W, y)], fill=lerp(CURB_LIP, CURB_COLOR, y / (CURB_H - 1)) + (255,))
    for x in range(CURB_JOINT_PERIOD // 2, W, CURB_JOINT_PERIOD):
        cd.line([(x, 2), (x, CURB_H - 1)], fill=(26, 30, 33, 110), width=2)
    shadow = Image.new("RGBA", (W, ROAD_H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    for i in range(8):
        sd.line([(0, CURB_H + i), (W, CURB_H + i)],
                fill=(6, 8, 10, int(CURB_SHADOW_ALPHA * (1 - i / 8) ** 2)))
    road = over(road, wrap_blur(shadow, 1.2))
    road = over(road, curb)

    # lane dividers: dashed worn paint, eroded by noise so the asphalt shows through
    paint = Image.new("L", (W, ROAD_H), 0)
    pd = ImageDraw.Draw(paint)
    r = random.Random(808)
    start = (DASH_PERIOD - DASH_LEN) // 2
    for i in range(1, NUM_LANES):
        y = i * LANE_H
        for x0 in range(start, W, DASH_PERIOD):
            a = r.randrange(175, 235)
            pd.rectangle([x0, y - LINE_THICK // 2, x0 + DASH_LEN - 1, y + LINE_THICK // 2 - 1],
                         fill=a)
    wear = noise_gray(W, ROAD_H, 2, 61).point(lambda v: 100 + v * 155 // 255)
    wear2 = noise_gray(W, ROAD_H, 10, 62).point(lambda v: 150 + v * 105 // 255)
    paint = ImageChops.multiply(ImageChops.multiply(paint, wear), wear2)
    paint = paint.point(lambda v: min(255, v * 255 // 230))
    paint = wrap_blur(paint, 0.7)
    layer = Image.new("RGBA", (W, ROAD_H), PAINT + (0,))
    layer.putalpha(paint)
    road = over(road, layer)

    return road.convert("RGB")


def row_avg(im, y):
    px = [im.getpixel((x, y)) for x in range(im.width)]
    return tuple(round(sum(p[i] for p in px) / len(px)) for i in range(3))


def hex_of(rgb):
    return "0x%02x%02x%02x" % rgb


def seam_check(im, name):
    diff = max(max(abs(a[i] - b[i]) for i in range(3))
               for a, b in ((im.getpixel((0, y)), im.getpixel((im.width - 1, y)))
                            for y in range(im.height)))
    print(f"{name}: edge delta max {diff} (structural continuity, not equality)")


def write_preview(road, prev_dir):
    os.makedirs(prev_dir, exist_ok=True)
    scenery = Image.open(os.path.join(OUT, "scenery-suburb.png")).convert("RGB")
    prev = Image.new("RGB", (800, 450))
    prev.paste(scenery.resize((800, 180), Image.LANCZOS), (0, 0))
    prev.paste(road.resize((800, 270), Image.LANCZOS), (0, 180))
    d = ImageDraw.Draw(prev, "RGBA")
    for cx, cy, s in ((200, 214, 0.6), (330, 268, 0.7), (460, 322, 0.8),
                      (590, 376, 0.9), (700, 430, 1.0)):
        hw = 35 * s
        d.ellipse([cx - hw, cy - 8 * s, cx + hw, cy + 8 * s], fill=(0, 0, 0, 77))
        d.rectangle([cx - hw, cy - 2 * hw, cx + hw, cy], fill=(240, 90, 90))
    prev.save(os.path.join(prev_dir, "preview.png"))
    tile = Image.new("RGB", (W, ROAD_H))
    tile.paste(road.crop((W // 2, 0, W, ROAD_H)), (0, 0))
    tile.paste(road.crop((0, 0, W // 2, ROAD_H)), (W // 2, 0))
    tile.save(os.path.join(prev_dir, "seam-road.png"))
    road.save(os.path.join(prev_dir, "road-full.png"))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    road = make_road()
    road.save(os.path.join(OUT, "road-suburb.png"))
    seam_check(road, "road")
    print("top row", hex_of(row_avg(road, 0)), " bottom row", hex_of(row_avg(road, ROAD_H - 1)))
    if "--preview" in sys.argv:
        write_preview(road, sys.argv[sys.argv.index("--preview") + 1])
    print("wrote", OUT)
