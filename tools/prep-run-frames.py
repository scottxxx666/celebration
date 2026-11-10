#!/usr/bin/env python3
"""Turn source run-cycle frames into player or enemy sprite frames, or
generate placeholder frames so the pipeline works before real art exists.

    python3 tools/prep-run-frames.py original_images/player/run-1.png \
        original_images/player/run-2.png
    python3 tools/prep-run-frames.py --sheet 3 original_images/player/sheet.png
    python3 tools/prep-run-frames.py --sheet 3x2 original_images/player/sheet.png
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

`--sheet N` takes exactly ONE image holding N frames side by side (left to
right = frame order) and splits it into N frames first (`split_sheet`):
content segments are runs of columns with any alpha above the noise threshold (segments narrower
than 2% of the width are specks and ignored; the count must equal N), cells
are cut at the midpoint of each gap between segments, and every cell is
padded to the widest cell width with its own centre kept at the centre of the
padded canvas, at the full sheet height. The frames then go through the
source pipeline below. Not combinable with `--dummy`.

`--sheet COLSxROWS` (e.g. `3x2`; `X` also accepted; plain `N` means `Nx1`)
takes a grid, frames in row-major order (top row left to right, then the next
row). Rows are found like columns (runs of non-empty rows, specks narrower
than 2% of the height ignored; the count must equal ROWS) and cut at the
midpoints of the gaps between them (first strip from y=0, last to the sheet
height). Each row strip is split into COLS cells with `split_sheet`, then
every cell of every row is padded to the max width and max height with its
centre kept at the canvas centre (`split_grid`).

Source mode (images in argument order, or the split sheet):
  1. open all as RGBA; each must have transparent corners (real alpha, not
     an opaque backdrop or drawn checkerboard); they must share one canvas
     size (cells of one sheet, character placed consistently)
  2. zero faint alpha noise (alpha <= `ALPHA_NOISE_MAX`, `clean_alpha`), take
     each image's alpha bounding box (`Image.getbbox()`) and crop every
     frame to the UNION of them — no padding — so the character keeps the
     same scale and position across frames
  3. resize all with ONE shared LANCZOS scale so the output height ==
     --height, keeping aspect (width follows); default 280 = 2x logical
     (matches obstacle sprites)
  4. save each as `public/assets/sprites/<target>/run-<i>.png`, i starting at 0

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

from prep_common import ALPHA_NOISE_MAX, clean_alpha, require_transparency

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


SPECK_FRACTION = 0.02


def content_segments(img, axis='x'):
    """(start, end) ranges (end exclusive) of runs of non-empty columns
    (axis 'x') or rows (axis 'y'), ignoring runs narrower than SPECK_FRACTION
    of that dimension."""
    alpha = img.getchannel('A').point(lambda a: 255 if a > ALPHA_NOISE_MAX else 0)
    if axis == 'y':
        length = img.height
        occupied = [alpha.crop((0, y, img.width, y + 1)).getbbox() is not None
                    for y in range(length)]
    else:
        length = img.width
        occupied = [alpha.crop((x, 0, x + 1, img.height)).getbbox() is not None
                    for x in range(length)]
    segments, start = [], None
    for i, occ in enumerate(occupied + [False]):
        if occ and start is None:
            start = i
        elif not occ and start is not None:
            segments.append((start, i))
            start = None
    min_len = SPECK_FRACTION * length
    return [s for s in segments if s[1] - s[0] >= min_len]


def cut_bounds(segments, length):
    """Cut positions: 0, the midpoint of each gap between segments, length."""
    bounds = [0]
    for (_, end), (start, _) in zip(segments, segments[1:]):
        bounds.append((end + start) // 2)
    bounds.append(length)
    return bounds


def parse_sheet(value):
    """'N' -> (N, 1); 'CxR' / 'CXR' -> (C, R). Exits on anything else."""
    parts = str(value).lower().split('x')
    if len(parts) not in (1, 2) or not all(p.isdigit() for p in parts):
        raise SystemExit(f'--sheet expects N or COLSxROWS (e.g. 3x2), got {value!r}')
    cols, rows = int(parts[0]), int(parts[1]) if len(parts) == 2 else 1
    if cols < 1 or rows < 1:
        raise SystemExit(f'--sheet columns and rows must be at least 1, got {value!r}')
    return cols, rows


def split_sheet(img, n, where=''):
    """Split an RGBA sheet of n frames side by side into n equal-size RGBA
    images (see module docstring). `where` names the row in error messages."""
    segments = content_segments(img)
    if len(segments) != n:
        found = ', '.join(f'{a}-{b}' for a, b in segments) or 'none'
        raise SystemExit(f'expected {n} frames{where} in the sheet but found '
                         f'{len(segments)} content segments (x ranges: {found})')
    bounds = cut_bounds(segments, img.width)
    cells = [img.crop((bounds[i], 0, bounds[i + 1], img.height))
             for i in range(n)]
    return pad_to_common(cells)


def pad_to_common(cells):
    """Pad every cell to the max width and height, each cell's centre kept at
    the centre of the padded canvas."""
    width = max(c.width for c in cells)
    height = max(c.height for c in cells)
    out = []
    for c in cells:
        canvas = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        canvas.paste(c, ((width - c.width) // 2, (height - c.height) // 2))
        out.append(canvas)
    return out


def split_grid(img, cols, rows):
    """Split a cols x rows RGBA sheet into cols*rows equal-size frames in
    row-major order (see module docstring)."""
    segments = content_segments(img, 'y')
    if len(segments) != rows:
        found = ', '.join(f'{a}-{b}' for a, b in segments) or 'none'
        raise SystemExit(f'expected {rows} rows in the sheet but found '
                         f'{len(segments)} content segments (y ranges: {found})')
    bounds = cut_bounds(segments, img.height)
    cells = []
    for r in range(rows):
        strip = img.crop((0, bounds[r], img.width, bounds[r + 1]))
        where = f' in row {r + 1}' if rows > 1 else ''
        cells.extend(split_sheet(strip, cols, where))
    return pad_to_common(cells)


def prep_sources(images, out_dir, height, frame_count_const):
    clear_stale_frames(out_dir)
    srcs = [Image.open(image).convert('RGBA') for image in images]
    prep_frames(images, srcs, out_dir, height, frame_count_const)


def prep_sheet(image, cols, rows, out_dir, height, frame_count_const):
    clear_stale_frames(out_dir)
    src = Image.open(image).convert('RGBA')
    require_transparency(src, image)
    frames = split_grid(src, cols, rows)
    n = len(frames)
    labels = [f'{image}[{i + 1}/{n}]' for i in range(n)]
    prep_frames(labels, frames, out_dir, height, frame_count_const,
                check_alpha=False)


def prep_frames(images, srcs, out_dir, height, frame_count_const,
                check_alpha=True):
    if len({src.size for src in srcs}) > 1:
        sizes = '\n'.join(f'  {image}: {src.width}x{src.height}'
                          for image, src in zip(images, srcs))
        raise SystemExit('source frames must share one canvas size:\n' + sizes)

    boxes = []
    srcs = list(srcs)
    for i, image in enumerate(images):
        if check_alpha:
            require_transparency(srcs[i], image)
        srcs[i] = clean_alpha(srcs[i])
        bbox = srcs[i].getbbox()
        if bbox is None:
            raise SystemExit(f'{image} is fully transparent, nothing to crop')
        boxes.append(bbox)
    union = (min(b[0] for b in boxes), min(b[1] for b in boxes),
             max(b[2] for b in boxes), max(b[3] for b in boxes))
    union_w, union_h = union[2] - union[0], union[3] - union[1]
    print(f'canvas {srcs[0].width}x{srcs[0].height}, union alpha bbox {union} '
          f'({union_w}x{union_h})')

    scale = height / union_h
    out_size = (round(union_w * scale), height)
    print(f'shared output size {out_size[0]}x{out_size[1]}')

    for i, (image, src) in enumerate(zip(images, srcs)):
        out = src.crop(union).resize(out_size, Image.LANCZOS)

        dest = os.path.join(out_dir, f'run-{i}.png')
        out.save(dest, optimize=True)
        print(f'  {image} -> wrote {dest}')

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
    ap.add_argument('--sheet', metavar='N|COLSxROWS',
                    help='one source image holding the frames: N = N frames '
                         'side by side, COLSxROWS (e.g. 3x2) = a grid; frame '
                         'order is row-major (left to right, top row first)')
    ap.add_argument('--target', choices=sorted(TARGETS), default='player',
                    help='which character to prep frames for (default player)')
    ap.add_argument('--out-dir', default=None,
                    help='output directory (default depends on --target)')
    ap.add_argument('--height', type=int, default=DEFAULT_HEIGHT,
                    help=f'output height in px (default {DEFAULT_HEIGHT})')
    args = ap.parse_args()

    if args.sheet is not None:
        if args.dummy:
            raise SystemExit('--sheet cannot be combined with --dummy')
        if len(args.images) != 1:
            raise SystemExit('--sheet takes exactly one source image')
        cols, rows = parse_sheet(args.sheet)
        target = TARGETS[args.target]
        prep_sheet(args.images[0], cols, rows, args.out_dir or target['out_dir'],
                   args.height, target['frame_count_const'])
        return

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
