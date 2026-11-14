#!/usr/bin/env python3
"""Generate the concert road, glow and crowd layers and the stage LAYOUT drawing per docs/image-assets.md.

    uv run --with pillow python tools/gen-concert-assets.py [--preview DIR]

Writes public/assets/bg/road-concert.png     1600x540  tiles left<->right, not vertically
       public/assets/bg/scenery-concert-glow-{magenta,cyan,wall}.png   additive glow layers
       public/assets/bg/scenery-concert-crowd-{a,b}.png               crowd frames
It does NOT write public/assets/bg/scenery-concert.png (1600x360): the shipped stage is an AI restyle
of the layout drawing below (like gen-desert-assets.py), made once with Codex's image model and
prepped with tools/prep-scenery-image.py (docs/image-assets.md). The procedural stage is kept as the
layout drawing, written only to --preview DIR/scenery-full.png. The glow images are keyed to that
layout (lamp heads, LED wall), so any regenerated stage must keep lamps and wall in place.

The layout drawing is a big dark stage seen from the crowd side: lighting truss across the top with a
few magenta / purple / cyan lamp heads, tall speaker stacks, an LED wall with an
equaliser pattern, drifting haze, and the crowd band left
as a clear dark deck. Near-black base with restrained saturated accents so the
runner, obstacles and DiscoLights beams stay readable. The road is a dark
stage-floor / barrier lane with faint reflections; like the underground road it
bakes no bright lane lines, only a faint dark seam at y = 180 / 360.

Also writes three RGBA additive glow layers (scenery-concert-glow-<group>.png, same size,
seamless; RGB = colour, alpha = intensity, transparent elsewhere) that the game draws as
tiling ADD-blend strips and pulses on the beat (src/beatPulse.js): `magenta` (magenta and
purple lamp halos/lenses), `cyan` (cyan lamps) and `wall` (the bright LED equaliser).

Also writes two transparent crowd strips, scenery-concert-crowd-{a,b}.png (1600x160 RGBA,
scenery rows 200..360, seamless): head-and-shoulders silhouettes with purple/cyan rim light in two
poses (A arms down / heads low, B arms up / heads slightly higher), neighbours in opposite poses and
frame b the mirror assignment of a, so swapping them on the beat ripples the crowd. The base
scenery has NO crowd (its bottom band is a clear dark stage deck) so the stage art can be restyled
without painting one; the game draws the crowd as a separate layer (src/crowdSway.js).

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

    # coloured light spill from the rig: broad pools, kept low so shadows and sprites read
    spill = Image.new("RGBA", (W, ROAD_H), (0, 0, 0, 0))

    def draw_spill(d, dx):
        for i, x in enumerate(LAMP_XS):
            if i in LIT:
                col = ACCENTS[i % 3]
                d.ellipse([x + dx - 130, 10, x + dx + 130, 300], fill=col + (30,))
                d.ellipse([x + dx - 60, 30, x + dx + 60, 160], fill=col + (22,))
        d.ellipse([560 + dx, 0, 1040 + dx, 240], fill=(150, 70, 220, 26))

    wrapped(draw_spill, spill)
    road = over(road, wrap_blur(spill, 28.0))

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
        d.ellipse([x - 11, y + 26, x + 11, y + 36], fill=(lerp(lens, (255, 255, 255), 0.35) if i in LIT else lens) + (255,))


def lamp_glow(d, dx):
    for i, (x, col, s) in enumerate(LAMPS):
        if i in LIT:
            d.ellipse([x + dx - 60, TRUSS_Y + 4, x + dx + 60, TRUSS_Y + 76], fill=col + (int(110 * s),))
            d.ellipse([x + dx - 22, TRUSS_Y + 24, x + dx + 22, TRUSS_Y + 48], fill=lerp(col, (255, 255, 255), 0.5) + (200,))


# Column slots in the gaps between lamp heads (lamps every 160 px from x = 60) and clear of the LED wall;
# the last one crosses the tile seam (wrapped() draws it on both sides).
SPEAKER_SLOTS = ((100, 84), (250, 100), (400, 100), (1070, 90), (1200, 110), (1380, 84), (1514, 100))
SPEAKER_OPTIONS = (("new", "WBF"), ("new", "WB"), ("new", "W"),
                   ("plain", 2), ("plain", 3), ("plain", 4))


def speaker_columns():
    """Seeded, deterministic mix of the two speaker styles over the slots: no two adjacent columns
    (including across the tile seam) share style+size, exactly two tall frame stacks that are not
    adjacent, and both styles well represented. Returns (x0, w, style, spec, shade) per slot."""
    n = len(SPEAKER_SLOTS)
    for seed in range(1000):
        r = random.Random(8800 + seed)
        pick = [r.choice(SPEAKER_OPTIONS) for _ in range(n)]
        frames = [i for i, c in enumerate(pick) if c == ("new", "WBF")]
        plain = sum(1 for c in pick if c[0] == "plain")
        if len(frames) != 2 or not 3 <= plain <= 4:
            continue
        if any(pick[i] == pick[(i + 1) % n] for i in range(n)):
            continue
        if any((a + 1) % n == b for a in frames for b in frames):
            continue
        return [(x0, w, style, spec, 0.9 if spec in ("W", 2) else 1.0)
                for (x0, w), (style, spec) in zip(SPEAKER_SLOTS, pick)]
    raise RuntimeError("no speaker assignment satisfies the constraints")


def _shade(col, k):
    return tuple(int(c * k) for c in col)


def _cabinet(d, dx, x0, w, y0, y1, k, rnd):
    """Heavy grey-black concrete-looking cabinet: speckle texture, edge highlights, corner screws."""
    x0 += dx
    d.rectangle([x0, y0, x0 + w, y1], fill=_shade((30, 31, 36), k) + (255,))
    for _ in range(w * (y1 - y0) // 14):  # weathering speckle
        px, py = rnd.randrange(x0 + 2, x0 + w - 1), rnd.randrange(y0 + 2, y1 - 1)
        v = rnd.randrange(-9, 12)
        d.point((px, py), fill=_shade((30 + v, 31 + v, 36 + v), k) + (255,))
    d.rectangle([x0, y0, x0 + w, y0 + 2], fill=_shade((66, 66, 80), k) + (255,))     # top edge highlight
    d.rectangle([x0, y0, x0 + 2, y1], fill=_shade((46, 46, 58), k) + (255,))         # left edge
    d.rectangle([x0 + w - 2, y0, x0 + w, y1], fill=_shade((14, 14, 18), k) + (255,))  # right edge, in shadow
    d.rectangle([x0, y1 - 2, x0 + w, y1], fill=_shade((10, 10, 13), k) + (255,))
    for sx, sy in ((x0 + 7, y0 + 8), (x0 + w - 7, y0 + 8), (x0 + 7, y1 - 8), (x0 + w - 7, y1 - 8)):
        d.ellipse([sx - 2, sy - 2, sx + 2, sy + 2], fill=_shade((74, 74, 88), k) + (255,), outline=(8, 8, 10, 255))


def _woofer(d, cx, cy, r, k):
    """Round woofer: surround ring, cone with a ridge, dust cap, highlight arc (all scale with r)."""
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=_shade((20, 20, 25), k) + (255,),
              outline=_shade((78, 78, 94), k) + (255,), width=2)
    rc = int(r * 0.80)
    d.ellipse([cx - rc, cy - rc, cx + rc, cy + rc], fill=_shade((9, 9, 12), k) + (255,),
              outline=_shade((38, 38, 48), k) + (255,))
    rr = int(r * 0.55)
    d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=_shade((30, 30, 40), k) + (255,))
    rd = max(3, int(r * 0.28))
    d.ellipse([cx - rd, cy - rd, cx + rd, cy + rd], fill=_shade((26, 26, 33), k) + (255,),
              outline=_shade((52, 52, 66), k) + (255,))
    d.arc([cx - r + 3, cy - r + 3, cx + r - 3, cy + r - 3], 200, 260, fill=_shade((96, 96, 114), k) + (255,), width=2)


def plain_stack(d, dx, x0, w, tiers, base_y, k=1.0):
    """Older, plainer style: dark boxes with one round driver per tier (second small drivers on wide ones)."""
    th = 62
    for t in range(tiers):
        y1 = base_y - t * th
        y0 = y1 - th + 3
        d.rectangle([x0 + dx, y0, x0 + dx + w, y1], fill=_shade((22, 22, 27), k) + (255,))
        d.rectangle([x0 + dx, y0, x0 + dx + w, y0 + 2], fill=_shade((58, 58, 72), k) + (255,))
        d.rectangle([x0 + dx, y0, x0 + dx + 2, y1], fill=_shade((38, 38, 48), k) + (255,))
        cx, cy = x0 + dx + w // 2, (y0 + y1) // 2
        for rad, col in ((22, (9, 9, 12)), (16, (24, 24, 30)), (8, (7, 7, 9))):
            d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=_shade(col, k) + (255,),
                      outline=_shade((52, 52, 66), k) + (255,) if rad == 22 else None)
        if w > 80:
            for sx in (x0 + dx + 18, x0 + dx + w - 18):
                d.ellipse([sx - 7, cy - 7, sx + 7, cy + 7], fill=_shade((11, 11, 15), k) + (255,),
                          outline=_shade((48, 48, 60), k) + (255,))


def speaker_stack(d, dx, x0, w, layout, base_y, k=1.0):
    """One column of concrete cabinets, bottom to top per `layout`: 'W' two stacked woofers (diameter
    ~60% of the cabinet width, clear panel between and around them), 'B' a band of small round drivers,
    'F' an open purple box frame. No horns or tweeters."""
    rnd = random.Random(7700 + x0)
    y = base_y
    for part in layout:
        if part == "W":
            r = int(w * 0.30)               # woofer diameter ~60% of the cabinet width
            gap, m = int(r * 0.45), int(r * 0.5)
            h = 4 * r + gap + m + int(r * 1.3)   # the pair fills the lower ~2/3, panel above
            _cabinet(d, dx, x0, w, y - h, y, k, rnd)
            for cy in (y - m - r, y - m - 3 * r - gap):
                _woofer(d, x0 + dx + w // 2, cy, r, k)
        elif part == "B":
            h = 34
            _cabinet(d, dx, x0, w, y - h, y, k, rnd)
            n = (w - 10) // 22
            for i in range(n):
                cx = x0 + dx + 5 + (w - 10) * (2 * i + 1) // (2 * n)
                _woofer(d, cx, y - h // 2, 8, k)
        else:  # 'F'
            h = 44
            fx = x0 + dx + 6
            d.rectangle([fx, y - h, x0 + dx + w - 6, y], fill=(66, 30, 112, 255))
            d.rectangle([fx, y - h, x0 + dx + w - 6, y - h + 2], fill=(120, 70, 180, 255))
            d.rectangle([fx + 8, y - h + 8, x0 + dx + w - 14, y - 8], fill=(7, 6, 11, 255))
            d.line([(fx + 8, y - h // 2), (x0 + dx + w - 14, y - h // 2)], fill=(52, 24, 92, 255), width=3)
        y -= h


WALL_BOX = (560, 1040, 96, 246)


def led_wall(img, glow_only=False):
    d = ImageDraw.Draw(img, "RGBA")
    x0, x1, y0, y1 = WALL_BOX
    if not glow_only:
        d.rectangle([x0 - 8, y0 - 8, x1 + 8, y1 + 8], fill=(16, 16, 22, 255))
        d.rectangle([x0, y0, x1, y1], fill=(6, 6, 12, 255))
    bw, gap = 14, 6
    r = random.Random(6202)
    n = (x1 - x0) // (bw + gap)
    for i in range(n):
        x = x0 + 4 + i * (bw + gap)
        t = i / (n - 1)
        col = lerp((70, 230, 255), (255, 60, 200), t)
        env = 0.35 + 0.65 * math.sin(math.pi * t) ** 1.5      # louder in the middle
        h = int((y1 - y0 - 16) * env * r.uniform(0.45, 1.0))
        for k in range(0, h, 7):                                # LED segments
            y = y1 - 6 - k
            dim = 0.55 + 0.45 * (1 - k / max(h, 1))
            d.rectangle([x, y - 5, x + bw, y], fill=(lerp((6, 6, 12), col, 1.0 * dim) + (255,)) if not glow_only
                        else (lerp(col, (255, 255, 255), 0.25) + (int(255 * dim),)))
        d.rectangle([x, y1 - 6 - h - 6, x + bw, y1 - 6 - h - 3], fill=col + (255,))  # peak cap
    if glow_only:
        return
    for y in range(y0, y1, 4):                                  # pixel-grid scanlines
        d.line([(x0, y), (x1, y)], fill=(0, 0, 0, 70))


def haze(d, dx):
    r = random.Random(6303)
    for _ in range(22):
        cx, cy = r.randrange(0, W) + dx, r.randrange(120, 320)
        rw, rh = r.randrange(120, 300), r.randrange(18, 50)
        d.ellipse([cx - rw, cy - rh, cx + rw, cy + rh],
                  fill=r.choice(((70, 40, 110), (40, 60, 100), (90, 40, 90))) + (r.randrange(10, 22),))


CROWD_TOP = 200                 # crowd strips cover scenery rows CROWD_TOP..BG_H (tallest raised hand ~y 225)
CROWD_H = BG_H - CROWD_TOP
HEAD_LIFT = 4                   # pose B heads sit this much higher than pose A


def crowd(d, dx, color=CROWD, dy=0, flip=0):
    """Head-and-shoulders silhouettes, two ranks. Neighbours alternate pose A (arms down, heads low)
    and pose B (arms up, heads slightly higher); `flip` 1 swaps the assignment, so the frame pair
    ripples when it alternates. Positions and sizes are identical in both frames."""
    for rank, (base, hr, seed, a) in enumerate(((BG_H + 12, 13, 6404, 255), (BG_H + 30, 17, 6405, 255))):
        r = random.Random(seed)
        n = W // (hr * 5 // 2)      # even, so the A/B alternation also closes on the tile seam
        for k in range(n):  # evenly spread slots, so the pattern closes on the tile seam
            cx = int((k + r.uniform(-0.2, 0.2)) * W / n) + dx
            top = base - r.randrange(46, 74) - (16 if rank == 0 else 0)
            sides = ((-1,), (1,), (-1, 1))[r.randrange(3)]
            arms = [(r.randrange(4, 18), r.randrange(26, 52)) for _ in sides]
            up = (k + flip) % 2 == 1
            hy = dy - (HEAD_LIFT if up else -HEAD_LIFT)
            d.ellipse([cx - hr, top - hr + hy, cx + hr, top + hr + hy], fill=color + (a,))
            d.polygon([(cx - hr * 2.2, base), (cx - hr * 1.5, top + hr + 6 + hy), (cx - hr * 0.6, top + hr - 2 + hy),
                       (cx + hr * 0.6, top + hr - 2 + hy), (cx + hr * 1.5, top + hr + 6 + hy), (cx + hr * 2.2, base)],
                      fill=color + (a,))
            if up:  # raised arm(s)
                for side, (ax, ay) in zip(sides, arms):
                    sx = cx + side * hr * 1.6
                    tip = (sx + side * ax, top - ay + hy)
                    d.line([(cx + side * hr * 1.3, top + hr + 4 + hy), (sx, top + hr - 10 + hy), tip],
                           fill=color + (a,), width=7)
                    d.ellipse([tip[0] - 6, tip[1] - 6, tip[0] + 6, tip[1] + 6], fill=color + (a,))


def make_crowd(flip):
    """Transparent RGBA crowd strip (W x CROWD_H, scenery rows CROWD_TOP..BG_H) with the purple/cyan
    stage rim light on heads and hands. Drawn over the stage by the game; the base scenery has no crowd."""
    layer = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))
    rim = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))
    cyan = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))
    wrapped(lambda d, dx: crowd(d, dx, (110, 60, 170), -3, flip), rim)
    wrapped(lambda d, dx: crowd(d, dx, (50, 130, 170), -3, flip), cyan)
    rim = wrap_blur(Image.blend(rim, cyan, 0.5), 0.8)
    wrapped(lambda d, dx: crowd(d, dx, CROWD, 0, flip), layer)
    out = over(rim, layer).crop((0, CROWD_TOP, W, BG_H))
    # bottom rows ease into the road's top row (LIP), like the base scenery
    px = out.load()
    for i in range(EDGE_ROWS):
        y = CROWD_H - EDGE_ROWS + i
        t = (i + 1) / EDGE_ROWS
        for x in range(W):
            r_, g_, b_, a_ = px[x, y]
            px[x, y] = lerp((r_, g_, b_), LIP, t) + (a_,)
    return out


def make_bg():
    bg = Image.new("RGBA", (W, BG_H), SKY + (255,))
    # faint stage-glow wash rising from behind the LED wall
    wash = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))
    wd = ImageDraw.Draw(wash)
    wd.ellipse([440, 40, 1160, 360], fill=(90, 40, 140, 38))
    bg = over(bg, wrap_blur(wash, 40.0))

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
    for x0, w, style, spec, k in speaker_columns():
        fn = plain_stack if style == "plain" else speaker_stack
        wrapped(lambda d, dx, x0=x0, w=w, spec=spec, k=k, fn=fn: fn(d, dx, x0, w, spec, 262, k), layer)
    bg = over(bg, layer)

    led = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))
    led_wall(led)
    bg = over(bg, led)
    screen_glow = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))
    ImageDraw.Draw(screen_glow).rectangle([560, 96, 1040, 246], fill=(170, 70, 220, 70))
    bg = over(bg, wrap_blur(screen_glow, 26.0))
    # wide soft bleed from the screen onto the truss and nearby speakers
    bleed = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bleed)
    bd.ellipse([380, 20, 1220, 330], fill=(150, 60, 210, 46))
    bd.ellipse([560, 90, 1040, 250], fill=(60, 200, 255, 26))
    bg = over(bg, wrap_blur(bleed, 34.0))

    layer = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))
    wrapped(lamp_heads, layer)
    bg = over(bg, layer)
    bg = over(bg, wrap_blur(glow(lamp_glow, 10.0), 6.0))

    bg = over(bg, wrap_blur(glow(haze, 22.0), 8.0))

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


GLOW_GROUPS = {"magenta": (MAGENTA, (0, 1)), "cyan": (CYAN, (2,))}  # group -> (layer colour, lamp i % 3 values)


def make_glows():
    """RGBA additive glow layers: lamp halos + lenses per colour group, and the LED wall."""
    out = {}
    for name, (col, mods) in GLOW_GROUPS.items():
        def draw(d, dx, col=col, mods=mods):
            for i, (x, lc, _s) in enumerate(LAMPS):
                if i not in LIT or i % 3 not in mods:
                    continue
                x += dx
                d.ellipse([x - 80, TRUSS_Y - 6, x + 80, TRUSS_Y + 92], fill=lc + (150,))
                d.ellipse([x - 40, TRUSS_Y + 14, x + 40, TRUSS_Y + 60], fill=lerp(lc, (255, 255, 255), 0.3) + (230,))
                # the lit lens as it sits on the shipped AI art (centre x + 1, y 92; see tools/prep-concert-lamps.py,
                # which dims the art's own lens to dark glass), solid so the relit lens at peak covers it fully
                d.ellipse([x - 13, 92 - 10, x + 15, 92 + 10], fill=lerp(lc, (255, 255, 255), 0.5) + (255,))
                d.ellipse([x - 6, 92 - 5, x + 8, 92 + 5], fill=(255, 255, 255, 255))
        layer = Image.new("RGBA", (W, BG_H), col + (0,))
        wrapped(draw, layer)
        out[name] = wrap_blur(layer, 9.0)
    wall = Image.new("RGBA", (W, BG_H), (190, 110, 255, 0))
    led_wall(wall, glow_only=True)
    halo = Image.new("RGBA", (W, BG_H), (190, 110, 255, 0))
    x0, x1, y0, y1 = WALL_BOX
    ImageDraw.Draw(halo).rectangle([x0 - 20, y0 - 20, x1 + 20, y1 + 20], fill=(190, 110, 255, 70))
    out["wall"] = over(wrap_blur(halo, 28.0), wrap_blur(wall, 1.2))
    return out


def write_preview(road, bg, prev_dir):
    os.makedirs(prev_dir, exist_ok=True)
    day.write_preview(road, bg, prev_dir)
    both = Image.new("RGB", (W * 2, BG_H + ROAD_H))
    for k in range(2):
        both.paste(bg, (k * W, 0))
        both.paste(road, (k * W, BG_H))
    both.save(os.path.join(prev_dir, "tiled-twice.png"))
    bg.save(os.path.join(prev_dir, "scenery-full.png"))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    road = make_road()
    layout = make_bg()
    road.save(os.path.join(OUT, "road-concert.png"))
    for name, frame in (("a", make_crowd(0)), ("b", make_crowd(1))):
        frame.save(os.path.join(OUT, f"scenery-concert-crowd-{name}.png"))
    for name, glow_img in make_glows().items():
        glow_img.save(os.path.join(OUT, f"scenery-concert-glow-{name}.png"))
        seam_check(glow_img.convert("RGB"), f"glow-{name}")
    seam_check(road, "road")
    shipped = Image.open(os.path.join(OUT, "scenery-concert.png")).convert("RGB")
    seam_check(shipped, "shipped scenery")
    print("sky (shipped scenery top row)", hex_of(row_avg(shipped, 0)),
          " ground (road bottom row)", hex_of(row_avg(road, ROAD_H - 1)))
    print("horizon: shipped scenery bottom row", hex_of(row_avg(shipped, BG_H - 1)),
          " road top row", hex_of(row_avg(road, 0)))
    if "--preview" in sys.argv:
        write_preview(road, layout, sys.argv[sys.argv.index("--preview") + 1])
