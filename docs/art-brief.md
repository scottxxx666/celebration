# Obstacle Sprite Art Brief

## Context
This is for a 2D side-scrolling game with a fake-3D ground plane illusion (Little Fighter 2 style).
The game has 3 depth rows — objects in the back row look far away, objects in the front row look close.

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
- **Canvas size**: any — `tools/prep-obstacle-image.py` crops to the alpha bounding box and
  resizes to 280 px tall (2× the logical size). Supply at least that height; see
  `docs/image-assets.md` for the pipeline
- **Anchor point**: the base (feet/bottom) is the lowest opaque pixel — after the crop it
  sits on the image's bottom edge, which the game places on the row's feet line

### Viewing Angle
- **Side view**, slightly from above (~10–15° downward tilt)
- Think: how you'd see someone standing on the ground if you were nearby and looking slightly down

### Style
- Clear outlines, readable silhouette
- Consistent light source: **top-left**
- No shadow drawn into the sprite — shadow is added by the game engine

### What NOT to Do
- Don't draw the ground or floor in the sprite
- Don't add a shadow to the sprite itself
- Don't make it isometric (diamond-angle) — simple side view is correct

---

## Object List

Obstacles are **character cutouts**, registered in `src/config/obstacleSprites.js`
(`OBSTACLE_SPRITES`). Each blocks exactly one row regardless of how tall the art is.

General guidelines for good obstacle shapes:
- Readable silhouette at ~140 px tall on an 800×450 screen
- Feet/base clearly on the ground, so the drop shadow looks natural underneath
- Keep the body roughly as wide as the pose needs — the collision half-width (`hw`) is
  tuned per image, and a wide pose blocks its row for longer

---

## Scale Reference (How the Game Uses Sprites)

The game automatically resizes sprites depending on which depth row they appear in
(`ROW_SCALE_BACK` → `ROW_SCALE_FRONT` in `gameConfig.js`):

| Row | Distance | Scale |
|-----|----------|-------|
| Row 1 (top) | Far | 90% |
| Row 2 (mid) | Mid | 95% |
| Row 3 (bottom) | Near | 100% |

Design at full (front-row) size.

---

## Example Reference Games
- Little Fighter 2 — ground objects (barrels, rocks)
- Streets of Rage — environment props
- Castle Crashers — enemy sprites (side view, slight overhead angle)
