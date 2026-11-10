"""Draw the player's 6-frame run-cycle pose guide: stick figures in a 3x2 grid
on a 1536x1024 canvas, attached to the ChatGPT sheet prompt in
docs/run-sprite-prompt.md so the generated sheet copies its poses and layout
(then `prep-run-frames.py --sheet 3x2` splits it).

    python3 tools/gen-run-pose-guide.py                 # writes docs/run-pose-guide/player.png
    python3 tools/gen-run-pose-guide.py --gif run.gif   # also a looping preview to check the motion

The cycle is two steps, facing right: contact -> mid-stance -> push-off on the
near leg (red), then the same three on the far leg (blue). The far leg runs
the same table as the near leg, half a cycle (3 frames) later, so frames 4-6
are frames 1-3 with the legs swapped. Arms swing opposite their own leg.
No labels, no ground line: the prompt forbids text and ground.
"""
import argparse
import math
import os

from PIL import Image, ImageDraw

RED, BLUE, BODY = (220, 40, 40), (40, 90, 220), (40, 40, 40)
FRAMES = 6
COLS, ROWS = 3, 2
CELL = 512

# Near leg per frame: (thigh angle forward of straight down, knee bend), degrees.
LEG = [
    (28, 12),    # contact: reaching forward, heel down
    (22, 46),    # mid-stance: foot under the hips, knee compressed (lowest)
    (-32, 14),   # push-off: extended behind, on the toe
    (-28, 95),   # recovery: heel kicking up behind
    (12, 120),   # passing: heel tucked, knee swinging through
    (48, 85),    # knee drive: knee up in front, shin hanging
]
# Foot pitch relative to the shin's perpendicular (positive = toes up).
FOOT = [12, 0, -22, -55, -35, -5]
# Near arm swing from straight down (positive = forward), opposite the near leg.
ARM = [-38, -12, 24, 38, 12, -24]
ELBOW_BEND = 100

# Segment lengths as fractions of the cell height.
THIGH, SHIN, FOOT_LEN = 0.24, 0.24, 0.07
TORSO, HEAD_R = 0.29, 0.065
UPPER_ARM, FOREARM = 0.15, 0.14
LEAN_DEG = 14


def along(origin, length, deg):
    """Point `length` from `origin`, `deg` measured from straight down,
    positive rotating toward +x (forward)."""
    a = math.radians(deg)
    return origin[0] + length * math.sin(a), origin[1] + length * math.cos(a)


def leg_points(hip, phase, h):
    thigh_deg, knee_bend = LEG[phase]
    knee = along(hip, THIGH * h, thigh_deg)
    shin_deg = thigh_deg - knee_bend
    ankle = along(knee, SHIN * h, shin_deg)
    toe = along(ankle, FOOT_LEN * h, shin_deg + 90 + FOOT[phase])
    return [hip, knee, ankle, toe]


def arm_points(shoulder, phase, h):
    elbow = along(shoulder, UPPER_ARM * h, ARM[phase])
    hand = along(elbow, FOREARM * h, ARM[phase] + ELBOW_BEND)
    return [shoulder, elbow, hand]


def draw_frame(i, size=CELL, margin=22):
    """Frame i on a size x size white cell; hips centred, lowest foot point
    on the shared feet line `margin` px above the bottom."""
    img = Image.new('RGB', (size, size), 'white')
    d = ImageDraw.Draw(img)
    near, far = i, (i + 3) % FRAMES
    lowest = max(p[1] for ph in (near, far) for p in leg_points((0, 0), ph, size))
    hip = (size * 0.5, size - margin - lowest)
    shoulder = along(hip, TORSO * size, 180 - LEAN_DEG)
    head = along(hip, TORSO * size + HEAD_R * size * 1.25, 180 - LEAN_DEG)
    lw = max(4, int(size * 0.022))
    r = HEAD_R * size

    d.line(leg_points(hip, far, size), fill=BLUE, width=lw, joint='curve')
    d.line(arm_points(shoulder, far, size), fill=BLUE, width=lw, joint='curve')
    d.line([hip, shoulder], fill=BODY, width=int(lw * 2.2))
    d.ellipse([head[0] - r, head[1] - r, head[0] + r, head[1] + r], fill=BODY)
    d.polygon([(head[0] + r * 0.8, head[1] - r * 0.3),   # nose: facing right
               (head[0] + r * 1.45, head[1] + r * 0.15),
               (head[0] + r * 0.8, head[1] + r * 0.35)], fill=BODY)
    d.line(leg_points(hip, near, size), fill=RED, width=lw, joint='curve')
    d.line(arm_points(shoulder, near, size), fill=RED, width=lw, joint='curve')
    return img


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--out', default='docs/run-pose-guide/player.png')
    ap.add_argument('--gif', help='also write a looping preview GIF here')
    args = ap.parse_args()

    frames = [draw_frame(i) for i in range(FRAMES)]
    sheet = Image.new('RGB', (CELL * COLS, CELL * ROWS), 'white')
    for i, f in enumerate(frames):
        sheet.paste(f, ((i % COLS) * CELL, (i // COLS) * CELL))
    os.makedirs(os.path.dirname(args.out) or '.', exist_ok=True)
    sheet.save(args.out, optimize=True)
    print(f'wrote {args.out} ({sheet.width}x{sheet.height})')
    if args.gif:
        frames[0].save(args.gif, save_all=True, append_images=frames[1:],
                       duration=110, loop=0)
        print(f'wrote {args.gif}')


if __name__ == '__main__':
    main()
