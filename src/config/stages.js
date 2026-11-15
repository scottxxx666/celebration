import { DISCO_DIM_FADE_MS, STAGE_DIM_ALPHA, TRACK_BEAT_MS } from './gameConfig.js';

// Song-time scenery stages: the road+background pair changes to `theme`
// (a SCENERY_THEMES key) at each startMs, by the stage's `transition`:
//   'fade' (default) crossfades over the fade length (see stageBlend);
//   'cut' hard-swaps at startMs;
//   'dim' hard-swaps at startMs too, hidden by a black dim (see stageDim): the previous theme dims over the
//     `dimInBeats` (default 3) track beats before startMs, then the dim clears over `dimOutBeats` (default 0 = snaps off)
//     after it; `dimAlpha` is the peak overlay alpha (default STAGE_DIM_ALPHA).
// Arrival-sorted, first starts at 0. Stage 6 is a placeholder reusing an existing theme until its art exists.
// Times must sit on a real track beat (yarn check:beats): 27251 = 3 beats
// after highlight1b ends (26055), 53156 = the beat nearest 53 s, 59134 = the beat nearest 59 s =
// WALL_BREAK_MS (the runner smashes through the wall at the end of desert; its white flash covers the cut),
// 63518 = concert, entered from a 3-beat dark run-in,
// 89822 = blackout start (change hidden in the dark), 123697 = final_highlight start.
export const STAGES = [
  { name: 'stage1', startMs: 0, theme: 'suburb' },
  { name: 'stage2', startMs: 27251, theme: 'suburbDay' },
  { name: 'stage3', startMs: 53156, theme: 'desert' },
  { name: 'stage4', startMs: 59134, theme: 'underground', transition: 'cut' },
  { name: 'stage5', startMs: 63518, theme: 'concert', transition: 'dim', dimInBeats: 3, dimOutBeats: 2 },
  // { name: 'stage5', startMs: 65511, theme: 'night' },
  { name: 'stage6', startMs: 89822, theme: 'night' },
  // { name: 'stage7', startMs: 123697, theme: 'night' },
];

// Last stage whose startMs <= songMs; negative songMs (latency at run start) is stage 1.
export function stageAt(songMs, stages = STAGES) {
  let current = stages[0];
  for (const stage of stages) {
    if (stage.startMs <= songMs) current = stage;
    else break;
  }
  return current;
}

// Crossfade state at songMs: the fade runs from the stage's startMs for fadeMs,
// blending the previous stage's theme (`from`) into the current one (`to`) at
// t 0..1; outside a fade from === to and t = 1. fadeMs <= 0, or a stage with
// transition 'cut' or 'dim', is a hard cut.
export function stageBlend(songMs, fadeMs, stages = STAGES) {
  const stage = stageAt(songMs, stages);
  const to = stage.theme;
  const index = stages.indexOf(stage);
  if (index === 0 || stage.transition === 'cut' || stage.transition === 'dim' || !(fadeMs > 0)) return { from: to, to, t: 1 };
  const elapsed = songMs - stage.startMs;
  if (elapsed >= fadeMs) return { from: to, to, t: 1 };
  return { from: stages[index - 1].theme, to, t: elapsed / fadeMs };
}

// Dim of a 'dim' stage at songMs: { level 0..1, alpha } (overlay alpha = level * alpha). Ramps in linearly over
// min(DISCO_DIM_FADE_MS, run-in) at the start of the run-in (the `dimInBeats` track beats before startMs), holds full
// until startMs, then fades out linearly over `dimOutBeats` track beats (0 = gone at startMs). Stateless; { level: 0 }
// outside every run-in / dim-out window.
export function stageDim(songMs, stages = STAGES) {
  for (const stage of stages) {
    if (stage.transition !== 'dim') continue;
    const alpha = stage.dimAlpha ?? STAGE_DIM_ALPHA;
    const inMs = (stage.dimInBeats ?? 3) * TRACK_BEAT_MS;
    const outMs = (stage.dimOutBeats ?? 0) * TRACK_BEAT_MS;
    const sinceStart = songMs - stage.startMs;
    if (sinceStart < 0 && sinceStart >= -inMs) {
      const level = (songMs - (stage.startMs - inMs)) / Math.min(DISCO_DIM_FADE_MS, inMs);
      return { level: Math.min(1, Math.max(0, level)), alpha };
    }
    if (sinceStart >= 0 && sinceStart < outMs) return { level: 1 - sinceStart / outMs, alpha };
  }
  return { level: 0, alpha: 0 };
}

// Unique themes used by STAGES, for preloading.
export function stageThemeNames() {
  return [...new Set(STAGES.map(s => s.theme))];
}
