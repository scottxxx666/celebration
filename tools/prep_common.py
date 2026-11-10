"""Helpers shared by the sprite prep scripts."""

CORNER_ALPHA_MAX = 8


def require_transparency(img, label):
    """Exit with a helpful message unless all four corners of an RGBA image
    are (nearly) transparent. Image generators sometimes return an opaque
    backdrop or a drawn checkerboard instead of real alpha, which would
    defeat the alpha bounding-box crop."""
    w, h = img.size
    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    alphas = [img.getpixel(c)[3] for c in corners]
    if all(a <= CORNER_ALPHA_MAX for a in alphas):
        return
    raise SystemExit(
        f'{label} has no real transparent background (corner alpha '
        f'{alphas}): it has an opaque backdrop or a drawn checkerboard. '
        'Regenerate it with a transparent background, or remove the '
        'background first, e.g. `uvx rembg i in.png out.png` (one '
        'suggestion).')
