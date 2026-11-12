#!/usr/bin/env python3
"""Generate the hazy-desert road + scenery pair per docs/image-assets.md.

    uv run --with pillow python tools/gen-desert-assets.py [--preview DIR]

Writes public/assets/bg/road-desert.png    1600x540  tiles left<->right, not vertically

The scenery drawn here is NOT shipped: it is the layout reference given to the
AI image model, whose output (prepped) is the shipped scenery-desert.png
(docs/image-assets.md). --preview writes it to DIR/scenery-full.png.

An overcast, dusty desert: a low brown-grey dust sky of soft cloud masses,
layers of smooth dunes fading into the haze (far grey-green, near warm sand,
lee sides shaded), sparse dry scrub and a bleached skull on the foreground
sand. The road is an old sun-bleached desert highway with sand drifting over
it and faded, half-buried dashed dividers at y = 180 / 360. Soft focus, warm
desaturated grade, no grain.

Prints the seam checks and the edge-row hexes: road bottom row -> `ground` in
SCENERY_THEMES.desert (`sky` comes from the prep script run on the AI scenery). --preview also dumps an
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


def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, os.path.join(_HERE, file))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


night = _load("gen_night_assets", "gen-night-assets.py")
day = _load("gen_suburb_day_assets", "gen-suburb-day-assets.py")
lerp, wrap_blur, wrapped = night.lerp, night.wrap_blur, night.wrapped
vgradient, noise_gray = night.vgradient, night.noise_gray
over, hazed = day.over, day.hazed
row_avg, hex_of, seam_check, swapped = day.row_avg, day.hex_of, day.seam_check, day.swapped

W = night.W
ROAD_H = night.ROAD_H
BG_H = night.BG_H
NUM_LANES = night.NUM_LANES
LANE_H = night.LANE_H
OUT = night.OUT

# ---------------------------------------------------------------- road
# dusty warm-grey asphalt, mid value so a 30% black shadow still reads
ROAD_TOP = (132, 113, 88)
ROAD_BOTTOM = (128, 110, 86)
SAND_ROAD = (172, 146, 106)     # drifted sand over the asphalt
SHOULDER_H = 16                 # sandy shoulder band at the top of the road
SHOULDER_LIP = (184, 158, 116)  # road row 0 == scenery last row

PAINT = (214, 198, 164)
LINE_THICK = 6
DASH_PERIOD = 100  # divides W
DASH_LEN = 60

# ------------------------------------------------------------ scenery
SKY_TOP = (128, 126, 110)       # overcast, low and grey-sage
SKY_HORIZON = (176, 168, 142)   # pale dusty haze at the horizon
CLOUD_DARK = (104, 102, 90)
CLOUD_LIGHT = (180, 174, 152)
HAZE = (172, 164, 138)

DUNE_FAR = ((166, 158, 132), (144, 136, 112))   # (lit, lee) grey-green, deep in the haze
DUNE_MID = ((180, 160, 122), (142, 122, 90))
DUNE_NEAR = ((194, 164, 114), (146, 112, 72))
SAND_FORE = (190, 160, 112)

SCRUB = (108, 106, 76)
SCRUB_DARK = (78, 76, 56)
BONE = (232, 226, 208)
BONE_SHADE = (184, 176, 156)
BONE_HOLE = (92, 80, 64)

EDGE_ROWS = 3  # last rows fade into SHOULDER_LIP (last row exact)


def grade(im):
    """Hazy film grade: desaturated, lifted blacks, warm cast. No grain."""
    gray = im.convert("L").convert("RGB")
    im = Image.blend(im, gray, 0.18)
    lift, top = 12, 244
    lut = []
    for mult, add in ((1.0, 4), (1.0, 2), (0.96, 0)):
        for v in range(256):
            o = (lift + v * (top - lift) / 255) * mult + add
            lut.append(max(0, min(255, int(round(o)))))
    return im.point(lut)


# ---------------------------------------------------------------- road
def make_road():
    road = vgradient(W, ROAD_H, ROAD_TOP, ROAD_BOTTOM).convert("RGB")

    # soft aggregate grain, overlay-blended: texture, never speckle
    # faint fine grain only: the AI backdrop is smooth, so coarse mottling read as fur
    for block, strength, seed in ((2, 0.10, 201), (8, 0.04, 202)):
        n = noise_gray(W, ROAD_H, block, seed).point(lambda v: 128 + (v - 128) // 3)
        n = wrap_blur(n.convert("RGB"), 1.0 if block <= 2 else 2.4)
        road = Image.blend(road, ImageChops.overlay(road, n), strength)
    road = road.convert("RGBA")

    # wind-blown sand: long, low horizontal drifts, thicker near the shoulder.
# Transparent pixels of every blurred layer carry the layer's colour, so the
# (non-premultiplied) blur never mixes a dark fringe in.
    drift = Image.new("RGBA", (W, ROAD_H), SAND_ROAD + (0,))

    def draw_drift(d, dx):
        r = random.Random(2101)
        for _ in range(34):
            cy = r.randrange(SHOULDER_H, ROAD_H - 10)
            near_top = 1 - cy / ROAD_H
            cx = r.randrange(0, W) + dx
            rw, rh = r.randrange(90, 260), r.randrange(5, 16)
            a = int(r.randrange(26, 46) * (0.5 + near_top))
            d.ellipse([cx - rw, cy - rh, cx + rw, cy + rh], fill=SAND_ROAD + (a,))

    wrapped(draw_drift, drift)
    road = over(road, wrap_blur(drift, 7.0))

    # sand streaks: thin wind lines, sharper than the drifts
    streaks = Image.new("RGBA", (W, ROAD_H), SAND_ROAD + (0,))

    def draw_streaks(d, dx):
        r = random.Random(2202)
        for _ in range(45):
            x = r.randrange(0, W) + dx
            y = r.randrange(SHOULDER_H + 4, ROAD_H - 4)
            ln = r.randrange(30, 120)
            d.line([(x, y), (x + ln, y + r.randrange(-2, 3))], fill=SAND_ROAD + (r.randrange(20, 40),),
                   width=r.choice((1, 2)))

    wrapped(draw_streaks, streaks)
    road = over(road, wrap_blur(streaks, 1.0))

    # fine heat cracks
    cracks = Image.new("RGBA", (W, ROAD_H), (0, 0, 0, 0))

    def branch(d, r, x, y, ang, depth, a):
        pts = [(x, y)]
        for _s in range(r.randrange(3, 6)):
            ang += r.uniform(-0.8, 0.8)
            ln = r.randrange(8, 30)
            x += math.cos(ang) * ln
            y += math.sin(ang) * ln * 0.45
            pts.append((x, y))
            if depth < 2 and r.random() < 0.3:
                branch(d, r, x, y, ang + r.choice((-1, 1)) * r.uniform(0.6, 1.3), depth + 1, a)
        d.line(pts, fill=(84, 78, 68, a), width=1)

    def draw_cracks(d, dx):
        r = random.Random(2303)
        for _ in range(14):
            branch(d, r, r.randrange(0, W) + dx, r.randrange(40, ROAD_H - 10),
                   r.uniform(-0.5, 0.5), 0, r.randrange(36, 58))

    wrapped(draw_cracks, cracks)
    road = over(road, wrap_blur(cracks, 0.5))

    # lane dividers: faded paint, eroded and partly buried by sand
    paint = Image.new("L", (W, ROAD_H), 0)
    pd = ImageDraw.Draw(paint)
    r = random.Random(2404)
    start = (DASH_PERIOD - DASH_LEN) // 2
    for i in range(1, NUM_LANES):
        y = i * LANE_H
        for x0 in range(start, W, DASH_PERIOD):
            pd.rectangle([x0, y - LINE_THICK // 2, x0 + DASH_LEN - 1, y + LINE_THICK // 2 - 1],
                         fill=r.randrange(130, 175))
    wear = noise_gray(W, ROAD_H, 2, 261).point(lambda v: 130 + v * 125 // 255)
    wear2 = noise_gray(W, ROAD_H, 10, 262).point(lambda v: 150 + v * 105 // 255)
    paint = ImageChops.multiply(ImageChops.multiply(paint, wear), wear2)
    paint = wrap_blur(paint.point(lambda v: min(255, v * 255 // 210)), 1.2)
    layer = Image.new("RGBA", (W, ROAD_H), PAINT + (0,))
    layer.putalpha(paint)
    road = over(road, layer)

    # sandy shoulder: solid sand at row 0 fading into the asphalt, ragged edge
    shoulder = Image.new("RGBA", (W, ROAD_H), SAND_ROAD + (0,))
    sd = ImageDraw.Draw(shoulder)
    # smooth low-frequency edge: high-frequency raggedness read as a grass fringe
    edge = [SHOULDER_H + 5 * math.sin(2 * math.pi * 3 * x / W) + 3 * math.sin(2 * math.pi * 7 * x / W + 1.3)
            for x in range(W)]
    for x in range(W):
        e = edge[x]
        for y in range(int(e) + 40):
            t = y / (e + 40)
            a = 255 if y < e - 8 else int(255 * max(0.0, 1 - (y - (e - 8)) / 48) ** 1.6)
            sd.point((x, y), fill=lerp(SHOULDER_LIP, SAND_ROAD, t) + (a,))
    shoulder = wrap_blur(shoulder, 3.0)
    road = over(road, shoulder)
    # row 0 exactly the lip colour so the horizon has no step
    ImageDraw.Draw(road).line([(0, 0), (W, 0)], fill=SHOULDER_LIP + (255,))

    return road.convert("RGB")


# ------------------------------------------------------- scenery parts
def dune_profile(base, terms):
    """Periodic dune crest heights; each term is skewed so crests lean right
    (gentle windward slope on the left, steeper lee face on the right).
    Integer frequencies keep the seam exact."""
    out = []
    for x in range(W):
        h = 0.0
        for k, a, ph in terms:
            p = 2 * math.pi * k * x / W + ph
            h += a * math.sin(p - 0.55 * math.sin(p))
        out.append(base - h)
    return out


def draw_dunes(prof, colors, rim, seed, ripples=0):
    """Fill below a crest profile; lee faces (profile falling to the right)
    take the shade colour, crests get a pale rim, optional wind ripples."""
    lit, lee = colors
    layer = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for x in range(W):
        top = prof[x]
        slope = prof[(x + 2) % W] - prof[(x - 2) % W]  # >0: descending to the right
        s = max(0.0, min(1.0, slope / 1.2)) ** 0.8
        col_top = lerp(lit, lee, s)
        for y in range(int(top), BG_H):
            t = min(1.0, (y - top) / 60)
            # the shade fades out down the face: lee faces are darkest just under the crest
            d.point((x, y), fill=lerp(col_top, lerp(lit, lee, 0.25), t) + (255,))
        # pale rim only right at the crests (a local peak within a few px)
        if prof[x] <= min(prof[(x + k) % W] for k in range(-6, 7)) + 0.6:
            d.line([(x, top), (x, top + 1)], fill=rim + (140,))
    if ripples:
        r = random.Random(seed)
        rd = ImageDraw.Draw(layer, "RGBA")
        for _ in range(ripples):
            x = r.randrange(0, W)
            y0 = prof[x] + r.randrange(10, 40)
            if y0 >= BG_H - 4:
                continue
            ln = r.randrange(40, 120)
            pts = [(x + i, y0 + 2 * math.sin(i / 9.0) + i * 0.04) for i in range(0, ln, 4)]
            rd.line(pts, fill=lee + (70,), width=1)
    return layer


def scrub(d, x, y, s, r):
    """Dry desert shrub: a low tuft of thin twigs over a soft dark base."""
    d.ellipse([x - 7 * s, y - 2 * s, x + 7 * s, y + 1.5 * s], fill=SCRUB_DARK + (120,))
    for _ in range(int(9 + 5 * s)):
        ang = math.pi + r.uniform(0.25, math.pi - 0.25)
        ln = r.uniform(4, 10) * s
        ex, ey = x + math.cos(ang) * ln * 1.2, y + math.sin(ang) * ln
        d.line([(x + r.uniform(-3, 3) * s, y), (ex, ey)],
               fill=(SCRUB if r.random() < 0.6 else SCRUB_DARK) + (220,), width=1)


def skull(d, x, y):
    """Small bleached animal skull half sunk in the sand, with a couple of ribs."""
    for i in range(4):  # ribs arching out of the sand behind it
        rx = x + 22 + i * 9
        d.arc([rx - 6, y - 14 + i, rx + 6, y + 8], 200, 340, fill=BONE_SHADE, width=2)
    d.ellipse([x - 4, y - 2, x + 20, y + 4], fill=(170, 146, 108))   # contact shadow
    d.ellipse([x - 2, y - 12, x + 14, y + 1], fill=BONE)               # cranium
    d.polygon([(x - 10, y - 6), (x - 1, y - 9), (x + 2, y), (x - 9, y - 1)], fill=BONE)  # snout
    d.ellipse([x + 6, y - 10, x + 14, y - 1], fill=BONE_SHADE)
    d.ellipse([x + 1, y - 9, x + 5, y - 5], fill=BONE_HOLE)            # eye socket
    d.ellipse([x - 9, y - 5, x - 7, y - 3], fill=BONE_HOLE)            # nostril
    d.arc([x - 2, y - 22, x + 12, y - 6], 200, 290, fill=BONE, width=2)  # horn


# ---------------------------------------------------------------- scenery
def make_bg():
    bg = vgradient(W, BG_H, SKY_TOP, SKY_HORIZON, ease=lambda t: t ** 0.9).convert("RGBA")

    # overcast: big soft cloud masses, darker up high, kept off the top rows
    clouds = Image.new("RGBA", (W, BG_H), lerp(CLOUD_DARK, CLOUD_LIGHT, 0.5) + (0,))

    def draw_clouds(d, dx):
        r = random.Random(3101)
        for _ in range(26):
            cx = r.randrange(0, W) + dx
            cy = r.randrange(40, 190)
            rw, rh = r.randrange(80, 220), r.randrange(18, 44)
            dark = r.random() < 0.55
            col = CLOUD_DARK if dark else CLOUD_LIGHT
            a = r.randrange(40, 80) if dark else r.randrange(50, 90)
            d.ellipse([cx - rw, cy - rh, cx + rw, cy + rh], fill=col + (a,))

    wrapped(draw_clouds, clouds)
    clouds = wrap_blur(clouds, 22.0)
    # fade the clouds out toward the top so the sky fill above the strip has no seam
    fade = Image.linear_gradient("L").resize((W, BG_H)).point(lambda v: min(255, max(0, (v - 10) * 4)))
    clouds.putalpha(ImageChops.multiply(clouds.getchannel("A"), fade))
    bg = over(bg, clouds)

    # dune layers, far to near; the haze swallows the far ones
    far = dune_profile(226, ((2, 10, 0.3), (5, 7, 1.9), (9, 3, 0.7), (14, 1.5, 2.2)))
    mid = dune_profile(262, ((3, 16, 1.1), (4, 8, 2.8), (7, 6, 0.4), (11, 2, 1.6)))
    near = dune_profile(300, ((2, 18, 2.4), (5, 12, 0.9), (8, 6, 2.0), (13, 3, 0.2)))

    bg = over(bg, hazed(draw_dunes(far, DUNE_FAR, (180, 172, 146), 1), HAZE, 120))

    mid_l = draw_dunes(mid, DUNE_MID, (200, 182, 144), 2, ripples=30)
    md = ImageDraw.Draw(mid_l, "RGBA")
    r = random.Random(3202)
    for _ in range(30):  # distant scrub specks
        x = r.randrange(6, W - 6)
        y = mid[x] + r.randrange(8, 30)
        if y < BG_H - 2:
            md.ellipse([x - 2.5, y - 1.2, x + 2.5, y + 1.2], fill=SCRUB_DARK + (150,))
    bg = over(bg, hazed(mid_l, HAZE, 70))

    near_l = draw_dunes(near, DUNE_NEAR, (214, 186, 136), 3, ripples=60)
    bg = over(bg, hazed(near_l, HAZE, 26))

    # foreground: flat sand to the road, sparse scrub, the skull
    fore = Image.new("RGBA", (W, BG_H), SAND_FORE + (0,))
    fd = ImageDraw.Draw(fore, "RGBA")
    fore_top = [338 + 3 * math.sin(2 * math.pi * 3 * x / W + 0.8) + 2 * math.sin(2 * math.pi * 11 * x / W)
                for x in range(W)]
    for x in range(W):
        fd.line([(x, fore_top[x]), (x, BG_H)], fill=SAND_FORE + (255,))
    fore = wrap_blur(fore, 2.0)

    def draw_fore(d, dx):
        r = random.Random(3303)
        for _ in range(26):
            x = r.randrange(0, W)
            prof = near if r.random() < 0.55 else fore_top
            y = prof[x] + r.randrange(6, 20)
            if y > BG_H - 6:
                continue
            scrub(d, x + dx, y, 0.6 + (y - 290) / 70 * 0.6, r)
        skull(d, 1180 + dx, 350)

    details = Image.new("RGBA", (W, BG_H), SCRUB + (0,))
    wrapped(draw_fore, details)
    fore = over(fore, wrap_blur(details, 0.6))
    bg = over(bg, hazed(fore, HAZE, 16))

    bg = wrap_blur(grade(bg.convert("RGB")), 0.7)

    fix = ImageDraw.Draw(bg)
    for i in range(EDGE_ROWS):
        y = BG_H - EDGE_ROWS + i
        t = (i + 1) / EDGE_ROWS
        for x in range(W):
            fix.point((x, y), fill=lerp(bg.getpixel((x, y)), SHOULDER_LIP, t))
    return bg


def write_preview(road, bg, prev_dir):
    os.makedirs(prev_dir, exist_ok=True)
    day.write_preview(road, bg, prev_dir)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    road = make_road()
    bg = make_bg()
    road.save(os.path.join(OUT, "road-desert.png"))
    seam_check(road, "road")
    seam_check(bg, "scenery")
    print("sky (scenery top row)", hex_of(row_avg(bg, 0)),
          " ground (road bottom row)", hex_of(row_avg(road, ROAD_H - 1)))
    print("horizon: scenery bottom row", hex_of(row_avg(bg, BG_H - 1)),
          " road top row", hex_of(row_avg(road, 0)))
    if "--preview" in sys.argv:
        write_preview(road, bg, sys.argv[sys.argv.index("--preview") + 1])
