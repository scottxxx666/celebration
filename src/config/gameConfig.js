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

// Player half-dimensions (must match Player.js HALF_W / HALF_H)
export const PLAYER_HW = 35;
export const PLAYER_HH = 35;

// Player rows
export const NUM_ROWS = 5;
export const ROW_HEIGHT = (GAME_HEIGHT - WALK_ZONE_TOP) / NUM_ROWS; // 54

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
