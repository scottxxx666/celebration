// Character obstacle sprites (docs/image-assets.md "Obstacle character
// sprites"). Prepped with `tools/prep-obstacle-image.py` from the raw source
// art into public/assets/sprites/obstacles/<slug>.png at a uniform height
// (280px = 2x logical) so every sprite scales consistently in
// `ObstacleSpawner.js`. `BootScene` preloads every entry here.
//
// Note: once a sprite is used, the wave's `visualHh` is ignored — height comes
// only from `hh` here. And since wall sections spawn two obstacles per beat, a
// wide `hw` (zombie 61 vs the authored 25) makes walls block a row for longer;
// if walls feel unfair, lower `hw` toward 30 and let art trail past the hitbox
// (the left, dangerous edge stays aligned).
export const OBSTACLE_SPRITES = [
  {
    key: 'obs-chaewon-flamingo',
    file: 'assets/sprites/obstacles/chaewon-flamingo.png',
    hh: 70, // logical half-height at front-row scale; drives the uniform
            // scale applied to the sprite (width follows the image aspect)
    hw: 35, // collision AABB half-width AND spawn-timing distance — tuned
            // per image from its displayed half-width at this hh; collision
            // height is still fixed to one row (see collisionHh)
  },
  {
    key: 'obs-kazuha-zombie',
    file: 'assets/sprites/obstacles/kazuha-zombie.png',
    hh: 58,
    hw: 61,
  },
  {
    key: 'obs-sakura-chainsaw',
    file: 'assets/sprites/obstacles/sakura-chainsaw.png',
    hh: 62,
    hw: 56,
  },
];
