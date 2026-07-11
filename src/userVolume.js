import { DEFAULT_VOLUME } from './config/gameConfig.js';

const STORAGE_KEY = 'celebration.volume';

// Persisted user volume (0-1), lazy-loaded into a module cache that is the read
// source of truth: reading the sound manager back (scene.sound.volume) is
// unreliable while the audio context is locked — WebAudio's gain.setValueAtTime
// isn't reflected by gain.value until the context resumes. Writers set the
// manager AND the cache; readers use the cache. A saved value wins over
// DEFAULT_VOLUME. Defensive against garbage/missing localStorage (bad JSON,
// Safari private mode).
let current = null;

export function getUserVolume() {
  if (current !== null) return current;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const value = parseFloat(raw);
    current = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : DEFAULT_VOLUME;
  } catch {
    current = DEFAULT_VOLUME;
  }
  return current;
}

export function setUserVolume(value) {
  current = Math.min(1, Math.max(0, value));
}

export function saveUserVolume() {
  try {
    localStorage.setItem(STORAGE_KEY, String(current));
  } catch {
    // Safari private mode etc. — nothing to do, next load just falls back to default
  }
}
