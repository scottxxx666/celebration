# Image Assets — Runner & Obstacle Sprites

Concrete pixel sizes and export specs for replacing the placeholder rectangles
(player `Player.js`, obstacles `ObstacleSpawner.js`) with images. Style/angle
guidance lives in `docs/art-brief.md`; this doc is the sizing spec.

## How the game displays images (why sizes are what they are)

- The game renders internally at a fixed **800×450** framebuffer
  (`GAME_WIDTH`/`GAME_HEIGHT`); `Phaser.Scale.FIT` stretches that canvas via
  CSS to fill the screen. **Nothing is ever drawn sharper than its logical
  size in the 800×450 world** — oversized source art cannot add fullscreen
  sharpness, it only survives downscaling better.
- Sprites are drawn at their logical (front-row) size, then scaled **down**
  by the fake-3D row scale (0.6 back row → 1.0 front row, `rowLayout.js`).
- The only scale-ups ever applied are trivial: the disco zoom punch (×1.02)
  and the CSS stretch above. The rotate section zooms **out** (×0.49).
- Collision boxes never change with art — the player is always a 70×70 AABB,
  obstacles always block exactly one row (`collisionHh` in
  `ObstacleSpawner.js`). Art only needs to *read* correctly, not collide.

## Logical target sizes

Sizes the sprite will occupy on screen at front-row scale (w = `hw × 2`,
h = `visualHh × 2`, from `gameConfig.js` / `waves.js`):

| Use | Logical box (px) | Notes |
|---|---|---|
| **Runner (player)** | **70 × 70** | `PLAYER_HW/HH = 35`; beat pulse squashes height to 85% |
| Obstacle — small block | 50 × 50 | intro |
| Obstacle — low/wide | 60 × 40 and 50 × 40 | most common (high/low alternation) |
| Obstacle — tall/narrow | 40 × 100 | intro |
| Obstacle — big block | 80 × 100 | wave enders |
| Obstacle — wall | 60 × 108 | gap-run pairs; tall art may extend above the walk zone (by design) |
| (Enemy, if also swapped later) | 40 × 60 | `ENEMY_HW/HH = 20/30` |

Obstacles with similar aspect ratios can share one sprite (the engine scales
by width) — a minimal set is **4 obstacle sprites**: square-ish (~1:1),
low/wide (~3:2), tall/narrow (~2:5), and big wall (~4:5).

## Recommended source resolution

**Option A — Recommended: smooth/cartoon art at 2× logical size.**
Export each sprite at exactly **2× its logical box** (runner **140×140**,
low/wide obstacle 120×80, wall 120×216, …). 2× keeps back rows (drawn at
0.6× logical = 1.2× minification from a 2× source) crisp under linear
filtering, and is the ceiling of useful resolution given the 800×450
framebuffer. Anything larger (e.g. the 256×256 in the original art brief) is
wasted texture memory and can look *worse* when minified ~4× without mipmaps.

**Option B — Pixel art at exact 1× logical size.**
Author at the logical box itself (runner 70×70) and set `pixelArt: true` in
the Phaser game config so nearest-neighbor filtering keeps pixels crisp
through the CSS upscale. Best retro look and smallest files, but the art must
be authored pixel-perfect at these small sizes (a big pixel-art canvas scaled
down turns to mush), and the 0.6–0.9 row scales will shimmer slightly since
non-integer nearest-neighbor scaling drops pixel rows.

Pick per the final art style; don't mix (filtering mode is global).

## Export specs (both options)

- **Format**: PNG with alpha (PNG-24). No JPEG (no transparency), no WebP
  needed at these sizes.
- **Crop**: tight bounding box — no padding. The engine sizes sprites by
  their image dimensions, so empty margins would shrink the visible art and
  desync it from the collision box and shadow width.
- **Anchor**: design so the **feet/base sit exactly on the bottom edge** of
  the image. Obstacles are base-anchored to the row's feet line and tall art
  grows upward; the engine-drawn shadow ellipse marks ground contact.
- **No baked shadow, no ground** — the engine draws the drop shadow
  (`addShadow` in `rowLayout.js`).
- **Aspect ratio must match the target box** in the table above (e.g. the
  wall sprite must be authored at 5:9). If art is authored off-ratio, either
  the visual size or the collision fairness drifts.
- Power-of-two dimensions are **not** required (Phaser 3 WebGL handles NPOT
  textures for 2D sprites).

## Runner animation (optional, later)

The beat squash is done in code via `setScale`, so a single static frame
works day one. If a run cycle is wanted later, export a **horizontal
spritesheet** of uniform frames at the same per-frame size as above
(e.g. 6–8 frames × 140×140 → 840–1120 × 140) and step frames on the
Conductor's 8th-note grid so the run cycle stays on the music like
everything else.

## AI-generation prompts for the runner (from a real photo)

Two ways to get the runner sprite from a photo of the person. Both target
**Option A** (smooth cartoon at 2× = 140×140) — pixel art from a photo
doesn't survive at 70px.

**Why chibi proportions**: the runner's box is **square** (70×70). A
realistically proportioned person is ~1:3 wide:tall, so they'd either be
squashed to fit or fill only a third of the canvas width. Both prompts ask
for a chibi (2–2.5 heads tall) build so the character fills the square and
stays readable at 70px.

**Facing right**: obstacles scroll in from the right and the enemy chases
from the left, so the runner must face right.

### Prompt 1 — whole photo, AI restyles it into a sprite

Attach a clear, well-lit **full-body** photo (front or side view).

```
Turn the person in this photo into a 2D video-game character sprite.
Keep their likeness recognizable: face shape, hairstyle, skin tone, and
the outfit/colors from the photo.

Requirements:
- Full-body chibi proportions, about 2 to 2.5 heads tall, so the whole
  character fits a SQUARE canvas
- Mid-stride running pose, side view seen very slightly from above
  (~10-15 degrees), facing RIGHT
- Smooth cartoon style with clean bold outlines and flat cel shading,
  light source from the top-left
- Feet touching the exact bottom edge of the image, character centered
  horizontally, cropped tight with no empty margins
- Fully transparent background (PNG), no ground, no floor, NO drop
  shadow (the game engine adds the shadow)
- Output: 140 x 140 pixels, PNG with alpha
```

### Prompt 2 — only the face is real, AI draws the body

Attach a clear **head/face** photo (a casual portrait is fine). Fill in the
clothing description — the body is invented, so say what they should wear.

```
Draw a 2D video-game character sprite whose face is based on the person
in this photo. Capture their likeness — face shape, hairstyle, hair
color, skin tone, glasses/facial hair if present — as a cartoon, not a
photo cutout.

Design the body yourself: a chibi character about 2 to 2.5 heads tall
(oversized head, small body) wearing [DESCRIBE OUTFIT, e.g. "a red
hoodie, dark jeans and white sneakers"].

Requirements:
- Mid-stride running pose, side view seen very slightly from above
  (~10-15 degrees), facing RIGHT
- Smooth cartoon style with clean bold outlines and flat cel shading,
  light source from the top-left; the face must match the drawn style
  (same outlines/shading), not pasted-in photo texture
- Feet touching the exact bottom edge of the image, character centered
  horizontally, cropped tight with no empty margins
- Fully transparent background (PNG), no ground, no floor, NO drop
  shadow (the game engine adds the shadow)
- Output: 140 x 140 pixels, PNG with alpha
```

### After generation (both prompts)

Models often ignore the size/transparency lines, so check and fix:

1. **Background**: if it isn't truly transparent, remove it (e.g.
   Preview.app → Instant Alpha, or any background-removal tool).
2. **Crop** to the tight bounding box — no padding, feet on the bottom edge.
3. **Resize** to 140×140. If the tight crop isn't square, pad **width only**
   (transparent, centered) to make it square — never pad the bottom, and
   don't stretch.
4. Check readability: zoom the result down to 70px (and 60% of that for the
   back row) — the silhouette and face should still read.

## File locations

Place under `public/assets/` alongside `intro.mp4` / `music.m4a`, e.g.
`public/assets/sprites/runner.png`, `public/assets/sprites/obstacle-wall.png`;
load them in `BootScene` with the other assets.
