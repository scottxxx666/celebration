// Dev/testing deep-link: `?t=` starts a run at an arbitrary song time. Accepts
// plain seconds (`65`, `65.5`) or `m:ss`/`m:ss.mmm` (`1:05`, `1:05.500`). The
// URL never changes at runtime, so this is computed once at module load and
// cached, same shape as userVolume.js / seenHowToPlay.js.
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
