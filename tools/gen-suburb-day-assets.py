#!/usr/bin/env python3
"""Generate the daytime suburb road + scenery pair per docs/image-assets.md.

    uv run --with pillow python tools/gen-suburb-day-assets.py [--preview DIR]

Writes public/assets/bg/road-suburb-day.png     1600x540  tiles left<->right, not vertically

The scenery drawn here is NOT shipped: it is the layout reference given to the
AI image model, whose output (prepped) is the shipped scenery-suburb-day.png
(docs/image-assets.md). --preview writes it to DIR/scenery-full.png.

The same street as the night `suburb` theme (scenery-suburb.png), on a sunny
afternoon: a row of two-storey gabled houses in weathered wood siding and
stucco, porches and garage doors, big leafy trees between them, hazy low hills
behind, blue sky with soft cumulus; wooden plank fences, black cast-iron lamp
posts, lawn + sidewalk + grass verge meeting the road's curb. Flat cel shading,
light from the upper left, a warm, gently desaturated grade, no grain.

Prints the seam checks and the edge-row hexes: scenery top row -> `sky`, road
bottom row -> `ground` in SCENERY_THEMES.suburbDay (`sky` comes from the
prep script run on the AI scenery). --preview also dumps an
800x450 in-game mock and the swapped-halves seam checks to DIR.
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
BG_H = night.BG_H
NUM_LANES = night.NUM_LANES
LANE_H = night.LANE_H
OUT = night.OUT

# ---------------------------------------------------------------- road
# pale sun-bleached warm grey, but still mid value so a 30% black shadow reads
ROAD_TOP = (128, 125, 118)
ROAD_BOTTOM = (146, 141, 131)

# light concrete curb in the top CURB_H rows: kerb top, then its darker face.
# Row 0 is exactly CURB_LIP, which the scenery's bottom row fades into.
CURB_H = 14
CURB_LIP = (196, 192, 180)
CURB_TOP = (186, 182, 170)
CURB_FACE = (150, 146, 136)
CURB_FACE_H = 5
CURB_JOINT_PERIOD = 200  # divides W
CURB_SHADOW_ALPHA = 70

PAINT = (236, 232, 218)
LINE_THICK = 6
DASH_PERIOD = 100  # divides W
DASH_LEN = 60

# ------------------------------------------------------------ scenery
SKY_TOP = (112, 158, 198)
SKY_HORIZON = (196, 212, 214)
CLOUD = (246, 247, 244)
CLOUD_SHADE = (214, 222, 228)
CLOUD_DEEP = (194, 206, 216)
HAZE = (190, 206, 210)
HILL_FAR = (150, 172, 178)
HILL_NEAR = (126, 150, 140)

TRIM = (232, 230, 220)
TRIM_SHADE = (196, 196, 188)
ROOF = (104, 106, 110)
ROOF_LINE = (84, 86, 90)
ROOF_LIGHT = (128, 130, 132)
GLASS = (80, 98, 112)
GLASS_HI = (176, 196, 206)
DOOR = (96, 72, 56)
GARAGE = (204, 204, 196)
GARAGE_SHADE = (172, 172, 166)
LANTERN = (38, 40, 42)
SHUTTER = (78, 90, 96)

SIDING_GREY = (150, 150, 144)       # weathered wood
SIDING_YELLOW = (170, 166, 108)     # muted yellow-green
STUCCO = (200, 192, 174)            # warm cream stucco
STUCCO_GREY = (178, 180, 176)

LEAF_DARK = (56, 84, 48)
LEAF = (86, 116, 58)
LEAF_LIGHT = (138, 160, 78)
BARK = (92, 82, 72)

PLANK = (150, 118, 86)
PLANK_SHADE = (124, 96, 70)
GRASS = (104, 132, 66)
GRASS_SHADE = (88, 114, 56)
VERGE = (114, 144, 70)
WALK = (204, 200, 188)
WALK_SHADE = (180, 176, 164)
IRON = (34, 36, 38)
IRON_HI = (82, 86, 90)

GY = 330           # house base line
LAWN_TOP = 326     # front lawn band
WALK_TOP = 338     # sidewalk
VERGE_TOP = 350    # grass verge
EDGE_ROWS = 3      # last rows fade into CURB_LIP (last row exact)


def over(base, layer):
    return Image.alpha_composite(base, layer)


def hazed(layer, col, a):
    """Pull a layer toward the haze colour by a/255, keeping its alpha."""
    tint = Image.new("RGBA", layer.size, col + (0,))
    tint.putalpha(layer.getchannel("A").point(lambda v: v * a // 255))
    return over(layer, tint)


def grade(im):
    """Clean cinematic grade: a little desaturation, slightly lifted blacks,
    warm cast (red up, blue down a touch). No grain."""
    gray = im.convert("L").convert("RGB")
    im = Image.blend(im, gray, 0.12)
    lift, top = 14, 248
    lut = []
    for mult, add in ((1.0, 5), (1.0, 2), (0.97, 0)):
        for v in range(256):
            o = (lift + v * (top - lift) / 255) * mult + add
            lut.append(max(0, min(255, int(round(o)))))
    return im.point(lut)


# ---------------------------------------------------------------- road
def make_road():
    road = vgradient(W, ROAD_H, ROAD_TOP, ROAD_BOTTOM, ease=lambda t: t ** 0.9)

    # aggregate grain, overlay-blended around mid grey: soft, never speckly
    for block, strength, seed in ((2, 0.20, 101), (8, 0.18, 102), (20, 0.14, 103)):
        n = noise_gray(W, ROAD_H, block, seed)
        n = n.point(lambda v: 128 + (v - 128) // 3)
        n = wrap_blur(n.convert("RGB"), 1.0 if block <= 2 else 2.4)
        grainy = ImageChops.overlay(road, n)
        mask = Image.linear_gradient("L").resize((W, ROAD_H))
        mask = mask.point(lambda v, s=strength: int(v * s * 0.8 + 255 * s * 0.2))
        road = Image.composite(grainy, road, mask)
    road = road.convert("RGBA")

    # sun-bleached and stained areas: big, very soft blotches
    patches = Image.new("RGBA", (W, ROAD_H), (0, 0, 0, 0))

    def draw_patches(d, dx):
        r = random.Random(1501)
        for _ in range(9):
            cx = r.randrange(0, W) + dx
            cy = r.randrange(50, ROAD_H - 30)
            rw, rh = r.randrange(120, 260), r.randrange(28, 60)
            col = (176, 170, 156) if r.random() < 0.6 else (88, 84, 78)
            d.ellipse([cx - rw, cy - rh, cx + rw, cy + rh], fill=col + (r.randrange(12, 22),))

    wrapped(draw_patches, patches)
    road = over(road, wrap_blur(patches, 36.0))

    # repair patches: slightly darker squarish asphalt fills with soft edges
    repairs = Image.new("RGBA", (W, ROAD_H), (0, 0, 0, 0))

    def draw_repairs(d, dx):
        r = random.Random(1611)
        for _ in range(5):
            x = r.randrange(0, W) + dx
            y = r.randrange(60, ROAD_H - 60)
            w, h = r.randrange(60, 150), r.randrange(20, 46)
            d.rectangle([x, y, x + w, y + h], fill=(96, 92, 86, 34))

    wrapped(draw_repairs, repairs)
    road = over(road, wrap_blur(repairs, 3.5))

    # cracks: fine branching lines, alligator clusters in a few spots
    cracks = Image.new("RGBA", (W, ROAD_H), (0, 0, 0, 0))

    def branch(d, r, x, y, ang, depth, a):
        pts = [(x, y)]
        for _s in range(r.randrange(3, 7)):
            ang += r.uniform(-0.8, 0.8)
            ln = r.randrange(8, 34)
            x += math.cos(ang) * ln
            y += math.sin(ang) * ln * 0.45
            pts.append((x, y))
            if depth < 2 and r.random() < 0.3:
                branch(d, r, x, y, ang + r.choice((-1, 1)) * r.uniform(0.6, 1.3), depth + 1, a)
        d.line(pts, fill=(62, 60, 56, a), width=1)

    def draw_cracks(d, dx):
        r = random.Random(1077)
        for _ in range(16):
            branch(d, r, r.randrange(0, W) + dx, r.randrange(40, ROAD_H - 10),
                   r.uniform(-0.5, 0.5), 0, r.randrange(40, 64))
        for cx, cy in ((420, 300), (1180, 160)):
            for _ in range(7):
                branch(d, r, cx + r.randrange(-50, 50) + dx, cy + r.randrange(-24, 24),
                       r.uniform(0, 6.28), 1, r.randrange(30, 50))

    wrapped(draw_cracks, cracks)
    road = over(road, wrap_blur(cracks, 0.5))

    # tar-sealed seams: soft darker squiggles
    tar = Image.new("RGBA", (W, ROAD_H), (0, 0, 0, 0))

    def draw_tar(d, dx):
        r = random.Random(1333)
        for _ in range(5):
            x = r.randrange(0, W) + dx
            y = r.randrange(40, ROAD_H - 20)
            pts = [(x, y)]
            for _s in range(r.randrange(8, 14)):
                x += r.randrange(20, 50)
                y += r.randrange(-12, 12)
                pts.append((x, y))
            d.line(pts, fill=(70, 66, 60, 56), width=4, joint="curve")

    wrapped(draw_tar, tar)
    road = over(road, wrap_blur(tar, 1.6))

    # curb: light kerb top, darker kerb face, gutter shadow below
    shadow = Image.new("RGBA", (W, ROAD_H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    for i in range(10):
        sd.line([(0, CURB_H + i), (W, CURB_H + i)],
                fill=(30, 28, 24, int(CURB_SHADOW_ALPHA * (1 - i / 10) ** 2)))
    road = over(road, wrap_blur(shadow, 1.2))
    curb = Image.new("RGBA", (W, ROAD_H), (0, 0, 0, 0))
    cd = ImageDraw.Draw(curb)
    top_h = CURB_H - CURB_FACE_H
    for y in range(top_h):
        cd.line([(0, y), (W, y)], fill=lerp(CURB_LIP, CURB_TOP, y / (top_h - 1)) + (255,))
    for y in range(top_h, CURB_H):
        cd.line([(0, y), (W, y)], fill=CURB_FACE + (255,))
    for x in range(CURB_JOINT_PERIOD // 2, W, CURB_JOINT_PERIOD):
        cd.line([(x, 2), (x, CURB_H - 1)], fill=(140, 136, 126, 255), width=2)
    road = over(road, curb)

    # lane dividers: dashed worn paint, eroded by noise so the asphalt shows through
    paint = Image.new("L", (W, ROAD_H), 0)
    pd = ImageDraw.Draw(paint)
    r = random.Random(1808)
    start = (DASH_PERIOD - DASH_LEN) // 2
    for i in range(1, NUM_LANES):
        y = i * LANE_H
        for x0 in range(start, W, DASH_PERIOD):
            a = r.randrange(160, 215)
            pd.rectangle([x0, y - LINE_THICK // 2, x0 + DASH_LEN - 1, y + LINE_THICK // 2 - 1],
                         fill=a)
    wear = noise_gray(W, ROAD_H, 2, 161).point(lambda v: 120 + v * 135 // 255)
    wear2 = noise_gray(W, ROAD_H, 10, 162).point(lambda v: 150 + v * 105 // 255)
    paint = ImageChops.multiply(ImageChops.multiply(paint, wear), wear2)
    paint = paint.point(lambda v: min(255, v * 255 // 220))
    paint = wrap_blur(paint, 0.8)
    layer = Image.new("RGBA", (W, ROAD_H), PAINT + (0,))
    layer.putalpha(paint)
    road = over(road, layer)

    return road.convert("RGB")


# ------------------------------------------------------- scenery parts
SH = (30, 34, 40)  # shadow tint for alpha-blended cel shadows


def lerp_x(p, q, y):
    """x on segment p-q at height y."""
    (x0, y0), (x1, y1) = p, q
    if y1 == y0:
        return x0
    return x0 + (x1 - x0) * (y - y0) / (y1 - y0)


def shingles(d, left, right, y0, y1, step=8):
    """Shingle courses inside a roof whose left/right edges are segments."""
    for y in range(int(y0) + step, int(y1) - 2, step):
        xl, xr = lerp_x(*left, y) + 2, lerp_x(*right, y) - 2
        if xr - xl > 6:
            d.line([(xl, y), (xr, y)], fill=ROOF_LINE + (120,), width=1)


def side_roof(d, x0, x1, eave_y, ridge_y, ov=14, hip=0.0):
    """Side-gable (hip=0) or hipped roof seen from the front, white fascia."""
    run = (eave_y - ridge_y) * hip
    a, b = (x0 - ov, eave_y), (x0 - ov + run, ridge_y)
    c, e = (x1 + ov - run, ridge_y), (x1 + ov, eave_y)
    d.polygon([a, b, c, e], fill=ROOF)
    d.polygon([b, c, (lerp_x(c, e, ridge_y + 8), ridge_y + 8),
               (lerp_x(a, b, ridge_y + 8), ridge_y + 8)], fill=ROOF_LIGHT)
    shingles(d, (a, b), (c, e), ridge_y + 4, eave_y)
    d.rectangle([x0, eave_y + 2, x1, eave_y + 12], fill=SH + (48,))  # soffit shadow
    d.line([(x0 - ov, eave_y), (x1 + ov, eave_y)], fill=TRIM, width=5)


def front_gable(d, x0, x1, wall_top, peak_y, wall, ov=14, vent=True):
    """Gable end facing the street: roof edge, wall triangle, white
    bargeboards (right one in shade), a soft shadow under them."""
    cx = (x0 + x1) / 2
    s = (wall_top - peak_y) / ((x1 - x0) / 2)
    le, re = (x0 - ov, wall_top + ov * s), (x1 + ov, wall_top + ov * s)
    d.polygon([(le[0] - 4, le[1] - 5), (cx, peak_y - 11), (re[0] + 4, re[1] - 5),
               (re[0], re[1]), (cx, peak_y), (le[0], le[1])], fill=ROOF)
    d.polygon([(x0, wall_top), (cx, peak_y + 4), (x1, wall_top)], fill=wall)
    d.line([(x0 + 4, wall_top + 7), (cx, peak_y + 11), (x1 - 4, wall_top + 7)],
           fill=SH + (44,), width=7)
    d.line([le, (cx, peak_y)], fill=TRIM, width=6)
    d.line([(cx, peak_y), re], fill=TRIM_SHADE, width=6)
    if vent:
        vy = peak_y + (wall_top - peak_y) * 0.42
        vh = (wall_top - peak_y) * 0.3
        vw = vh / s
        d.polygon([(cx - vw, vy + vh), (cx, vy), (cx + vw, vy + vh)], fill=TRIM_SHADE)
        for i in range(1, 4):
            yy = vy + vh * i / 4
            hw = vw * i / 4
            d.line([(cx - hw + 1, yy), (cx + hw - 1, yy)], fill=(150, 150, 144), width=1)


def siding(d, x0, y0, x1, y1, col, seed, step=7):
    """Lap siding: a shadow line under every board, a few weathered boards."""
    r = random.Random(seed)
    d.rectangle([x0, y0, x1, y1], fill=col)
    for y in range(int(y0) + step, int(y1), step):
        if r.random() < 0.25:
            d.rectangle([x0, y - step + 1, x1, y - 1],
                        fill=(255, 255, 255, r.randrange(6, 14)) if r.random() < 0.5
                        else SH + (r.randrange(6, 14),))
        d.line([(x0, y), (x1, y)], fill=SH + (46,), width=1)
        d.line([(x0, y + 1), (x1, y + 1)], fill=(255, 255, 255, 18), width=1)


def stucco(d, x0, y0, x1, y1, col):
    d.rectangle([x0, y0, x1, y1], fill=col)


def corner_boards(d, x0, y0, x1, y1):
    d.rectangle([x0, y0, x0 + 5, y1], fill=TRIM)
    d.rectangle([x1 - 5, y0, x1, y1], fill=TRIM_SHADE)


def window(d, x0, y0, w, h, cols=2, rows=1, shutters=False):
    f = 4
    if shutters:
        d.rectangle([x0 - f - 14, y0 - f, x0 - f - 2, y0 + h + f], fill=SHUTTER)
        d.rectangle([x0 + w + f + 2, y0 - f, x0 + w + f + 14, y0 + h + f], fill=SHUTTER)
        for sx in (x0 - f - 14, x0 + w + f + 2):
            for yy in range(int(y0), int(y0 + h), 5):
                d.line([(sx + 2, yy), (sx + 10, yy)], fill=SH + (50,), width=1)
    d.rectangle([x0 - f, y0 - f, x0 + w + f, y0 + h + f], fill=TRIM)
    d.rectangle([x0, y0, x0 + w, y0 + h], fill=GLASS)
    # sky reflection: pale diagonal band toward the upper left
    d.polygon([(x0 + w * 0.10, y0 + h), (x0 + w * 0.40, y0), (x0 + w * 0.60, y0),
               (x0 + w * 0.30, y0 + h)], fill=GLASS_HI + (60,))
    d.rectangle([x0, y0, x0 + w, y0 + 4], fill=SH + (70,))
    for i in range(1, cols):
        mx = x0 + w * i / cols
        d.line([(mx, y0), (mx, y0 + h)], fill=TRIM, width=3)
    for i in range(1, rows):
        my = y0 + h * i / rows
        d.line([(x0, my), (x0 + w, my)], fill=TRIM, width=3)
    d.rectangle([x0 - f - 3, y0 + h + f, x0 + w + f + 3, y0 + h + f + 4], fill=TRIM)
    d.rectangle([x0 - f - 1, y0 + h + f + 5, x0 + w + f + 5, y0 + h + f + 8], fill=SH + (40,))


def garage(d, x0, x1, top):
    """Wide sectional garage door: trim frame, recessed head, panel grid."""
    d.rectangle([x0 - 6, top - 6, x1 + 6, GY], fill=TRIM)
    d.rectangle([x0, top, x1, GY], fill=GARAGE)
    d.rectangle([x0, top, x1, top + 6], fill=SH + (80,))
    sections = 4
    sh = (GY - top) / sections
    for i in range(1, sections):
        y = top + sh * i
        d.line([(x0, y), (x1, y)], fill=GARAGE_SHADE, width=2)
    cols = max(3, int((x1 - x0) // 34))
    pw = (x1 - x0) / cols
    for i in range(cols):
        for j in range(sections):
            px, py = x0 + pw * i + 5, top + sh * j + 5
            d.rectangle([px, py, px + pw - 10, py + sh - 10], outline=GARAGE_SHADE, width=1)


def porch(d, x0, x1, roof_y, door_x, wall_lamp=True):
    """Front porch: small shed roof on two white posts, door, black lantern."""
    d.rectangle([door_x, roof_y + 18, door_x + 26, GY], fill=TRIM)
    d.rectangle([door_x + 4, roof_y + 22, door_x + 22, GY], fill=DOOR)
    d.rectangle([door_x + 8, roof_y + 28, door_x + 18, roof_y + 40], fill=(120, 96, 76))
    d.ellipse([door_x + 17, roof_y + 50, door_x + 20, roof_y + 53], fill=(200, 180, 120))
    if wall_lamp:
        lx = door_x + 34
        d.rectangle([lx, roof_y + 30, lx + 6, roof_y + 42], fill=LANTERN)
        d.rectangle([lx + 1, roof_y + 33, lx + 5, roof_y + 39], fill=(170, 160, 130))
    d.rectangle([x0, roof_y + 10, x1, roof_y + 18], fill=SH + (50,))  # shade under the roof
    d.polygon([(x0 - 8, roof_y + 10), (x0 + 6, roof_y - 6), (x1 - 6, roof_y - 6),
               (x1 + 8, roof_y + 10)], fill=ROOF)
    d.line([(x0 - 8, roof_y + 10), (x1 + 8, roof_y + 10)], fill=TRIM, width=4)
    for px in (x0 + 2, x1 - 8):
        d.rectangle([px, roof_y + 12, px + 6, GY], fill=TRIM)
        d.rectangle([px + 4, roof_y + 12, px + 6, GY], fill=TRIM_SHADE)
    d.rectangle([x0 - 4, GY - 6, x1 + 4, GY], fill=TRIM_SHADE)  # porch step
    d.line([(x0 + 8, GY - 22), (x1 - 8, GY - 22)], fill=TRIM, width=3)  # rail


def chimney(d, x, top, bottom, col):
    d.rectangle([x, top, x + 22, bottom], fill=col)
    d.rectangle([x + 16, top, x + 22, bottom], fill=SH + (40,))
    d.rectangle([x - 3, top - 5, x + 25, top], fill=TRIM_SHADE)
    for y in range(top + 6, bottom, 6):
        d.line([(x, y), (x + 22, y)], fill=SH + (30,), width=1)


# ---------------------------------------------------------------- houses
# Same row as the night scenery-suburb.png: stucco + porch, siding + garage,
# stucco with chimney + porch, siding + garage, then a narrower stucco house.

def house_stucco_porch(d, x, w=180, col=STUCCO):
    """Front gable, stucco, porch on the left with door and lantern."""
    front_gable(d, x, x + w, 196, 120, col)
    stucco(d, x, 196, x + w, GY, col)
    d.rectangle([x + w - 12, 196, x + w, GY], fill=SH + (24,))
    d.line([(x, 260), (x + w, 260)], fill=TRIM_SHADE, width=4)
    window(d, x + w / 2 - 26, 210, 52, 36, cols=2)
    window(d, x + w - 66, 278, 42, 34, cols=2)
    porch(d, x + 8, x + 92, 268, x + 34)


def house_siding_garage(d, x, w=230, col=SIDING_GREY, seed=1):
    """Front gable over the whole house, lap siding, garage right, porch left."""
    front_gable(d, x, x + w, 190, 108, col)
    siding(d, x, 190, x + w, GY, col, seed)
    # siding continues into the gable triangle
    cx = x + w / 2
    for y in range(116, 190, 7):
        hw = (y - 108) / (190 - 108) * w / 2 - 8
        if hw > 4:
            d.line([(cx - hw, y), (cx + hw, y)], fill=SH + (40,), width=1)
    corner_boards(d, x, 190, x + w, GY)
    window(d, cx - 30, 212, 60, 40, cols=2, rows=2)
    window(d, x + 18, 214, 34, 36, cols=1, rows=2, shutters=False)
    window(d, x + w - 52, 214, 34, 36, cols=1, rows=2)
    d.rectangle([x, 262, x + w, 268], fill=TRIM_SHADE)  # floor band
    garage(d, x + w - 130, x + w - 20, 282)
    porch(d, x + 10, x + 84, 270, x + 28)


def house_stucco_chimney(d, x, w=250, col=STUCCO_GREY):
    """Side-gable main block with chimney, front-gable wing on the right,
    porch with posts on the left."""
    chimney(d, x + 20, 128, 186, (150, 120, 104))
    side_roof(d, x, x + w - 90, 186, 136)
    stucco(d, x, 186, x + w - 90, GY, col)
    window(d, x + 40, 206, 50, 40, cols=2, shutters=True)
    window(d, x + 40, 282, 50, 34, cols=2)
    # wing
    wx0, wx1 = x + w - 110, x + w
    front_gable(d, wx0, wx1, 186, 116, col)
    stucco(d, wx0, 186, wx1, GY, col)
    d.rectangle([wx1 - 10, 186, wx1, GY], fill=SH + (24,))
    d.rectangle([wx0 - 12, 192, wx0, GY], fill=SH + (36,))  # wing shadow on the main block
    window(d, wx0 + 30, 204, 50, 44, cols=2, rows=2)
    window(d, wx0 + 30, 280, 50, 36, cols=3)
    porch(d, x + 96, x + w - 118, 264, x + 104, wall_lamp=False)
    d.line([(x, 260), (x + w - 112, 260)], fill=TRIM_SHADE, width=4)


HOUSES = (
    (lambda d, x: house_stucco_porch(d, x, 176, STUCCO), 10),
    (lambda d, x: house_siding_garage(d, x, 236, SIDING_GREY, 11), 340),
    (lambda d, x: house_stucco_chimney(d, x, 260, STUCCO_GREY), 700),
    (lambda d, x: house_siding_garage(d, x, 230, SIDING_YELLOW, 12), 1100),
    (lambda d, x: house_stucco_porch(d, x, 160, (192, 188, 176)), 1430),
)
TREES = ((262, 250, 200, 21), (628, 230, 170, 22), (1012, 262, 210, 23), (1376, 240, 180, 24))
FENCES = ((196, 330), (566, 694), (952, 1100), (1326, 1430))
LAMPS = (470, 1250)


# ---------------------------------------------------------------- nature
def hill_profile(base, terms):
    """Periodic silhouette heights (integer frequencies keep the seam exact)."""
    return [base - sum(a * math.sin(2 * math.pi * k * x / W + ph) for k, a, ph in terms)
            for x in range(W)]


def draw_hills(bg):
    d = ImageDraw.Draw(bg, "RGBA")
    far = hill_profile(146, ((2, 16, 0.4), (3, 12, 2.1), (5, 7, 0.9), (9, 3, 1.7)))
    near = hill_profile(182, ((3, 14, 1.3), (4, 9, 0.2), (7, 6, 2.6), (13, 2, 0.5)))
    for x in range(W):
        d.line([(x, far[x]), (x, BG_H)], fill=HILL_FAR)
    # sunlit upper-left flanks: a lighter rim where the profile rises
    for x in range(W):
        if far[(x + 3) % W] < far[x]:
            d.line([(x, far[x]), (x, far[x] + 6)], fill=(168, 186, 188))
    for x in range(W):
        d.line([(x, near[x]), (x, BG_H)], fill=HILL_NEAR)
    for x in range(W):
        if near[(x + 3) % W] < near[x]:
            d.line([(x, near[x]), (x, near[x] + 5)], fill=(146, 168, 148))
    return near


def cumulus(d, cx, cy, w, seed):
    """Flat-bottomed cumulus: shaded base, sunlit puffs offset up-left."""
    r = random.Random(seed)
    puffs = []
    n = max(4, int(w / 34))
    for i in range(n):
        t = i / (n - 1)
        px = cx - w / 2 + t * w + r.uniform(-8, 8)
        rr = (1 - abs(t - 0.45) * 1.3) * w * 0.12 + r.uniform(6, 12)
        puffs.append((px, cy - rr * 0.55, rr))
    for _ in range(n // 2):
        px = cx + r.uniform(-w * 0.25, w * 0.2)
        rr = w * r.uniform(0.09, 0.14)
        puffs.append((px, cy - rr * 1.3, rr))
    # bottoms clamp to cy: cumulus sit on a flat, shaded base
    for px, py, rr in puffs:
        d.ellipse([px - rr, py - rr, px + rr, min(py + rr * 0.9, cy)], fill=CLOUD_DEEP)
    for px, py, rr in puffs:
        d.ellipse([px - rr, py - rr, px + rr * 0.9, min(py + rr * 0.6, cy - 6)], fill=CLOUD_SHADE)
    for px, py, rr in puffs:
        d.ellipse([px - rr * 0.95, py - rr * 0.95, px + rr * 0.55, min(py + rr * 0.3, cy - 12)],
                  fill=CLOUD)


def puff(d, cx, cy, rx, ry, dark=LEAF_DARK, base=LEAF, light=LEAF_LIGHT):
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=dark)
    d.ellipse([cx - rx, cy - ry, cx + rx * 0.75, cy + ry * 0.55], fill=base)
    d.ellipse([cx - rx * 0.8, cy - ry * 0.85, cx + rx * 0.1, cy - ry * 0.1], fill=light)


def leafy_tree(d, x, h, w, seed):
    """Big deciduous street tree: forked trunk, clustered leaf masses."""
    r = random.Random(seed)
    base = GY
    crown_cy = base - h * 0.62
    d.polygon([(x - 8, base), (x - 4, crown_cy + 20), (x + 4, crown_cy + 20), (x + 8, base)], fill=BARK)
    d.line([(x + 4, base), (x + 4, crown_cy + 30)], fill=SH + (50,), width=3)
    for ang in (2.2, 1.0, 1.7):
        ex = x + math.cos(ang) * w * 0.32
        ey = crown_cy + 20 - math.sin(ang) * h * 0.22
        d.line([(x, crown_cy + 40), (ex, ey)], fill=BARK, width=5)
    pads = []
    for _ in range(44):
        a = r.uniform(0, 2 * math.pi)
        rad = r.random() ** 0.5
        px = x + math.cos(a) * rad * w * 0.44
        py = crown_cy + math.sin(a) * rad * h * 0.27
        pads.append((px, py, r.uniform(11, 22)))
    pads.sort(key=lambda p: -p[1] - p[0] * 0.3)  # back (lower right) first
    for px, py, rr in pads:
        d.ellipse([px - rr - 3, py - rr * 0.85, px + rr + 4, py + rr * 0.85 + 4], fill=LEAF_DARK)
    for px, py, rr in pads:
        d.ellipse([px - rr, py - rr * 0.85, px + rr * 0.7, py + rr * 0.5], fill=LEAF)
    for px, py, rr in pads:
        if px - x + (py - crown_cy) * 1.2 < w * 0.1:  # upper-left side catches the sun
            d.ellipse([px - rr * 0.8, py - rr * 0.8, px + rr * 0.1, py - rr * 0.1], fill=LEAF_LIGHT)
    # a few sky holes through the canopy
    for _ in range(3):
        hx = x + r.uniform(-w * 0.25, w * 0.25)
        hy = crown_cy + r.uniform(-h * 0.12, h * 0.1)
        d.ellipse([hx - 4, hy - 3, hx + 4, hy + 3], fill=LEAF_DARK)


def shrub(d, x, y, rx, ry):
    puff(d, x, y, rx, ry)


def plank_fence(d, x0, x1, top=292):
    """Wooden privacy fence: vertical planks, two rails, posts."""
    d.rectangle([x0, top, x1, GY], fill=PLANK)
    for px in range(int(x0), int(x1), 9):
        d.line([(px, top), (px, GY)], fill=PLANK_SHADE, width=1)
    for px in range(int(x0) + 4, int(x1), 27):
        d.line([(px, top + 2), (px, GY)], fill=(170, 138, 104), width=1)
    d.line([(x0, top), (x1, top)], fill=(170, 138, 104), width=2)
    d.rectangle([x0, top + 2, x1, top + 6], fill=SH + (26,))
    for px in range(int(x0), int(x1) + 1, 60):
        d.rectangle([px, top - 4, px + 6, GY], fill=PLANK_SHADE)


def lamp_post(d, x):
    """Black ornamental cast-iron lamp post standing on the verge."""
    foot = BG_H - 4
    top = 196
    d.polygon([(x - 9, foot), (x + 9, foot), (x + 6, foot - 18), (x - 6, foot - 18)], fill=IRON)
    d.rectangle([x - 7, foot - 26, x + 7, foot - 18], fill=IRON)
    d.rectangle([x - 3, top + 30, x + 3, foot - 26], fill=IRON)
    d.line([(x - 2, top + 30), (x - 2, foot - 26)], fill=IRON_HI, width=1)
    for ry in (foot - 40, top + 60):
        d.rectangle([x - 5, ry, x + 5, ry + 4], fill=IRON)
    # lantern: cap, glass, base
    d.polygon([(x - 14, top + 6), (x + 14, top + 6), (x, top - 6)], fill=IRON)
    d.line([(x, top - 6), (x, top - 14)], fill=IRON, width=2)
    d.ellipse([x - 3, top - 18, x + 3, top - 12], fill=IRON)
    d.polygon([(x - 11, top + 6), (x + 11, top + 6), (x + 8, top + 26), (x - 8, top + 26)],
              fill=(214, 210, 192))
    d.line([(x, top + 6), (x, top + 26)], fill=IRON, width=1)
    d.polygon([(x - 2, top + 8), (x - 9, top + 8), (x - 7, top + 24), (x - 2, top + 24)],
              fill=(236, 234, 220))
    d.rectangle([x - 9, top + 26, x + 9, top + 30], fill=IRON)


# ---------------------------------------------------------------- scenery
def make_bg():
    bg = vgradient(W, BG_H, SKY_TOP, SKY_HORIZON, ease=lambda t: t ** 1.3).convert("RGBA")

    # cumulus clouds, softened a little so they read as vapour, not cut-outs
    clouds = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))

    def draw_clouds(d, dx):
        for cx, cy, w, seed in ((170, 122, 300, 31), (560, 88, 180, 32), (930, 132, 340, 33),
                                (1330, 104, 240, 34), (1560, 140, 120, 35)):
            cumulus(d, cx + dx, cy, w, seed)

    wrapped(draw_clouds, clouds)
    clouds.putalpha(clouds.getchannel("A").point(lambda v: v * 235 // 255))
    bg = over(bg, wrap_blur(clouds, 2.6))

    hills = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))
    draw_hills(hills)
    bg = over(bg, hazed(hills, HAZE, 40))

    # far trees on the near hill line and behind the houses
    far = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))

    def draw_far(d, dx):
        r = random.Random(4402)
        for _ in range(26):
            cx = r.randrange(0, W) + dx
            cy = GY - r.randrange(70, 110)
            puff(d, cx, cy, r.randrange(26, 44), r.randrange(24, 40),
                 dark=(96, 120, 92), base=(112, 136, 98), light=(140, 160, 112))
            d.rectangle([cx - 30, cy, cx + 30, GY], fill=(96, 120, 92))

    wrapped(draw_far, far)
    bg = over(bg, hazed(far, HAZE, 110))

    houses = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))

    def draw_houses(d, dx):
        for fx0, fx1 in FENCES:
            plank_fence(d, fx0 + dx, fx1 + dx)
        for fn, hx in HOUSES:
            fn(d, hx + dx)

    wrapped(draw_houses, houses)
    bg = over(bg, hazed(houses, HAZE, 48))

    trees = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))

    def draw_trees(d, dx):
        for tx, h, w, seed in TREES:
            leafy_tree(d, tx + dx, h, w, seed)
        r = random.Random(4501)
        for hx in (40, 300, 560, 690, 1080, 1290, 1560):  # foundation shrubs
            shrub(d, hx + dx + r.randrange(-6, 6), GY - 10, r.randrange(18, 26), r.randrange(12, 16))

    wrapped(draw_trees, trees)
    bg = over(bg, hazed(trees, HAZE, 40))

    # ground strip: lawn, sidewalk, grass verge
    ground = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(ground, "RGBA")
    gd.rectangle([0, LAWN_TOP, W, WALK_TOP], fill=GRASS)
    gd.rectangle([0, LAWN_TOP, W, LAWN_TOP + 2], fill=GRASS_SHADE)
    gd.rectangle([0, WALK_TOP, W, VERGE_TOP], fill=WALK)
    gd.line([(0, WALK_TOP), (W, WALK_TOP)], fill=WALK_SHADE, width=1)
    for x in range(40, W, 80):  # slab joints, slanted by the low camera
        gd.line([(x, WALK_TOP + 1), (x - 5, VERGE_TOP - 1)], fill=WALK_SHADE, width=1)
    gd.rectangle([0, VERGE_TOP, W, BG_H], fill=VERGE)
    gd.line([(0, VERGE_TOP), (W, VERGE_TOP)], fill=GRASS_SHADE, width=1)
    # driveways cross the lawn in front of the garages
    for hx, w in ((340, 236), (1100, 230)):
        for dx in (-W, 0, W):
            x0, x1 = hx + w - 136 + dx, hx + w - 14 + dx
            gd.polygon([(x0, GY), (x1, GY), (x1 + 6, WALK_TOP), (x0 - 6, WALK_TOP)], fill=WALK_SHADE)
            gd.polygon([(x0 - 6, VERGE_TOP), (x1 + 6, VERGE_TOP), (x1 + 8, BG_H), (x0 - 8, BG_H)],
                       fill=WALK_SHADE)
    bg = over(bg, hazed(ground, HAZE, 24))

    front = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))

    def draw_front(d, dx):
        for lx in LAMPS:
            lamp_post(d, lx + dx)

    wrapped(draw_front, front)
    bg = over(bg, hazed(front, HAZE, 36))

    bg = wrap_blur(grade(bg.convert("RGB")), 0.5)

    # last rows fade into the road's curb lip so the horizon has no step
    fix = ImageDraw.Draw(bg)
    for i in range(EDGE_ROWS):
        y = BG_H - EDGE_ROWS + i
        t = (i + 1) / EDGE_ROWS
        for x in range(W):
            fix.point((x, y), fill=lerp(bg.getpixel((x, y)), CURB_LIP, t))
    return bg


# ---------------------------------------------------------------- checks
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


def swapped(im):
    t = Image.new("RGB", im.size)
    t.paste(im.crop((im.width // 2, 0, im.width, im.height)), (0, 0))
    t.paste(im.crop((0, 0, im.width // 2, im.height)), (im.width // 2, 0))
    return t


def write_preview(road, bg, prev_dir):
    os.makedirs(prev_dir, exist_ok=True)
    prev = Image.new("RGB", (800, 450))
    prev.paste(bg.resize((800, 180), Image.LANCZOS), (0, 0))
    prev.paste(road.resize((800, 270), Image.LANCZOS), (0, 180))
    d = ImageDraw.Draw(prev, "RGBA")
    for cx, cy, s in ((200, 214, 0.6), (330, 268, 0.7), (460, 322, 0.8),
                      (590, 376, 0.9), (700, 430, 1.0)):
        hw = 35 * s
        d.ellipse([cx - hw, cy - 8 * s, cx + hw, cy + 8 * s], fill=(0, 0, 0, 77))
        d.rectangle([cx - hw, cy - 2 * hw, cx + hw, cy], fill=(240, 90, 90))
    prev.save(os.path.join(prev_dir, "preview.png"))
    swapped(road).resize((800, 270), Image.LANCZOS).save(os.path.join(prev_dir, "seam-road.png"))
    swapped(bg).resize((800, 180), Image.LANCZOS).save(os.path.join(prev_dir, "seam-bg.png"))
    bg.save(os.path.join(prev_dir, "scenery-full.png"))
    road.save(os.path.join(prev_dir, "road-full.png"))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    road = make_road()
    bg = make_bg()
    road.save(os.path.join(OUT, "road-suburb-day.png"))
    seam_check(road, "road")
    seam_check(bg, "scenery")
    print("sky (scenery top row)", hex_of(row_avg(bg, 0)),
          " ground (road bottom row)", hex_of(row_avg(road, ROAD_H - 1)))
    print("horizon: scenery bottom row", hex_of(row_avg(bg, BG_H - 1)),
          " road top row", hex_of(row_avg(road, 0)))
    if "--preview" in sys.argv:
        write_preview(road, bg, sys.argv[sys.argv.index("--preview") + 1])
    print("wrote", OUT)
