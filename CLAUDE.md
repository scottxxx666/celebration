# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev       # start dev server (http://localhost:5173)
yarn build     # production build to dist/
yarn preview   # preview production build locally
```

No test runner is configured.

## Architecture

**Stack:** Phaser 3 + Vite 6, vanilla JavaScript (ES modules).

**Scene lifecycle** (`src/main.js` bootstraps in order):
1. `BootScene` — asset loading; transitions to `MenuScene`
2. `MenuScene` — title menu with Start / How to Play; the confirming gesture unlocks the browser audio context before gameplay starts (keeps music in sync). The bottom hint is device-aware (`device.os.desktop`: keyboard vs touch wording). How to Play opens `HowToPlayScene` rather than an in-scene panel. On mobile, the Start tap also requests fullscreen (guarded on `scale.fullscreen.available`, so iPhone no-ops) and attempts a landscape orientation lock on enter; on desktop, F toggles fullscreen in any scene (global DOM keydown listener in `src/main.js`; every scene's desktop hint line advertises it)
3. `IntroScene` — plays the intro video (`public/assets/intro.mp4`, encoding specs in `docs/video-assets.md`) in-canvas via a Phaser Video game object; SPACE/ESC/tap skips, and both skip and VIDEO_COMPLETE go through a guarded `startGame()` that waits for the audio unlock before starting `GameScene`. Sizing quirk: the Video object starts as a 256×256 placeholder and VIDEO_TEXTURE fires *before* Phaser adopts the real frame size, so the scene sets `setScale` from the event's texture dimensions — never `setDisplaySize`, which bakes in a 256-based scale that zoom-crops the video
4. `GameScene` — main gameplay loop; owns physics, scrolling background, collision detection, score, and music (starts on create, plays once — no loop). **Song = level**: the track's COMPLETE event ends the run as a win; death or win goes through `endRun(won)`, which passes `{ won, score, progress }` to `GameOverScene`
5. `GameOverScene` — shows CLEAR! (win) or GAME OVER plus song progress % and survived seconds; SPACE restarts `GameScene`, ESC returns to `MenuScene`. On a win it fires a one-shot confetti-cannon pop (`Confetti` in `src/objects/Confetti.js`) to celebrate — pooled `add.rectangle` pieces launched up-and-inward from the bottom corners, falling under gravity with horizontal air drag, tumbling (spin + a scaleX flip fakes edge-on paper) and fluttering (sinusoidal sway), fading out near end of life (`CONFETTI_*` in `gameConfig.js`), depth 9, purely visual

`HowToPlayScene` — full-screen instructions reached from `MenuScene`'s "How to Play" option; not part of the boot→game flow. Device-aware (`device.os.desktop`): desktop shows two keycap-demo columns (←/→ and ↑/↓ press animations); mobile shows a single **landscape** phone mock mirroring the real play screen, running a sequenced play loop on one 350ms clock — six alternating finger taps on the left/right halves, then one thumb-side swipe (up on the right half, down on the left — alternating halves says "swipe anywhere works"; the divider dims during it and a chevron pulses beside the swiping half), then a rest tick — with all captions stacked full-width below (the long monospace lines overlap in a two-column layout). Any key or tap returns to `MenuScene`.

**Game objects** (`src/objects/`):
- `Player` — alternating left/right key taps accelerate the player; up/down arrows snap between 5 rows. Input is split into shared methods — `tap(side)` (alternating accel) and `moveRow(dir)` (clamped row snap) — so keyboard (`update()`) and touch share one code path. Touch controls (wired in `GameScene`): tapping the left/right half of the screen calls `tap()` on `pointerdown`; a vertical swipe past `SWIPE_THRESHOLD` (`gameConfig.js`) calls `moveRow()` mid-gesture, one row change per pointer until release — tracked per-pointer so two-thumb tapping and a swipe don't interfere
- `ObstacleSpawner` — spawns the authored waves from `src/config/waves.js`, timed off song time (passed in from the Conductor) so obstacles arrive at the player on the beat; scroll speed is the player's actual speed, while spawn timing uses a separate `timingSpeed`
- `Enemy` — chases from the left; its speed ramps from `ENEMY_SPEED` to `ENEMY_CRUISE_SPEED` anchored to song time, pinning the player into a narrow speed band near max. Tracks the player's row instantly during the intro; once beat sync is on it steps onto the row only on beat crossings, so row-dodging buys up to one beat of separation

**Fake-3D depth** (`src/rowLayout.js`): shared `rowLayout(row)` → `{y, scale, depth}` — the only
place row→y math lives; back rows render smaller (`ROW_SCALE_BACK`→`ROW_SCALE_FRONT`, per
`docs/art-brief.md`) and behind front rows (`setDepth(row)`; drop shadows at row − 0.5, background
layers below that). Scaling is visual only — collision boxes never scale.

**Beat clock** (`src/Conductor.js`): minimal music clock (`BPM` + `FIRST_BEAT_OFFSET_MS` from config); polled each frame by `GameScene` for beat/half-beat crossings, and the single read point for song time (`conductor.songMs`) — score, the beat-sync gate, the enemy ramp, and obstacle spawning all run on it; nothing else reads `music.seek`. The whole beat-sync layer — enemy row-stepping, the player's 8th-note squash pulse, and the walk-zone beat flash — switches on together at `BEAT_SYNC_START_MS` (song time, independent of the enemy speed ramp); before that the game behaves like the original intro.

**Speed/rhythm design** (`docs/speed-design.md`): once the enemy reaches cruise speed, obstacle spawn timing assumes the band average (`OBSTACLE_TIMING_SPEED`) instead of the instantaneous player speed, keeping on-beat arrival within ~±40ms. Before the ramp completes (sparse intro), timing uses the player's actual speed.

**Configuration** (`src/config/gameConfig.js`): single source of truth for canvas size, speed bounds, acceleration/deceleration rates, enemy ramp, and music constants (`BPM`, `FIRST_BEAT_OFFSET_MS` — TBD until the track is chosen). Tune gameplay here, not inline. Wave/beat maps live in `src/config/waves.js`.

**Song sections** (`src/config/sections.js`): authored, song-time-anchored spans (like `waves.js`) that layer effects on top of normal play; `sectionAt(songMs)` returns the containing section or a normal default. `speedMult` is a global world multiplier `GameScene` applies to background scroll, obstacle scroll/spawn timing, and enemy motion (not `Player.speed` — taps feel the same, only the world moves faster); `disco` shows `DiscoLights` top-down beam cones (plus pools and lasers) that jump to a random position/slant on every beat, each taking a distinct colour from `DISCO_COLORS` offset by its element index (a "palette spread", never random) — the whole set advances together per bar (`DISCO_HUE_BEATS`), and the beat-flash overlay uses the base hue; each beam also fakes volumetric haze with nested narrower/brighter inner-cone triangles (`HAZE_INNER_WIDTH_RATIOS`/`HAZE_INNER_ALPHA`) and a soft apex glow blob at its source (`HAZE_APEX_GLOW_WIDTH`/`HAZE_APEX_GLOW_HEIGHT`/`HAZE_APEX_GLOW_ALPHA`), both sharing the parent beam's apex/axis/colour and re-jumping in lockstep with it — and fades in a black dim overlay (depth −6, between the background and the lights/beat overlay) that darkens the world so the beams pop without dimming the player/enemy/obstacles above it — fading in/out on a beat-aligned ramp (`DISCO_DIM_FADE_MS`) at section start/end; a per-section `strobe` field (flashes per beat — its own authored effect, independent of `disco`) flashes full-screen white (`this.strobeOverlay`, depth 8, above gameplay) to `STROBE_ALPHA`, fading over `STROBE_DECAY`, aligned to the beat grid and gated purely on section song-time; `rotate` continuously spins the main camera counterclockwise (`ROTATE_BEATS_PER_TURN` beats per revolution, zoomed to `ROTATE_ZOOM` so the whole field stays visible) anchored to the section start, purely visual; during disco the main camera also does a subtle zoom punch (`ZOOM_PUNCH_AMOUNT`) every `ZOOM_PUNCH_BEATS` beats, decaying over `ZOOM_PUNCH_DECAY_MS`, multiplied onto the base zoom so it composes with `ROTATE_ZOOM` when `rotate` is on — purely visual, gated on section song-time. Times are placeholders (track TBD), same as `BPM`; each effect is gated on section song-time, never on another system's runtime state (enemy ramp, beat-sync gate stay independent).
