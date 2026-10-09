import { GAME_HEIGHT } from './config/gameConfig.js';

export const MENU_ROW_SPACING = 45;
export const MENU_CAPTION_OFFSET = 30; // difficulty caption's y below its row
export const MENU_CAPTION_GAP = 24; // extra space below the difficulty row for its caption
export const MENU_TOUCH_WIDTH = 320;

// Row i's label y and its mobile touch zone (centre y + height). A zone is one
// row spacing tall around its label, so neighbours tile without overlapping; the
// difficulty row's zone also covers the caption below it.
export function menuRowLayout(i, difficultyRow) {
  const y = GAME_HEIGHT / 2 + i * MENU_ROW_SPACING + (i > difficultyRow ? MENU_CAPTION_GAP : 0);
  const extra = i === difficultyRow ? MENU_CAPTION_GAP : 0;
  return { y, zoneY: y + extra / 2, zoneHeight: MENU_ROW_SPACING + extra };
}
