import { translate, getLanguage } from './i18n.js';
import { SHARE_URL } from './config/gameConfig.js';

// Message for a finished run, in `lang`, with the game link on its own line.
// `difficulty` is the difficulty id; its label comes from the string table.
export function shareText({ won, score, pct, difficulty }, lang = getLanguage()) {
  const label = translate(lang, `difficulty.${difficulty}`);
  const message = translate(lang, won ? 'share.text.won' : 'share.text.lost', { score, pct, difficulty: label });
  return `${message}\n${SHARE_URL}`;
}

// Both intents honour only `text` reliably, so the link rides inside it rather
// than in a separate url= param.
const INTENTS = {
  x: 'https://twitter.com/intent/tweet?text=',
  threads: 'https://www.threads.com/intent/post?text=',
};

export function shareLink(platform, text) {
  const base = INTENTS[platform];
  if (!base) throw new Error(`Unknown share platform: ${platform}`);
  return base + encodeURIComponent(text);
}

// Browser-only below: window/navigator/document are touched when called, never at import.

// Call straight from the pointerup handler so the new tab counts as a user gesture.
export function openShare(platform, text) {
  window.open(shareLink(platform, text), '_blank', 'noopener');
}

// The PNG as a File the system share sheet will take, or null where files can't
// be shared. canShare is also false when an embedding iframe (itch.io) withholds
// the web-share permission, so the caller can still fall back inside the tap.
export function sheetFile(blob) {
  const file = new File([blob], 'celebration.png', { type: 'image/png' });
  return navigator.canShare?.({ files: [file] }) ? file : null;
}

// Screenshot + text to the system share sheet. False when the browser refused
// (e.g. the tap's activation expired); the player closing the sheet is an answer.
export async function shareSheet(file, text) {
  try {
    await navigator.share({ files: [file], text });
    return true;
  } catch (err) {
    return err?.name === 'AbortError';
  }
}

export function saveImage(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'celebration.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Screenshot of the current frame as a PNG Blob (null on failure).
export function captureCanvas(game) {
  return new Promise((resolve) => {
    game.renderer.snapshot((image) => {
      fetch(image.src).then((r) => r.blob()).then(resolve, () => resolve(null));
    });
  });
}
