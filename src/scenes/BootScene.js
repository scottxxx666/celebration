import Phaser from 'phaser';
import { getUserVolume } from '../userVolume.js';
import { SCENERY_THEMES } from '../config/sceneryThemes.js';
import { stageThemeNames } from '../config/stages.js';
import { OBSTACLE_SPRITES } from '../config/obstacleSprites.js';
import { PLAYER_FRAMES, ENEMY_FRAMES } from '../config/runFrames.js';
import { STATION_IMAGE, CAUGHT_IMAGE } from '../config/gameConfig.js';
import { hasChosenLanguage } from '../i18n.js';
import { getStartMs } from '../songTime.js';
import { SHARE_ICONS, SHARE_ICON_TEXTURE_PX } from './GameOverScene.js';

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
    this.load.audio('cue', 'assets/sfx/cue.wav');
    this.load.video('intro', 'assets/intro.mp4');
    // Placeholder: the ending cutscene reuses the intro file until ending.mp4 exists
    this.load.video('ending', 'assets/intro.mp4');

    for (const name of stageThemeNames()) {
      const theme = SCENERY_THEMES[name];
      this.load.image(theme.road.key, theme.road.file);
      this.load.image(theme.scenery.key, theme.scenery.file);
      for (const frame of theme.crowd ?? []) this.load.image(frame.key, frame.file);
      for (const glow of theme.pulse ?? []) this.load.image(glow.key, glow.file);
      if (theme.flicker) this.load.image(theme.flicker.key, theme.flicker.file);
    }

    this.load.image(STATION_IMAGE.key, STATION_IMAGE.file);
    this.load.image(CAUGHT_IMAGE.key, CAUGHT_IMAGE.file);
    for (const icon of SHARE_ICONS) {
      this.load.svg(icon.key, icon.file, { width: SHARE_ICON_TEXTURE_PX, height: SHARE_ICON_TEXTURE_PX });
    }

    OBSTACLE_SPRITES.forEach(sprite => this.load.image(sprite.key, sprite.file));
    PLAYER_FRAMES.forEach(frame => this.load.image(frame.key, frame.file));
    ENEMY_FRAMES.forEach(frame => this.load.image(frame.key, frame.file));
  }

  create() {
    this.sound.setVolume(getUserVolume());
    // Dev/testing deep-link (?t=): straight to the menu, like MenuScene's own skip.
    if (getStartMs() > 0) {
      this.scene.start('MenuScene');
      return;
    }
    // The picker only on the first visit; the flashing-lights warning every load.
    // `next` is always passed: a scene started without data keeps its previous one.
    if (hasChosenLanguage()) {
      this.scene.start('WarningScene');
    } else {
      this.scene.start('LanguageScene', { next: 'WarningScene' });
    }
  }
}
