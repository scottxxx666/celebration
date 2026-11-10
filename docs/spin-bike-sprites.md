# Spin-Bike Riders — Sprite Art Plan (option B)

Status: **planned, not implemented.** The riders currently ship as code-drawn
figures (option A, `src/objects/SpinBikes.js`). This doc is the plan for
swapping in sprite frames later without changing the choreography. Prompts
for generating the source art are in `docs/spin-bike-sprite-prompt.md`.

## What stays the same

Everything except how one rider is drawn:

- Row placement, drift with the backdrop, enter/exit, `bikes` section field and
  its modes (`'grip'` in `highlight1`, `true` in `highlight1b`) — unchanged.
- Timing comes from the same pure functions in `src/spinBikes.js`:
  `crankAngle` (pedal phase), `gripDip` (head nod), `armLean` (wave hit).
  Sprites only replace the *drawing*; the beat math picks which frame to show.
- Option A stays as the fallback: with sprites switched off, the code-drawn
  riders render exactly as today (same pattern as `PLAYER_FRAME_COUNT = 0` →
  placeholder rectangle).

## One image = the whole row of 5 riders

Every source image shows **all 5 riders side by side**, 5 different original
people, all in the same pose (the choreography is in unison anyway). The prep
script cuts each image into 5 rider columns. So 9 images give 5 distinct
riders, and lighting and style match across the row for free.

Riders keep their in-game spacing (`BIKE_SPACING`) — the columns are placed
by the existing row code, not by where they stood in the image, so uneven
spacing in a generation only matters for the cut, not on screen.

## Two layers per rider

Pedalling (continuous) and the upper body (nod / wave) animate independently.
Baking both into whole-body frames would need every pose × every pedal phase.
Instead each rider is **two stacked images** sharing one registration:

| Layer | Contents | Frames |
|---|---|---|
| **lower** | shorts below the waistband, legs, sneakers, flywheel, post, floor bar | 4 pedal phases |
| **upper** | torso, head, arms, hands, handlebar + console | 5 poses |

Upper poses: `grip-up`, `grip-nod`, `wave-centre` (both straight arms pointing
straight up, parallel), `wave-left`, `wave-right` (both arms still parallel, swinging
together to the front-upper-left / front-upper-right: toward the camera as
well as sideways, so they look shorter, with the fists slightly bigger). Arms are always straight in the wave, as in the reference.
Total **9 images**.

Split line: the shorts' waistband, just *below* the handlebar — so the bar,
console and gripping hands all live in the upper layer and the hands can never
drift off the bar. The two layers overlap a few px at the waistband to hide
the seam. The lower layer draws first.

### Generating layers from whole-body images

Image models are bad at producing half-bodies with consistent registration,
so every source image shows **complete riders on their bikes** with the same
fixed camera framing (see the prompt doc). The prep script cuts each image
into the 5 riders, then slices each rider at the waistband line:

- pedal images → keep the part *below* the line → `lower-<i>.png`
- pose images → keep the part *above* the line → `upper-<pose>.png`

The upper body in the pedal images, and the legs in the pose images, are
simply discarded — so pose images can show any pedal phase, and pedal images
any upper-body pose (grip is easiest).

## Frame selection (maps A's timing onto frames)

Pure functions to add to `src/spinBikes.js` (unit-tested like the rest):

- **Pedal:** frame `floor(crankAngle / (2π) × 4) % 4` — one revolution per
  `BIKE_PEDAL_BEATS` as today. With the game's crank math the frames are
  (rider's own left/right, the rider faces the camera): 0 = knees level
  (right knee coming down, left coming up), 1 = LEFT knee up, 2 = knees level
  (left coming down, right coming up), 3 = RIGHT knee up. The pose guides
  below are rendered from the same math.
- **Grip — 2 frames for now:** `grip-nod` while `gripDip ≥ 0.5`, else
  `grip-up`. That makes the head snap down on the beat and pop back up about
  mid-beat (~0.2 s at this tempo), which suits a head-bang. **After checking
  it in-game**, add a third `grip-half` frame (head halfway down) only if the
  return looks too jumpy — it would show while `gripDip` is between two
  thresholds, costing one more image.
- **Wave:** `armLean > +0.5` → `wave-right`, `< −0.5` → `wave-left`, else
  `wave-centre`. `armLean` already snaps on each hit (every
  1/`BIKE_WAVE_HITS_PER_BEAT` beat, currently every beat), eases back to
  straight up and rests there (`BIKE_ARM_REST_FRAC`) before the next hit,
  so the centre frame shows between hits. The ease back takes over half a
  beat (~285 ms at the current config), so with only these 3 frames the
  arms would jump from the side straight to the centre partway through it.
  **After checking it in-game**, add `wave-half-left` / `wave-half-right`
  (arms halfway back to straight up) only if that jump looks wrong — shown
  while `|armLean|` is between two thresholds, costing two more images.

## Style

Follow the reference stage performance (a TV-stage row of spin-class backup
dancers), **not** the zombie/obstacle sprites:

- Photo-real live-stage look: saturated purple / magenta key light with cyan
  and pink neon rim lights, as on an LED-wall stage at night. Bright, glossy
  highlights on skin and fabric.
- Bright workout outfits: neon tank tops / vests, bike shorts, sweatbands,
  headbands, coloured socks, white sneakers.
- Black studio spin bikes with neon edge glow.
- Energetic, choreographed body language (unison hits, big overhead waves).
- Original generic people only — never a likeness of the performers or
  dancers in the reference.

The stage lighting is baked into the sprites, so the riders keep the
"on stage" look against the night skyline, and match the disco/neon effects
used elsewhere in the song.

## Sizes & export

- Source: landscape 1536 × 1024, 5 riders in a row → roughly 300 × 800 px per
  rider, well above what's needed.
- Rider + bike on screen today: ~123 logical px tall (floor line to head top),
  ~64 wide; raised hands reach ~120 above the floor. Keep the same footprint.
- Export at **2× logical**, like the other sprites: each rider's layers are
  cropped to the **union** bounding box of that rider across all 9 images (so
  layers stay registered) and scaled with one shared factor to **260 px**
  tall. Use the same scale for all 5 riders so their sizes stay consistent.
- Origin `(0.5, 1)` at the floor-bar bottom centre, placed on
  `BIKE_FLOOR_Y` at each rider's centre x.
- Transparent PNG, no ground or shadow (the backdrop is the scenery strip).

## Pose guides

`docs/spin-bike-pose-guide/` holds one 1536 × 1024 guide per frame
(`pedal-0.png` … `wave-right.png`). Each guide shows the row of 5 mannequins
in exactly the pose the game shows for that frame, at the target layout:
even spacing with side margins, floor bars on one line near the bottom edge.
They were rendered from the game's own pose functions in `src/spinBikes.js`
(`frontLeg`, `gripArm`, `armPose`, `headNod`) and the `BIKE_*` config, so
they match option A's choreography. Attach the matching guide to each
generation prompt. The optional frames have guides too (`grip-half.png`,
`wave-half-left.png`, `wave-half-right.png`; halfway = the moment in the
ease back where the lean is 0.5), so they're ready if the in-game check calls
for them. `overview.png` is a labelled contact sheet of all 12, for people
only; don't attach it to a prompt.

Torso colours in the guides only mark rider order (matching the outfit list
in the prompt doc); the mannequin look is not the target style. If `BIKE_*`
poses are retuned, re-render the guides before generating.

## File layout

```
original_images/spinbike/                    # raw generations, one row of 5 riders each
    pedal-0.png … pedal-3.png
    grip-up.png  grip-nod.png
    wave-centre.png  wave-left.png  wave-right.png

public/assets/sprites/spinbike/r<i>/          # prepped output, i = rider 0..4 (left to right)
    lower-0.png … lower-3.png
    upper-grip-up.png  upper-grip-nod.png
    upper-wave-centre.png  upper-wave-left.png  upper-wave-right.png
```

## Code changes when B is built (not done yet)

1. **Prep tool** — `tools/prep-spinbike-frames.py <source dir> --split <y-fraction>`:
   - cut each image into 5 rider columns — at the transparent gaps between
     riders (alpha column sums), falling back to equal fifths;
   - per rider, union-crop across all 9 images, shared scale to 260 px;
   - slice at the waistband line with a few px overlap and write the layout
     above.
   - `--dummy` makes placeholder layers (coloured blocks) so the code can be
     wired up first.

   Separate from `prep-run-frames.py` because of the column cut, slicing and
   two-layer output.
2. **Config** (`gameConfig.js`) — `SPINBIKE_SPRITES` (false = code-drawn
   fallback), `SPINBIKE_SPRITE_H` (logical display height),
   `SPINBIKE_PEDAL_FRAMES = 4`, plus the nod/wave thresholds.
3. **Frame list** — `src/config/spinBikeFrames.js` builds `{ key, file }[]`
   per rider (like `runFrames.js`); `BootScene` preloads them.
4. **`SpinBikes`** — when sprites are on, each rider is two pooled `Image`s
   (lower, upper) instead of Graphics drawing; per frame set x from the row,
   then `setTexture` from the frame-selection functions above. The 2×
   RenderTexture path stays for the fallback only.
5. **Tests** — frame-selection functions: pedal frame covers 0–3 once per
   `BIKE_PEDAL_BEATS`; grip switches to nod on the beat and back by mid-beat;
   wave picks left/right on alternating beats and centre while relaxed; the
   column-cut helper in the prep tool if it has non-trivial logic.
6. **Docs** — move the relevant parts of this file into
   `docs/image-assets.md` ("Spin-bike riders") and CLAUDE.md, and drop the
   "planned" status.

## Decided

- **One image per frame holds all 5 riders** — 9 images total, not 9 per rider.
- **2 nod frames** (`grip-up`, `grip-nod`) for now; add `grip-half` only if the
  in-game check shows a jumpy return.
- **3 wave frames** (`wave-centre`, `wave-left`, `wave-right`) for now; add
  `wave-half-left` / `wave-half-right` only if the in-game check shows a
  jumpy return to straight up.
- **Style** follows the stage reference, not the zombie sprites.
- **Pose guides** (`docs/spin-bike-pose-guide/`) are attached to every
  generation prompt.
