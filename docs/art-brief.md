# Obstacle Sprite Art Brief

## Context
This is for a 2D side-scrolling game with a fake-3D ground plane illusion (Little Fighter 2 style).
The game has 5 depth rows — objects in the back row look far away, objects in the front row look close.

---

## The Visual Trick (Important to Understand)
The game creates a 3D illusion using 3 things:
1. **Scale by depth** — the game code automatically scales sprites smaller in back rows, larger in front rows
2. **Drop shadow** — the game code draws an ellipse shadow beneath every object on the ground
3. **Your sprite** — should be a natural side-view object so the shadow + scale do the heavy lifting

**You do NOT need to draw isometric art.** Normal side-view sprites work great here.

---

## Sprite Requirements

### Format
- **File type**: PNG with transparent background
- **Canvas size**: 256 × 256 px (object should fill roughly 70–80% of canvas)
- **Anchor point**: object base (feet/bottom) should sit at the vertical center-bottom of the canvas

### Viewing Angle
- **Side view**, slightly from above (~10–15° downward tilt)
- Think: how you'd see a rock or barrel sitting on the ground if you were standing nearby and looking slightly down
- The "top" of the object should be slightly visible — not a pure flat side view

### Style
- **Pixel art preferred** — crisp pixels, no anti-aliasing on edges
- Smooth cartoon also acceptable if pixel art isn't available
- Clear outlines, readable silhouette
- Consistent light source: **top-left**
- No shadow drawn into the sprite — shadow is added by the game engine

### What NOT to Do
- Don't draw the ground or floor in the sprite
- Don't add a shadow to the sprite itself
- Don't make it isometric (diamond-angle) — simple side view is correct

---

## Object List

Objects are **photo-sourced** — the artist will pixelate/redraw based on reference photos provided.
For each object, provide a clear photo of it from a slight overhead-side angle as reference.

General guidelines for good obstacle shapes:
- Chunky, readable silhouette (avoid thin or tall objects — they're hard to read at small scale)
- Wide base (so the drop shadow looks natural underneath)
- Examples that work well: rocks, barrels, crates, stumps, bushes, sandbags

---

## Scale Reference (How the Game Uses Sprites)

The game will automatically resize sprites depending on which depth row they appear in:

| Row | Distance | Scale |
|-----|----------|-------|
| Row 1 (top) | Far | ~60% |
| Row 2 | | ~70% |
| Row 3 (mid) | Mid | ~80% |
| Row 4 | | ~90% |
| Row 5 (bottom) | Near | 100% |

So a 256px sprite at 100% scale is the "closest to camera" size. Design at full size.

---

## Example Reference Games
- Little Fighter 2 — ground objects (barrels, rocks)
- Streets of Rage — environment props
- Castle Crashers — enemy sprites (side view, slight overhead angle)
