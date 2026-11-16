import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, ENDING_CONTINUED_DELAY_MS } from '../config/gameConfig.js';
import { HINT_STYLE, textStyle, isDesktop } from '../config/ui.js';
import { addFullscreenButton } from '../objects/FullscreenButton.js';
import { addVolumeSlider } from '../objects/VolumeSlider.js';
import { getUserVolume } from '../userVolume.js';
import { onDismiss } from '../input.js';
import { t } from '../i18n.js';

const TEXT_DEPTH = 5; // over the video, under the HUD
const OUTLINE = { stroke: '#000000', strokeThickness: 5 }; // readable over any video frame
const MARGIN = 24;

// Ending cutscene, shown after a won run (GameScene's run-out) and before the
// CLEAR! screen. Same in-canvas video setup as IntroScene — see the comments
// there for the scale-from-texture and volume quirks.
export class EndingScene extends Phaser.Scene {
  constructor() {
    super('EndingScene');
  }

  init(data) {
    this.result = { won: true, score: data.score ?? 0, progress: data.progress ?? 1 };
  }

  create() {
    this.finished = false;

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000);

    const video = this.add.video(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ending');
    video.once(Phaser.GameObjects.Events.VIDEO_TEXTURE, (_vid, texture) => {
      const frame = texture.get();
      video.setScale(GAME_WIDTH / frame.realWidth, GAME_HEIGHT / frame.realHeight);
    });
    video.once(Phaser.GameObjects.Events.VIDEO_COMPLETE, () => this.finish());
    video.play();

    const applyVideoVolume = (_mgr, v) => video.setVolume(v);
    applyVideoVolume(this.sound, getUserVolume());
    this.sound.on(Phaser.Sound.Events.GLOBAL_VOLUME, applyVideoVolume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.sound.off(Phaser.Sound.Events.GLOBAL_VOLUME, applyVideoVolume);
    });

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, t('ending.message'), textStyle({
      fontSize: '30px', color: '#ffffff', fontStyle: 'bold', align: 'center', ...OUTLINE,
    })).setOrigin(0.5).setDepth(TEXT_DEPTH);

    // The message stands alone first. Skipping is armed only together with the
    // second line: the player is still mashing run taps when the run is won,
    // and those must not skip the ending before it can be read.
    this.time.delayedCall(ENDING_CONTINUED_DELAY_MS, () => {
      this.add.text(GAME_WIDTH - MARGIN, GAME_HEIGHT - MARGIN, t('ending.toBeContinued'), textStyle({
        fontSize: '22px', color: '#ffffff', fontStyle: 'italic', ...OUTLINE,
      })).setOrigin(1, 1).setDepth(TEXT_DEPTH);

      const skipHint = t(isDesktop(this) ? 'intro.skipDesktop' : 'intro.skipMobile');
      this.add.text(MARGIN, GAME_HEIGHT - MARGIN, skipHint, textStyle(HINT_STYLE))
        .setOrigin(0, 1).setDepth(TEXT_DEPTH);

      const skip = () => this.finish();
      onDismiss(this, { keys: { SPACE: skip, ESC: skip }, tap: skip });
    });

    // Fullscreen button first: it returns where the slider's right edge goes.
    addVolumeSlider(this, addFullscreenButton(this));
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.scene.start('GameOverScene', this.result);
  }
}
