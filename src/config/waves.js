// row: top-most player row the obstacle occupies, 0 (top/back) – 4 (bottom/front).
// rows: optional, default 1 — number of consecutive rows blocked (row … row + rows − 1).
// hw: collision half-width (AABB) — matches ObstacleSpawner collision.
// visualHh: drawn half-height only; never affects collision (rows decides what's blocked).
// timeOffset: ms after wave start; events must be sorted ascending.

export const WAVES = [
  {
    songTime: 0,
    name: 'intro',
    duration: 5600,
    obstacles: [
      { timeOffset: 0,    row: 0, hw: 25, visualHh: 25 },
      { timeOffset: 1400, row: 2, hw: 30, visualHh: 20 },
      { timeOffset: 2800, row: 0, hw: 30, visualHh: 20 },
      { timeOffset: 4200, row: 0, hw: 20, visualHh: 50 },
    ],
  },
  {
    songTime: 5600,
    name: 'high_low_alternation',
    duration: 5600,
    obstacles: [
      { timeOffset: 0,    row: 0, hw: 25, visualHh: 20 },
      { timeOffset: 700,  row: 2, hw: 25, visualHh: 20 },
      { timeOffset: 1400, row: 0, hw: 25, visualHh: 20 },
      { timeOffset: 2100, row: 2, hw: 25, visualHh: 20 },
      { timeOffset: 2800, row: 0, hw: 25, visualHh: 20 },
      { timeOffset: 3500, row: 2, hw: 25, visualHh: 20 },
      { timeOffset: 4200, row: 0, hw: 40, visualHh: 50 },
    ],
  },
  {
    songTime: 11200,
    name: 'gap_run',
    duration: 7000,
    obstacles: [
      { timeOffset: 0,    row: 0, hw: 30, visualHh: 54 },
      { timeOffset: 0,    row: 4, hw: 30, visualHh: 54 },
      { timeOffset: 2000, row: 0, hw: 30, visualHh: 54 },
      { timeOffset: 2000, row: 4, hw: 30, visualHh: 54 },
      { timeOffset: 4500, row: 0, hw: 30, visualHh: 54 },
      { timeOffset: 4500, row: 4, hw: 30, visualHh: 54 },
    ],
  },
];
