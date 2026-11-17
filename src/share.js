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

// Which icons the share row shows. Where the system share sheet takes files it
// is the one path for every app, so a single generic icon stands for it; brand
// icons appear only where each does something of its own.
export function sharePlatforms(sheet) {
  return sheet ? ['sheet'] : ['x', 'threads', 'ig'];
}

function pngFile(blob) {
  return new File([blob], 'celebration.png', { type: 'image/png' });
}

// Whether the system share sheet takes a PNG. Also false when an embedding
// iframe (itch.io) withholds the web-share permission. Asked with an empty
// file so the row can be laid out before the screenshot exists.
export function canShareFiles() {
  return !!navigator.canShare?.({ files: [pngFile(new Blob())] });
}

// Text to the system share sheet, with the screenshot when there is one (`blob`
// may be null: tapped before the capture finished). False when the browser
// refused (e.g. the tap's activation expired); the player closing the sheet is
// an answer.
export async function shareSheet(blob, text) {
  try {
    await navigator.share(blob ? { files: [pngFile(blob)], text } : { text });
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
