// Song sections with per-section effects. Times are PLACEHOLDERS (track TBD),
// beat-aligned to the 700ms beat like waves.js. Gaps between sections = normal play.
export const SECTIONS = [
  { name: 'highlight1', startMs: 22400, endMs: 33600, speedMult: 1.5, disco: false, rotate: false },
  { name: 'dance_break', startMs: 44800, endMs: 56000, speedMult: 1.5, disco: true, rotate: false },
  { name: 'final_highlight', startMs: 67200, endMs: 78400, speedMult: 1.5, disco: true, rotate: true },
];

const NORMAL = { speedMult: 1, disco: false, rotate: false, strobe: 0 };

export function sectionAt(songMs) {
  for (const section of SECTIONS) {
    if (songMs >= section.startMs && songMs < section.endMs) return section;
  }
  return NORMAL;
}
