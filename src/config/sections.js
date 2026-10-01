// Song sections with per-section effects. Times are authored in ms (read them
// off the HUD / ?t=) and must sit on a real track beat of public/assets/music.m4a
// (= a game half-beat at the default half-time BPM); `yarn check:beats`
// verifies this, `yarn check:beats --fix` rewrites them, and it also runs
// before `yarn build`. Gaps between sections = normal play. Entries list only
// what differs from NORMAL.
// strobe = flashes per beat (0.25 = per bar, 1 = per beat, 2 = per half-beat; 0/absent = off).
// beatFlash = walk-zone flash on each beat (still waits for BEAT_SYNC_START_MS; colour/alpha follow disco).
const NORMAL = { speedMult: 1, disco: false, rotate: false, strobe: 0, beatFlash: false };

export const SECTIONS = [
  { name: 'highlight1', startMs: 14498, endMs: 26454, speedMult: 1, beatFlash: true },
  // { name: 'highlight1', startMs: 27650, endMs: 53156, speedMult: 1, beatFlash: true },
  { name: 'highlight2', startMs: 65909, endMs: 78663, speedMult: 1, disco: true },
  { name: 'dance_break', startMs: 89822, endMs: 98589, speedMult: 1.5, disco: true },
  { name: 'final_highlight', startMs: 123299, endMs: 136052, speedMult: 1, disco: true, rotate: true },
].map(section => ({ ...NORMAL, ...section }));

export function sectionAt(songMs) {
  for (const section of SECTIONS) {
    if (songMs >= section.startMs && songMs < section.endMs) return section;
  }
  return NORMAL;
}
