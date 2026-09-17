// Song sections with per-section effects. Times are real-beat boundaries of
// public/assets/music.m4a (real beat n = 549 + n*398.54 ms; section table in
// tools/gen-waves.py). Gaps between sections = normal play.
// strobe = flashes per beat (0.25 = per bar, 1 = per beat, 2 = per half-beat; 0/absent = off).
export const SECTIONS = [
  { name: 'highlight1', startMs: 27650, endMs: 53156, speedMult: 1.5, disco: false, rotate: false },
  // { name: 'dance_break', startMs: 65909, endMs: 78663, speedMult: 1.5, disco: true, rotate: false },
  // { name: 'final_highlight', startMs: 123299, endMs: 136052, speedMult: 1.5, disco: true, rotate: true },
];

const NORMAL = { speedMult: 1, disco: false, rotate: false, strobe: 0 };

export function sectionAt(songMs) {
  for (const section of SECTIONS) {
    if (songMs >= section.startMs && songMs < section.endMs) return section;
  }
  return NORMAL;
}
