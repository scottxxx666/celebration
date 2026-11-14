#!/usr/bin/env python3
"""Generate the dark concert-stage road + scenery pair per docs/image-assets.md.

    uv run --with pillow python tools/gen-concert-assets.py [--preview DIR]

Writes public/assets/bg/road-concert.png     1600x540  tiles left<->right, not vertically
       public/assets/bg/scenery-concert.png  1600x360  tiles left<->right

A big dark stage seen from the crowd side: lighting truss across the top with a
few magenta / purple / cyan lamp heads, tall speaker stacks, an LED wall with an
equaliser pattern, drifting haze, and a foreground of crowd silhouettes (some
with raised arms). Near-black base with restrained saturated accents so the
runner, obstacles and DiscoLights beams stay readable. The road is a dark
stage-floor / barrier lane with faint reflections; like the underground road it
bakes no bright lane lines, only a faint dark seam at y = 180 / 360.

Prints the seam checks and the edge-row hexes: scenery top row -> `sky`,
road bottom row -> `ground` in SCENERY_THEMES.concert. --preview also dumps an
800x450 in-game mock and the swapped-halves seam checks to DIR.
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

W, ROAD_H, BG_H = night.W, night.ROAD_H, night.BG_H
NUM_LANES, LANE_H, OUT = night.NUM_LANES, night.LANE_H, night.OUT

SKY = (0x02, 0x03, 0x05)        # scenery top row == theme.sky
GROUND = (0x24, 0x24, 0x27)     # road bottom row == theme.ground
CROWD = (5, 5, 8)
LIP = (9, 9, 12)                # scenery last row == road row 0
MAGENTA, PURPLE, CYAN = (230, 40, 170), (130, 60, 230), (40, 190, 235)
ACCENTS = (MAGENTA, PURPLE, CYAN)
EDGE_ROWS = 4
TRUSS_Y = 46


def glow(layer_fn, radius):
    layer = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))
    wrapped(layer_fn, layer)
    return wrap_blur(layer, radius)


def make_road():
    road = vgradient(W, ROAD_H, LIP, GROUND, ease=lambda t: t ** 0.9).convert("RGB")
    for block, strength, seed in ((2, 0.12, 601), (10, 0.10, 602), (50, 0.10, 603)):
        n = noise_gray(W, ROAD_H, block, seed).point(lambda v: 128 + (v - 128) // 3)
        n = wrap_blur(n.convert("RGB"), 1.0 if block <= 2 else 3.0 if block <= 10 else 14.0)
        road = Image.blend(road, ImageChops.overlay(road, n), strength)
    road = road.convert("RGBA")

    # soft coloured reflections of the rig, vertical smears, very low alpha
    refl = Image.new("RGBA", (W, ROAD_H), (0, 0, 0, 0))

    def draw_refl(d, dx):
        r = random.Random(6101)
        for _ in range(16):
            cx, cy = r.randrange(0, W) + dx, r.randrange(30, ROAD_H - 20)
            rw, rh = r.randrange(25, 90), r.randrange(8, 22)
            col = r.choice(ACCENTS)
            d.ellipse([cx - rw, cy - rh, cx + rw, cy + rh], fill=col + (r.randrange(8, 18),))

    wrapped(draw_refl, refl)
    road = over(road, wrap_blur(refl, 12.0))

    # faint dark seams between rows plus staggered panel joints (stage deck boards)
    seams = Image.new("RGBA", (W, ROAD_H), (0, 0, 0, 0))

    def draw_seams(d, dx):
        for i in range(1, NUM_LANES):
            y = i * LANE_H
            d.line([(dx, y), (dx + W, y)], fill=(4, 4, 6, 140), width=3)
            d.line([(dx, y + 2), (dx + W, y + 2)], fill=(80, 80, 96, 22), width=1)
        for row in range(NUM_LANES):
            off = (row * 160) % 320
            for x in range(off, W + 320, 320):
                d.line([(x + dx, row * LANE_H + 4), (x + dx, (row + 1) * LANE_H - 4)],
                       fill=(4, 4, 6, 70), width=2)

    wrapped(draw_seams, seams)
    road = over(road, wrap_blur(seams, 0.8))

    # crowd-barrier shadow at the top (row 0 == scenery last row), fading down
    lip = Image.new("RGBA", (W, ROAD_H), LIP + (0,))
    ld = ImageDraw.Draw(lip)
    for y in range(60):
        ld.line([(0, y), (W, y)], fill=LIP + (int(255 * (1 - y / 60) ** 1.8),))
    road = over(road, lip)
    road = road.convert("RGB")
    d = ImageDraw.Draw(road)
    d.line([(0, 0), (W, 0)], fill=LIP)
    d.line([(0, ROAD_H - 1), (W, ROAD_H - 1)], fill=GROUND)  # flat last row == theme.ground
    return road


def truss(d, dx):
    """Horizontal lighting truss with zigzag bracing, plus a lower rear truss."""
    for y0, h, a in ((TRUSS_Y, 16, 255), (TRUSS_Y + 86, 10, 190)):
        d.rectangle([dx, y0, dx + W, y0 + h], fill=(20, 20, 26, a))
        d.line([(dx, y0), (dx + W, y0)], fill=(60, 60, 76, a), width=2)
        d.line([(dx, y0 + h), (dx + W, y0 + h)], fill=(8, 8, 11, a), width=2)
        step = 32
        for x in range(0, W, step):  # 32 divides W
            d.line([(dx + x, y0 + h), (dx + x + step // 2, y0), (dx + x + step, y0 + h)],
                   fill=(44, 44, 56, a), width=2)


LAMP_XS = [60 + i * 160 for i in range(10)]
LAMPS = [(x, ACCENTS[i % 3], 0.9 if i % 3 != 1 else 0.7) for i, x in enumerate(LAMP_XS)]
LIT = {0, 2, 3, 5, 7, 8}        # only some heads are lit; the rest are dark housings


def lamp_heads(d, dx):
    for i, (x, col, _s) in enumerate(LAMPS):
        x += dx
        y = TRUSS_Y + 16
        d.rectangle([x - 3, y, x + 3, y + 10], fill=(24, 24, 30, 255))
        d.rectangle([x - 12, y + 10, x + 12, y + 30], fill=(30, 30, 38, 255))
        d.rectangle([x - 12, y + 10, x + 12, y + 12], fill=(70, 70, 88, 255))
        lens = col if i in LIT else (40, 40, 48)
        d.ellipse([x - 8, y + 26, x + 8, y + 34], fill=lens + (255,))


def lamp_glow(d, dx):
    for i, (x, col, s) in enumerate(LAMPS):
        if i in LIT:
            d.ellipse([x + dx - 34, TRUSS_Y + 18, x + dx + 34, TRUSS_Y + 56], fill=col + (int(120 * s),))


def beams(d, dx):
    """Very faint haze cones under the lit heads (static art; DiscoLights does the real beams)."""
    for i, (x, col, s) in enumerate(LAMPS):
        if i in LIT:
            tilt = (i % 3 - 1) * 60
            d.polygon([(x + dx - 6, TRUSS_Y + 50), (x + dx + 6, TRUSS_Y + 50),
                       (x + dx + tilt + 70, 300), (x + dx + tilt - 70, 300)],
                      fill=col + (int(22 * s),))


def speaker_stack(d, dx, x0, w, tiers, base_y):
    th = 62
    for t in range(tiers):
        y1 = base_y - t * th
        y0 = y1 - th + 3
        d.rectangle([x0 + dx, y0, x0 + dx + w, y1], fill=(14, 14, 18, 255))
        d.rectangle([x0 + dx, y0, x0 + dx + w, y0 + 2], fill=(54, 54, 68, 255))
        d.rectangle([x0 + dx, y0, x0 + dx + 2, y1], fill=(34, 34, 44, 255))
        cx, cy = x0 + dx + w // 2, (y0 + y1) // 2
        for rad, col in ((22, (8, 8, 11)), (16, (22, 22, 28)), (8, (6, 6, 8))):
            d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=col + (255,),
                      outline=(48, 48, 60, 255) if rad == 22 else None)
        if w > 80:  # wide cabinets carry a second driver
            for sx in (x0 + dx + 18, x0 + dx + w - 18):
                d.ellipse([sx - 7, cy - 7, sx + 7, cy + 7], fill=(10, 10, 14, 255), outline=(44, 44, 56, 255))


def led_wall(img):
    d = ImageDraw.Draw(img, "RGBA")
    x0, x1, y0, y1 = 560, 1040, 96, 246
    d.rectangle([x0 - 8, y0 - 8, x1 + 8, y1 + 8], fill=(16, 16, 22, 255))
    d.rectangle([x0, y0, x1, y1], fill=(6, 6, 12, 255))
    bw, gap = 14, 6
    r = random.Random(6202)
    n = (x1 - x0) // (bw + gap)
    for i in range(n):
        x = x0 + 4 + i * (bw + gap)
        t = i / (n - 1)
        col = lerp(CYAN, MAGENTA, t)
        env = 0.35 + 0.65 * math.sin(math.pi * t) ** 1.5      # louder in the middle
        h = int((y1 - y0 - 16) * env * r.uniform(0.45, 1.0))
        for k in range(0, h, 7):                                # LED segments
            y = y1 - 6 - k
            dim = 0.55 + 0.45 * (1 - k / max(h, 1))
            d.rectangle([x, y - 5, x + bw, y], fill=lerp((6, 6, 12), col, 0.7 * dim) + (255,))
        d.rectangle([x, y1 - 6 - h - 6, x + bw, y1 - 6 - h - 3], fill=col + (255,))  # peak cap
    for y in range(y0, y1, 4):                                  # pixel-grid scanlines
        d.line([(x0, y), (x1, y)], fill=(0, 0, 0, 70))


def haze(d, dx):
    r = random.Random(6303)
    for _ in range(22):
        cx, cy = r.randrange(0, W) + dx, r.randrange(120, 320)
        rw, rh = r.randrange(120, 300), r.randrange(18, 50)
        d.ellipse([cx - rw, cy - rh, cx + rw, cy + rh],
                  fill=r.choice(((70, 40, 110), (40, 60, 100), (90, 40, 90))) + (r.randrange(10, 22),))


def crowd(d, dx):
    """Head-and-shoulders silhouettes, two ranks; some with raised arms."""
    for rank, (base, hr, seed, a) in enumerate(((BG_H + 12, 13, 6404, 255), (BG_H + 30, 17, 6405, 255))):
        r = random.Random(seed)
        n = W // (hr * 5 // 2)
        for k in range(n):  # evenly spread slots, so the pattern closes on the tile seam
            cx = int((k + r.uniform(-0.2, 0.2)) * W / n) + dx
            top = base - r.randrange(46, 74) - (16 if rank == 0 else 0)
            d.ellipse([cx - hr, top - hr, cx + hr, top + hr], fill=CROWD + (a,))
            d.polygon([(cx - hr * 2.2, base), (cx - hr * 1.5, top + hr + 6), (cx - hr * 0.6, top + hr - 2),
                       (cx + hr * 0.6, top + hr - 2), (cx + hr * 1.5, top + hr + 6), (cx + hr * 2.2, base)],
                      fill=CROWD + (a,))
            if r.random() < 0.28:  # raised arm(s)
                for side in ((-1,), (1,), (-1, 1))[r.randrange(3)]:
                    sx = cx + side * hr * 1.6
                    tip = (sx + side * r.randrange(4, 18), top - r.randrange(26, 52))
                    d.line([(cx + side * hr * 1.3, top + hr + 4), (sx, top + hr - 10), tip],
                           fill=CROWD + (a,), width=7)
                    d.ellipse([tip[0] - 6, tip[1] - 6, tip[0] + 6, tip[1] + 6], fill=CROWD + (a,))


def make_bg():
    bg = Image.new("RGBA", (W, BG_H), SKY + (255,))
    # faint stage-glow wash rising from behind the LED wall
    wash = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))
    wd = ImageDraw.Draw(wash)
    wd.ellipse([440, 40, 1160, 360], fill=(90, 40, 140, 38))
    bg = over(bg, wrap_blur(wash, 40.0))

    layer = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))
    wrapped(beams, layer)
    bg = over(bg, wrap_blur(layer, 6.0))

    layer = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))
    wrapped(truss, layer)
    bg = over(bg, layer)

    # stage deck: dark band with a faint lit front edge
    deck = ImageDraw.Draw(bg, "RGBA")
    deck.rectangle([0, 262, W, BG_H], fill=(10, 10, 14, 255))
    deck.line([(0, 262), (W, 262)], fill=(58, 44, 84, 255), width=2)
    for x in range(0, W, 40):
        deck.line([(x, 266), (x, 290)], fill=(18, 18, 24, 255), width=2)

    layer = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))
    for x0, w, tiers in ((120, 110, 4), (300, 80, 3), (1220, 80, 3), (1370, 110, 4), (40, 70, 2), (1520, 70, 2)):
        wrapped(lambda d, dx, x0=x0, w=w, tiers=tiers: speaker_stack(d, dx, x0, w, tiers, 262), layer)
    bg = over(bg, layer)

    led = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))
    led_wall(led)
    bg = over(bg, led)
    screen_glow = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))
    ImageDraw.Draw(screen_glow).rectangle([560, 96, 1040, 246], fill=(150, 60, 200, 34))
    bg = over(bg, wrap_blur(screen_glow, 26.0))

    layer = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))
    wrapped(lamp_heads, layer)
    bg = over(bg, layer)
    bg = over(bg, wrap_blur(glow(lamp_glow, 10.0), 6.0))

    bg = over(bg, wrap_blur(glow(haze, 22.0), 8.0))

    layer = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))
    wrapped(crowd, layer)
    bg = over(bg, layer)
    bg = bg.convert("RGB")
    bg = wrap_blur(bg, 0.6)

    # sky rows flat so the fill above the strip has no seam; bottom rows ease into the road lip
    fix = ImageDraw.Draw(bg)
    for y in range(8):
        t = 1 - y / 8
        for x in range(W):
            fix.point((x, y), lerp(bg.getpixel((x, y)), SKY, t))
    for i in range(EDGE_ROWS):
        y = BG_H - EDGE_ROWS + i
        t = (i + 1) / EDGE_ROWS
        for x in range(W):
            fix.point((x, y), lerp(bg.getpixel((x, y)), LIP, t))
    return bg


def write_preview(road, bg, prev_dir):
    os.makedirs(prev_dir, exist_ok=True)
    day.write_preview(road, bg, prev_dir)
    both = Image.new("RGB", (W * 2, BG_H + ROAD_H))
    for k in range(2):
        both.paste(bg, (k * W, 0))
        both.paste(road, (k * W, BG_H))
    both.save(os.path.join(prev_dir, "tiled-twice.png"))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    road = make_road()
    bg = make_bg()
    road.save(os.path.join(OUT, "road-concert.png"))
    bg.save(os.path.join(OUT, "scenery-concert.png"))
    seam_check(road, "road")
    seam_check(bg, "scenery")
    print("sky (scenery top row)", hex_of(row_avg(bg, 0)),
          " ground (road bottom row)", hex_of(row_avg(road, ROAD_H - 1)))
    print("horizon: scenery bottom row", hex_of(row_avg(bg, BG_H - 1)),
          " road top row", hex_of(row_avg(road, 0)))
    if "--preview" in sys.argv:
        write_preview(road, bg, sys.argv[sys.argv.index("--preview") + 1])
