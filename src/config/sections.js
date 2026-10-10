// Song sections with per-section effects. Times are authored in ms (read them
// off the HUD / ?t=) and must sit on a real track beat of public/assets/music.m4a
// (= a game beat at the default true-tempo BPM); `yarn check:beats`
// verifies this, `yarn check:beats --fix` rewrites them, and it also runs
// before `yarn build`. Gaps between sections = normal play. Entries list only
// what differs from NORMAL.
// strobe = flashes per beat (0.25 = per bar, 1 = per beat, 2 = per half-beat; 0/absent = off).
//   Or a list of [beats, rate] steps from the section start for a build: [[4, 1], [4, 2]] = 4 beats at 1/beat, then 2/beat (the last step holds to the section end).
// strobeRamp = strobe peak at the section start as a fraction of STROBE_ALPHA, rising linearly to full at the section end (1/absent = no ramp).
// beatFlash = walk-zone flash on each beat (still waits for BEAT_SYNC_START_MS; colour/alpha follow lights).
// dim = black overlay darkening the world; back-to-back dimmed sections fade as one span.
// lights = DiscoLights beams/pools/lasers + zoom punch + disco-coloured beat flash.
// lightsOut = { lit, dark } in beats, cycling from the section start: lit for `lit` beats, then
//   fully black for `dark` beats, hiding all gameplay ({ lit: 1, dark: 1 } = 1 beat each; null/absent = off).
//   Optional `bursts` + `gap` blink the lit part: `bursts` lit blinks of `lit` beats with `gap` beats of
//   black between them, then `dark` ({ lit: 0.25, gap: 0.25, bursts: 3, dark: 2.75 } = 3 blinks per 4 beats).
//   Optional `strobe: true` fires a white strobe flash each time the lights come on (including the section start).
//   Optional `reveal` keeps something readable through the dark: 'shadows' = drop shadows glow on
//   pure black; 'silhouettes' = sprites turn solid black on a near-black backdrop. Without it,
//   author this section's obstacles to arrive while lit or right as the dark begins.
// ghost = "double vision": extra translucent copies of the whole world (not the HUD) sway around the beat,
//   fading in/out over GHOST_FADE_MS at the section edges. Don't combine with lightsOut (the copies show through the black).
// trails = afterimages: player, chaser and obstacles leave short fading coloured copies of themselves
//   (TRAIL_* in gameConfig). Independent of ghost; like it, not meant for lightsOut sections.
// ...DISCO = preset for dim + lights together.
const NORMAL = { speedMult: 1, dim: false, lights: false, rotate: false, strobe: 0, strobeRamp: 1, beatFlash: false, lightsOut: null, ghost: false, trails: false };
const DISCO = { dim: true, lights: true };

export const SECTIONS = [
  { name: 'highlight1', startMs: 14498, endMs: 26055, speedMult: 1, beatFlash: true },
  // { name: 'chorus1b', startMs: 27650, endMs: 53156, speedMult: 1, beatFlash: true },
  // { name: 'build2', startMs: 62721, endMs: 65909, speedMult: 1, strobe: [[4, 1], [2, 2], [2, 4]], strobeRamp: 0.25 },
  { name: 'highlight2', startMs: 65909, endMs: 78663, speedMult: 1, ...DISCO },
  { name: 'ready', startMs: 84641, endMs: 89822, speedMult: 1, strobe: [[6, 1], [3, 2], [3, 4], [1, 8]], strobeRamp: 0.25 },
  { name: 'blackout', startMs: 89822, endMs: 91017, speedMult: 1.5, lightsOut: { lit:0, dark: 2, reveal: 'silhouettes' }, dim: true },
  { name: 'blackout2', startMs: 91017, endMs: 91814, speedMult: 1.5, lightsOut: { lit:0, dark: 2 }, dim: true },
  { name: 'dance_break', startMs: 91814, endMs: 96198, speedMult: 1.5, lightsOut: { lit: 0.25, gap: 0.25, bursts: 2, dark: 1.25, strobe: true }, dim: true },
  { name: 'dance_break2', startMs: 96198, endMs: 96995, speedMult: 1.5, lightsOut: { lit: 0.25, gap: 0.25, bursts: 3, dark: 2.75, strobe: true }, dim: true },
  { name: 'dance_break3', startMs: 96995, endMs: 98191, speedMult: 1.5, lightsOut: { lit: 0.25, gap: 0.25, bursts: 1, dark: 2.75, strobe: true }, dim: true },
  { name: 'blackout', startMs: 98191, endMs: 98589, speedMult: 1.5 },
  { name: 'final_highlight', startMs: 123697, endMs: 136451, speedMult: 1.5, ...DISCO, rotate: true },
].map(section => ({ ...NORMAL, ...section }));

// SECTIONS is in time order: one forward and one backward pass give every dimmed
// section the bounds of its contiguous dimmed run (the dim fades across that span).
SECTIONS.forEach((section, i) => {
  if (!section.dim) return;
  const prev = SECTIONS[i - 1];
  section.dimStartMs = prev?.dim && prev.endMs === section.startMs ? prev.dimStartMs : section.startMs;
});
for (let i = SECTIONS.length - 1; i >= 0; i--) {
  const section = SECTIONS[i];
  if (!section.dim) continue;
  const next = SECTIONS[i + 1];
  section.dimEndMs = next?.dim && section.endMs === next.startMs ? next.dimEndMs : section.endMs;
}

export function sectionAt(songMs) {
  for (const section of SECTIONS) {
    if (songMs >= section.startMs && songMs < section.endMs) return section;
  }
  return NORMAL;
}

// Strobe peak multiplier at songMs: section.strobeRamp at the section start, rising linearly to 1 at its end.
export function strobeScale(section, songMs) {
  const { strobeRamp = 1, startMs, endMs } = section;
  if (strobeRamp === 1) return 1;
  const progress = Math.min(1, Math.max(0, (songMs - startMs) / (endMs - startMs)));
  return strobeRamp + (1 - strobeRamp) * progress;
}

// Strobe flashes per beat at songMs: section.strobe itself, or, when it is a list of
// [beats, rate] steps, the rate of the step songMs falls in (the last step holds).
export function strobeRate(section, songMs, beatMs) {
  const { strobe, startMs } = section;
  if (!Array.isArray(strobe)) return strobe;
  let beats = (songMs - startMs) / beatMs;
  for (const [length, rate] of strobe) {
    if (beats < length) return rate;
    beats -= length;
  }
  return strobe[strobe.length - 1][1];
}

// Camera turns away from upright at songMs for a `rotate` section: one full turn forward,
// then the same turn played back in reverse, repeating (a ping-pong, so the spin is stateless
// and returns to upright every two turns).
export function rotateTurns(section, songMs, turnMs) {
  const lap = ((songMs - section.startMs) / turnMs) % 2;
  return lap <= 1 ? lap : 2 - lap;
}
