import Phaser from 'phaser';
import { getUserVolume } from '../userVolume.js';
import { SCENERY_THEMES } from '../config/sceneryThemes.js';
import { stageThemeNames } from '../config/stages.js';
import { OBSTACLE_SPRITES } from '../config/obstacleSprites.js';
import { PLAYER_FRAMES, ENEMY_FRAMES } from '../config/runFrames.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // The loader still completes (and create() still runs) when a file fails,
    // so surface failures loudly instead of starting a run with missing assets.
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, file => {
      window.alert(`Failed to load ${file.key} (${file.src})`);
    });

    this.load.audio('music', 'assets/music.m4a');
    this.load.audio('breakwall', 'assets/sfx/breakwall.wav');
    this.load.video('intro', 'assets/intro.mp4');

    for (const name of stageThemeNames()) {
      const theme = SCENERY_THEMES[name];
      this.load.image(theme.road.key, theme.road.file);
      this.load.image(theme.scenery.key, theme.scenery.file);
      if (theme.flicker) this.load.image(theme.flicker.key, theme.flicker.file);
    }

    OBSTACLE_SPRITES.forEach(sprite => this.load.image(sprite.key, sprite.file));
    PLAYER_FRAMES.forEach(frame => this.load.image(frame.key, frame.file));
    ENEMY_FRAMES.forEach(frame => this.load.image(frame.key, frame.file));
  }

  create() {
    this.sound.setVolume(getUserVolume());
    this.scene.start('MenuScene');
  }
}
