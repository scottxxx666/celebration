# Run-Cycle Sprite Prompts (Player & Enemy)

ChatGPT (image generation) prompts for producing run-cycle frames from a
reference photo (player) or a zombie concept (enemy). Keep every frame in
**one conversation** so the character, outfit, lighting and size stay
consistent across frames.

## Player

### Prompt (frame 1)

```
Reference: the attached photo of a zombie in a torn grey-brown suit, grey-white skin,
dark wet hair, one milky eye, mouth open. I need this character as game sprite frames.

Rules for every image:
- Same character, same outfit and face as the reference. Photo-realistic, not cartoon.
- Full body, head to feet, feet fully visible. Nothing cropped.
- Side view, running to the RIGHT of the frame.
- One character only, no other people, no props, no text, no ground, no shadow.
- Fully transparent background (PNG with alpha). No white or grey backdrop.
- Character fills the image height, centred, about 1024 px tall.
- Even, daylight lighting, no dramatic shadows on the body.

Frame 1: mid-stride. Right leg forward and extended, left leg trailing behind.
Arms bent zombie-style at chest height, hunched shoulders, head slightly forward.
```

### Follow-up prompts (same conversation)

```
Same character, same rules, same size and lighting. Frame 2: legs crossing at the
midpoint of the stride, both feet near the ground, body slightly lower than frame 1.
```

```
Frame 3: mirror of frame 1. Left leg forward and extended, right leg trailing.
```

```
Frame 4: same as frame 2 but the other leg is about to swing forward.
```

## Enemy

Same rules as the player prompt, but the character is a **different** zombie
(or a tight cluster of 2–3 zombies rendered as one cutout, to read as a
chasing "mob") — never the same look as the player's sprite, so the two
characters stay visually distinct on screen. Arms reach forward (grabbing,
not the player's bent-at-chest pose), still facing RIGHT, still chasing.

### Prompt (frame 1)

```
Reference: [attach a zombie photo/concept, or a small group of 2-3 zombies
tightly clustered]. I need this character (or cluster) as game sprite frames
for a CHASING enemy.

Rules for every image:
- Same character(s), same outfit and face as the reference. Photo-realistic, not cartoon.
- Full body/bodies, head to feet, feet fully visible. Nothing cropped.
- Side view, running/chasing to the RIGHT of the frame, arms reaching forward
  as if grabbing at something ahead.
- If multiple zombies: treat them as one tight cluster/cutout, overlapping
  naturally, not spread across the frame.
- No other people, no props, no text, no ground, no shadow.
- Fully transparent background (PNG with alpha). No white or grey backdrop.
- Character(s) fill the image height, centred, about 1024 px tall.
- Even, daylight lighting, no dramatic shadows on the body.

Frame 1: mid-stride, arms reaching forward and slightly down, mouths open, chasing pose.
```

### Follow-up prompts (same conversation)

```
Same character(s), same rules, same size and lighting. Frame 2: legs crossing at the
midpoint of the stride, arms still reaching forward, body slightly lower than frame 1.
```

Note: if the reference is a cluster, `ENEMY_HW` (`gameConfig.js`) may need
widening from its single-character default so the collision box roughly
matches the wider silhouette.

## Workflow

1. Keep all frames of one character in one ChatGPT conversation so it stays consistent.
2. Save each result as `original_images/player/run-1.png`, `run-2.png`, … (or
   `original_images/enemy/run-1.png`, … for the enemy) in generation order.
3. Run the prep script to crop/resize into `public/assets/sprites/<target>/`:
   ```
   python3 tools/prep-run-frames.py original_images/player/run-1.png \
       original_images/player/run-2.png
   python3 tools/prep-run-frames.py original_images/enemy/run-1.png \
       original_images/enemy/run-2.png --target enemy
   ```
4. Set `PLAYER_FRAME_COUNT` / `ENEMY_FRAME_COUNT` in `src/config/gameConfig.js`
   to the number of frames produced (the script prints a reminder for
   whichever `--target` you ran).
5. 2 frames is enough for a serviceable run cycle; 4 is smooth. All frames must
   be on equal-size canvases with the character placed consistently (e.g.
   cells of one sheet), since the script crops every frame to the union of
   their alpha bounding boxes and scales them together.
