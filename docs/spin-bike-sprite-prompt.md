# Spin-Bike Rider Sprite Prompts

ChatGPT (image generation) prompts for the spin-bike rider frames planned in
`docs/spin-bike-sprites.md`. Every image shows **the same row of 5 riders**
in one pose. Make all 9 images in **one conversation** so the people,
outfits, bikes, lighting and framing stay identical. The riders are
**original, generic people**. Never ask for, or attach a reference of, a
real person.

The prep script cuts each image into the 5 riders, then slices each rider at
the shorts' waistband. Pedal images become the lower layer and pose images
the upper layer. So the framing and the riders' positions must not move
between images.

**Attach the matching pose guide** from `docs/spin-bike-pose-guide/` to every
prompt (`pedal-0.png` with image 1, and so on). The guides fix the layout,
each rider's size and position, and the exact pose. The prompts below tell
the generator to copy the guide's pose and layout but not its look.

## Prompt (image 1, `pedal-0`)

```
I need game sprite frames: a row of 5 original, generic adult spin-class riders
(not resembling any real person) on 5 identical stationary spin bikes, side by
side.

Rules for every image in this conversation:
- Each prompt comes with a pose guide image: a row of 5 simple mannequins on
  bikes. Copy the guide EXACTLY for layout, each rider's size and position,
  the floor line, and every rider's pose (arms, legs, head). Do NOT copy its
  look: the mannequins, flat colours and white background are only a guide.
  The torso colours in the guide mark which rider is which (see the list below).
- Style: a photo-real still from a live K-pop TV stage performance, where a row
  of spin-class backup dancers rides on stage. Not cartoon.
- The same 5 people, same outfits, same bikes, in the same left-to-right order
  in every image (described below).
- FRONT VIEW: every rider faces the camera head-on, bikes pointing straight at
  the camera. Camera at chest height, no tilt, no perspective change between
  images.
- All 5 riders the same size and evenly spaced, with a clear empty gap between
  neighbours. No overlapping bikes or limbs.
- Every rider fully visible, nothing cropped: from the top of the head (and
  raised hands, if any) down to the bike's floor bar. All floor bars sit on
  one line near the bottom edge, as in the guide; the riders fill about the
  lower half of the image, with empty space above.
- All 5 riders do exactly the same pose at the same moment, in unison.
- Only these 5 riders. No other people, no text, no floor, no shadow, no stage
  set or background.
- Fully transparent background (PNG with alpha). No white or grey backdrop.
- Landscape image, 1536 x 1024.
- Concert stage lighting: saturated purple/magenta key light from the upper
  left, cyan and pink neon rim light on the body edges, glossy highlights on
  skin and fabric. Each bike has a neon edge glow in its rider's accent colour.
  Keep the lighting identical in every image.
- Energetic, choreographed body language, like dancers in a stage routine.

Riders, left to right:
1. Woman in her 20s, medium-light skin, dark brown hair in a high ponytail with
   a cyan scrunchie, neon-green mesh training vest over a black sports bra,
   black bike shorts, neon-orange ankle socks, white sneakers, white sweatband
   on the left wrist. Bike glow: cyan.
2. Man in his 20s, deep brown skin, short black hair with a white headband,
   bright orange sleeveless training top, navy bike shorts, lime knee-high
   sports socks, white sneakers, sweatbands on both wrists. Bike glow: magenta.
3. Woman in her 20s, light skin, shoulder-length bleached-blonde hair with a
   purple headband, hot-pink crop tank top, black bike shorts, white socks,
   white sneakers. Bike glow: purple.
4. Man in his 20s, tan skin, short wavy brown hair, white sleeveless muscle tee,
   teal bike shorts, white socks with a teal stripe, white sneakers. Bike glow:
   pink.
5. Woman in her 20s, light-medium skin, black hair in a top bun, violet sports
   crop top, yellow bike shorts, white socks, white sneakers, black wristbands.
   Bike glow: lime.

Image 1 (pedal-0, guide attached): all riders seated, both hands gripping the
handlebar ends, slightly hunched, looking at the camera. Pedalling, mid-stroke:
both knees at about the same height, each rider's right leg moving down and
left leg moving up.
```

## Follow-up prompts (same conversation, one per image)

Each follow-up is sent with its own guide attached (the file named in
parentheses).

```
Same 5 riders, outfits, bikes, order, lighting and EXACT same framing and
positions; follow the attached guide. Image 2 (pedal-1): same upper bodies.
Each rider's LEFT knee raised high (left pedal at the top), right leg extended
down.
```

```
Image 3 (pedal-2): same upper bodies; follow the attached guide. Both knees at
about the same height, each rider's left leg moving down and right leg moving
up.
```

```
Image 4 (pedal-3): same upper bodies; follow the attached guide. Each rider's
RIGHT knee raised high (right pedal at the top), left leg extended down.
```

```
Image 5 (grip-up): same as image 1. Seated, both hands gripping the handlebar
ends, elbows bent slightly outward, heads up, looking at the camera.
```

```
Image 6 (grip-nod): same as image 5 but every head bowed sharply forward and
down, chin near the chest, so we see the TOP of each head and the faces are
mostly hidden. Hands stay on the handlebars, shoulders stay where they are.
```

```
Image 7 (wave-centre): all riders seated, both arms raised straight up overhead,
parallel to each other (shoulder width apart), arms fully STRAIGHT (elbows
locked, no bend), hands open, heads up, smiling. Hands must stay inside the
image and must not touch a neighbour's hands.
```

```
Image 8 (wave-left): same as image 7, arms still fully straight and still
parallel to each other, but both arms of every rider swing together toward
the LEFT side of the image, like a unison side-to-side wave. Torsos stay
upright. Hands must not touch a neighbour's.
```

```
Image 9 (wave-right): mirror of image 8: both parallel straight arms swing
toward the RIGHT side of the image.
```

Only if the in-game check calls for it (see the plan doc), add one more:

```
Image 10 (grip-half): same as image 6 but the heads only halfway bowed: chin
dropped, face still partly visible, looking down at the handlebars.
```

## Workflow

1. One ChatGPT conversation; generate images 1–9 in order, attaching the
   matching guide from `docs/spin-bike-pose-guide/` each time. Reject and
   regenerate any image where the framing, a rider's position, outfit, hair or
   order drifted. The layers only line up if all of that is identical.
2. Save to `original_images/spinbike/` using the names in parentheses:
   `pedal-0.png` … `pedal-3.png`, `grip-up.png`, `grip-nod.png`,
   `wave-centre.png`, `wave-left.png`, `wave-right.png`.
3. Check by eye: flip quickly between `pedal-0`…`pedal-3` and between the five
   pose images. The floor bars, handlebars and riders' positions must not
   jump.
4. Prep and wire up as described in `docs/spin-bike-sprites.md` ("Code changes
   when B is built"). That step is not implemented yet.
