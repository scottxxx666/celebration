// Song-time scenery stages: the road+background pair hard-cuts to `theme`
// (a SCENERY_THEMES key) at each startMs. Arrival-sorted, first starts at 0.
// Placeholders reusing existing themes until the new stage art exists.
// Times must sit on a real track beat (yarn check:beats): 26055 = end of
// highlight1b, 89822 = blackout start (cut hidden in the dark), 123697 =
// final_highlight start.
export const STAGES = [
  { name: 'stage1', startMs: 0, theme: 'suburb' },
  { name: 'stage2', startMs: 27251, theme: 'suburbDay' },
  { name: 'stage3', startMs: 89822, theme: 'suburb' },
  { name: 'stage4', startMs: 123697, theme: 'night' },
];

// Last stage whose startMs <= songMs; negative songMs (latency at run start) is stage 1.
export function stageAt(songMs) {
  let current = STAGES[0];
  for (const stage of STAGES) {
    if (stage.startMs <= songMs) current = stage;
    else break;
  }
  return current;
}

// Unique themes used by STAGES, for preloading.
export function stageThemeNames() {
  return [...new Set(STAGES.map(s => s.theme))];
}
