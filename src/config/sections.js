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
// lightsOut = { lit, dark } in beats, cycling from the section start: fully black for `dark` beats
//   (hiding all gameplay), then lit for `lit` beats ({ lit: 1, dark: 1 } = 1 beat each; null/absent = off).
//   Add `shadows: true` to keep the drop shadows glowing through the dark (rows/distances stay
//   readable); without it, author this section's obstacles to arrive while lit or right as the dark begins — never in the opening dark.
// ...DISCO = preset for dim + lights together.
const NORMAL = { speedMult: 1, dim: false, lights: false, rotate: false, strobe: 0, beatFlash: false, lightsOut: null };
const DISCO = { dim: true, lights: true };

export const SECTIONS = [
  { name: 'highlight1', startMs: 14498, endMs: 26454, speedMult: 1, beatFlash: true },
  { name: 'highlight2', startMs: 65909, endMs: 78663, speedMult: 1, ...DISCO },
  { name: 'ready', startMs: 84641, endMs: 89822, speedMult: 1, strobe: 2 },
  { name: 'blackout', startMs: 89822, endMs: 91814, speedMult: 1.5, dim: true },
  { name: 'dance_break', startMs: 91814, endMs: 98589, speedMult: 1.5, lightsOut: { lit: 0.33, dark: 0.67, shadows: true }, dim: true },
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

export function sectionAt(songMs) {
  for (const section of SECTIONS) {
    if (songMs >= section.startMs && songMs < section.endMs) return section;
  }
  return NORMAL;
}
