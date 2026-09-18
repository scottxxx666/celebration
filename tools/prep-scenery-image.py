#!/usr/bin/env python3
"""Turn a generated image (ChatGPT et al.) into a usable road/scenery layer.

    python3 tools/prep-scenery-image.py road    shot.png [--out public/assets/bg/road-day.png]
    python3 tools/prep-scenery-image.py scenery shot.png --offset -120

Image models only emit 1024x1024 / 1536x1024 / 1024x1536 and never tile, so every
generated layer needs the same mechanical pass before the game can use it:

  1. crop the widest band of the target aspect (no squashing — the top and bottom
     of the frame are thrown away, which is what the prompts tell the model to expect)
  2. resize to the exact target box (road 1600x540, scenery 1600x360)
  3. force the left<->right seam so the tile actually repeats
  4. report the edge-row colours to paste into SCENERY_THEMES (src/objects/Scenery.js)

See docs/image-assets.md. Needs pillow (pip3 install --user pillow).
"""
import argparse
import os

from PIL import Image

# Target boxes, 2x the logical layer size (docs/image-assets.md)
TARGETS = {
    'road': (1600, 540),
    'scenery': (1600, 360),
}


def crop_band(im, aspect, offset):
    """Widest band of `aspect` that fits, centred, then nudged by `offset` px."""
    w, h = im.size
    band_h = round(w / aspect)
    if band_h <= h:
        top = max(0, min(h - band_h, (h - band_h) // 2 + offset))
        return im.crop((0, top, w, top + band_h))
    # Input is already wider than the target aspect — crop width instead
    band_w = round(h * aspect)
    left = max(0, min(w - band_w, (w - band_w) // 2))
    return im.crop((left, 0, left + band_w, h))


def force_seam(im, blend):
    """Make the image tile horizontally by mirror-blending its right edge.

    The last `blend` columns cross-fade into a mirrored copy of the first `blend`,
    so the final column ends up identical to column 0 — the tile joins cleanly at
    the cost of a faint mirrored ghost in that strip. Keep `blend` small relative
    to the width (the default is 3% of 1600) and the ghost reads as texture.
    """
    if blend <= 0:
        return im
    w, h = im.size
    blend = min(blend, w // 4)
    mirrored = im.crop((0, 0, blend, h)).transpose(Image.FLIP_LEFT_RIGHT)
    # linear_gradient is a top->bottom ramp; rotate it to run left->right
    mask = Image.linear_gradient('L').transpose(Image.ROTATE_90).resize((blend, h))
    mask = mask.point(lambda v: int(255 * (3 * (v / 255) ** 2 - 2 * (v / 255) ** 3)))  # smoothstep
    out = im.copy()
    out.paste(mirrored, (w - blend, 0), mask)
    return out


def seam_delta(im):
    """Max channel difference across the wrap (column w-1 vs column 0). 0 = exact."""
    w, h = im.size
    first = list(im.crop((0, 0, 1, h)).getdata())
    last = list(im.crop((w - 1, 0, w, h)).getdata())
    return max(max(abs(a[i] - b[i]) for i in range(3)) for a, b in zip(first, last))


def row_hex(im, y):
    """Average colour of one pixel row, as 0xRRGGBB — a SCENERY_THEMES value."""
    row = list(im.crop((0, y, im.width, y + 1)).getdata())
    avg = tuple(sum(px[i] for px in row) // len(row) for i in range(3))
    return '0x{:02x}{:02x}{:02x}'.format(*avg), avg


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('layer', choices=sorted(TARGETS), help='which layer this image is')
    ap.add_argument('image', help='the generated image')
    ap.add_argument('--out', help='output path (default: <input>-prepped.png — it never '
                                  'writes into public/assets/bg unless you say so)')
    ap.add_argument('--offset', type=int, default=0,
                    help='shift the cropped band down (+) or up (-) in source px; needed '
                         'when the horizon or the road is not vertically centred')
    ap.add_argument('--blend', type=int, default=48,
                    help='seam cross-fade width in px (0 = leave the seam alone)')
    args = ap.parse_args()

    tw, th = TARGETS[args.layer]
    src = Image.open(args.image).convert('RGB')
    print(f'{args.image}: {src.width}x{src.height} -> {args.layer} {tw}x{th}')

    band = crop_band(src, tw / th, args.offset)
    print(f'  cropped band {band.width}x{band.height}'
          f'{" (offset %+d)" % args.offset if args.offset else ""}')

    out = band.resize((tw, th), Image.LANCZOS)
    before = seam_delta(out)
    out = force_seam(out, args.blend)
    print(f'  seam delta {before} -> {seam_delta(out)}'
          f'{" (blend %dpx)" % args.blend if args.blend else " (seam untouched)"}')

    top_hex, top_rgb = row_hex(out, 0)
    bot_hex, bot_rgb = row_hex(out, th - 1)
    print(f'  top row    {top_hex} {top_rgb}'
          + ('   <- theme.sky' if args.layer == 'scenery' else '   (must match the scenery PNG\'s bottom row)'))
    print(f'  bottom row {bot_hex} {bot_rgb}'
          + ('   <- theme.ground' if args.layer == 'road' else '   (must match the road PNG\'s top row)'))

    dest = args.out or f'{os.path.splitext(args.image)[0]}-prepped.png'
    out.save(dest)
    print('  wrote', dest)


if __name__ == '__main__':
    main()
