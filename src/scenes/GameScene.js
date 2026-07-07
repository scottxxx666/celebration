import Phaser from 'phaser';
import { Player } from '../objects/Player.js';
import { ObstacleSpawner } from '../objects/ObstacleSpawner.js';
import { Enemy } from '../objects/Enemy.js';
import { Conductor } from '../Conductor.js';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  PLAYER_X,
  ENEMY_START_X,
  WALK_ZONE_TOP,
  ENEMY_CRUISE_SPEED,
  OBSTACLE_TIMING_SPEED,
  BEAT_SYNC_START_MS,
} from '../config/gameConfig.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    // Background layers sit below the fake-3D depth range (shadows start at −0.5)
    // Scrolling background — walk zone only
    this.bg = this.add.rectangle(0, WALK_ZONE_TOP, GAME_WIDTH * 3, GAME_HEIGHT - WALK_ZONE_TOP, 0x1a1a2e).setOrigin(0, 0).setDepth(-10);
    this.bgX = 0;

    // Static scenery area above the walk zone
    this.add.rectangle(0, 0, GAME_WIDTH, WALK_ZONE_TOP, 0x2a4a2e).setOrigin(0, 0).setDepth(-10);
    // Dividing line
    this.add.rectangle(0, WALK_ZONE_TOP, GAME_WIDTH, 2, 0x88aa66).setOrigin(0, 0).setDepth(-10);

    // Song = level: the track plays once; reaching its end clears the run
    this.music = this.sound.add('music', { loop: false });
    this.music.once(Phaser.Sound.Events.COMPLETE, () => this.endRun(true));
    this.music.play();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.sound.remove(this.music);
    });
    this.conductor = new Conductor(this.music);

    // Beat flash — white overlay over the walk zone, pulsed on each beat;
    // above the background but below shadows and game objects
    this.beatOverlay = this.add
      .rectangle(0, WALK_ZONE_TOP, GAME_WIDTH, GAME_HEIGHT - WALK_ZONE_TOP, 0xffffff)
      .setOrigin(0, 0)
      .setAlpha(0)
      .setDepth(-5);

    const walkZoneMidY = WALK_ZONE_TOP + (GAME_HEIGHT - WALK_ZONE_TOP) / 2;
    this.player = new Player(this, PLAYER_X, walkZoneMidY);
    this.spawner = new ObstacleSpawner(this);
    this.enemy = new Enemy(this, ENEMY_START_X);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.leftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.rightKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);

    // Speed readout (debug HUD) — above all gameplay depths
    this.speedText = this.add.text(10, 10, '', { fontSize: '14px', color: '#ffffff' }).setDepth(10);
  }

  update(time, delta) {
    this.conductor.update();
    const songMs = this.conductor.songMs;
    // Original intro behavior until the beat-sync layer switches on
    const beatSyncOn = songMs >= BEAT_SYNC_START_MS;

    this.player.update(this.cursors, this.leftKey, this.rightKey, delta);
    if (beatSyncOn && this.conductor.halfBeatCrossed) this.player.pulse();

    // Beat flash: brighter on the downbeat of each bar, then fade out
    if (beatSyncOn && this.conductor.beatCrossed) {
      this.beatOverlay.setAlpha(this.conductor.beatIndex % 4 === 0 ? 0.1 : 0.05);
    } else {
      this.beatOverlay.setAlpha(Math.max(0, this.beatOverlay.alpha - 0.4 * (delta / 1000)));
    }

    // Scroll background
    this.bgX -= this.player.speed * (delta / 1000);
    if (this.bgX <= -GAME_WIDTH) this.bgX += GAME_WIDTH;
    this.bg.setX(this.bgX);

    this.enemy.trackRow(this.player.row, this.conductor.beatCrossed, beatSyncOn);
    this.enemy.update(delta / 1000, this.player.speed, songMs);

    // Once the enemy pins the player into the speed band, time spawns off the
    // band average instead of the instantaneous player speed (docs/speed-design.md)
    const timingSpeed =
      this.enemy.speed >= ENEMY_CRUISE_SPEED ? OBSTACLE_TIMING_SPEED : this.player.speed;
    this.spawner.update(songMs, this.player.speed, delta, timingSpeed);

    // Collision
    if (this.player.overlaps(this.enemy)) {
      this.endRun(false);
      return;
    }

    for (const obs of this.spawner.obstacles) {
      if (this.player.overlaps(obs)) {
        this.endRun(false);
        return;
      }
    }

    this.speedText.setText(`speed: ${Math.floor(this.player.speed)}`);
  }

  endRun(won) {
    const durationMs = this.music.duration * 1000;
    // On COMPLETE the sound's seek has already reset, so take the full duration
    const songMs = won ? durationMs : this.conductor.songMs;
    const progress = won ? 1 : Math.min(1, durationMs > 0 ? songMs / durationMs : 0);
    this.music.stop();
    this.enemy.destroy();
    this.spawner.destroyAll();
    this.scene.start('GameOverScene', { won, score: Math.floor(songMs / 1000), progress });
  }
}
