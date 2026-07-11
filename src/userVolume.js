import { DEFAULT_VOLUME } from './config/gameConfig.js';

const STORAGE_KEY = 'celebration.volume';

// Persisted user volume (0-1), read once at boot and written on slider drag end.
// A saved value wins; DEFAULT_VOLUME is only the fallback. Defensive against
// garbage/missing localStorage (bad JSON, Safari private mode).
export function loadUserVolume() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const value = parseFloat(raw);
    if (!Number.isFinite(value)) return DEFAULT_VOLUME;
    return Math.min(1, Math.max(0, value));
  } catch {
    return DEFAULT_VOLUME;
  }
}

export function saveUserVolume(value) {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Safari private mode etc. — nothing to do, next load just falls back to default
  }
}
