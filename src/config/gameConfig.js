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

// Player half-dimensions
export const PLAYER_HW = 35;
export const PLAYER_HH = 35;

// Player rows
export const NUM_ROWS = 5;
export const ROW_HEIGHT = (GAME_HEIGHT - WALK_ZONE_TOP) / NUM_ROWS; // 54

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
export const ENEMY_HW = 20;          // half-width
export const ENEMY_HH = 30;          // half-height

// Enemy speed ramp, anchored to song time (see docs/speed-design.md)
export const ENEMY_CRUISE_SPEED = 575;    // after ramp; keep just below the sustainable tap average so perfect play slowly escapes
export const ENEMY_RAMP_START_MS = 5600;  // song time when enemy speed starts rising
export const ENEMY_RAMP_END_MS = 11200;   // song time when enemy reaches cruise speed

// Assumed player speed for obstacle spawn timing once the enemy is at cruise
export const OBSTACLE_TIMING_SPEED = (MAX_SPEED + ENEMY_CRUISE_SPEED) / 2;

// Song time when the beat-sync presentation switches on (enemy row-stepping on
// the beat, player squash pulse, walk-zone beat flash); before it, original
// intro behavior — no pulses, enemy tracks the player's row instantly
export const BEAT_SYNC_START_MS = 11200;

// Music — TBD, set when the final track is chosen
export const BPM = 85.7;                 // matches the 700ms beat spacing in waves.js
export const FIRST_BEAT_OFFSET_MS = 0;

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
