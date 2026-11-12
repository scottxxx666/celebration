// Song-time scenery stages: the road+background pair crossfades to `theme`
// (a SCENERY_THEMES key) starting at each startMs (see stageBlend). Arrival-sorted, first starts at 0.
// Stages 5-6 are placeholders reusing existing themes until their art exists.
// Times must sit on a real track beat (yarn check:beats): 27251 = 3 beats
// after highlight1b ends (26055), 53156 = the beat nearest 53 s, 59134 = the beat nearest 59 s, 89822 =
// blackout start (change hidden in the dark), 123697 = final_highlight start.
export const STAGES = [
  { name: 'stage1', startMs: 0, theme: 'suburb' },
  { name: 'stage2', startMs: 27251, theme: 'suburbDay' },
  { name: 'stage3', startMs: 53156, theme: 'desert' },
  { name: 'stage4', startMs: 59134, theme: 'underground' },
  { name: 'stage5', startMs: 89822, theme: 'suburb' },
  { name: 'stage6', startMs: 123697, theme: 'night' },
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

// Crossfade state at songMs: the fade runs from the stage's startMs for fadeMs,
// blending the previous stage's theme (`from`) into the current one (`to`) at
// t 0..1; outside a fade from === to and t = 1. fadeMs <= 0 is a hard cut.
export function stageBlend(songMs, fadeMs) {
  const stage = stageAt(songMs);
  const to = stage.theme;
  const index = STAGES.indexOf(stage);
  if (index === 0 || !(fadeMs > 0)) return { from: to, to, t: 1 };
  const elapsed = songMs - stage.startMs;
  if (elapsed >= fadeMs) return { from: to, to, t: 1 };
  return { from: STAGES[index - 1].theme, to, t: elapsed / fadeMs };
}

// Unique themes used by STAGES, for preloading.
export function stageThemeNames() {
  return [...new Set(STAGES.map(s => s.theme))];
}
