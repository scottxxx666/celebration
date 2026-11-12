#!/usr/bin/env python3
"""Generate the dim underground-underpass road + scenery pair per docs/image-assets.md.

    uv run --with pillow python tools/gen-underground-assets.py [--preview DIR]

Writes public/assets/bg/road-underground.png     1600x540  tiles left<->right, not vertically
       public/assets/bg/scenery-underground.png  1600x360  tiles left<->right

A neglected pedestrian underpass at night, a little scary: a long wall of
pale teal glazed tiles (stack bond, grout lines, stained and chipped) with a
rust-orange tile band at mid height, blue-grey pilaster strips, peeling paper
notices and a red warning sign, under a dark ceiling soffit with sparse cold
fluorescent fixtures — one of them dead, over a black side passage. Water
stains streak down from the ceiling, mould creeps up from a rust-red skirting
stripe, and low fog hangs near the floor. The road is grimy, damp concrete
slabs with dead leaves and grit; slab joints at y = 180 / 360 mark the rows.
Cold green-teal grade, crushed but not black.

Prints the seam checks and the edge-row hexes: scenery top row -> `sky`,
road bottom row -> `ground` in SCENERY_THEMES.underground. --preview also
dumps an 800x450 in-game mock and the swapped-halves seam checks to DIR.
Helpers come from gen-night-assets.py / gen-suburb-day-assets.py.
"""
import importlib.util
import math
import os
import random
import sys

from PIL import Image, ImageChops, ImageDraw

_HERE = os.path.dirname(os.path.abspath(__file__))


def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, os.path.join(_HERE, file))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


night = _load("gen_night_assets", "gen-night-assets.py")
day = _load("gen_suburb_day_assets", "gen-suburb-day-assets.py")
lerp, wrap_blur, wrapped = night.lerp, night.wrap_blur, night.wrapped
vgradient, noise_gray = night.vgradient, night.noise_gray
over = day.over
row_avg, hex_of, seam_check = day.row_avg, day.hex_of, day.seam_check

W = night.W
ROAD_H = night.ROAD_H
BG_H = night.BG_H
NUM_LANES = night.NUM_LANES
LANE_H = night.LANE_H
OUT = night.OUT

# ---------------------------------------------------------------- road
# damp grey-green concrete, mid-dark so a 30% black shadow still reads
ROAD_TOP = (26, 30, 29)
ROAD_BOTTOM = (40, 44, 42)
FLOOR_LIP = (16, 19, 18)        # road row 0 == scenery last row (grime at the wall base)
JOINT = (12, 14, 14)
STAIN = (10, 12, 12)
LEAF = (58, 46, 32)
SLAB_W = 200                    # divides W

# ------------------------------------------------------------ scenery
CEIL_H = 56                     # dark soffit band at the top
WALL_BOTTOM = 334               # skirting starts here
SKIRT_H = 14
TILE_W, TILE_H = 80, 28         # stack bond; TILE_W divides W
CEILING = (16, 20, 20)
TILE = (150, 178, 166)          # pale teal glaze (before lighting)
GROUT = (74, 92, 86)
RUST = (150, 72, 44)
PILASTER = (92, 128, 132)
SKIRT = (112, 44, 34)
PAPER = (196, 196, 178)
FOG = (70, 92, 86)

LAMPS = ((200, 0.8), (600, 0.55), (1000, 0.0), (1400, 0.7))  # (x, strength); 1000 is dead
PASSAGE = (930, 1070)           # dark side opening under the dead lamp
EDGE_ROWS = 3


def wrap_dx(a, b):
    d = abs(a - b) % W
    return min(d, W - d)


def grade(im):
    """Cold underpass grade: desaturated, green-teal cast, crushed but lifted blacks."""
    gray = im.convert("L").convert("RGB")
    im = Image.blend(im, gray, 0.25)
    lift, top = 4, 205
    lut = []
    for mult, add in ((0.88, 0), (1.0, 3), (0.98, 2)):
        for v in range(256):
            o = (lift + v * (top - lift) / 255) * mult + add
            lut.append(max(0, min(255, int(round(o)))))
    return im.point(lut)


# ---------------------------------------------------------------- road
def make_road():
    road = vgradient(W, ROAD_H, ROAD_TOP, ROAD_BOTTOM, ease=lambda t: t ** 0.8).convert("RGB")

    for block, strength, seed in ((2, 0.16, 401), (8, 0.10, 402), (40, 0.12, 403)):
        n = noise_gray(W, ROAD_H, block, seed).point(lambda v: 128 + (v - 128) // 3)
        n = wrap_blur(n.convert("RGB"), 1.0 if block <= 2 else 3.0 if block <= 8 else 14.0)
        road = Image.blend(road, ImageChops.overlay(road, n), strength)
    road = road.convert("RGBA")

    # damp stains and dried puddle rings, soft and flat
    stains = Image.new("RGBA", (W, ROAD_H), STAIN + (0,))

    def draw_stains(d, dx):
        r = random.Random(4101)
        for _ in range(22):
            cx, cy = r.randrange(0, W) + dx, r.randrange(20, ROAD_H - 10)
            rw, rh = r.randrange(40, 150), r.randrange(10, 34)
            d.ellipse([cx - rw, cy - rh, cx + rw, cy + rh], fill=STAIN + (r.randrange(22, 48),))

    wrapped(draw_stains, stains)
    road = over(road, wrap_blur(stains, 10.0))

    # slab joints: row lines at 180/360, staggered vertical joints per row
    joints = Image.new("RGBA", (W, ROAD_H), JOINT + (0,))

    def draw_joints(d, dx):
        for i in range(1, NUM_LANES):
            y = i * LANE_H
            d.line([(dx, y), (dx + W, y)], fill=JOINT + (150,), width=3)
            d.line([(dx, y + 2), (dx + W, y + 2)], fill=(110, 118, 110, 40), width=1)  # chipped lit edge
        for row in range(NUM_LANES):
            off = (row * SLAB_W // 2) % SLAB_W
            for x in range(off, W + SLAB_W, SLAB_W):
                d.line([(x + dx, row * LANE_H + 4), (x + dx, (row + 1) * LANE_H - 4)],
                       fill=JOINT + (90,), width=2)

    wrapped(draw_joints, joints)
    road = over(road, wrap_blur(joints, 0.8))

    cracks = Image.new("RGBA", (W, ROAD_H), (0, 0, 0, 0))

    def branch(d, r, x, y, ang, depth, a):
        pts = [(x, y)]
        for _s in range(r.randrange(3, 7)):
            ang += r.uniform(-0.7, 0.7)
            ln = r.randrange(10, 34)
            x += math.cos(ang) * ln
            y += math.sin(ang) * ln * 0.5
            pts.append((x, y))
            if depth < 1 and r.random() < 0.25:
                branch(d, r, x, y, ang + r.choice((-1, 1)) * r.uniform(0.6, 1.3), depth + 1, a)
        d.line(pts, fill=(24, 28, 26, a), width=1)

    def draw_cracks(d, dx):
        r = random.Random(4303)
        for _ in range(9):
            branch(d, r, r.randrange(0, W) + dx, r.randrange(30, ROAD_H - 10),
                   r.uniform(-0.5, 0.5), 0, r.randrange(70, 110))

    wrapped(draw_cracks, cracks)
    road = over(road, wrap_blur(cracks, 0.5))

    # dead leaves and grit: tiny, flat, low contrast — never obstacle-sized
    debris = Image.new("RGBA", (W, ROAD_H), LEAF + (0,))

    def draw_debris(d, dx):
        r = random.Random(4404)
        for _ in range(90):
            x, y = r.randrange(0, W) + dx, r.randrange(6, ROAD_H - 4)
            s = 1.5 + 3.5 * y / ROAD_H
            a = r.uniform(0, math.pi)
            pts = [(x + math.cos(a + k * math.pi / 2) * s * (1.6 if k % 2 == 0 else 0.7),
                    y + math.sin(a + k * math.pi / 2) * s * 0.5) for k in range(4)]
            d.polygon(pts, fill=(LEAF if r.random() < 0.7 else (40, 36, 30)) + (r.randrange(110, 170),))
        for _ in range(260):
            x, y = r.randrange(0, W) + dx, r.randrange(4, ROAD_H - 2)
            d.point((x, y), fill=(28, 30, 28, r.randrange(80, 150)))

    wrapped(draw_debris, debris)
    road = over(road, wrap_blur(debris, 0.5))

    # grime where the floor meets the wall: dark at row 0, fading down
    grime = Image.new("RGBA", (W, ROAD_H), FLOOR_LIP + (0,))
    gd = ImageDraw.Draw(grime)
    for y in range(60):
        gd.line([(0, y), (W, y)], fill=FLOOR_LIP + (int(255 * (1 - y / 60) ** 1.8),))
    road = over(road, grime)
    ImageDraw.Draw(road).line([(0, 0), (W, 0)], fill=FLOOR_LIP + (255,))
    return road.convert("RGB")


# ---------------------------------------------------------------- scenery
def light_map():
    """Wall illumination 0..1: cold pools under the live fixtures, deep
    darkness between them and under the dead one, darker toward the ceiling."""
    m = Image.new("L", (W, BG_H))
    px = m.load()
    for x in range(W):
        col = [0.0] * BG_H
        for lx, s in LAMPS:
            if s <= 0:
                continue
            dx = wrap_dx(x, lx)
            fx = math.exp(-(dx * dx) / (2 * 85.0 ** 2))
            for y in range(BG_H):
                dy = max(0, y - CEIL_H)
                col[y] += s * fx * (0.35 + 0.65 * math.exp(-dy / 70.0))
        for y in range(BG_H):
            v = 0.06 + 0.94 * min(1.0, col[y])
            if y < CEIL_H:
                v *= 0.35
            px[x, y] = int(255 * min(1.0, v))
    return wrap_blur(m, 4.0)


def make_wall():
    wall = Image.new("RGBA", (W, BG_H), TILE + (255,))
    d = ImageDraw.Draw(wall)
    r = random.Random(5101)
    rows = (WALL_BOTTOM - CEIL_H) // TILE_H
    band = rows // 2 - 1
    for row in range(rows):
        y0 = CEIL_H + row * TILE_H
        for c in range(W // TILE_W):
            x0 = c * TILE_W
            if row == band:
                base = RUST if r.random() < 0.78 else lerp(TILE, (180, 170, 150), 0.4)
            else:
                base = TILE
            col = lerp(base, (60, 70, 66), r.uniform(0.0, 0.22))
            d.rectangle([x0, y0, x0 + TILE_W - 1, y0 + TILE_H - 1], fill=col)
            d.line([(x0 + 2, y0 + 2), (x0 + TILE_W - 4, y0 + 2)], fill=lerp(col, (230, 240, 230), 0.25))  # glaze glint
    # thin vertical stripes in the row above the band (like the reference)
    sy = CEIL_H + (band - 1) * TILE_H
    for x in range(0, W, 16):
        d.line([(x + 6, sy + 4), (x + 6, sy + TILE_H - 5)], fill=lerp(TILE, RUST, 0.55), width=3)
    # grout
    for row in range(rows + 1):
        y = CEIL_H + row * TILE_H
        d.line([(0, y), (W, y)], fill=GROUT, width=2)
    for x in range(0, W, TILE_W):  # 1px each side of the joint, so x = 0 pairs with x = W - 1
        d.line([(x, CEIL_H), (x, WALL_BOTTOM)], fill=GROUT)
        d.line([((x - 1) % W, CEIL_H), ((x - 1) % W, WALL_BOTTOM)], fill=GROUT)
    # pilasters every 400px, offset from the lamps; drawn at x - W too so the one on the seam wraps
    for x in [p + dx for p in range(396, W, 400) for dx in (0, -W)]:
        d.rectangle([x - 9, CEIL_H, x + 9, WALL_BOTTOM], fill=PILASTER)
        d.line([(x - 9, CEIL_H), (x - 9, WALL_BOTTOM)], fill=lerp(PILASTER, (200, 220, 220), 0.3), width=2)
        d.line([(x + 9, CEIL_H), (x + 9, WALL_BOTTOM)], fill=lerp(PILASTER, (0, 0, 0), 0.45), width=2)
    # rust-red skirting stripe and dark base
    d.rectangle([0, WALL_BOTTOM, W, WALL_BOTTOM + SKIRT_H], fill=SKIRT)
    d.line([(0, WALL_BOTTOM), (W, WALL_BOTTOM)], fill=lerp(SKIRT, (0, 0, 0), 0.4), width=2)
    d.rectangle([0, WALL_BOTTOM + SKIRT_H, W, BG_H], fill=(52, 58, 54))
    # ceiling soffit
    d.rectangle([0, 0, W, CEIL_H - 1], fill=CEILING)
    d.line([(0, CEIL_H - 4), (W, CEIL_H - 4)], fill=(36, 42, 40), width=3)  # soffit edge
    return wall


def stains_layer():
    """Water streaks from the ceiling, rust bleeding from fixtures, mould from the floor."""
    layer = Image.new("RGBA", (W, BG_H), (40, 50, 40, 0))

    def draw(d, dx):
        r = random.Random(5202)
        for _ in range(70):
            x = r.randrange(0, W) + dx
            ln = r.randrange(30, 220)
            wd = r.choice((1, 2, 2, 3, 5))
            for k in range(0, ln, 3):
                a = int(r.randrange(40, 80) * (1 - k / ln))
                d.line([(x, CEIL_H + k), (x, CEIL_H + k + 3)], fill=(44, 52, 42, a), width=wd)
        for lx, _s in LAMPS:  # rust bleed under each fixture
            for j in range(5):
                x = lx + dx + r.randrange(-30, 30)
                ln = r.randrange(40, 120)
                for k in range(0, ln, 3):
                    d.line([(x, CEIL_H + k), (x, CEIL_H + k + 3)],
                           fill=(110, 60, 36, int(70 * (1 - k / ln))), width=2)
        for _ in range(40):  # mould blooms creeping up from the skirting
            x = r.randrange(0, W) + dx
            rw, rh = r.randrange(20, 70), r.randrange(10, 46)
            d.ellipse([x - rw, WALL_BOTTOM - rh, x + rw, WALL_BOTTOM + rh // 3],
                      fill=(36, 48, 34, r.randrange(20, 45)))

    wrapped(draw, layer)
    return wrap_blur(layer, 2.4)


def notices(d, dx):
    """Peeling paper notices and a rust-framed warning sign."""
    r = random.Random(5303)
    for x0, y0, w, h, tilt in ((470, 120, 34, 46, 0.05), (512, 132, 28, 38, -0.08),
                               (1290, 112, 30, 44, -0.04), (1330, 150, 26, 36, 0.10),
                               (160, 200, 28, 34, 0.06)):
        x0 += dx
        cx, cy = x0 + w / 2, y0 + h / 2
        corners = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2 - 8), (w / 2 - 8, h / 2), (-w / 2, h / 2)]
        pts = [(cx + px * math.cos(tilt) - py * math.sin(tilt), cy + px * math.sin(tilt) + py * math.cos(tilt))
               for px, py in corners]
        d.polygon(pts, fill=lerp(PAPER, (150, 150, 120), r.uniform(0, 0.4)) + (235,))
        for k in range(4, h - 10, 6):  # text lines
            ln = r.randrange(w // 3, w - 8)
            d.line([(x0 + 4, y0 + k), (x0 + 4 + ln, y0 + k + tilt * ln)], fill=(70, 70, 64, 150), width=1)
        d.rectangle([cx - 4, y0 - 2, cx + 4, y0 + 2], fill=(200, 200, 170, 140))  # tape
    # warning sign
    x0, y0 = 690 + dx, 96
    d.rectangle([x0, y0, x0 + 46, y0 + 66], fill=(130, 46, 34, 255))
    d.rectangle([x0 + 4, y0 + 4, x0 + 42, y0 + 62], fill=(190, 176, 150, 255))
    d.polygon([(x0 + 23, y0 + 10), (x0 + 37, y0 + 34), (x0 + 9, y0 + 34)], fill=(160, 60, 40, 255))
    for k in range(42, 58, 5):
        d.line([(x0 + 9, y0 + k), (x0 + 37, y0 + k)], fill=(80, 70, 60, 170), width=1)


def make_bg():
    wall = make_wall()
    wall = over(wall, stains_layer())
    details = Image.new("RGBA", (W, BG_H), PAPER + (0,))
    wrapped(notices, details)
    wall = over(wall, wrap_blur(details, 0.5))

    # dark side passage under the dead lamp: an opening into blackness
    pd = ImageDraw.Draw(wall)
    x0, x1 = PASSAGE
    pd.rectangle([x0 - 6, CEIL_H + 30, x1 + 6, WALL_BOTTOM + SKIRT_H], fill=(40, 48, 46))  # frame
    for y in range(CEIL_H + 36, BG_H):
        t = (y - CEIL_H - 36) / (BG_H - CEIL_H - 36)
        pd.line([(x0, y), (x1, y)], fill=lerp((6, 8, 8), (20, 26, 24), t ** 2))
    for k in range(5):  # faint stair edges deep in the dark
        y = WALL_BOTTOM - 8 - k * 14
        pd.line([(x0 + 20 + k * 6, y), (x1 - 20 - k * 6, y)], fill=(26, 32, 30), width=2)

    # lighting
    lit = light_map()
    black = Image.new("RGBA", (W, BG_H), (4, 6, 6, 255))
    wall = Image.composite(wall, black, lit)

    # fluorescent fixtures: glowing tubes on the soffit edge; the dead one is grey
    fx = Image.new("RGBA", (W, BG_H), (200, 240, 220, 0))

    def draw_fixtures(d, dx):
        for lx, s in LAMPS:
            x = lx + dx
            d.rectangle([x - 46, CEIL_H - 12, x + 46, CEIL_H - 4], fill=(30, 34, 34, 255))
            tube = (215, 245, 228) if s > 0 else (70, 76, 74)
            d.rectangle([x - 42, CEIL_H - 9, x + 42, CEIL_H - 6], fill=tube + (255,))

    wrapped(draw_fixtures, fx)
    glow = Image.new("RGBA", (W, BG_H), (170, 230, 210, 0))

    def draw_glow(d, dx):
        for lx, s in LAMPS:
            if s > 0:
                d.ellipse([lx + dx - 90, CEIL_H - 24, lx + dx + 90, CEIL_H + 14], fill=(170, 230, 210, int(110 * s)))

    wrapped(draw_glow, glow)
    wall = over(wall, wrap_blur(glow, 14.0))
    wall = over(wall, fx)

    # low fog drifting along the floor, thicker at the bottom
    fog = Image.new("RGBA", (W, BG_H), FOG + (0,))

    def draw_fog(d, dx):
        r = random.Random(5404)
        for _ in range(26):
            cx = r.randrange(0, W) + dx
            cy = r.randrange(250, 360)
            rw, rh = r.randrange(90, 240), r.randrange(20, 50)
            d.ellipse([cx - rw, cy - rh, cx + rw, cy + rh], fill=FOG + (r.randrange(20, 46),))

    wrapped(draw_fog, fog)
    wall = over(wall, wrap_blur(fog, 20.0))

    bg = wrap_blur(grade(wall.convert("RGB")), 0.6)

    # ceiling top rows flat so the sky fill above the strip has no seam
    fix = ImageDraw.Draw(bg)
    top = tuple(round(sum(c) / len(c)) for c in zip(*(bg.getpixel((x, 0)) for x in range(W))))
    for y in range(6):
        for x in range(W):
            fix.point((x, y), lerp(bg.getpixel((x, y)), top, 1 - y / 6))
    for i in range(EDGE_ROWS):
        y = BG_H - EDGE_ROWS + i
        t = (i + 1) / EDGE_ROWS
        for x in range(W):
            fix.point((x, y), fill=lerp(bg.getpixel((x, y)), FLOOR_LIP, t))
    return bg


def write_preview(road, bg, prev_dir):
    os.makedirs(prev_dir, exist_ok=True)
    day.write_preview(road, bg, prev_dir)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    road = make_road()
    bg = make_bg()
    road.save(os.path.join(OUT, "road-underground.png"))
    bg.save(os.path.join(OUT, "scenery-underground.png"))
    seam_check(road, "road")
    seam_check(bg, "scenery")
    print("sky (scenery top row)", hex_of(row_avg(bg, 0)),
          " ground (road bottom row)", hex_of(row_avg(road, ROAD_H - 1)))
    print("horizon: scenery bottom row", hex_of(row_avg(bg, BG_H - 1)),
          " road top row", hex_of(row_avg(road, 0)))
    if "--preview" in sys.argv:
        write_preview(road, bg, sys.argv[sys.argv.index("--preview") + 1])
