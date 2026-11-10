# Run-Cycle Sprite Prompts (Player & Enemy)

ChatGPT (image generation) prompts for producing run-cycle frames from a
reference image — both the player and the enemy are zombies, drawn as
different characters. Ask for **all frames in ONE image**, side by side:
frames drawn together are more consistent (character, outfit, lighting, size)
than frames from separate prompts. The prep script splits the sheet with
`--sheet N`.

## Player

3 frames (`PLAYER_FRAME_COUNT`).

### Prompt

Attach the reference photo, then:

```
Reference: the attached photo of a zombie in a torn grey-brown suit, grey-white skin,
dark wet hair, one milky eye, mouth open. Do not redesign the character. I need this
character as a 3-frame run cycle sprite sheet.

One landscape image, 1536x1024, with 3 frames side by side, left to right, evenly
spaced, all the same size, feet on one shared baseline. Leave a clear transparent gap
between frames; frames must not overlap or touch. No text, no numbers, no borders, no
gutters, no panel labels.

Rules for every frame:
- Same character, same outfit and face as the reference. Photo-realistic, not cartoon.
- Full body, head to feet, feet fully visible. Nothing cropped.
- Side view, running to the RIGHT of the frame.
- One character per frame, no other people, no props, no ground, no shadow.
- Fully transparent background (real PNG alpha). A drawn checkerboard is not
  transparency; no white or grey backdrop.
- Even, daylight lighting, no dramatic shadows on the body.

Frames:
1. Mid-stride. Right leg forward and extended, left leg trailing behind.
   Arms bent zombie-style at chest height, hunched shoulders, head slightly forward.
2. Legs crossing at the midpoint of the stride, both feet near the ground, body
   slightly lower than frame 1.
3. Mirror of frame 1. Left leg forward and extended, right leg trailing.
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
2. Save the sheet as `original_images/player/sheet.png` (or
   `original_images/enemy/sheet.png`).
3. Split, crop and resize into `public/assets/sprites/<target>/` (N = number
   of frames in the sheet):
   ```
   python3 tools/prep-run-frames.py --sheet 3 original_images/player/sheet.png
   python3 tools/prep-run-frames.py --sheet 2 original_images/enemy/sheet.png --target enemy
   ```
   The script cuts the sheet at the middle of each transparent gap, pads every
   cell to the same width (keeping each character's offset within its cell)
   and then crops/scales all frames together. It exits with the segment
   x-ranges it found if the count is not N (frames touching, or stray specks
   bigger than 2% of the width), and refuses images whose corners are not
   transparent.
4. Set `PLAYER_FRAME_COUNT` / `ENEMY_FRAME_COUNT` in `src/config/gameConfig.js`
   to the number of frames produced (the script prints a reminder for
   whichever `--target` you ran).
5. 2 frames is enough for a serviceable run cycle; 4 is smooth. The current
   build ships 3 player frames and 2 enemy frames; if the player's count
   changes, revisit `PLAYER_RUN_STEPS_PER_BEAT`, which is tuned so a 3-frame
   cycle lands a foot contact every half beat.

Fallback: separate per-frame images (one per prompt, same conversation) still
work with the multi-file command — save as `run-1.png`, `run-2.png`, … on
equal-size canvases with the character placed consistently, then
`python3 tools/prep-run-frames.py original_images/player/run-1.png original_images/player/run-2.png`
(add `--target enemy` for the enemy). Expect less consistency between frames.
