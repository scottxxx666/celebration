const STORAGE_KEY = 'celebration.seenHowToPlay';

// Whether the player has ever been shown the controls. Drives the one-time
// HowToPlayScene gate between IntroScene and GameScene. Same shape as
// userVolume.js: a module cache backed by localStorage, defensive against
// storage being unavailable (Safari private mode). The cache is what makes the
// write failure harmless — the gate still won't re-fire within the session.
let seen = null;

export function hasSeenHowToPlay() {
  if (seen !== null) return seen;
  try {
    seen = localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    seen = false;
  }
  return seen;
}

export function markHowToPlaySeen() {
  seen = true;
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Safari private mode etc. — the session cache still suppresses the gate
  }
}
