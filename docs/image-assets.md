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
| Obstacle — character sprites | varies (`hw × 2` × `hh × 2`, `OBSTACLE_SPRITES`) | replaces the red rectangle; see below |
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

## Obstacle character sprites

Character cutouts (arbitrary size, transparent background) become obstacle
sprites via `tools/prep-obstacle-image.py`:

```
python3 tools/prep-obstacle-image.py original_images/kazuha_zombie.png \
    --out public/assets/sprites/obstacles/kazuha-zombie.png --height 216
```

It crops to the alpha bounding box (`Image.getbbox()`, no padding) and
resizes so the output height matches `--height` (default 216 = 2x the
tallest logical obstacle height, 108) — width follows the source aspect, so
sprites of different builds don't get distorted to a common box.

Each prepped PNG is registered in `src/config/obstacleSprites.js`
(`OBSTACLE_SPRITES`, `{ key, file, hh, hw }`), loaded by `BootScene`, and
picked by `ObstacleSpawner.spriteFor()`:

- `hh` — logical half-height at front-row scale; the sprite's *display*
  scale is derived from `hh` (`(hh * 2 / textureHeight) * rowScale`), so
  width scales along with it to preserve the source aspect ratio.
- `hw` — collision AABB half-width **and** the spawn-timing distance; tuned
  per image to roughly match its displayed half-width at that `hh` (not
  derived automatically, since art bleeds into transparent margins
  differently per pose). Collision height is still fixed to one row
  (`collisionHh` in `ObstacleSpawner.js`).
- Sprites render with origin `(0, 1)`: the left edge sits exactly on the
  collision box's left edge (`x - hw`) and the bottom edge sits on the row's
  feet line, matching the shadow anchor.

Things to be aware of:

- The wave `visualHh` values in `waves.js` are unused once a sprite is
  drawn — heights come only from the manifest `hh`. `visualHh` still sizes
  the placeholder rectangle when `OBSTACLE_SPRITES` is empty.
- Wall sections spawn four obstacles per beat, so a wide sprite (e.g. the
  zombie at `hw: 47`) makes those walls block a row noticeably longer than
  the authored `hw: 25`. If walls feel unfair, lower the wide sprites' `hw`
  toward 30 and accept some art trailing past the hitbox — the left
  (dangerous) edge stays aligned regardless.

## Road & background (the two scenery layers)

`GameScene` currently draws these as flat rectangles (`GameScene.js` create):

| Layer | Rect today | Logical box | Scrolls? |
|---|---|---|---|
| **Road** (walk zone) | `0x1a1a2e`, `y = WALK_ZONE_TOP` → bottom | **800 × 270** | yes, left, wraps every 800px |
| **Background** (scenery strip) | `0x2a4a2e`, `y = 0` → `WALK_ZONE_TOP` | **800 × 180** | no (static) |
| Horizon line | `0x88aa66`, 2px at `y = WALK_ZONE_TOP` | 800 × 2 | no |

Both sit at depth −10, under everything. Export at **2×** like the sprites:
road **1600 × 540**, background **1600 × 360**. Opaque PNG (no alpha needed).

Constraints that come from the engine, not taste:

- **The road must tile seamlessly left↔right.** It scrolls by
  `player.speed × section.speedMult` and wraps at exactly `GAME_WIDTH`, so the
  left and right edges have to match pixel-for-pixel. No baked vignette or
  one-off landmark that would pop at the seam.
- **The road must NOT tile vertically** — its top edge is the far end of the
  fake-3D ground plane, its bottom edge is nearest the camera.
- **Rows are equal height, not perspective-compressed.** 5 rows × 54 logical px
  (108px at 2×). A true converging perspective grid fights the layout; equal
  horizontal bands at those offsets do not, and they help players read which
  row an obstacle is in.
- **Keep the road mid-dark and low-contrast.** The engine drops a black ellipse
  shadow at alpha 0.3 under every object, flashes the whole walk zone white on
  the beat, and fades a black dim overlay in during `disco` sections — a road
  that is already near-black kills the shadows, and a busy one buries the 70px
  sprites.
- **Nothing on the road that looks like an obstacle.** Every solid, chunky shape
  on the ground reads as something to dodge.
- **Tall obstacles overhang the background.** A wall sprite in the back row
  crosses above `y = 180`, so keep the scenery strip silhouette-y and
  low-contrast enough that a wall still reads against it.
- The background's bottom edge is where it meets the road; design the last few
  pixels as the horizon seam (then the code's 2px line is optional). Making it
  seamlessly tileable too is cheap insurance if it ever gets parallax.

### Prompt template — road

Paste as-is, replacing `[SCENE]` with one block from the table below.

```
Draw a seamless side-scrolling game ground texture: a top-down-ish
ground plane seen from a low camera looking slightly down, for a 2D
runner game.

Scene: [SCENE]

Requirements:
- Seamlessly tileable LEFT to RIGHT: the left and right edges must match
  exactly so the image can repeat horizontally forever. Not tileable
  vertically.
- The top edge is the far distance, the bottom edge is closest to the
  camera. Suggest depth by making surface detail finer and slightly
  darker toward the top, coarser and slightly brighter toward the bottom.
- Divide the surface into 5 equal horizontal lanes with very subtle
  boundaries (a faint seam, tone shift or scuff line every 108 pixels) —
  subtle, not bold painted lines.
- Smooth cartoon style, clean flat cel shading, light source from the
  top-left, matching a cartoon character sprite that will run on top.
- Medium-dark overall value with LOW contrast: bright enough that a soft
  black drop shadow reads on it, flat enough that small 70px character
  sprites stay readable above it.
- No characters, no vehicles, no props, no obstacles, no text, no
  watermark, no vignette, no border, no lighting hotspot.
- Fill the entire canvas, edge to edge. No margins, no frame.
- Output: 1600 x 540 pixels, PNG.
```

### Prompt template — background

```
Draw a background scenery strip for a 2D side-scrolling runner game: a
wide, distant backdrop seen from ground level, sitting above the
horizon.

Scene: [SCENE]

Requirements:
- Very wide, short letterbox composition. The bottom edge of the image
  is the horizon line where the ground begins — the scenery sits on it,
  nothing hangs below it.
- Distant and atmospheric: mostly silhouettes and simple flat shapes with
  soft haze, LOW contrast and low detail, as if far away. It must never
  compete with the characters running in front of it.
- Smooth cartoon style, clean flat cel shading, light source from the
  top-left.
- Seamlessly tileable left to right (left and right edges match exactly).
- No characters in focus, no foreground props, no text, no watermark, no
  vignette, no border.
- Fill the entire canvas, edge to edge. No margins, no frame.
- Output: 1600 x 360 pixels, PNG.
```

### The four `[SCENE]` blocks

| Variant | Road `[SCENE]` | Background `[SCENE]` |
|---|---|---|
| **Night city** | Wet night asphalt street, dark blue-grey, faint puddles reflecting pink and cyan neon, painted lane scuffs, manhole covers and cracks worn flat | Night city skyline: dark building silhouettes with lit windows, glowing pink/cyan neon signs and street lamps, deep blue sky fading to purple at the horizon |
| **Day city** | Sunlit grey asphalt street, warm mid-grey, faded white lane markings, light cracks and tar seams, occasional drain grate | Daytime city skyline: pale buildings and rooftops in soft haze, a few trees and street lamps, bright blue sky with flat cartoon clouds |
| **Gym** | Indoor gym floor: pale honey-coloured wooden boards running left to right, faint painted court lines in red and blue, subtle polished sheen | Gym interior wall: racks of dumbbells and weight plates, a wall mirror, hanging championship banners and a scoreboard, all flat and muted |
| **Disco / party** | Glossy black-and-white checkered dance floor with a wet mirror-like sheen, faint coloured light pools smeared across it | Nightclub interior: dark wall with stacked speakers, a DJ booth, a mirror ball, strings of party lights and confetti, silhouetted dancing crowd along the bottom |

### After generation

1. **Check the seam**: duplicate the road side by side and look at the join.
   Most models fake tileability — expect to fix it (Photoshop offset filter,
   or `imagemagick -roll +800+0` then paint out the seam).
2. **Resize** to exactly 1600×540 / 1600×360, no crop that shifts the horizon.
3. **Sanity check at real size**: view the road at 800×270 with a 70px sprite
   and a 30% black ellipse on it — if the shadow vanishes, the road is too dark;
   if the sprite gets lost, the road is too busy.
4. Keep one road + one background per variant so a theme can be swapped as a
   pair.

**Handling the rotate section**: the `rotate` section zooms the camera out to
0.49 and spins it, which would otherwise reveal area outside the 800×450
world. `Scenery` (`src/objects/Scenery.js`) handles this in code, not art: both
tileSprites are widened in x to cover the circle the zoomed-out, spinning
camera sweeps, with flat sky/ground fill rectangles (`theme.sky`/`theme.ground`)
extending beyond them so no black ever shows.

## File locations

Place under `public/assets/` alongside `intro.mp4` / `music.m4a`, e.g.
`public/assets/sprites/runner.png`, `public/assets/sprites/obstacle-wall.png`,
`public/assets/bg/road-night.png`, `public/assets/bg/scenery-night.png`;
`BootScene` loads the active theme's pair via the `SCENERY_THEMES` table in
`src/objects/Scenery.js`, which owns both layers. The road and the background
are **both** `add.tileSprite` (not `add.image`) — the background needs one too
because of the rotate-section oversizing above, even though it never scrolls;
the road's `tilePositionX` replaces the old manual `bgX` wrap in
`GameScene.update`.
