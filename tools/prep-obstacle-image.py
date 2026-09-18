#!/usr/bin/env python3
"""Turn a generated character cutout into an obstacle sprite.

    python3 tools/prep-obstacle-image.py original_images/kazuha_zombie.png
    python3 tools/prep-obstacle-image.py original_images/"chaewon_ flamingo.png" \
        --out public/assets/sprites/obstacles/chaewon-flamingo.png --height 280

Unlike the scenery images (crop_band + force_seam), these source images are
already single subjects on a transparent background at large, uneven sizes —
they just need a tight alpha crop and a uniform height so every obstacle
sprite scales consistently in `ObstacleSpawner.js` (see `OBSTACLE_SPRITES` in
`src/config/obstacleSprites.js` and docs/image-assets.md).

  1. open as RGBA
  2. crop to the alpha bounding box (`Image.getbbox()`) — no padding, feet
     (bottom of the art) end up on the bottom edge of the crop
  3. resize with LANCZOS so the output height == --height, keeping aspect
     (width follows); default 280 = 2x the tallest logical obstacle height
     (140, the wall sprite, docs/image-assets.md)
  4. save as PNG with optimize=True

Needs pillow (pip3 install --user pillow).
"""
import argparse
import os

from PIL import Image

DEFAULT_HEIGHT = 280


def slugify(path):
    base = os.path.splitext(os.path.basename(path))[0]
    return base.lower().replace(' ', '').replace('_', '-')


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('image', help='source PNG (RGBA, transparent background)')
    ap.add_argument('--out', help='output path (default: '
                                  'public/assets/sprites/obstacles/<slug>.png)')
    ap.add_argument('--height', type=int, default=DEFAULT_HEIGHT,
                    help=f'output height in px (default {DEFAULT_HEIGHT})')
    args = ap.parse_args()

    src = Image.open(args.image).convert('RGBA')
    print(f'{args.image}: {src.width}x{src.height}')

    bbox = src.getbbox()
    if bbox is None:
        raise SystemExit('image is fully transparent, nothing to crop')
    cropped = src.crop(bbox)
    print(f'  cropped to alpha bbox {cropped.width}x{cropped.height}')

    scale = args.height / cropped.height
    out_w = round(cropped.width * scale)
    out = cropped.resize((out_w, args.height), Image.LANCZOS)

    dest = args.out or f'public/assets/sprites/obstacles/{slugify(args.image)}.png'
    os.makedirs(os.path.dirname(dest) or '.', exist_ok=True)
    out.save(dest, optimize=True)
    print(f'  wrote {dest} ({out.width}x{out.height})')


if __name__ == '__main__':
    main()
