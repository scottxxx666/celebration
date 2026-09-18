#!/usr/bin/env python3
"""Turn source run-cycle frames into player or enemy sprite frames, or
generate placeholder frames so the pipeline works before real art exists.

    python3 tools/prep-run-frames.py original_images/player/run-1.png \
        original_images/player/run-2.png
    python3 tools/prep-run-frames.py --dummy 2
    python3 tools/prep-run-frames.py --dummy 2 --target enemy

Like `tools/prep-obstacle-image.py`, source frames are already single
subjects on a transparent background — they just need a tight alpha crop and
a uniform height so every frame scales consistently in the shared `RunCycle`
helper (see `PLAYER_FRAMES`/`ENEMY_FRAMES` in `src/config/runFrames.js` and
docs/image-assets.md).

`--target` (default `player`) picks the output directory
(`public/assets/sprites/<target>`), the config-constant reminder
(`PLAYER_FRAME_COUNT` / `ENEMY_FRAME_COUNT`) and the dummy-mode colours
(green for player, red for enemy); `--out-dir` overrides the directory.

Source mode, per image (in argument order):
  1. open as RGBA
  2. crop to the alpha bounding box (`Image.getbbox()`) — no padding, feet
     (bottom of the art) end up on the bottom edge of the crop
  3. resize with LANCZOS so the output height == --height, keeping aspect
     (width follows); default 280 = 2x logical (matches obstacle sprites)
  4. save as `public/assets/sprites/<target>/run-<i>.png`, i starting at 0

Dummy mode (`--dummy N`): draws N placeholder run-cycle frames with PIL
ImageDraw — a stylised zombie silhouette in the target's placeholder colour
with a darker outline, legs alternating stride per frame — so the
frame-loading/advancing pipeline can be exercised before real art exists.

Either mode deletes any existing `run-*.png` in the output directory first,
so stale frames from a previous, larger frame count never linger.

Needs pillow (pip3 install --user pillow).
"""
import argparse
import glob
import math
import os

from PIL import Image, ImageDraw

DEFAULT_HEIGHT = 280

# Per-target output dir, config-constant reminder, and dummy-mode colours.
TARGETS = {
    'player': {
        'out_dir': 'public/assets/sprites/player',
        'frame_count_const': 'PLAYER_FRAME_COUNT',
        'color': (0x00, 0xff, 0x88, 255),
        'outline': (0x00, 0x88, 0x48, 255),
    },
    'enemy': {
        'out_dir': 'public/assets/sprites/enemy',
        'frame_count_const': 'ENEMY_FRAME_COUNT',
        'color': (0xff, 0x33, 0x33, 255),
        'outline': (0x8a, 0x1a, 0x1a, 255),
    },
}


def clear_stale_frames(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    stale = sorted(glob.glob(os.path.join(out_dir, 'run-*.png')))
    for path in stale:
        os.remove(path)
    if stale:
        print(f'removed stale frames: {", ".join(stale)}')


def print_reminder(n, frame_count_const):
    print(f'set {frame_count_const} = {n} in src/config/gameConfig.js')


def prep_sources(images, out_dir, height, frame_count_const):
    clear_stale_frames(out_dir)
    for i, image in enumerate(images):
        src = Image.open(image).convert('RGBA')
        print(f'{image}: {src.width}x{src.height}')

        bbox = src.getbbox()
        if bbox is None:
            raise SystemExit(f'{image} is fully transparent, nothing to crop')
        cropped = src.crop(bbox)
        print(f'  cropped to alpha bbox {cropped.width}x{cropped.height}')

        scale = height / cropped.height
        out_w = round(cropped.width * scale)
        out = cropped.resize((out_w, height), Image.LANCZOS)

        dest = os.path.join(out_dir, f'run-{i}.png')
        out.save(dest, optimize=True)
        print(f'  wrote {dest} ({out.width}x{out.height})')

    print_reminder(len(images), frame_count_const)


def stride_spread(i, n):
    """Leg spread fraction in [-1, 1] for frame i of n (even i one direction,
    odd the other; interpolated with a sine wave over the cycle for n > 2).
    Cosine (rather than sine) is used so it peaks at +-1 exactly on the
    even/odd frames instead of crossing zero there."""
    if n <= 1:
        return 0.0
    return math.cos(2 * math.pi * i / n)


def draw_dummy_frame(height, spread, color, outline):
    width = round(height * 0.55)
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx = width / 2
    head_r = height * 0.13
    head_cy = head_r + height * 0.02
    neck_y = head_cy + head_r * 0.9
    torso_top = neck_y
    torso_bottom = height * 0.62
    hip_y = torso_bottom
    leg_bottom = height - 1  # feet touch the bottom edge

    outline_w = max(2, round(height * 0.02))

    # Legs — spread alternates stride direction/amount per frame.
    leg_spread_px = spread * width * 0.28
    left_foot_x = cx - width * 0.10 - leg_spread_px
    right_foot_x = cx + width * 0.10 + leg_spread_px
    leg_w = max(3, round(width * 0.14))

    for foot_x in (left_foot_x, right_foot_x):
        draw.line([(cx, hip_y), (foot_x, leg_bottom)], fill=outline,
                   width=leg_w + outline_w)
    for foot_x in (left_foot_x, right_foot_x):
        draw.line([(cx, hip_y), (foot_x, leg_bottom)], fill=color,
                   width=leg_w)

    # Torso.
    torso_w = width * 0.34
    draw.rounded_rectangle(
        [cx - torso_w / 2 - outline_w, torso_top - outline_w,
         cx + torso_w / 2 + outline_w, torso_bottom + outline_w],
        radius=torso_w / 2 + outline_w, fill=outline)
    draw.rounded_rectangle(
        [cx - torso_w / 2, torso_top, cx + torso_w / 2, torso_bottom],
        radius=torso_w / 2, fill=color)

    # Arms stuck out forward (to the right), zombie-style.
    arm_y = torso_top + (torso_bottom - torso_top) * 0.35
    arm_len = width * 0.42
    arm_w = max(3, round(width * 0.12))
    for dy in (-height * 0.03, height * 0.05):
        draw.line([(cx, arm_y), (cx + arm_len, arm_y + dy)], fill=outline,
                   width=arm_w + outline_w)
    for dy in (-height * 0.03, height * 0.05):
        draw.line([(cx, arm_y), (cx + arm_len, arm_y + dy)], fill=color,
                   width=arm_w)

    # Head — rounded, drawn last so it sits over the neck/torso.
    draw.ellipse(
        [cx - head_r - outline_w, head_cy - head_r - outline_w,
         cx + head_r + outline_w, head_cy + head_r + outline_w],
        fill=outline)
    draw.ellipse(
        [cx - head_r, head_cy - head_r, cx + head_r, head_cy + head_r],
        fill=color)

    return img


def prep_dummy(n, out_dir, height, frame_count_const, color, outline):
    clear_stale_frames(out_dir)
    for i in range(n):
        spread = stride_spread(i, n)
        img = draw_dummy_frame(height, spread, color, outline)
        dest = os.path.join(out_dir, f'run-{i}.png')
        img.save(dest, optimize=True)
        print(f'  wrote {dest} ({img.width}x{img.height})')

    print_reminder(n, frame_count_const)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('images', nargs='*', help='source PNGs (RGBA, transparent '
                                               'background), in frame order')
    ap.add_argument('--dummy', type=int, metavar='N',
                    help='generate N placeholder frames instead of using source images')
    ap.add_argument('--target', choices=sorted(TARGETS), default='player',
                    help='which character to prep frames for (default player)')
    ap.add_argument('--out-dir', default=None,
                    help='output directory (default depends on --target)')
    ap.add_argument('--height', type=int, default=DEFAULT_HEIGHT,
                    help=f'output height in px (default {DEFAULT_HEIGHT})')
    args = ap.parse_args()

    if bool(args.images) == bool(args.dummy):
        raise SystemExit('pass either source images or --dummy N, not both')

    target = TARGETS[args.target]
    out_dir = args.out_dir or target['out_dir']

    if args.dummy is not None:
        prep_dummy(args.dummy, out_dir, args.height, target['frame_count_const'],
                   target['color'], target['outline'])
    else:
        prep_sources(args.images, out_dir, args.height, target['frame_count_const'])


if __name__ == '__main__':
    main()
