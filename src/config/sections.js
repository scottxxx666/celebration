import { LIGHTS_OUT_FADE_MS } from './gameConfig.js';

// Song sections with per-section effects. Times are authored in ms (read them
// off the HUD / ?t=) and must sit on a real track beat of public/assets/music.m4a
// (= a game half-beat at the default half-time BPM); `yarn check:beats`
// verifies this, `yarn check:beats --fix` rewrites them, and it also runs
// before `yarn build`. Gaps between sections = normal play. Entries list only
// what differs from NORMAL.
// strobe = flashes per beat (0.25 = per bar, 1 = per beat, 2 = per half-beat; 0/absent = off).
// beatFlash = walk-zone flash on each beat (still waits for BEAT_SYNC_START_MS; colour/alpha follow lights).
// dim = black overlay darkening the world; back-to-back dimmed sections fade as one span.
// lights = DiscoLights beams/pools/lasers + zoom punch + disco-coloured beat flash.
// lightsOut = { lit, dark } in beats, cycling from the section start: lit for `lit` beats, then
//   fully black for `dark` beats, hiding all gameplay ({ lit: 1, dark: 1 } = 1 beat each; null/absent = off).
//   Optional `bursts` + `gap` blink the lit part: `bursts` lit blinks of `lit` beats with `gap` beats of
//   black between them, then `dark` ({ lit: 0.125, gap: 0.125, bursts: 3, dark: 1.375 } = 3 blinks per 2 beats).
//   Optional `strobe: true` fires a white strobe flash each time the lights come on (including the section start).
//   Optional `reveal` keeps something readable through the dark: 'shadows' = drop shadows glow on
//   pure black; 'silhouettes' = sprites turn solid black on a near-black backdrop. Without it,
//   author this section's obstacles to arrive while lit or right as the dark begins.
// ...DISCO = preset for dim + lights together.
const NORMAL = { speedMult: 1, dim: false, lights: false, rotate: false, strobe: 0, beatFlash: false, lightsOut: null };
const DISCO = { dim: true, lights: true };

export const SECTIONS = [
  { name: 'highlight1', startMs: 14498, endMs: 26454, speedMult: 1, beatFlash: true },
  { name: 'highlight2', startMs: 65909, endMs: 78663, speedMult: 1, ...DISCO },
  { name: 'ready', startMs: 84641, endMs: 89822, speedMult: 1, strobe: 2 },
  { name: 'blackout', startMs: 89822, endMs: 91017, speedMult: 1.5, lightsOut: { lit:0, dark: 1, reveal: 'silhouettes' }, dim: true },
  { name: 'blackout2', startMs: 91017, endMs: 91814, speedMult: 1.5, lightsOut: { lit:0, dark: 1 }, dim: true },
  { name: 'dance_break', startMs: 91814, endMs: 96198, speedMult: 1.5, lightsOut: { lit: 0.125, gap: 0.125, bursts: 2, dark: 0.625, strobe: true }, dim: true },
  { name: 'dance_break2', startMs: 96198, endMs: 96995, speedMult: 1.5, lightsOut: { lit: 0.125, gap: 0.125, bursts: 3, dark: 1.375, strobe: true }, dim: true },
  { name: 'dance_break3', startMs: 96995, endMs: 98191, speedMult: 1.5, lightsOut: { lit: 0.125, gap: 0.125, bursts: 1, dark: 1.375, strobe: true }, dim: true },
  { name: 'blackout', startMs: 98191, endMs: 98589, speedMult: 1.5 },
  { name: 'final_highlight', startMs: 123299, endMs: 136052, speedMult: 1, ...DISCO, rotate: true },
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

// Where a lightsOut cycle stands `sinceStartMs` after its section began. The
// cycle: lightsOut.bursts lit blinks of lightsOut.lit beats, lightsOut.gap
// beats of black between them, then black for lightsOut.dark beats. Each blink
// fades to black over its last `fadeMs` (capped at the blink length), so full
// black lands on the grid point where the lit part ends; the lights snap back
// on. Returns the overlay `alpha`, the `reveal` in effect (from the fade's
// start through the dark, else null) and `litMs` — ms since the lights came
// on, or null once the lit part is over. Pure and stateless
export function lightsOutAt(lightsOut, sinceStartMs, beatMs, fadeMs = LIGHTS_OUT_FADE_MS) {
  const { lit, dark, gap = 0, bursts = 1 } = lightsOut;
  const blinkMs = lit * beatMs;
  const burstMs = (lit + gap) * beatMs; // one blink + the gap after it
  const burstsMs = bursts * burstMs - gap * beatMs; // the last blink has no gap, the long dark follows
  const phaseMs = sinceStartMs % (burstsMs + dark * beatMs);
  // ms since the current (or last) blink began: lit while < blinkMs, black after
  const sinceLitMs = phaseMs < burstsMs ? phaseMs % burstMs : phaseMs - burstsMs + blinkMs;
  const litMs = sinceLitMs < blinkMs ? sinceLitMs : null;
  const fade = Math.min(fadeMs, blinkMs);
  const intoFadeMs = sinceLitMs - (blinkMs - fade);
  if (intoFadeMs < 0) return { alpha: 0, reveal: null, litMs };
  // lit: 0 (dark throughout) and a zero fade both land here with nothing to
  // ramp — full black, no dip at the cycle wrap
  const alpha = intoFadeMs >= fade ? 1 : intoFadeMs / fade;
  return { alpha, reveal: lightsOut.reveal ?? null, litMs };
}

export function sectionAt(songMs) {
  for (const section of SECTIONS) {
    if (songMs >= section.startMs && songMs < section.endMs) return section;
  }
  return NORMAL;
}
