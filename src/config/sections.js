// Song sections with per-section effects. Times are real-beat boundaries of
// public/assets/music.m4a (real beat n = 549 + n*398.54 ms; section table in
// tools/gen-waves.py). Gaps between sections = normal play. Entries list only
// what differs from NORMAL.
// strobe = flashes per beat (0.25 = per bar, 1 = per beat, 2 = per half-beat; 0/absent = off).
// beatFlash = walk-zone flash on each beat (still waits for BEAT_SYNC_START_MS; colour/alpha follow disco).
const NORMAL = { speedMult: 1, disco: false, rotate: false, strobe: 0, beatFlash: false };

export const SECTIONS = [
  { name: 'highlight1', startMs: 14500, endMs: 26456, speedMult: 1, beatFlash: true },
  // { name: 'highlight1', startMs: 27650, endMs: 53156, speedMult: 1, beatFlash: true },
  { name: 'highlight2', startMs: 65909, endMs: 78663, speedMult: 1, disco: true },
  { name: 'dance_break', startMs: 90000, endMs: 98663, speedMult: 1.5, disco: true },
  { name: 'final_highlight', startMs: 123299, endMs: 136052, speedMult: 1, disco: true, rotate: true },
].map(section => ({ ...NORMAL, ...section }));

export function sectionAt(songMs) {
  for (const section of SECTIONS) {
    if (songMs >= section.startMs && songMs < section.endMs) return section;
  }
  return NORMAL;
}
