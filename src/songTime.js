// Song-time string contract, `m:ss.mmm`: formatSongTime() writes it on the
// debug HUD (section/wave boundaries get read off it) and the `?t=` deep-link
// below reads it back (also accepting plain seconds).

export function formatSongTime(ms) {
  const total = Math.max(0, ms || 0);
  const min = Math.floor(total / 60000);
  const sec = Math.floor((total % 60000) / 1000);
  const msec = Math.floor(total % 1000);
  return `${min}:${String(sec).padStart(2, '0')}.${String(msec).padStart(3, '0')}`;
}

// Dev/testing deep-link: `?t=` starts a run at an arbitrary song time. Accepts
// plain seconds (`65`, `65.5`) or `m:ss`/`m:ss.mmm` (`1:05`, `1:05.500`). The
// URL never changes at runtime, so this is computed once and cached, same
// shape as userVolume.js.
let cached = null;

function parse(raw) {
  if (!raw) return 0;
  const colonMatch = raw.match(/^(\d+):(\d+(?:\.\d+)?)$/);
  if (colonMatch) {
    const min = parseFloat(colonMatch[1]);
    const sec = parseFloat(colonMatch[2]);
    const totalSec = min * 60 + sec;
    return Number.isFinite(totalSec) && totalSec >= 0 ? totalSec * 1000 : 0;
  }
  const sec = parseFloat(raw);
  return Number.isFinite(sec) && sec >= 0 ? sec * 1000 : 0;
}

export function getStartMs() {
  if (cached !== null) return cached;
  try {
    const params = new URLSearchParams(window.location.search);
    cached = parse(params.get('t'));
  } catch {
    cached = 0;
  }
  return cached;
}
