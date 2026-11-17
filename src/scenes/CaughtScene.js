import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  CAUGHT_IMAGE,
  CAUGHT_IMAGE_MS,
  CAUGHT_SKIP_ARM_MS,
} from '../config/gameConfig.js';
import { HINT_STYLE, textStyle, isDesktop } from '../config/ui.js';
import { addFullscreenButton } from '../objects/FullscreenButton.js';
import { onDismiss } from '../input.js';
import { t } from '../i18n.js';

const TEXT_DEPTH = 5; // over the picture, under the HUD
const OUTLINE = { stroke: '#000000', strokeThickness: 5 }; // readable over the bright picture
const MARGIN = 24;

// Shown after a lost run (GameScene's freeze) and before the GAME OVER screen:
// the chasers' group picture with a welcome line — the player is one of them now.
// Silent (the music stopped on the collision), moves on by itself.
export class CaughtScene extends Phaser.Scene {
  constructor() {
    super('CaughtScene');
  }

  init(data) {
    this.result = { won: false, score: data.score ?? 0, progress: data.progress ?? 0 };
  }

  create() {
    this.finished = false;

    this.add.image(0, 0, CAUGHT_IMAGE.key).setOrigin(0, 0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.2, t('caught.message'), textStyle({
      fontSize: '30px', color: '#ffffff', fontStyle: 'bold', align: 'center', ...OUTLINE,
    })).setOrigin(0.5).setDepth(TEXT_DEPTH);

    this.time.delayedCall(CAUGHT_IMAGE_MS, () => this.finish());

    // Skipping is armed late: keys and fingers still mashing from the run must
    // not skip the picture before it can be seen.
    this.time.delayedCall(CAUGHT_SKIP_ARM_MS, () => {
      const skipHint = t(isDesktop(this) ? 'intro.skipDesktop' : 'intro.skipMobile');
      this.add.text(MARGIN, GAME_HEIGHT - MARGIN, skipHint, textStyle({ ...HINT_STYLE, ...OUTLINE }))
        .setOrigin(0, 1).setDepth(TEXT_DEPTH);

      const skip = () => this.finish();
      onDismiss(this, { keys: { SPACE: skip, ESC: skip }, tap: skip });
    });

    addFullscreenButton(this);
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.scene.start('GameOverScene', this.result);
  }
}
