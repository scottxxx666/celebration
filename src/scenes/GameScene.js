import Phaser from 'phaser';
import { Player } from '../objects/Player.js';
import { ObstacleSpawner } from '../objects/ObstacleSpawner.js';
import { Enemy } from '../objects/Enemy.js';
import { DiscoLights } from '../objects/DiscoLights.js';
import { Conductor } from '../Conductor.js';
import { sectionAt } from '../config/sections.js';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  PLAYER_X,
  ENEMY_START_X,
  WALK_ZONE_TOP,
  ENEMY_CRUISE_SPEED,
  OBSTACLE_TIMING_SPEED,
  BEAT_SYNC_START_MS,
  DISCO_FLASH_ALPHA,
  ROTATE_BEATS_PER_TURN,
  ROTATE_ZOOM,
  DISCO_DIM_ALPHA,
  DISCO_DIM_FADE_MS,
} from '../config/gameConfig.js';

// Saturated palette the beat flash cycles through during disco sections, by beatIndex
const DISCO_COLORS = [0xff00ff, 0x00ffff, 0xffff00, 0x00ff00, 0xff8800];

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

    // Disco dim — black overlay darkening the world so beams/lasers pop;
    // below the lights (-4) and beat overlay (-5), above the background (-10)
    this.discoDim = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000)
      .setOrigin(0, 0)
      .setAlpha(0)
      .setDepth(-6);

    const walkZoneMidY = WALK_ZONE_TOP + (GAME_HEIGHT - WALK_ZONE_TOP) / 2;
    this.player = new Player(this, PLAYER_X, walkZoneMidY);
    this.spawner = new ObstacleSpawner(this);
    this.enemy = new Enemy(this, ENEMY_START_X);
    this.disco = new DiscoLights(this);

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
    // Song-section effects (src/config/sections.js) — gated purely on song time,
    // independent of the enemy ramp / beat-sync gate above
    const section = sectionAt(songMs);

    this.player.update(this.cursors, this.leftKey, this.rightKey, delta);
    if (beatSyncOn && this.conductor.halfBeatCrossed) this.player.pulse();

    // Beat flash: brighter on the downbeat of each bar, then fade out; during
    // disco sections it cycles a saturated palette instead of white
    this.beatOverlay.setFillStyle(
      section.disco ? DISCO_COLORS[this.conductor.beatIndex % DISCO_COLORS.length] : 0xffffff
    );
    if (beatSyncOn && this.conductor.beatCrossed) {
      const onBeat = this.conductor.beatIndex % 4 === 0;
      const peakAlpha = section.disco ? DISCO_FLASH_ALPHA : 0.1;
      const offAlpha = section.disco ? DISCO_FLASH_ALPHA * 0.6 : 0.05;
      this.beatOverlay.setAlpha(onBeat ? peakAlpha : offAlpha);
    } else {
      this.beatOverlay.setAlpha(Math.max(0, this.beatOverlay.alpha - 0.4 * (delta / 1000)));
    }
    this.disco.update(songMs, this.conductor.beatCrossed, this.conductor.beatIndex, section.disco);

    // Disco dim — beat-aligned fade in/out at section start/end, gated purely on song time
    let dimAlpha = 0;
    if (section.disco) {
      const edgeMs = Math.min(songMs - section.startMs, section.endMs - songMs);
      dimAlpha = DISCO_DIM_ALPHA * Phaser.Math.Clamp(edgeMs / DISCO_DIM_FADE_MS, 0, 1);
    }
    this.discoDim.setAlpha(dimAlpha);

    // Scroll background — global world multiplier from the current section
    this.bgX -= this.player.speed * section.speedMult * (delta / 1000);
    if (this.bgX <= -GAME_WIDTH) this.bgX += GAME_WIDTH;
    this.bg.setX(this.bgX);

    this.enemy.trackRow(this.player.row, this.conductor.beatCrossed, beatSyncOn);
    // this.enemy.speed stays the base ramp value; the multiplier only scales motion
    this.enemy.update(delta / 1000, this.player.speed, songMs, section.speedMult);

    // Once the enemy pins the player into the speed band, time spawns off the
    // band average instead of the instantaneous player speed (docs/speed-design.md)
    const timingSpeed =
      (this.enemy.speed >= ENEMY_CRUISE_SPEED ? OBSTACLE_TIMING_SPEED : this.player.speed) *
      section.speedMult;
    this.spawner.update(songMs, this.player.speed * section.speedMult, delta, timingSpeed);

    // Continuous camera spin during the final highlight — visual only, collision/rows untouched.
    // Negative camera.rotation makes the world spin counterclockwise on screen — the direction
    // we want (confirmed by play-testing).
    const cam = this.cameras.main;
    if (section.rotate) {
      const turnMs = this.conductor.beatMs * ROTATE_BEATS_PER_TURN;
      cam.setRotation(-((songMs - section.startMs) / turnMs) * Math.PI * 2);
      cam.setZoom(ROTATE_ZOOM);
    } else {
      cam.setRotation(0);
      cam.setZoom(1);
    }

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
    this.disco.destroy();
    this.scene.start('GameOverScene', { won, score: Math.floor(songMs / 1000), progress });
  }
}
