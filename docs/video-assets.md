# Video assets — encoding guide

Specs for the intro/ending cutscene videos (`public/assets/*.mp4`), played in-canvas
via Phaser Video game objects (`IntroScene`).

## Why quality is capped

The game renders into an 800×450 canvas buffer (no devicePixelRatio scaling), so a
video can never display more than 800×450 pixels of detail — on a 2× (Retina/mobile)
screen the OS then upscales that buffer. Source resolution above 720p is wasted;
**bitrate, not resolution, is the lever that matters** at this canvas size.

## Recommended encode

| Setting    | Value                                          | Notes |
|------------|------------------------------------------------|-------|
| Container  | MP4 with `+faststart`                          | moov atom up front so playback can start while streaming |
| Video      | H.264, Main/High profile, `yuv420p`            | universal desktop + mobile support; skip HEVC/VP9/AV1 |
| Resolution | 1280×720 (min 854×480), 16:9                   | matches the 800×450 canvas aspect; slight downsample from 720p looks crisper than a 1:1 480p source |
| Quality    | CRF 20–22, `preset slow` (≈ 2.5–4 Mbps at 720p) | dark, high-motion footage needs the headroom — blocking shows badly in shadows |
| Framerate  | keep source (24/30), max 30                    | |
| Audio      | AAC 128–160 kbps stereo, 48 kHz                | |
| File size  | ≤ ~5–8 MB per clip                             | preloaded in `BootScene` before the title shows; mobile users may be on cellular |

The current `intro.mp4` (854×480 @ 485 kbps) is well below this — re-export from the
original master if available; visible macroblocking in dark scenes is the encode,
not the renderer.

## Reference command

```bash
ffmpeg -i master.mov \
  -vf "scale=1280:720" -r 24 \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 21 -preset slow \
  -c:a aac -b:a 160k \
  -movflags +faststart \
  intro.mp4
```

Sanity-check the result: duration × bitrate ≈ file size (17 s × 3 Mbps ≈ 6 MB), and
scrub through the darkest shots at 100% zoom.

## If quality still isn't enough

Both remaining ceilings are renderer-side, not encode-side (see the Option A/B
trade-off in the intro-video plan):

1. Render the canvas at devicePixelRatio (bigger buffer, affects the whole game), or
2. Play cutscenes in a DOM `<video>` overlay instead of in-canvas (native decode and
   sharpness, but separate sizing/input handling from the Phaser scale manager).
