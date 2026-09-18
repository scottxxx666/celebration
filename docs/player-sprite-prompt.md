# Player Run-Cycle Sprite Prompt

ChatGPT (image generation) prompt for producing the player's run-cycle
frames from a reference photo. Keep every frame in **one conversation** so
the character, outfit, lighting and size stay consistent across frames.

## Prompt (frame 1)

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

## Follow-up prompts (same conversation)

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

## Workflow

1. Keep all frames in one ChatGPT conversation so the character stays consistent.
2. Save each result as `original_images/player/run-1.png`, `run-2.png`, … in
   generation order.
3. Run the prep script to crop/resize into `public/assets/sprites/player/`:
   ```
   python3 tools/prep-player-frames.py original_images/player/run-1.png \
       original_images/player/run-2.png
   ```
4. Set `PLAYER_FRAME_COUNT` in `src/config/gameConfig.js` to the number of
   frames produced (the script prints a reminder).
5. 2 frames is enough for a serviceable run cycle; 4 is smooth. Feet should
   sit at roughly the same height across frames since the script crops each
   to its own alpha bounding box.
