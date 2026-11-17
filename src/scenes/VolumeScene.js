import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { TITLE_STYLE, CAPTION_STYLE, HINT_STYLE, textStyle, isDesktop } from '../config/ui.js';
import { addFullscreenButton } from '../objects/FullscreenButton.js';
import { addVolumeSlider } from '../objects/VolumeSlider.js';
import { onDismiss, onDirectionKey } from '../input.js';
import { t } from '../i18n.js';

const SLIDER_SCALE = 3;
const SLIDER_Y = 200;

export class VolumeScene extends Phaser.Scene {
  constructor() {
    super('VolumeScene');
  }

  // Gate between HowToPlayScene and the intro video: lets the player set the
  // volume before any audio plays. The cue sound goes through the sound manager,
  // so it is exactly as loud as the music will be.
  create() {
    const cx = GAME_WIDTH / 2;
    const desktop = isDesktop(this);

    this.add.text(cx, 40, t('volume.title'), textStyle({ ...TITLE_STYLE, fontSize: '28px' })).setOrigin(0.5);
    this.add.text(cx, 100, t('volume.sound'), textStyle({ ...CAPTION_STYLE, align: 'center' })).setOrigin(0.5);

    const slider = addVolumeSlider(this, undefined, {
      y: SLIDER_Y,
      scale: SLIDER_SCALE,
      centerX: cx,
      bright: true,
      onCommit: () => this.sound.play('cue'),
    });

    this.add.text(cx, 290, t('volume.advice'), textStyle({ ...CAPTION_STYLE, align: 'center' })).setOrigin(0.5);
    this.add.text(cx, 345, t(desktop ? 'volume.hint.desktop' : 'volume.hint.mobile'), textStyle(HINT_STYLE)).setOrigin(0.5);
    this.add.text(cx, GAME_HEIGHT - 30, t(desktop ? 'continue.desktop' : 'continue.mobile'), textStyle(HINT_STYLE)).setOrigin(0.5);

    if (desktop) {
      // Each fresh press steps once and plays the cue; a held key must not machine-gun it
      const nudge = (dir) => (event) => { if (!event.repeat) slider.nudge(dir); };
      onDirectionKey(this, 'left', nudge(-1));
      onDirectionKey(this, 'right', nudge(1));
    }

    const leave = () => this.scene.start('IntroScene');
    onDismiss(this, { keys: { ESC: leave, ENTER: leave, SPACE: leave }, tap: leave });

    addFullscreenButton(this);
  }
}
