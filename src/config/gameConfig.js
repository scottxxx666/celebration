export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 400;

export const PLAYER_X = 300;

// World scroll speed (pixels/second)
export const MIN_SPEED = 200;
export const MAX_SPEED = 600;
export const ACCEL_STEP = 50;   // speed gained per alternating tap
export const DECEL_PER_SEC = 100; // speed lost per second when not tapping

// Player vertical movement
export const VERTICAL_SPEED = 250; // pixels/second

// Obstacle spawning
export const SPAWN_INTERVAL_MS = 1400;

// Chasing enemy
export const ENEMY_SPEED = 400;      // world px/s; keep player.speed above this to stay safe
export const ENEMY_START_X = 0;   // initial off-screen x position
export const ENEMY_HW = 20;          // half-width
export const ENEMY_HH = 30;          // half-height
