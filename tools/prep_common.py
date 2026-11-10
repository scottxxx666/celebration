"""Helpers shared by the sprite prep scripts."""

# Alpha at or below this is generator noise (faint specks across the
# background, a thin ring around the outline), not content.
ALPHA_NOISE_MAX = 8


def clean_alpha(img):
    """Return a copy of an RGBA image with every pixel whose alpha is at or
    below ALPHA_NOISE_MAX made fully transparent (RGBA 0), so the alpha
    bounding box ignores noise and the saved PNG carries no faint specks."""
    noise = img.getchannel('A').point(
        lambda a: 255 if a <= ALPHA_NOISE_MAX else 0)
    out = img.copy()
    out.paste((0, 0, 0, 0), mask=noise)
    return out


def require_transparency(img, label):
    """Exit with a helpful message unless all four corners of an RGBA image
    are (nearly) transparent. Image generators sometimes return an opaque
    backdrop or a drawn checkerboard instead of real alpha, which would
    defeat the alpha bounding-box crop."""
    w, h = img.size
    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    alphas = [img.getpixel(c)[3] for c in corners]
    if all(a <= ALPHA_NOISE_MAX for a in alphas):
        return
    raise SystemExit(
        f'{label} has no real transparent background (corner alpha '
        f'{alphas}): it has an opaque backdrop or a drawn checkerboard. '
        'Regenerate it with a transparent background, or remove the '
        'background first, e.g. `uvx rembg i in.png out.png` (one '
        'suggestion).')
