const STORAGE_KEY = 'celebration.difficulty';

export const DIFFICULTIES = {
  easy: { label: 'Easy', caption: 'Auto-run — just dodge' },
  normal: { label: 'Normal', caption: 'Tap to run and dodge' },
  hard: { label: 'Hard', caption: 'More obstacles' },
};
const IDS = Object.keys(DIFFICULTIES);

export const DEFAULT_DIFFICULTY = 'normal';

export function parseDifficulty(raw) {
  return IDS.includes(raw) ? raw : DEFAULT_DIFFICULTY;
}

// Next (dir 1) or previous (dir -1) difficulty, wrapping at both ends.
export function stepDifficulty(id, dir) {
  return IDS[(IDS.indexOf(id) + dir + IDS.length) % IDS.length];
}

// Chosen difficulty, lazy-loaded into a module cache that is the read source of
// truth (same shape as userVolume.js), so a failing localStorage (Safari private
// mode) still holds the choice for the session.
let current = null;

export function getDifficulty() {
  if (current !== null) return current;
  try {
    current = parseDifficulty(localStorage.getItem(STORAGE_KEY));
  } catch {
    current = DEFAULT_DIFFICULTY;
  }
  return current;
}

export function setDifficulty(id) {
  current = parseDifficulty(id);
  try {
    localStorage.setItem(STORAGE_KEY, current);
  } catch {
    // Safari private mode etc. — the session cache still holds the choice
  }
}
