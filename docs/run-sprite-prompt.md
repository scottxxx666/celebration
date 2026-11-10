# Run-Cycle Sprite Prompts (Player & Enemy)

ChatGPT (image generation) prompts for producing run-cycle frames from a
reference image — both the player and the enemy are zombies, drawn as
different characters. Ask for **all frames in ONE image**, side by side:
frames drawn together are more consistent (character, outfit, lighting, size)
than frames from separate prompts. The prep script splits the sheet with
`--sheet N` (one row) or `--sheet COLSxROWS` (a grid).

## Player

6 frames (`PLAYER_FRAME_COUNT`), laid out 3 columns × 2 rows, read left to
right, top row first. The cycle is **two steps**: contact → mid-stance →
push-off on the near leg (frames 1–3), then the same three on the far leg
(frames 4–6), looping back to frame 1. At `PLAYER_RUN_STEPS_PER_BEAT = 6`
the foot contacts (frames 1 and 4) still land every half beat, so the timing
constant doesn't change. Everything for the player lives in
`original_images/zombie/`; the shipped frames come from its
`run-sheet.png` (`--sheet 3x2`).

### Reference images

No original photo is kept; the character only exists as ChatGPT output.
Attach two images from `original_images/zombie/`, each doing one job:

1. **Character (identity + style):**
   `character-reference.png` — the same character in a
   single pose outside the run cycle (knee raised), large (1254×1254) and
   really transparent. Because the pose isn't one of the cycle frames, it
   doesn't pull any frame toward a pose. Save it in ChatGPT as a reference
   (e.g. "player zombie") and call it back by name in later chats.
2. **Poses + layout:** `pose-guide.png` — the pose guide: 6 stick figures in a
   3×2 grid on 1536×1024, no labels, no ground line, hips centred in each
   512×512 cell, feet on each row's shared line. Drawn by
   `tools/gen-run-pose-guide.py` (`--gif out.gif` writes a looping preview to
   check the motion; tune the pose tables there and rerun). Red = the leg/arm
   nearer the camera, blue = the far one.

Do **not** attach `run-sheet.png` or the shipped
`public/assets/sprites/player/run-*.png`: they are cycle poses, so the model
copies them instead of following the pose guide.

### Prompt

Attach the character reference (or call back the saved one) and the pose
guide `original_images/zombie/pose-guide.png`, then:

```
Two images are attached. Image 1 is the exact character to keep: a zombie man with short
messy dark hair, pale grey-white skin with red scratches and blood smears, mouth
open, head tilted up, clawed hands; a torn olive-brown suit jacket with ragged
hems over an open dark grey vest and bare chest, olive-brown trousers with frayed
hems, dark brown lace-up boots. Do not redesign the character. I need this
character as a 6-frame run cycle sprite sheet.

Image 2 is a pose guide: 6 stick figures in 3 columns and 2 rows. Copy it EXACTLY
for layout, each frame's size and position, each row's feet line, and every pose
(legs, arms, torso lean, head). Do NOT copy its look: the stick figures, flat
colours and white background are only a guide. Red limbs are the leg/arm nearer
the camera, blue the far one.

One landscape image, 1536x1024: 3 columns x 2 rows of frames, read left to right,
top row first. Every frame the same size, evenly spaced, the character centred in
its cell. Leave a clear transparent gap between frames, both across and between
the rows; frames must not overlap or touch. No text, no numbers, no borders, no
gutters, no panel labels.

Rules for every frame:
- Same character, same outfit and face as the reference.
- Same art style as the reference: semi-realistic comic illustration with dark ink
  outlines and painted shading. Not a photo, not a flat or chibi cartoon.
- Full body, head to feet, feet fully visible. Nothing cropped.
- Side view, running to the RIGHT of the frame, torso leaning slightly forward.
- One character per frame, no other people, no props, no ground, no shadow.
- Fully transparent background (real PNG alpha). A drawn checkerboard is not
  transparency; no white or grey backdrop.
- Even, daylight lighting, no dramatic shadows on the body.

Frames (two running steps, looping back to frame 1):
1. Contact, near leg. Near leg reaching forward, heel touching down; far leg
   kicked up behind, knee bent. Near arm swung back, far arm forward.
2. Mid-stance, near leg. Near foot planted under the hips, knee bent, body at
   its lowest; far knee swinging through, heel tucked up behind. Arms close to
   the body, elbows bent.
3. Push-off, near leg. Near leg extended behind, pushing off the toe; far knee
   driven up in front, shin hanging. Near arm forward, far arm back.
4. Contact, far leg: frame 1 with the legs and arms swapped.
5. Mid-stance, far leg: frame 2 with the legs and arms swapped.
6. Push-off, far leg: frame 3 with the legs and arms swapped.
```

## Enemy

2 frames (`ENEMY_FRAME_COUNT`). Same rules as the player prompt, but the
character is a **different** zombie (or a tight cluster of 2–3 zombies
rendered as one cutout per frame, to read as a chasing "mob") — never the
same look as the player's sprite, so the two characters stay visually distinct
on screen. Arms reach forward (grabbing, not the player's bent-at-chest pose),
still facing RIGHT, still chasing.

### Prompt

```
Reference: [attach a zombie photo/concept, or a small group of 2-3 zombies
tightly clustered]. Do not redesign the character(s). I need this character (or
cluster) as a 2-frame run cycle sprite sheet for a CHASING enemy.

One landscape image, 1536x1024, with 2 frames side by side, left to right, evenly
spaced, all the same size, feet on one shared baseline. Leave a clear transparent gap
between frames; frames must not overlap or touch. No text, no numbers, no borders, no
gutters, no panel labels.

Rules for every frame:
- Same character(s), same outfit and face as the reference. Photo-realistic, not cartoon.
- Full body/bodies, head to feet, feet fully visible. Nothing cropped.
- Side view, running/chasing to the RIGHT of the frame, arms reaching forward
  as if grabbing at something ahead.
- If multiple zombies: treat them as one tight cluster per frame, overlapping
  naturally, not spread across the frame.
- No other people, no props, no ground, no shadow.
- Fully transparent background (real PNG alpha). A drawn checkerboard is not
  transparency; no white or grey backdrop.
- Even, daylight lighting, no dramatic shadows on the body.

Frames:
1. Mid-stride, arms reaching forward and slightly down, mouths open, chasing pose.
2. Legs crossing at the midpoint of the stride, arms still reaching forward, body
   slightly lower than frame 1.
```

Note: if the reference is a cluster, `ENEMY_HW` (`gameConfig.js`) may need
widening from its single-character default so the collision box roughly
matches the wider silhouette.

## Workflow

1. Generate the sheet in ChatGPT. Once you have a character you like, save it
   in ChatGPT as a reference image and call it back by name for reruns. To fix
   something, send a follow-up that says "change only <X>; do not redesign the
   character" and repeats the defining details (outfit, skin, hair, eye).
2. Save the sheet in the character's `original_images/` folder: the player's
   is `original_images/zombie/` (the shipped sheet is
   `run-sheet.png`); the enemy has none yet, e.g.
   `original_images/enemy/sheet.png`.
3. Split, crop and resize into `public/assets/sprites/<target>/` (`3x2` =
   3 columns × 2 rows; a plain N = N frames in one row):
   ```
   python3 tools/prep-run-frames.py --sheet 3x2 original_images/zombie/run-sheet.png
   python3 tools/prep-run-frames.py --sheet 2 original_images/enemy/sheet.png --target enemy
   ```
   The script cuts the sheet at the middle of each transparent gap (rows,
   then columns), pads every cell to the same size (keeping each character's
   offset within its cell) and then crops/scales all frames together. It exits
   with the ranges it found if a count doesn't match (frames touching, or stray
   specks bigger than 2% of the sheet), and refuses images whose corners are
   not transparent.
4. Set `PLAYER_FRAME_COUNT` / `ENEMY_FRAME_COUNT` in `src/config/gameConfig.js`
   to the number of frames produced (the script prints a reminder for
   whichever `--target` you ran).
5. 2 frames is enough for a serviceable run cycle; 6 is smooth. The current
   build ships 6 player frames and 2 enemy frames. `PLAYER_RUN_STEPS_PER_BEAT`
   (6) lands a foot contact every half beat for both the 3-frame (one step)
   and 6-frame (two steps) player cycles; revisit it for any other count.

Fallback: separate per-frame images (one per prompt, same conversation) still
work with the multi-file command — save as `run-1.png`, `run-2.png`, … on
equal-size canvases with the character placed consistently, then
`python3 tools/prep-run-frames.py original_images/player/run-1.png original_images/player/run-2.png`
(add `--target enemy` for the enemy). Expect less consistency between frames.
