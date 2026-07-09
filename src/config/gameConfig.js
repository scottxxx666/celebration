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

// Fake haze (docs/disco-upgrade.md P4) — nested brighter cones + apex glow layered inside
// each DiscoLights beam to fake volumetric fog, no shader needed
export const HAZE_INNER_WIDTH_RATIOS = [0.55, 0.28]; // each inner layer's base half-width as a ratio of BEAM_HALF_BASE (same apex/axis/base-center as the parent beam)
export const HAZE_INNER_ALPHA = 0.35;        // additive alpha per inner layer; stacking reads as a brighter core near the apex
export const HAZE_APEX_GLOW_WIDTH = 90;      // width of the soft glow blob pooled at the beam's apex (top edge)
export const HAZE_APEX_GLOW_HEIGHT = 50;     // height of the apex glow blob
export const HAZE_APEX_GLOW_ALPHA = 0.35;    // alpha of the apex glow blob
