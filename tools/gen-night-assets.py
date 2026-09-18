#!/usr/bin/env python3
"""Generate the night-city road + scenery layers per docs/image-assets.md.

    python3 tools/gen-night-assets.py [--preview DIR]

Writes public/assets/bg/road-night.png    1600x540  tiles left<->right, not vertically
       public/assets/bg/scenery-night.png 1600x360  tiles left<->right, bottom = horizon

--preview also dumps an 800x450 in-game mock and the two tiled-seam checks to DIR.
Needs pillow (pip3 install --user pillow); nothing else in the project uses Python.
"""
import math
import os
import random
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter

W = 1600
ROAD_H = 540
BG_H = 360
NUM_LANES = 3
LANE_H = ROAD_H // NUM_LANES  # 180
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "assets", "bg")

NEON_PINK = (255, 92, 180)
NEON_CYAN = (94, 226, 255)
NEON_AMBER = (255, 176, 92)

# road top tone == scenery bottom tone, so the horizon seam is invisible
ROAD_TOP = (26, 30, 46)
ROAD_BOTTOM = (50, 56, 76)


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(len(a)))


def wrap_blur(im, radius):
    """Gaussian blur that wraps horizontally, so the L/R seam stays exact."""
    p = int(radius * 3) + 2
    ext = Image.new(im.mode, (im.width + 2 * p, im.height))
    ext.paste(im.crop((im.width - p, 0, im.width, im.height)), (0, 0))
    ext.paste(im, (p, 0))
    ext.paste(im.crop((0, 0, p, im.height)), (p + im.width, 0))
    ext = ext.filter(ImageFilter.GaussianBlur(radius))
    return ext.crop((p, 0, p + im.width, im.height))


def wrapped(fn, layer):
    """Run a draw callback three times so shapes crossing the edge repeat."""
    for dx in (-W, 0, W):
        fn(ImageDraw.Draw(layer, "RGBA"), dx)


def vgradient(w, h, top, bottom, ease=lambda t: t):
    im = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(im)
    for y in range(h):
        d.line([(0, y), (w, y)], fill=lerp(top, bottom, ease(y / (h - 1))))
    return im


def noise_gray(w, h, block=1, seed=0):
    """Block noise; block sizes divide W so the tile seam stays clean."""
    rnd = random.Random(seed)
    bw, bh = w // block, h // block
    data = bytes(rnd.randrange(256) for _ in range(bw * bh))
    im = Image.frombytes("L", (bw, bh), data)
    return im if block == 1 else im.resize((w, h), Image.NEAREST)


# ---------------------------------------------------------------- road
def make_road():
    rnd = random.Random(20260728)
    road = vgradient(W, ROAD_H, ROAD_TOP, ROAD_BOTTOM, ease=lambda t: t ** 0.85)

    # asphalt grain: fine + tight far away, coarser up close. Overlay-blended
    # around mid grey so it textures the asphalt without greying it out.
    for block, strength, seed in ((2, 0.30, 1), (8, 0.22, 2), (20, 0.14, 3)):
        n = noise_gray(W, ROAD_H, block, seed)
        # squeeze toward mid grey: low-amplitude texture, not static
        n = n.point(lambda v: 128 + (v - 128) // 3)
        n = wrap_blur(n.convert("RGB"), 0.8 if block <= 2 else 2.0)
        grainy = ImageChops.overlay(road, n)
        # depth mask: grain fades out toward the far (top) edge
        mask = Image.linear_gradient("L").resize((W, ROAD_H))
        mask = mask.point(lambda v, s=strength: int(v * s * 0.8 + 255 * s * 0.2))
        road = Image.composite(grainy, road, mask)

    # ---- lane seams: 3 equal bands, faint tone step + worn scuff dashes
    seams = Image.new("RGBA", (W, ROAD_H), (0, 0, 0, 0))
    ds = ImageDraw.Draw(seams, "RGBA")
    for i in range(1, NUM_LANES):
        y = i * LANE_H
        near = i / (NUM_LANES - 1)  # lower seams are nearer the camera -> a touch stronger
        ds.line([(0, y), (W, y)], fill=(6, 8, 18, int(80 + 45 * near)))
        ds.line([(0, y + 1), (W, y + 1)], fill=(150, 165, 200, int(20 + 20 * near)))
        # painted scuffs: worn dashes riding the seam, never a bold line
        x = rnd.randrange(0, 160)
        while x < W:
            ln = rnd.randrange(34, 96)
            a = rnd.randrange(14, 34)
            ds.rectangle([x, y - 2, min(x + ln, W), y - 1], fill=(210, 215, 225, a))
            if x + ln > W:  # wrap the dash
                ds.rectangle([0, y - 2, x + ln - W, y - 1], fill=(210, 215, 225, a))
            x += ln + rnd.randrange(60, 240)
    road = Image.alpha_composite(road.convert("RGBA"), wrap_blur(seams, 0.6))

    # ---- cracks + tar seams: thin, flat, low contrast (never chunky)
    cracks = Image.new("RGBA", (W, ROAD_H), (0, 0, 0, 0))

    def draw_cracks(d, dx):
        r = random.Random(77)
        for _ in range(26):
            x = r.randrange(0, W) + dx
            y = r.randrange(20, ROAD_H - 10)
            a = r.randrange(22, 46)
            ang = r.uniform(-0.5, 0.5)
            pts = [(x, y)]
            for _s in range(r.randrange(3, 7)):
                ang += r.uniform(-0.7, 0.7)
                ln = r.randrange(18, 60)
                x += math.cos(ang) * ln
                y += math.sin(ang) * ln * 0.35
                pts.append((x, y))
            d.line(pts, fill=(10, 12, 22, a), width=1)

    wrapped(draw_cracks, cracks)
    road = Image.alpha_composite(road, wrap_blur(cracks, 0.7))

    # ---- manhole covers: worn flat discs, deliberately faint
    holes = Image.new("RGBA", (W, ROAD_H), (0, 0, 0, 0))

    def draw_holes(d, dx):
        for cx, cy, rr in ((215, 400, 30), (760, 250, 24), (1235, 470, 33), (1420, 150, 20)):
            cx += dx
            d.ellipse([cx - rr, cy - rr * 0.42, cx + rr, cy + rr * 0.42],
                      fill=(16, 19, 30, 70), outline=(120, 132, 158, 34))
            d.ellipse([cx - rr * 0.6, cy - rr * 0.25, cx + rr * 0.6, cy + rr * 0.25],
                      outline=(120, 132, 158, 26))

    wrapped(draw_holes, holes)
    road = Image.alpha_composite(road, wrap_blur(holes, 1.0))

    # ---- wet sheen: shallow puddles, and neon smeared vertically into them.
    # Two passes so the pools keep an edge while the reflections stay vapour —
    # a crisp vertical streak on the ground reads as an obstacle.
    POOLS = [(120, 470, 150, 46), (330, 300, 110, 34), (610, 505, 190, 40),
             (880, 372, 130, 36), (1090, 210, 96, 26), (1330, 430, 165, 44),
             (1500, 300, 120, 30), (40, 200, 90, 24)]
    wet = Image.new("RGBA", (W, ROAD_H), (0, 0, 0, 0))

    def draw_pools(d, dx):
        for (cx, cy, rw, rh) in POOLS:
            cx += dx
            d.ellipse([cx - rw, cy - rh, cx + rw, cy + rh], fill=(12, 15, 28, 62))

    wrapped(draw_pools, wet)
    road = Image.alpha_composite(road, wrap_blur(wet, 6.0))

    neon = Image.new("RGBA", (W, ROAD_H), (0, 0, 0, 0))

    def draw_neon(d, dx):
        r = random.Random(4242)
        for i, (cx, cy, rw, rh) in enumerate(POOLS):
            cx += dx
            col = (NEON_PINK, NEON_CYAN, NEON_AMBER)[i % 3]
            for _ in range(r.randrange(2, 4)):
                sx = cx + r.randrange(-rw // 2, rw // 2)
                sw = r.randrange(6, 14)
                sh = int(rh * r.uniform(0.8, 1.3))
                d.ellipse([sx - sw, cy - sh, sx + sw, cy + sh],
                          fill=col + (r.randrange(30, 50),))

    wrapped(draw_neon, neon)
    road = Image.alpha_composite(road, wrap_blur(neon, 13.0))

    return road.convert("RGB")


# ------------------------------------------------------------ scenery
def make_bg():
    sky_top = (10, 12, 30)
    sky_horizon = (62, 32, 74)
    bg = vgradient(W, BG_H, sky_top, sky_horizon, ease=lambda t: t ** 2.2)

    # horizon glow: city light bounce hugging the bottom edge
    glow = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))

    def draw_glow(d, dx):
        for cx, col, a in ((190, NEON_PINK, 30), (560, NEON_CYAN, 24),
                           (980, NEON_AMBER, 22), (1360, NEON_PINK, 26)):
            d.ellipse([cx + dx - 340, BG_H - 130, cx + dx + 340, BG_H + 90], fill=col + (a,))

    wrapped(draw_glow, glow)
    bg = Image.alpha_composite(bg.convert("RGBA"), wrap_blur(glow, 70.0))

    def skyline(seed, h_lo, h_hi, w_lo, w_hi, body, haze, win_rate, win_col,
                win_alpha, neon=0, detail=False):
        """One depth layer of buildings, drawn wrap-aware, then hazed back."""
        layer = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))
        rnd = random.Random(seed)
        blocks = []
        x = -rnd.randrange(0, 60)
        while x < W:
            bw = rnd.randrange(w_lo, w_hi)
            bh = rnd.randrange(h_lo, h_hi)
            blocks.append((x, bw, bh))
            x += bw + rnd.randrange(-6, 16)
        # make the run tile: the last block is cloned at x - W by wrapped()

        def draw(d, dx):
            r = random.Random(seed + 1)
            for (bx, bw, bh) in blocks:
                bx += dx
                top = BG_H - bh
                d.rectangle([bx, top, bx + bw, BG_H], fill=body)
                # roofline detail: a setback box, water tank or antenna mast
                if detail and r.random() < 0.5:
                    k = r.random()
                    if k < 0.4:
                        sw = int(bw * r.uniform(0.3, 0.6))
                        sh = r.randrange(10, 30)
                        sx = bx + (bw - sw) // 2
                        d.rectangle([sx, top - sh, sx + sw, top], fill=body)
                    elif k < 0.75:
                        mx = bx + int(bw * r.uniform(0.25, 0.75))
                        d.line([(mx, top), (mx, top - r.randrange(16, 40))],
                               fill=body, width=2)
                    else:
                        tw = r.randrange(12, 22)
                        tx = bx + int(bw * 0.5) - tw // 2
                        d.rectangle([tx, top - r.randrange(12, 20), tx + tw, top], fill=body)
                # lit windows
                if win_rate <= 0:
                    continue
                gx, gy = 12, 16
                for wy in range(top + 14, BG_H - 8, gy):
                    for wx in range(bx + 8, bx + bw - 8, gx):
                        if r.random() > win_rate:
                            continue
                        c = win_col if r.random() < 0.78 else NEON_CYAN
                        a = int(win_alpha * r.uniform(0.55, 1.0))
                        d.rectangle([wx, wy, wx + 4, wy + 7], fill=c + (a,))
                # neon sign band on the facade
                if neon and r.random() < neon:
                    col = NEON_PINK if r.random() < 0.5 else NEON_CYAN
                    sy = top + r.randrange(20, max(24, bh // 2))
                    if r.random() < 0.55:
                        d.rectangle([bx + 6, sy, bx + bw - 6, sy + 4], fill=col + (150,))
                    else:
                        sx = bx + int(bw * r.uniform(0.25, 0.7))
                        d.rectangle([sx, sy, sx + 5, sy + r.randrange(24, 54)],
                                    fill=col + (150,))

        wrapped(draw, layer)
        if haze:  # atmospheric fade toward the sky colour
            layer = Image.alpha_composite(
                layer, Image.new("RGBA", (W, BG_H), sky_horizon + (haze,)))
        return layer

    far = skyline(11, 70, 150, 46, 110, (34, 32, 62), 96, 0.10, (255, 214, 150), 90)
    mid = skyline(23, 110, 210, 54, 130, (24, 24, 48), 54, 0.16, (255, 208, 140), 140,
                  neon=0.25, detail=True)
    near = skyline(37, 150, 268, 62, 150, (14, 15, 34), 22, 0.20, (255, 200, 130), 190,
                   neon=0.42, detail=True)

    for layer in (far, mid, near):
        bg = Image.alpha_composite(bg, layer)

    # bloom pass: pull a bright copy of the lights back over the skyline
    lights = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))
    for layer in (mid, near):
        px = layer.copy()
        px = px.point(lambda v: 0 if v < 150 else v)  # keep only the lit bits
        lights = Image.alpha_composite(lights, px)
    lights.putalpha(lights.getchannel("A").point(lambda v: int(v * 0.55)))
    bg = Image.alpha_composite(bg, wrap_blur(lights, 9.0))

    # street lamps + ground haze along the horizon seam
    street = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))

    def draw_street(d, dx):
        for cx in range(40, W + 40, 155):
            cx += dx
            d.ellipse([cx - 7, BG_H - 46, cx + 7, BG_H - 32], fill=NEON_AMBER + (170,))
            d.line([(cx, BG_H - 36), (cx, BG_H - 6)], fill=(18, 18, 34, 200), width=2)

    wrapped(draw_street, street)
    bg = Image.alpha_composite(bg, wrap_blur(street, 3.5))

    # last rows blend into the road's far tone so the horizon seam disappears
    seam = Image.new("RGBA", (W, BG_H), (0, 0, 0, 0))
    ds = ImageDraw.Draw(seam, "RGBA")
    band = 26
    for i in range(band):
        y = BG_H - band + i
        ds.line([(0, y), (W, y)], fill=ROAD_TOP + (int(255 * (i / (band - 1)) ** 1.6),))
    bg = Image.alpha_composite(bg, wrap_blur(seam, 1.0))

    return bg.convert("RGB")


def seam_check(im, name):
    """Report max edge mismatch: 0 means a perfect horizontal tile."""
    l = im.crop((0, 0, 1, im.height)).getdata()
    r = im.crop((im.width - 1, 0, im.width, im.height)).getdata()
    # a tile is seamless when col[-1] flows into col[0]; compare col0 vs col-1
    diff = max(max(abs(a[i] - b[i]) for i in range(3)) for a, b in zip(l, r))
    print(f"{name}: edge delta max {diff} (structural continuity, not equality)")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    road = make_road()
    bg = make_bg()
    road.save(os.path.join(OUT, "road-night.png"))
    bg.save(os.path.join(OUT, "scenery-night.png"))
    seam_check(road, "road")
    seam_check(bg, "scenery")

    prev_dir = None
    if "--preview" in sys.argv:
        prev_dir = sys.argv[sys.argv.index("--preview") + 1]
        os.makedirs(prev_dir, exist_ok=True)
    if not prev_dir:
        print("wrote", OUT, "and previews in", prev_dir)
        raise SystemExit

    # preview: exactly how the game composites them, at logical 800x450,
    # with a 70px sprite stand-in and the engine's 30% black shadow ellipse
    prev = Image.new("RGB", (800, 450))
    prev.paste(bg.resize((800, 180), Image.LANCZOS), (0, 0))
    prev.paste(road.resize((800, 270), Image.LANCZOS), (0, 180))
    d = ImageDraw.Draw(prev, "RGBA")
    for row, (cx, cy, s) in enumerate(((200, 214, 0.6), (330, 268, 0.7),
                                       (460, 322, 0.8), (590, 376, 0.9),
                                       (700, 430, 1.0))):
        hw = 35 * s
        d.ellipse([cx - hw, cy - 8 * s, cx + hw, cy + 8 * s], fill=(0, 0, 0, 77))
        d.rectangle([cx - hw, cy - 2 * hw, cx + hw, cy], fill=(240, 90, 90))
    prev.save(os.path.join(prev_dir, "preview.png"))

    # seam preview: two road tiles side by side, centred on the join
    tile = Image.new("RGB", (W, ROAD_H))
    tile.paste(road.crop((W // 2, 0, W, ROAD_H)), (0, 0))
    tile.paste(road.crop((0, 0, W // 2, ROAD_H)), (W // 2, 0))
    tile.resize((800, 270), Image.LANCZOS).save(os.path.join(prev_dir, "seam-road.png"))
    tileb = Image.new("RGB", (W, BG_H))
    tileb.paste(bg.crop((W // 2, 0, W, BG_H)), (0, 0))
    tileb.paste(bg.crop((0, 0, W // 2, BG_H)), (W // 2, 0))
    tileb.resize((800, 180), Image.LANCZOS).save(os.path.join(prev_dir, "seam-bg.png"))
    print("wrote", OUT)
