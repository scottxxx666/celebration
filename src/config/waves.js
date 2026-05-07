// y, hw, hh use half-dimension convention (AABB) — matches ObstacleSpawner collision.
// Valid y range: [hh, GAME_HEIGHT - hh] = [hh, 400 - hh]
// timeOffset: ms after wave start; events must be sorted ascending.

export const WAVES = [
  {
    name: 'intro',
    duration: 5600,
    obstacles: [
      { timeOffset: 0,    y: 200, hw: 25, hh: 25 },
      { timeOffset: 1400, y: 320, hw: 30, hh: 20 },
      { timeOffset: 2800, y: 80,  hw: 30, hh: 20 },
      { timeOffset: 4200, y: 200, hw: 20, hh: 50 },
    ],
  },
  {
    name: 'high_low_alternation',
    duration: 5600,
    obstacles: [
      { timeOffset: 0,    y: 80,  hw: 25, hh: 20 },
      { timeOffset: 700,  y: 320, hw: 25, hh: 20 },
      { timeOffset: 1400, y: 80,  hw: 25, hh: 20 },
      { timeOffset: 2100, y: 320, hw: 25, hh: 20 },
      { timeOffset: 2800, y: 80,  hw: 25, hh: 20 },
      { timeOffset: 3500, y: 320, hw: 25, hh: 20 },
      { timeOffset: 4200, y: 200, hw: 40, hh: 50 },
    ],
  },
  {
    name: 'gap_run',
    duration: 7000,
    obstacles: [
      { timeOffset: 0,    y: 60,  hw: 30, hh: 60 },
      { timeOffset: 0,    y: 340, hw: 30, hh: 60 },
      { timeOffset: 2000, y: 60,  hw: 30, hh: 60 },
      { timeOffset: 2000, y: 340, hw: 30, hh: 60 },
      { timeOffset: 4500, y: 60,  hw: 30, hh: 60 },
      { timeOffset: 4500, y: 340, hw: 30, hh: 60 },
    ],
  },
];
