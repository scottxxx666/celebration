# Image Assets — Runner & Obstacle Sprites

Concrete pixel sizes, export specs and prep pipelines for the game's images
(player/enemy run cycles, obstacle sprites, road and background). Style/angle
guidance lives in `docs/art-brief.md`; this doc is the sizing spec.

## How the game displays images (why sizes are what they are)

- The game renders internally at a fixed **800×450** framebuffer
  (`GAME_WIDTH`/`GAME_HEIGHT`); `Phaser.Scale.FIT` stretches that canvas via
  CSS to fill the screen. **Nothing is ever drawn sharper than its logical
  size in the 800×450 world** — oversized source art cannot add fullscreen
  sharpness, it only survives downscaling better.
- Sprites are drawn at their logical (front-row) size, then scaled **down**
  by the fake-3D row scale (0.9 back row → 1.0 front row, `ROW_SCALE_BACK`/
  `ROW_SCALE_FRONT`, applied in `rowLayout.js`).
- The only scale-ups ever applied are trivial: the `zoomPunch` section zoom punch (×1.02)
  and the CSS stretch above. The rotate section zooms **out** (×0.49).
- Collision boxes never change with art — the player is always a 90×90 AABB,
  obstacles always block exactly one row (`COLLISION_HH` in
  `ObstacleSpawner.js`). Art only needs to *read* correctly, not collide.

## Logical target sizes

Sizes the sprite will occupy on screen at front-row scale (w = `hw × 2`,
h = `hh × 2`, from `gameConfig.js` / `OBSTACLE_SPRITES`):

| Use | Logical box (px) | Notes |
|---|---|---|
| **Runner (player)** | collision 90 × 90, art `PLAYER_SPRITE_HH × 2` tall | `PLAYER_HW/HH = 45` for collision; art height comes from `PLAYER_SPRITE_HH` (`gameConfig.js`), width follows the source aspect; beat pulse squashes height to 85% |
| Obstacle — character sprites | `hw × 2` wide × `hh × 2` tall, per entry in `OBSTACLE_SPRITES` | `hh` sets the art height (currently 60–75 → 120–150 px), `hw` the art half-width (collision is `hw × OBSTACLE_HITBOX_SCALE`); see below |
| **Chaser (enemy)** | collision 52 × 78, art `ENEMY_SPRITE_HH × 2` tall | `ENEMY_HW/HH = 26/39` for collision; art height comes from `ENEMY_SPRITE_HH` (`gameConfig.js`, defaults to matching collision height), width follows the source aspect |

`waves.js` carries no sizes — an obstacle is only `{ timeOffset, row }`, and
its sprite (hence its size) is picked by `ObstacleSpawner.spriteFor()`.

## Source resolution

Sprites are smooth art prepped at **2× logical size**: the prep scripts below
resize to 280 px tall, 2× the tallest logical height (140). 2× keeps the back
row (0.9× logical) crisp under linear filtering and is the ceiling of useful
resolution given the 800×450 framebuffer; anything larger is wasted texture
memory. Pixel art at 1× with `pixelArt: true` was considered and not used —
filtering mode is global, and non-integer row scales shimmer under
nearest-neighbor.

## Export specs

The prep scripts handle crop and resize; the source art only needs:

- **Format**: PNG with alpha (PNG-24). No JPEG (no transparency), no WebP
  needed at these sizes.
- **Transparent background** — the scripts crop to the alpha bounding box, so
  a leftover backdrop defeats the crop. Empty margins would otherwise shrink
  the visible art and desync it from the collision box and shadow width.
  Generators sometimes return an opaque backdrop or a drawn checkerboard
  instead of real alpha, so `prep-obstacle-image.py` and `prep-run-frames.py`
  (source mode) refuse any image whose four corner pixels have alpha above 8
  (`require_transparency` in `tools/prep_common.py`). Regenerate with a
  transparent background, or remove it first (e.g. `uvx rembg i in.png
  out.png`). The scenery script is exempt (opaque by design).
- **Feet/base as the lowest opaque pixels**, so after the crop they sit on
  the bottom edge of the image. Sprites are base-anchored to the row's feet
  line and tall art grows upward; the engine-drawn shadow ellipse marks
  ground contact.
- **No baked shadow, no ground** — the engine draws the drop shadow
  (`addShadow` in `rowLayout.js`).
- **Facing right** for the player and enemy: obstacles scroll in from the
  right and the enemy chases from the left.
- Aspect ratio is free — width follows the source aspect at the configured
  height. Power-of-two dimensions are **not** required (Phaser 3 WebGL
  handles NPOT textures for 2D sprites).

Generation prompts for the player and enemy frames live in
`docs/run-sprite-prompt.md`.

## Obstacle character sprites

Character cutouts (arbitrary size, transparent background) become obstacle
sprites via `tools/prep-obstacle-image.py`:

```
python3 tools/prep-obstacle-image.py original_images/kazuha_zombie.png \
    --out public/assets/sprites/obstacles/kazuha-zombie.png --height 280
```

It crops to the alpha bounding box (`Image.getbbox()`, no padding) and
resizes so the output height matches `--height` (default 280 = 2x the
tallest logical obstacle height, 140) — width follows the source aspect, so
sprites of different builds don't get distorted to a common box.

Tip: once a character looks right, save it in ChatGPT as a reference image and
call it back by name for the next obstacle; fix-ups should say "change only
<X>; do not redesign the character" and repeat the defining details.

Each prepped PNG is registered in `src/config/obstacleSprites.js`
(`OBSTACLE_SPRITES`, `{ key, file, hh, hw }`), loaded by `BootScene`, and
picked by `ObstacleSpawner.spriteFor()`:

- `hh` — logical half-height at front-row scale; the sprite's *display*
  scale is derived from `hh` (`(hh * 2 / textureHeight) * rowScale`), so
  width scales along with it to preserve the source aspect ratio.
- `hw` — the art half-width: art placement, shadow width **and** the
  spawn-timing distance; tuned per image to roughly match its displayed
  half-width at that `hh` (not derived automatically, since art bleeds into
  transparent margins differently per pose). The collision AABB half-width
  is `hw × OBSTACLE_HITBOX_SCALE` (`gameConfig.js`, 0.75), shrunk equally
  front and back around the same centre. Collision height is still fixed to
  one row (`COLLISION_HH` in `ObstacleSpawner.js`).
- Sprites render with origin `(0, 1)`: the left edge sits at `x - hw`
  (the collision box starts `hw × (1 − OBSTACLE_HITBOX_SCALE)` inside it)
  and the bottom edge sits on the row's feet line, matching the shadow
  anchor.

Things to be aware of:

- Heights come only from the manifest `hh`. When `OBSTACLE_SPRITES` is
  empty, the placeholder rectangle uses fixed defaults (`FALLBACK_HW` in
  `ObstacleSpawner.js`, player half-height).
- Wall sections spawn two obstacles per beat, so a wide sprite (e.g. the
  zombie at `hw: 61`) makes those walls block a row noticeably longer.
  If walls feel unfair, lower `OBSTACLE_HITBOX_SCALE` to narrow every
  hitbox around its centre.

## Run-cycle frames (player & enemy)

Both the player's and the enemy's placeholder rectangles can be replaced with
a run cycle via `tools/prep-run-frames.py`, a file-naming-convention pipeline
(no manifest, no Phaser animation manager):

```
python3 tools/prep-run-frames.py original_images/player/run-1.png \
    original_images/player/run-2.png
python3 tools/prep-run-frames.py original_images/enemy/run-1.png \
    original_images/enemy/run-2.png --target enemy
```

Better: draw all frames of a character in ONE image side by side and let the
script split it (see `docs/run-sprite-prompt.md`):

```
python3 tools/prep-run-frames.py --sheet 3 original_images/player/sheet.png
python3 tools/prep-run-frames.py --sheet 2 original_images/enemy/sheet.png --target enemy
```

`--sheet N` takes exactly one image (not combinable with `--dummy`), finds N
content segments (runs of columns with alpha above 8; segments narrower than
2% of the width are ignored), cuts at the midpoint of each gap, and pads every
cell to the widest one around its own centre at full sheet height, so each
character keeps its offset within its cell and feet height is preserved. It
exits listing the segment x-ranges if the count is not N. The result then goes
through the same union-bbox/shared-scale pipeline below. `--sheet COLSxROWS`
(e.g. `3x2`) takes a grid instead, frames in row-major order (top row left to
right, then the next); rows are found and cut the same way as columns and the
row count must match, and all cells are padded to one common size.

`--target` (default `player`) picks the output directory
(`public/assets/sprites/<target>`), the config-constant reminder it prints,
and the dummy-mode placeholder colour (green for player, red for enemy);
`--out-dir` overrides the directory directly. Unlike the obstacle prep
script, it crops every source frame to the union of all frames' alpha
bounding boxes (frames must share one canvas size, e.g. cells of one sheet
placed consistently) and resizes them with one shared scale to a uniform
height (default 280 = 2x logical), so the character keeps a constant size and
position between frames, writing
`public/assets/sprites/<target>/run-<i>.png` (`i` starting at 0, in argument
order) — deleting any stale `run-*.png` first so a previous, larger frame
count never lingers. See `docs/run-sprite-prompt.md` for the ChatGPT prompts
used to generate source frames for each character.

`--dummy N` generates N placeholder frames instead (a stylised zombie
silhouette in the target's placeholder colour with alternating leg stride),
so the loading/frame-advance pipeline can be exercised before real art
exists.

Registration is a pair of config values per character in
`src/config/gameConfig.js`:

- `PLAYER_FRAME_COUNT` / `ENEMY_FRAME_COUNT` — number of `run-<i>.png`
  frames; `0` keeps the original placeholder rectangle (green for player,
  red for enemy).
- `PLAYER_SPRITE_HH` / `ENEMY_SPRITE_HH` — logical half-height at front-row
  scale (like obstacle `hh`); drives display scale only
  (`(spriteHh * 2 / textureHeight) * rowScale`) — the collision AABB stays
  `PLAYER_HW`/`PLAYER_HH` or `ENEMY_HW`/`ENEMY_HH`.
- `PLAYER_RUN_STEPS_PER_BEAT` / `ENEMY_RUN_STEPS_PER_BEAT` — frame steps per
  game beat. The player's 6-frame (two-step) cycle at 6 steps lands a foot contact
  (frames 0 and 3) every half game beat; the enemy's 2-frame cycle steps on
  8th notes (2).

`src/config/runFrames.js` builds `PLAYER_FRAMES` and `ENEMY_FRAMES`
(`{ key, file }[]`) from their respective `*_FRAME_COUNT`; `BootScene`
preloads every entry in both lists. The visual — sprite (or fallback
rectangle) plus drop shadow, frame stepping, and beat-squash pulse — is
owned by the shared `RunCycle` helper (`src/objects/RunCycle.js`), used by
both `Player.js` and `Enemy.js`; each just forwards `syncFrame()`/`pulse()`
to its own `RunCycle` instance. The sprite renders with origin `(0.5, 1)` so
its feet sit on the row's feet line (the same point the shadow anchors to).
`syncFrame(walkIndex)` shows frame `walkIndex % frameCount` (via
`setTexture`, only when it changes); each frame from song start `GameScene`
passes each character `conductor.gridIndex(<its steps per beat> ×
section.speedMult)` — both indices come off the same beat grid, so the phase
is fixed by the music (a `?t=` seek lands on the right frame). A free-running
timer at the same per-character rate (`BEAT_MS / stepsPerBeat`) only
animates each character's walk before the first sync, and stops once
beat-locked; `pulse()` adds the beat squash only once beat sync is on,
again called on both characters together. Collision is unaffected either
way.

The player is tap-driven while the user is tapping (`PLAYER_TAP_RUN_IDLE_MS`,
non-zero): each accelerating tap calls `step()`, which advances exactly one
frame and holds it — `syncFrame()` and the timer are ignored — until that
long passes without another tap, when the beat-locked cycle above takes over
again (it also runs before the first tap, so the character never freezes).
Set it to 0 (or use `?debug`, which ignores taps) for the beat-locked cycle
only.

## Road & background (the two scenery layers)

`Scenery` (`src/objects/Scenery.js`) draws both as `tileSprite`s from the
active theme's image pair:

| Layer | Position | Logical box | Scrolls? |
|---|---|---|---|
| **Road** (walk zone) | `y = WALK_ZONE_TOP` → bottom | **800 × 270** | yes, left, wraps every 800px |
| **Background** (scenery strip) | `y = 0` → `WALK_ZONE_TOP` | **800 × 180** | yes, left, at `SCENERY_PARALLAX` (0.2) of the road's speed |

Both sit at depth −10, under everything. Export at **2×** like the sprites:
road **1600 × 540**, background **1600 × 360**. Opaque PNG (no alpha needed).

Constraints that come from the engine, not taste:

- **The road must tile seamlessly left↔right.** It scrolls by
  `player.speed × section.speedMult` and wraps at exactly `GAME_WIDTH`, so the
  left and right edges have to match pixel-for-pixel. No baked vignette or
  one-off landmark that would pop at the seam.
- **The road must NOT tile vertically** — its top edge is the far end of the
  fake-3D ground plane, its bottom edge is nearest the camera.
- **Rows are equal height, not perspective-compressed.** 3 rows × 90 logical px
  (180px at 2×). A true converging perspective grid fights the layout; equal
  horizontal bands at those offsets do not, and they help players read which
  row an obstacle is in.
- **Keep the road mid-dark and low-contrast.** The engine drops a black ellipse
  shadow under every object (alpha 0.3 for the player/enemy, 0.5 for
  obstacles), flashes the whole walk zone white on the beat, and fades a black
  dim overlay in during `dim` sections — a road that is already near-black
  kills the shadows, and a busy one buries the sprites.
- **Nothing on the road that looks like an obstacle.** Every solid, chunky shape
  on the ground reads as something to dodge.
- **Tall obstacles overhang the background.** A wall sprite in the back row
  crosses above `y = 180`, so keep the scenery strip silhouette-y and
  low-contrast enough that a wall still reads against it.
- The background's bottom edge is where it meets the road; design the last few
  pixels as the horizon seam (the code draws no horizon line). It must tile
  left↔right too: the tileSprite is wider than one tile (see "Handling the
  rotate section").

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
- Divide the surface into 3 equal horizontal lanes with very subtle
  boundaries (a faint seam, tone shift or scuff line every 180 pixels) —
  subtle, not bold painted lines.
- Smooth cartoon style, clean flat cel shading, light source from the
  top-left, matching a cartoon character sprite that will run on top.
- Medium-dark overall value with LOW contrast: bright enough that a soft
  black drop shadow reads on it, flat enough that small 90px character
  sprites stay readable above it.
- No characters, no vehicles, no props, no obstacles, no text, no
  watermark, no vignette, no border, no lighting hotspot.
- Fill the entire canvas, edge to edge. No margins, no frame.
- Output: 1536 x 512 pixels, PNG.
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
- Keep all scenery in the lower part of the image, with plain sky above, so
  the crop to the final wide strip has room.
- Output: 1536 x 512 pixels, PNG.
```

### The `[SCENE]` blocks

| Variant | Road `[SCENE]` | Background `[SCENE]` |
|---|---|---|
| **Night city** | Wet night asphalt street, dark blue-grey, faint puddles reflecting pink and cyan neon, painted lane scuffs, manhole covers and cracks worn flat | Night city skyline: dark building silhouettes with lit windows, glowing pink/cyan neon signs and street lamps, deep blue sky fading to purple at the horizon |
| **Day city** | Sunlit grey asphalt street, warm mid-grey, faded white lane markings, light cracks and tar seams, occasional drain grate | Daytime city skyline: pale buildings and rooftops in soft haze, a few trees and street lamps, bright blue sky with flat cartoon clouds |
| **Gym** | Indoor gym floor: pale honey-coloured wooden boards running left to right, faint painted court lines in red and blue, subtle polished sheen | Gym interior wall: racks of dumbbells and weight plates, a wall mirror, hanging championship banners and a scoreboard, all flat and muted |
| **Disco / party** | Glossy black-and-white checkered dance floor with a wet mirror-like sheen, faint coloured light pools smeared across it | Nightclub interior: dark wall with stacked speakers, a DJ booth, a mirror ball, strings of party lights and confetti, silhouetted dancing crowd along the bottom |
| **Suburb night** (background shipped as `suburb`; road is procedural, see below) | Suburban asphalt street in the dead of night, very dark, matching the low brightness of the attached reference photo. The whole surface is one uniform worn asphalt road with faint cracks and tar seams, lit only by dim cool blue-green moonlight. At the very top edge only, a thin dark strip of concrete curb. Desaturated teal-grey colour grade. *(Swap the template's "3 equal lanes" line for "NO lane markings… uniform top to bottom" and prep with `--lanes`.)* | Quiet American suburb in the dead of night, very dark, cinematic and slightly eerie. A row of two-storey gabled houses (stucco and wooden siding, dark shingle roofs) set back across the street, almost lost in darkness, with a few warm amber lit windows and small porch/garage wall lamps casting soft yellow glows. Dark tree silhouettes between the houses, a low hill silhouette behind them. Heavy, wispy near-black clouds over a very dark charcoal-grey night sky. Desaturated neutral charcoal colour grade — no teal or green tint — with warm lamp light as the only accent. Painterly semi-realistic style. |

The model's widest allowed aspect is 3:1, hence `1536 x 512` in both
prompts; the prep script crops the widest 1600:360 band from the background
(position via `--offset`) and resizes to the final 1600×540 / 1600×360.
Seamless tiling is not guaranteed by the model, so `--blend` remains needed.

### After generation

1. **Run the prep script** — image models don't emit these sizes and never
   really tile:
   ```
   python3 tools/prep-scenery-image.py road    shot.png --out public/assets/bg/road-day.png
   python3 tools/prep-scenery-image.py scenery shot.png --offset -120
   ```
   Add `--lanes` on the road to paint dashed dividers at the exact row
   boundaries — models never place lane lines where the rows are, so prompt
   for a plain surface and let the script draw them. Add `--horizon HEX` on the
   background (HEX = the road PNG's top row) to fade its bottom rows into the
   road so the horizon seam has no tone step.
   It crops the widest band of the target aspect (`--offset` nudges the band
   vertically), resizes to exactly 1600×540 / 1600×360, forces the left↔right
   seam (`--blend`), and reports the edge-row colours to paste into the
   theme's `sky`/`ground` in `SCENERY_THEMES`.
2. **Check the seam**: duplicate the result side by side and look at the join.
3. **Sanity check at real size**: view the road at 800×270 with a sprite and a
   30% black ellipse on it — if the shadow vanishes, the road is too dark; if
   the sprite gets lost, the road is too busy.
4. Keep one road + one background per variant so a theme can be swapped as a
   pair: add an entry to `SCENERY_THEMES` and point a stage in
   `STAGES` (`src/config/stages.js`) at it. An optional `tint` (0xRRGGBB) on the
   entry darkens a too-light theme in code (multiplied onto strips and fills).

The `suburb` theme pairs its own procedural road, `road-suburb.png`
(`tools/gen-suburb-road.py`, see below), with an AI background,
`scenery-suburb.png`, generated with Codex's built-in image model:
`codex exec -i style.png colour.png mood.png < prompt.txt` (pass the prompt on
stdin, since `-i` takes several files and would swallow a trailing prompt
argument). It was prepped with
`prep-scenery-image.py scenery shot.png --offset 200 --horizon 0x2a3033`,
where `--offset` keeps the houses on the horizon and `--horizon` fades the bottom
rows into the suburb road's top row (re-run with the new hex after
regenerating the road, `--blend 0 --out` on the shipped PNG). The background's Suburb `[SCENE]` block
above is the shipped prompt. Ask for **neutral charcoal**, not "blue-green",
which came out teal. The Suburb road block above (prep with `--lanes`) was an
AI road that was tried and not shipped; the road in use is procedural instead.

The suburb road is drawn by `tools/gen-suburb-road.py`
(`uv run --with pillow python tools/gen-suburb-road.py [--preview DIR]`):
charcoal teal-grey asphalt with aggregate grain, stone chips, cracks, tar
seams and faint moonlit sheen, a curb in the top 14px kept only a few levels
above the asphalt (a lighter one read as a hard edge under the houses), and worn dashed lane dividers at y = 180 / 360. It reuses the helpers of
`gen-night-assets.py`, is deterministic, prints the seam check and the
top/bottom row hexes (`ground` in `SCENERY_THEMES.suburb`; the top hex feeds
`--horizon`), and is covered by `tests/tools/test_suburb_road.py`.

The `night` theme was not AI-generated: `tools/gen-night-assets.py` draws both
layers procedurally (`--preview DIR` also dumps an in-game mock and the
tiled-seam checks).

The `suburbDay` theme is the `suburb` street in daylight, made in two steps.
`tools/gen-suburb-day-assets.py`
(`uv run --with pillow python tools/gen-suburb-day-assets.py [--preview DIR]`)
draws the procedural road `road-suburb-day.png` (pale sun-bleached warm-grey
asphalt, fine cracks and patches, a light curb in the top 14px, worn dashed
dividers at y = 180 / 360) and a flat cel-shaded **layout drawing** of the
scenery (written only to `DIR/scenery-full.png`, never shipped): five two-storey
gabled houses in stucco and grey / yellow-green lap siding with porches, garages
and a chimney, leafy trees between them, plank fences, two black lamp posts,
hills, lawn, sidewalk and verge. Keep it free of per-pixel grain — speckle over
a pale haze read as snow.
The shipped `scenery-suburb-day.png` is that drawing restyled by Codex's image
model (`codex exec -i style1.png -i style2.png -i layout.png < prompt.txt`):
the two style references were sunny film stills of the same street (blue sky
with big cumulus, sunlit yellow-green trees, weathered siding, warm desaturated
cinematic grade) and the prompt asked to copy layout.png's architecture and
layout exactly, painterly semi-realistic, straight-on, no road / people /
vehicles. Prepped with
`prep-scenery-image.py scenery shot.png --offset 200 --horizon 0xc4c0b4`
(0xc4c0b4 = the road's top row; it printed `sky` 0xc8d3d4). Approve the drawing
before running the AI step. Covered by `tests/tools/test_suburb_day_assets.py`
(road, the drawing, and the shipped PNG's size, seam and edge rows).

The `desert` theme (stage 3 from 53156 ms) is made in two steps, like
`suburbDay`. `tools/gen-desert-assets.py`
(`uv run --with pillow python tools/gen-desert-assets.py [--preview DIR]`)
draws the procedural road `road-desert.png` (an old sun-bleached dusty-brown
highway warmed toward the sand's hue, with sand drifting over it, a sandy
shoulder with a smooth, long soft fade in the top rows — row 0 is the scenery's
horizon colour 0xb89e74 — and soft faded dashed dividers at y = 180 / 360; only
faint fine grain, since coarse mottling and a ragged shoulder edge read as fur /
a grass fringe against the smooth AI backdrop) and a **layout drawing** of the scenery (written only to
`DIR/scenery-full.png`, never shipped): a low brown-grey dust sky, three layers
of skewed dunes fading into the haze with shaded lee faces, sparse scrub and a
bleached skull on the foreground sand. Every blurred layer's transparent pixels
carry the layer colour so the non-premultiplied blur adds no dark fringe.
The shipped `scenery-desert.png` is that drawing restyled by Codex's image
model (`codex exec --skip-git-repo-check --sandbox workspace-write -i style1.png
-i layout.png < prompt.txt`): style1.png was an overcast hazy desert film still
(the person in it ignored), and the prompt asked to copy layout.png's dunes,
scrub and skull exactly, painterly semi-realistic, straight-on with a level
horizon, the band in the lower half of a 1536x1024 frame, moderately dark and
dusty, no road / people / vehicles. Prepped with
`prep-scenery-image.py scenery shot.png --offset 120 --horizon 0xb89e74`
(it printed `sky` 0x8f8973). Covered by `tests/tools/test_desert_assets.py`
(road, the drawing, and the shipped PNG's size, seam and edge rows).

The `underground` theme (stage 4 from 59134 ms) is fully procedural for now:
`tools/gen-underground-assets.py`
(`uv run --with pillow python tools/gen-underground-assets.py [--preview DIR]`)
writes both `road-underground.png` and `scenery-underground.png`. The scenery
is a dim pedestrian-underpass wall: pale teal stack-bond tiles with a
rust-orange band, blue-grey pilasters every 400 px, peeling notices and a
red warning sign, a dark ceiling soffit with four fluorescent fixtures (the one
at x = 1000 dead, over a black side passage), water/rust streaks, mould above a
rust-red skirting and low floor fog, lit by a periodic light map so pools of
cold light alternate with darkness. Kept deliberately dark (low ambient, dim lamps, a crushed grade) for a scary mood. The road is dark damp concrete slabs
(joints at y = 180 / 360 mark the rows) with stains, sparse cracks and tiny
dead-leaf debris, its top rows darkened as grime at the wall base (row 0 =
the scenery's bottom row, 0x101312). Anything crossing the seam (grout,
pilasters) is drawn on both sides of it. Covered by
`tests/tools/test_underground_assets.py`.

**Handling the rotate section**: the `rotate` section zooms the camera out to
0.49 and spins it, which would otherwise reveal area outside the 800×450
world. `Scenery` (`src/objects/Scenery.js`) handles this in code, not art: both
tileSprites are widened in x to cover the circle the zoomed-out, spinning
camera sweeps, with flat sky/ground fill rectangles (`theme.sky`/`theme.ground`)
extending beyond them so no black ever shows.

## File locations

Everything lives under `public/assets/` alongside `intro.mp4` / `music.m4a`:

- `sprites/player/run-<i>.png`, `sprites/enemy/run-<i>.png` — run-cycle frames
- `sprites/obstacles/<slug>.png` — obstacle character sprites
- `bg/road-<theme>.png`, `bg/scenery-<theme>.png` — scenery pair

`BootScene` loads the pair of every theme used in `STAGES` via the
`SCENERY_THEMES` table in `src/config/sceneryThemes.js`; `Scenery` owns both layers. The road and the background
are **both** `add.tileSprite` (not `add.image`) — the background needs one too
because of the rotate-section oversizing above and its own slow scroll; both
scroll via `tilePositionX` (`Scenery.scroll`), the background at
`SCENERY_PARALLAX` of the road's distance.
