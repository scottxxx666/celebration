// row: player row index 0 (top) – 4 (bottom); spawner converts to y.
// hw, hh use half-dimension convention (AABB) — matches ObstacleSpawner collision.
// timeOffset: ms after wave start; events must be sorted ascending.

export const WAVES = [
  {
    songTime: 0,
    name: 'intro',
    duration: 5600,
    obstacles: [
      { timeOffset: 0,    row: 0, hw: 25, hh: 25 },
      { timeOffset: 1400, row: 2, hw: 30, hh: 20 },
      { timeOffset: 2800, row: 0, hw: 30, hh: 20 },
      { timeOffset: 4200, row: 0, hw: 20, hh: 50 },
    ],
  },
  {
    songTime: 5600,
    name: 'high_low_alternation',
    duration: 5600,
    obstacles: [
      { timeOffset: 0,    row: 0, hw: 25, hh: 20 },
      { timeOffset: 700,  row: 2, hw: 25, hh: 20 },
      { timeOffset: 1400, row: 0, hw: 25, hh: 20 },
      { timeOffset: 2100, row: 2, hw: 25, hh: 20 },
      { timeOffset: 2800, row: 0, hw: 25, hh: 20 },
      { timeOffset: 3500, row: 2, hw: 25, hh: 20 },
      { timeOffset: 4200, row: 0, hw: 40, hh: 50 },
    ],
  },
  {
    songTime: 11200,
    name: 'gap_run',
    duration: 7000,
    // hh is visual only; collision is always 1 row regardless.
    obstacles: [
      { timeOffset: 0,    row: 0, hw: 30, hh: 54 },
      { timeOffset: 0,    row: 4, hw: 30, hh: 54 },
      { timeOffset: 2000, row: 0, hw: 30, hh: 54 },
      { timeOffset: 2000, row: 4, hw: 30, hh: 54 },
      { timeOffset: 4500, row: 0, hw: 30, hh: 54 },
      { timeOffset: 4500, row: 4, hw: 30, hh: 54 },
    ],
  },
];
