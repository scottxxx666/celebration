import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { TITLE_STYLE, CAPTION_STYLE, HINT_STYLE, textStyle, isDesktop } from '../config/ui.js';
import { addFullscreenButton } from '../objects/FullscreenButton.js';
import { onDismiss } from '../input.js';
import { t } from '../i18n.js';

const WARNING_COLOR = '#ffcc44';

// Photosensitivity warning: the game strobes, flashes and spins the camera.
// Shown on every page load, after the language is known and before the menu;
// deliberately not remembered, since the next person at this device has not
// seen it. Any key or a fresh tap continues (onDismiss: the input that picked
// the language must not also dismiss the warning unread).
export class WarningScene extends Phaser.Scene {
  constructor() {
    super('WarningScene');
  }

  create() {
    const cx = GAME_WIDTH / 2;

    this.add.text(cx, 100, t('warning.title'), textStyle({ ...TITLE_STYLE, fontSize: '30px', color: WARNING_COLOR }))
      .setOrigin(0.5);

    this.add.text(cx, 235, t('warning.body'), textStyle({
      ...CAPTION_STYLE,
      color: '#dddddd',
      align: 'center',
      lineSpacing: 8,
    })).setOrigin(0.5);

    const hint = t(isDesktop(this) ? 'continue.desktop' : 'continue.mobile');
    this.add.text(cx, GAME_HEIGHT - 30, hint, textStyle(HINT_STYLE)).setOrigin(0.5);

    const leave = () => this.scene.start('MenuScene');
    onDismiss(this, { keys: { SPACE: leave, ENTER: leave, ESC: leave }, tap: leave });

    addFullscreenButton(this);
  }
}
