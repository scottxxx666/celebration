export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 450;

export const PLAYER_X = 300;

// World scroll speed (pixels/second)
export const MIN_SPEED = 200;
export const MAX_SPEED = 600;
export const ACCEL_STEP = 50;   // speed gained per alternating tap
export const DECEL_PER_SEC = 125; // speed lost per second when not tapping

// Walking zone — player/obstacles confined to this vertical band
export const WALK_ZONE_TOP = GAME_HEIGHT * 0.4; // y=180; above is scenery

// Active road+background pair — see SCENERY_THEMES in src/objects/Scenery.js
export const SCENERY_THEME = 'night';

// Player half-dimensions
export const PLAYER_HW = 45;
export const PLAYER_HH = 45;

// Player run-cycle sprite (docs/image-assets.md "Run-cycle frames (player &
// enemy)"): number of `run-<i>.png` frames prepped by
// `tools/prep-run-frames.py` (0 = keep the green placeholder rectangle) and
// the sprite's logical half-height at front-row scale (like obstacle `hh` in
// obstacleSprites.js) — drives display scale only, the collision AABB stays
// PLAYER_HW/PLAYER_HH.
export const PLAYER_FRAME_COUNT = 3;
export const PLAYER_SPRITE_HH = 70;

// Player rows
export const NUM_ROWS = 3;
export const ROW_HEIGHT = (GAME_HEIGHT - WALK_ZONE_TOP) / NUM_ROWS; // 90

// Fake-3D depth (docs/art-brief.md): visual scale from back row (0) to front row
export const ROW_SCALE_BACK = 0.9;
export const ROW_SCALE_FRONT = 1.0;

// Obstacle collision width as a fraction of each sprite's `hw`
// (obstacleSprites.js), shrunk equally front and back around the same centre
// so near-misses go the player's way. Collision only — art placement, shadow
// and spawn timing keep the full `hw`. 1 = hitbox as wide as the art.
export const OBSTACLE_HITBOX_SCALE = 0.75;

// Touch controls — vertical drag distance (game px) from the pointer's down
// position before a swipe fires a row change (see GameScene pointer handlers)
export const SWIPE_THRESHOLD = 40;

// Chasing enemy
export const ENEMY_SPEED = 400;      // world px/s; keep player.speed above this to stay safe
export const ENEMY_START_X = 0;   // initial off-screen x position
export const ENEMY_HW = 26;          // half-width
export const ENEMY_HH = 39;          // half-height

// Enemy run-cycle sprite (docs/image-assets.md "Run-cycle frames (player &
// enemy)"): same scheme as the player's — number of `run-<i>.png` frames
// prepped by `tools/prep-run-frames.py --target enemy` (0 = keep the red
// placeholder rectangle) and the sprite's logical half-height at front-row
// scale; 39 matches the current 78px-tall placeholder so swapping in art
// doesn't change size. Drives display scale only, collision AABB stays
// ENEMY_HW/ENEMY_HH.
export const ENEMY_FRAME_COUNT = 2;
export const ENEMY_SPRITE_HH = 39;

// Enemy speed ramp, anchored to song time (see docs/speed-design.md)
export const ENEMY_CRUISE_SPEED = 565;    // after ramp; quarter-note tapping at 150.55 BPM (2.51 taps/s) sustains ~575, so 565 leaves an escape margin for on-rhythm play
export const ENEMY_RAMP_START_MS = 5331;  // song time when enemy speed starts rising (real beat 12, mid-intro)
export const ENEMY_RAMP_END_MS = 14896;   // song time when enemy reaches cruise speed (real beat 36, chorus 1 hits at cruise)

// Assumed player speed for obstacle spawn timing once the enemy pins the player
// into the speed band; before OBSTACLE_TIMING_SWITCH_MS (song time) timing uses
// the player's actual speed instead
export const OBSTACLE_TIMING_SPEED = (MAX_SPEED + ENEMY_CRUISE_SPEED) / 2;
export const OBSTACLE_TIMING_SWITCH_MS = 14896;  // real beat 36, when the enemy ramp completes

// Song time when the beat-sync presentation switches on (enemy row-stepping on
// the beat, player squash pulse, walk-zone beat flash); before it, original
// intro behavior — no pulses, enemy tracks the player's row instantly
// (real beat 36, chorus 1)
export const BEAT_SYNC_START_MS = 14896;

// Music — public/assets/music.m4a, measured 2026-09-18 (see tools/gen-waves.py):
// 150.55 BPM constant, real beat 0 (first downbeat) at 549 ms. Up to real beat
// 244 every phrase boundary falls on a multiple of 8 real beats counted from real
// beat 4 (a one-beat silence there shifts the bridge and final chorus by one), so the
// game's beat 0 is anchored there and downbeats (beatIndex % 4 === 0) land on
// phrase starts on either grid below.
export const TRACK_BPM = 150.55;
export const TRACK_BEAT_MS = 60000 / TRACK_BPM;   // real track beat (~398.54 ms) — the unit of waves.js timeOffset
export const BPM = TRACK_BPM;   // true-tempo game beat (~398 ms) — one game beat per real track beat
// export const BPM = TRACK_BPM / 2;    // half-time game beat (~797 ms) — swap in to compare (sections.js strobe/lightsOut values are authored for true tempo)
export const BEAT_MS = 60000 / BPM;
// Run-cycle frame steps per game beat, per character (GameScene multiplies by
// the section's speedMult). The player's 3-frame cycle at 6 steps puts a foot
// contact (frame 0) on every half game beat (every real track beat at half-time BPM); the
// enemy's 2-frame cycle steps on 8th notes. Also sets each character's
// free-running pre-beat frame period (BEAT_MS / steps) in RunCycle, so a
// character runs from the very first frame, before the beat clock starts.
export const PLAYER_RUN_STEPS_PER_BEAT = 6;
export const ENEMY_RUN_STEPS_PER_BEAT = 2;
// Tap-driven player run: each accelerating (alternating) tap advances the run
// cycle by exactly one frame, and it holds that frame until the next tap — so
// feet follow the fingers instead of the beat grid. After this long without a
// tap (and before the first one) the cycle falls back to the beat-locked run
// at PLAYER_RUN_STEPS_PER_BEAT, so the character never freezes; keep it well
// above the intended tap interval (~400 ms) or the two would fight between
// taps. 0 = always beat-locked (also what `?debug` uses, since it ignores
// taps).
export const PLAYER_TAP_RUN_IDLE_MS = 80;
export const FIRST_BEAT_OFFSET_MS = 2143;
// Song time at which the run is cleared — 3 s after the last obstacle arrives
// (chorus3 timeOffset 30 ≈ 135653 ms), a little before the track's own end
// (139498 ms). Its own knob: re-tune by hand if waves.js is regenerated. The
// track's COMPLETE event still wins the run if this is set past the end.
export const WIN_MS = 138653;
// Manual trim added on top of the auto-detected audio output latency (see
// Conductor); positive = visuals later
export const AUDIO_LATENCY_OFFSET_MS = 0;

// Default user volume when nothing is saved — sources play at full loudness,
// so the slider's max (1.0) is louder than this default
export const DEFAULT_VOLUME = 0.6;

// Section effects (src/config/sections.js holds the section times)
export const BEAT_FLASH_ALPHA = 0.1;          // beat-flash peak alpha outside disco (downbeat of each bar)
export const BEAT_FLASH_OFFBEAT_RATIO = 0.5;  // non-downbeat alpha as a fraction of the peak
export const DISCO_FLASH_OFFBEAT_RATIO = 0.6; // same, during disco
export const BEAT_FLASH_DECAY = 0.4;          // alpha fade per second after each flash
export const DISCO_FLASH_ALPHA = 0.14;        // beat-flash alpha during disco (downbeat; others slightly lower)
export const ROTATE_BEATS_PER_TURN = 16;      // one full camera revolution per N beats (spin-speed tuning knob)
// Worst-case fit: GAME_HEIGHT / √(GAME_WIDTH² + GAME_HEIGHT²) ≈ 0.49 — the constant zoom
// at which the whole 800×450 field stays inside the viewport at every angle of a full turn
// (no per-angle breathing)
export const ROTATE_ZOOM = 0.49;
export const DISCO_DIM_ALPHA = 0.55;    // black overlay alpha during disco — darkens world so beams/lasers pop
export const DISCO_DIM_FADE_MS = 700;  // beat-aligned fade in/out ramp (~1 beats) at disco section start/end
// Dashed lane-line row dividers redrawn above the dim (the road art's own lines sit under it and
// vanish); fade in/out with the dim and scroll with the road. With `lights` they blink
// on the beat grid: shown, then hidden, in equal spans; without (lights-out sections) they
// stay on
export const DIM_ROW_LINE_COLOR = 0xe8e4d8;  // without `lights`
// With `lights`: a fixed pastel road-paint cream, deliberately outside the saturated
// DISCO_COLORS so the lines never blend into a beam or the beat flash
export const DISCO_ROW_LINE_COLOR = 0xe8e4d8;
export const DIM_ROW_LINE_ALPHA = 0.6;       // alpha while shown
export const DIM_ROW_LINE_BLINK_BEATS = 1;   // beats shown, then the same hidden (0.5 = on/off within each beat)
export const DIM_ROW_LINE_THICKNESS = 3;
export const DIM_ROW_LINE_DASH = 48; // px drawn per dash
export const DIM_ROW_LINE_GAP = 72;  // px skipped between dashes (road-style: gap longer than dash)
export const DISCO_HUE_BEATS = 4; // beats the shared disco hue is held before advancing (4 = per bar)
// Saturated palette for disco: beat flash uses the base index; DiscoLights spread
// beams/pools/lasers across it by element index. The whole set advances per bar.
export const DISCO_COLORS = [0xff00ff, 0x00ffff, 0xffff00, 0x00ff00, 0xff8800];
// Strobe — full-screen white flash on beats; frequency is authored per-section (strobe = flashes/beat in sections.js)
export const STROBE_ALPHA = 0.4;  // peak white alpha of the strobe (a section's strobeRamp scales it up to this)
export const STROBE_DECAY = 12;    // alpha units/sec fade after the flash (~100ms tail)
// Lights out — full-black overlay on the dark part of each cycle (lit/dark beat lengths are authored per-section, lightsOut in sections.js)
export const LIGHTS_OUT_FADE_MS = 60;  // fade to black at the start of each dark part; the lights snap back on
// lightsOut.reveal 'shadows': drop shadows glow above the black so rows and distances stay readable
export const LIGHTS_OUT_SHADOW_COLOR = 0xffffff;
export const LIGHTS_OUT_SHADOW_ALPHA = 0.85;
export const LIGHTS_OUT_SHADOW_DEPTH = 9.5;  // above the lights-out overlay (9), below the HUD (10)
// lightsOut.reveal 'silhouettes': the overlay drops behind gameplay as a near-black backdrop and sprites tint solid black
export const LIGHTS_OUT_SILHOUETTE_BG = 0x161616;  // backdrop colour — lighter = outlines read more easily, darker = closer to full dark

// Camera zoom punch — subtle zoom pulse during lights sections, decaying over the beat.
// Multiplies the base zoom (1, or ROTATE_ZOOM when rotate is on), so it composes
// with the rotate section. Purely visual, gated on section.lights / song time.
export const ZOOM_PUNCH_AMOUNT = 0.02;    // peak extra zoom (1.02 = +2%) at the punch instant
export const ZOOM_PUNCH_BEATS = 4;        // beats between punches (4 = per-bar downbeat, 1 = per beat)
export const ZOOM_PUNCH_DECAY_MS = 350;   // linear decay time from peak back to base (~half a beat)

// Ghost double vision — extra translucent cameras redraw the whole world (not the HUD)
// slightly offset, each orbiting an ellipse once per GHOST_SWAY_BEATS beats. Composes
// with rotate/zoom punch (offsets are camera scroll/zoom on top of the main camera).
// Purely visual, gated on section.ghost / song time.
export const GHOST_COUNT = 2;             // extra cameras (duplicate worlds)
export const GHOST_ALPHA = 0.25;          // each ghost's opacity at full fade-in
export const GHOST_OFFSET_X = 14;         // horizontal orbit radius in px
export const GHOST_OFFSET_Y = 6;          // vertical orbit radius in px
export const GHOST_ZOOM_STEP = 0.02;      // extra zoom per ghost index (1st = +2%, 2nd = +4%)
export const GHOST_SWAY_BEATS = 4;        // beats per full orbit
export const GHOST_FADE_MS = 400;         // fade in after section start / out before its end

// Confetti cannon — one-shot pop fired on a clear/win to celebrate (GameOverScene).
// Pooled rectangles launched up-and-inward from the bottom corners, falling under
// gravity/drag; purely visual.
export const CONFETTI_COUNT = 150;             // pool size / pieces fired per burst
export const CONFETTI_COLORS = [0xff2d95, 0x00e5ff, 0xffe600, 0x39ff14, 0xff8800, 0xffffff]; // festive palette, distinct from DISCO_COLORS
export const CONFETTI_LIFESPAN_MS = 3200;      // total time a piece stays alive after launch
export const CONFETTI_FADE_MS = 700;           // alpha fades to 0 over this final stretch of life
export const CONFETTI_GRAVITY = 520;           // px/s² downward acceleration
export const CONFETTI_SPEED_MIN = 380;         // min launch speed (px/s)
export const CONFETTI_SPEED_MAX = 700;         // max launch speed (px/s)
export const CONFETTI_SPREAD_DEG = 28;         // ± spread around the up-and-inward aim angle
// Horizontal air drag, applied as vx *= CONFETTI_DRAG ** dt each frame (per-second
// velocity retention factor, <1 — NOT the linear vx -= vx*DRAG*dt form).
export const CONFETTI_DRAG = 0.4;
export const CONFETTI_SPIN_MAX = 12;           // max angular velocity magnitude (rad/s)
export const CONFETTI_FLUTTER_AMP = 40;        // px horizontal sway amplitude
export const CONFETTI_FLUTTER_FREQ = 8;        // sway/tumble oscillation speed (rad/s)
export const CONFETTI_SIZE_MIN = 6;            // min strip width (px)
export const CONFETTI_SIZE_MAX = 12;           // max strip width (px)
