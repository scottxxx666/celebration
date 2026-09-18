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

// Player run-cycle sprite (docs/image-assets.md "Player run frames"): number
// of `run-<i>.png` frames prepped by `tools/prep-player-frames.py` (0 = keep
// the green placeholder rectangle) and the sprite's logical half-height at
// front-row scale (like obstacle `hh` in obstacleSprites.js) — drives display
// scale only, the collision AABB stays PLAYER_HW/PLAYER_HH.
export const PLAYER_FRAME_COUNT = 2;
export const PLAYER_SPRITE_HH = 70;
// Free-running walk-cycle period so the player walks from the very first
// frame (the beat clock fires nothing before the first downbeat + audio start
// latency); each half-beat crossing re-steps and resets this timer, so once
// beats arrive the cycle is phase-locked to 8th notes. Defined below BPM.

// Player rows
export const NUM_ROWS = 3;
export const ROW_HEIGHT = (GAME_HEIGHT - WALK_ZONE_TOP) / NUM_ROWS; // 90

// Fake-3D depth (docs/art-brief.md): visual scale from back row (0) to front row
export const ROW_SCALE_BACK = 0.6;
export const ROW_SCALE_FRONT = 1.0;

// Obstacle spawning
export const SPAWN_INTERVAL_MS = 1400;

// Touch controls — vertical drag distance (game px) from the pointer's down
// position before a swipe fires a row change (see GameScene pointer handlers)
export const SWIPE_THRESHOLD = 40;

// Chasing enemy
export const ENEMY_SPEED = 400;      // world px/s; keep player.speed above this to stay safe
export const ENEMY_START_X = 0;   // initial off-screen x position
export const ENEMY_HW = 26;          // half-width
export const ENEMY_HH = 39;          // half-height

// Enemy speed ramp, anchored to song time (see docs/speed-design.md)
export const ENEMY_CRUISE_SPEED = 565;    // after ramp; quarter-note tapping at 150.55 BPM (2.51 taps/s) sustains ~575, so 565 leaves an escape margin for on-rhythm play
export const ENEMY_RAMP_START_MS = 5331;  // song time when enemy speed starts rising (real beat 12, mid-intro)
export const ENEMY_RAMP_END_MS = 14896;   // song time when enemy reaches cruise speed (real beat 36, chorus 1 hits at cruise)

// Assumed player speed for obstacle spawn timing once the enemy is at cruise
export const OBSTACLE_TIMING_SPEED = (MAX_SPEED + ENEMY_CRUISE_SPEED) / 2;

// Song time when the beat-sync presentation switches on (enemy row-stepping on
// the beat, player squash pulse, walk-zone beat flash); before it, original
// intro behavior — no pulses, enemy tracks the player's row instantly
// (real beat 36, chorus 1)
export const BEAT_SYNC_START_MS = 14896;

// Music — public/assets/music.m4a, measured 2026-09-18 (see tools/gen-waves.py):
// 150.55 BPM constant, real beat 0 (first downbeat) at 549 ms. Every phrase
// boundary falls on a multiple of 8 real beats counted from real beat 4, so the
// game's beat 0 is anchored there and downbeats (beatIndex % 4 === 0) land on
// phrase starts on either grid below.
export const TRACK_BPM = 150.55;
export const BPM = TRACK_BPM / 2;   // half-time game beat (~797 ms) — obstacles land on beats and half-beats
// export const BPM = TRACK_BPM;    // true-tempo game beat (~398 ms) — swap in to compare
export const PLAYER_FRAME_MS = 60000 / BPM / 2; // one 8th note
export const FIRST_BEAT_OFFSET_MS = 2143;

// Default user volume when nothing is saved — sources play at full loudness,
// so the slider's max (1.0) is louder than this default
export const DEFAULT_VOLUME = 0.7;

// Section effects (src/config/sections.js holds the section times)
export const DISCO_FLASH_ALPHA = 0.18;        // beat-flash alpha during disco (downbeat; others slightly lower)
export const ROTATE_BEATS_PER_TURN = 16;      // one full camera revolution per N beats (spin-speed tuning knob)
// Worst-case fit: GAME_HEIGHT / √(GAME_WIDTH² + GAME_HEIGHT²) ≈ 0.49 — the constant zoom
// at which the whole 800×450 field stays inside the viewport at every angle of a full turn
// (no per-angle breathing)
export const ROTATE_ZOOM = 0.49;
export const DISCO_DIM_ALPHA = 0.55;    // black overlay alpha during disco — darkens world so beams/lasers pop
export const DISCO_DIM_FADE_MS = 700;  // beat-aligned fade in/out ramp (~1 beats) at disco section start/end
export const DISCO_HUE_BEATS = 4; // beats the shared disco hue is held before advancing (4 = per bar)
// Saturated palette for disco: beat flash uses the base index; DiscoLights spread
// beams/pools/lasers across it by element index. The whole set advances per bar.
export const DISCO_COLORS = [0xff00ff, 0x00ffff, 0xffff00, 0x00ff00, 0xff8800];
// Strobe — full-screen white flash on beats; frequency is authored per-section (strobe = flashes/beat in sections.js)
export const STROBE_ALPHA = 0.4;  // peak white alpha of the strobe
export const STROBE_DECAY = 12;    // alpha units/sec fade after the flash (~100ms tail)

// Camera zoom punch — subtle zoom pulse during disco, decaying over the beat.
// Multiplies the base zoom (1, or ROTATE_ZOOM when rotate is on), so it composes
// with the rotate section. Purely visual, gated on section.disco / song time.
export const ZOOM_PUNCH_AMOUNT = 0.02;    // peak extra zoom (1.02 = +2%) at the punch instant
export const ZOOM_PUNCH_BEATS = 4;        // beats between punches (4 = per-bar downbeat, 1 = per beat)
export const ZOOM_PUNCH_DECAY_MS = 350;   // linear decay time from peak back to base (~half a beat)

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
