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

// Instagram has no web share URL: hand the PNG to the system share sheet where
// files can be shared (phones), else save it for the player to post by hand.
// Resolves to 'shared' | 'saved'.
export async function shareImage(blob, text, { preferSheet }) {
  const file = new File([blob], 'celebration.png', { type: 'image/png' });
  if (preferSheet && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (err) {
      // The player closing the sheet is an answer; any other refusal (e.g. the
      // tap's activation expired) falls through to the download.
      if (err?.name === 'AbortError') return 'shared';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'celebration.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'saved';
}

// Screenshot of the current frame as a PNG Blob (null on failure).
export function captureCanvas(game) {
  return new Promise((resolve) => {
    game.renderer.snapshot((image) => {
      fetch(image.src).then((r) => r.blob()).then(resolve, () => resolve(null));
    });
  });
}
