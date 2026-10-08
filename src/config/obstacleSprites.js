// Character obstacle sprites (docs/image-assets.md "Obstacle character
// sprites"). Prepped with `tools/prep-obstacle-image.py` from the raw source
// art into public/assets/sprites/obstacles/<slug>.png at a uniform height
// (280px = 2x logical) so every sprite scales consistently in
// `ObstacleSpawner.js`. `BootScene` preloads every entry here.
//
// Note: height comes only from `hh` here. Since wall sections spawn two
// obstacles per beat, a wide `hw` makes walls block a row for longer; if walls
// feel unfair, lower OBSTACLE_HITBOX_SCALE (gameConfig.js) to narrow every
// hitbox around its centre.
export const OBSTACLE_SPRITES = [
  {
    key: 'obs-chaewon-flamingo',
    file: 'assets/sprites/obstacles/chaewon-flamingo.png',
    hh: 70, // logical half-height at front-row scale; drives the uniform
            // scale applied to the sprite (width follows the image aspect)
    hw: 35, // art half-width: art placement, shadow and spawn-timing
            // distance — tuned per image from its displayed half-width at
            // this hh. The collision AABB is this × OBSTACLE_HITBOX_SCALE;
            // its height is still fixed to one row (see COLLISION_HH)
  },
  {
    key: 'obs-kazuha-zombie',
    file: 'assets/sprites/obstacles/kazuha-zombie.png',
    hh: 70,
    hw: 61,
  },
  {
    key: 'obs-sakura-chainsaw',
    file: 'assets/sprites/obstacles/sakura-chainsaw.png',
    hh: 62,
    hw: 56,
  },
];
