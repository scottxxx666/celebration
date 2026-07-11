import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { addFullscreenButton } from '../objects/FullscreenButton.js';
import { addVolumeSlider } from '../objects/VolumeSlider.js';

export class IntroScene extends Phaser.Scene {
  constructor() {
    super('IntroScene');
  }

  create() {
    this.started = false;

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000);

    const video = this.add.video(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'intro');
    // Fill the canvas. The object starts as a 256x256 placeholder, and
    // VIDEO_TEXTURE fires *before* Phaser adopts the real frame size — so
    // setDisplaySize here would bake in a 256-based scale that zoom-crops the
    // video once the real frame lands. Set scale from the texture's own
    // dimensions instead; Phaser preserves scale (not display size) through
    // the frame swap.
    video.once(Phaser.GameObjects.Events.VIDEO_TEXTURE, (_vid, texture) => {
      const frame = texture.get();
      video.setScale(GAME_WIDTH / frame.realWidth, GAME_HEIGHT / frame.realHeight);
    });
    video.once(Phaser.GameObjects.Events.VIDEO_COMPLETE, () => this.startGame());
    video.play();

    // Phaser Video audio doesn't go through the sound manager, so the user volume
    // has to be applied directly, re-applied on every slider drag via
    // GLOBAL_VOLUME. this.sound is game-global (shared across scenes), so the
    // listener must be removed on shutdown or it keeps a closure over this run's
    // dead video object.
    const applyVideoVolume = (_mgr, v) => video.setVolume(v);
    applyVideoVolume(this.sound, this.sound.volume);
    this.sound.on(Phaser.Sound.Events.GLOBAL_VOLUME, applyVideoVolume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.sound.off(Phaser.Sound.Events.GLOBAL_VOLUME, applyVideoVolume);
    });

    const isDesktop = this.sys.game.device.os.desktop;
    const skipHint = isDesktop ? 'Press SPACE to skip' : 'Tap to skip';
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 24, skipHint, {
      fontSize: '14px',
      color: '#888888',
    }).setOrigin(0.5).setDepth(10);

    this.input.keyboard.once('keydown-SPACE', () => this.startGame());
    this.input.keyboard.once('keydown-ESC', () => this.startGame());
    // Arm on pointerdown rather than a bare once('pointerup'): the volume slider
    // stopPropagates its own pointerdown, so a drag that starts on the slider and
    // is released outside it never arms this and can't skip the intro.
    this.input.on('pointerdown', () => {
      this.input.once('pointerup', () => this.startGame());
    });

    addFullscreenButton(this);
    addVolumeSlider(this);
  }

  startGame() {
    if (this.started) return;
    this.started = true;
    const go = () => this.scene.start('GameScene');
    if (this.sound.locked) {
      this.sound.once(Phaser.Sound.Events.UNLOCKED, go);
    } else {
      go();
    }
  }
}
