import Phaser from 'phaser';
import { Player } from '../objects/Player.js';
import { ObstacleSpawner } from '../objects/ObstacleSpawner.js';
import { Enemy } from '../objects/Enemy.js';
import { DiscoLights } from '../objects/DiscoLights.js';
import { Scenery } from '../objects/Scenery.js';
import { addFullscreenButton } from '../objects/FullscreenButton.js';
import { addVolumeSlider } from '../objects/VolumeSlider.js';
import { Conductor } from '../Conductor.js';
import { rotateTurns, sectionAt, strobeRate, strobeScale } from '../config/sections.js';
import { getStartMs, formatSongTime } from '../songTime.js';
import { addDirectionKeys } from '../input.js';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  PLAYER_X,
  ENEMY_START_X,
  WALK_ZONE_TOP,
  OBSTACLE_TIMING_SPEED,
  OBSTACLE_TIMING_SWITCH_MS,
  BEAT_SYNC_START_MS,
  PLAYER_RUN_STEPS_PER_BEAT,
  ENEMY_RUN_STEPS_PER_BEAT,
  DISCO_FLASH_ALPHA,
  BEAT_FLASH_ALPHA,
  BEAT_FLASH_OFFBEAT_RATIO,
  DISCO_FLASH_OFFBEAT_RATIO,
  BEAT_FLASH_DECAY,
  ROTATE_BEATS_PER_TURN,
  ROTATE_ZOOM,
  DISCO_DIM_ALPHA,
  DISCO_DIM_FADE_MS,
  DISCO_HUE_BEATS,
  DISCO_COLORS,
  STROBE_ALPHA,
  STROBE_DECAY,
  LIGHTS_OUT_FADE_MS,
  LIGHTS_OUT_SILHOUETTE_BG,
  ZOOM_PUNCH_AMOUNT,
  ZOOM_PUNCH_BEATS,
  ZOOM_PUNCH_DECAY_MS,
  WIN_MS,
} from '../config/gameConfig.js';

const HUD_REFRESH_MS = 100; // debug readout re-renders a text texture, so throttle it

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    // Background layers sit below the fake-3D depth range (shadows start at −0.5).
    // Road + scenery strip (themed pair, oversized for the rotate section's
    // zoom-out) — see src/objects/Scenery.js. No horizon divider needed: the
    // scenery PNG's bottom row and the road PNG's top row are the same colour
    // by construction (docs/image-assets.md).
    this.scenery = new Scenery(this);

    // Song = level: the track plays once; reaching its end clears the run
    this.music = this.sound.add('music', { loop: false });
    this.music.once(Phaser.Sound.Events.COMPLETE, () => this.endRun(true));
    // Dev/testing deep-link (?t=): seek the music and skip past already-passed
    // obstacles so a jump forward doesn't dump a pile of them on the first frame.
    const startMs = getStartMs();
    if (startMs > 0) {
      this.music.play({ seek: startMs / 1000 });
    } else {
      this.music.play();
    }
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

    // Strobe — full-screen white flash on the beat (frequency per section), above
    // gameplay (depth 8), below the HUD (10)
    this.strobeOverlay = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff)
      .setOrigin(0, 0)
      .setAlpha(0)
      .setDepth(8);
    this.strobeIndex = -1;

    // Lights out — full-screen black hiding all gameplay on the dark part of each
    // cycle; above the strobe (8), below the glowing shadows (9.5) and the HUD (10).
    // In 'silhouettes' reveal it drops behind gameplay instead (see update)
    this.lightsOutOverlay = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000)
      .setOrigin(0, 0)
      .setAlpha(0)
      .setDepth(9);

    this.player = new Player(this, PLAYER_X);
    this.player.attachTouch(this);
    this.keys = addDirectionKeys(this);
    this.spawner = new ObstacleSpawner(this);
    if (startMs > 0) this.spawner.skipTo(startMs);
    this.enemy = new Enemy(this, ENEMY_START_X);
    this.disco = new DiscoLights(this);

    // Speed + song-time readout (debug HUD) — above all gameplay depths
    this.speedText = this.add.text(10, 10, '', { fontSize: '14px', color: '#ffffff' }).setDepth(10);
    this.hudTimer = HUD_REFRESH_MS;

    // Fullscreen button first: it returns where the slider's right edge goes.
    addVolumeSlider(this, addFullscreenButton(this));
  }

  update(time, delta) {
    this.conductor.update();
    const songMs = this.conductor.songMs;
    // Original intro behavior until the beat-sync layer switches on
    const beatSyncOn = songMs >= BEAT_SYNC_START_MS;
    // Song-section effects (src/config/sections.js) — gated purely on song time,
    // independent of the enemy ramp / beat-sync gate above
    const section = sectionAt(songMs);

    this.player.update(this.keys, delta);
    if (this.conductor.beatTimeMs >= 0) {
      // Walk frames step (character's steps per beat)×speedMult times per
      // beat so feet keep pace with the faster world; the phase may jump once
      // when entering/leaving a section with a different speedMult.
      // Idempotent per index, so calling every frame is fine.
      const { speedMult } = section;
      this.player.syncFrame(this.conductor.gridIndex(PLAYER_RUN_STEPS_PER_BEAT * speedMult));
      this.enemy.syncFrame(this.conductor.gridIndex(ENEMY_RUN_STEPS_PER_BEAT * speedMult));
    }
    if (this.conductor.halfBeatCrossed) {
      // both bounce once beat sync is on
      if (beatSyncOn) {
        this.player.pulse();
        this.enemy.pulse();
      }
    }

    // Coordinated disco palette base index, advancing per bar (DISCO_HUE_BEATS):
    // the beat flash uses this base hue; DiscoLights spreads beams/pools/lasers
    // across the palette offset from it, so the whole set shifts together per bar
    const discoColorIndex = Math.floor(this.conductor.beatIndex / DISCO_HUE_BEATS) % DISCO_COLORS.length;
    const discoColor = DISCO_COLORS[discoColorIndex];

    // Beat flash: brighter on the downbeat of each bar, then fade out; during
    // lights sections it uses the base disco hue instead of white. Gated per
    // section (section.beatFlash); the fade below stays unconditional so a flash
    // in progress dies out naturally when entering a beatFlash:false section
    this.beatOverlay.setFillStyle(section.lights ? discoColor : 0xffffff);
    if (beatSyncOn && section.beatFlash && this.conductor.beatCrossed) {
      const onBeat = this.conductor.beatIndex % 4 === 0;
      const peakAlpha = section.lights ? DISCO_FLASH_ALPHA : BEAT_FLASH_ALPHA;
      const offAlpha = peakAlpha * (section.lights ? DISCO_FLASH_OFFBEAT_RATIO : BEAT_FLASH_OFFBEAT_RATIO);
      this.beatOverlay.setAlpha(onBeat ? peakAlpha : offAlpha);
    } else {
      this.beatOverlay.setAlpha(Math.max(0, this.beatOverlay.alpha - BEAT_FLASH_DECAY * (delta / 1000)));
    }
    this.disco.update(this.conductor.beatCrossed, section.lights, discoColorIndex);

    // Dim — beat-aligned fade in/out across the contiguous dimmed span (back-to-back
    // dimmed sections fade as one), gated purely on song time
    let dimAlpha = 0;
    if (section.dim) {
      const edgeMs = Math.min(songMs - section.dimStartMs, section.dimEndMs - songMs);
      dimAlpha = DISCO_DIM_ALPHA * Phaser.Math.Clamp(edgeMs / DISCO_DIM_FADE_MS, 0, 1);
    }
    this.discoDim.setAlpha(dimAlpha);

    // Strobe — flash white section.strobe times per beat during the section (may be
    // sub-beat, and stepped over the section: strobeRate), aligned to the beat grid,
    // then a fast fade tail; gated on song time. The peak follows section.strobeRamp
    // (faint at the section start, full at its end).
    let strobeFlash = false;
    const strobePerBeat = strobeRate(section, songMs, this.conductor.beatMs);
    if (strobePerBeat) {
      const idx = this.conductor.gridIndex(strobePerBeat);
      strobeFlash = idx !== this.strobeIndex;
      this.strobeIndex = idx;
    } else {
      this.strobeIndex = -1;
    }
    if (strobeFlash) {
      this.strobeOverlay.setAlpha(STROBE_ALPHA * strobeScale(section, songMs));
    } else {
      this.strobeOverlay.setAlpha(Math.max(0, this.strobeOverlay.alpha - STROBE_DECAY * (delta / 1000)));
    }

    // Lights out — cycle anchored to the section start: lightsOut.bursts lit
    // blinks of lightsOut.lit beats, lightsOut.gap beats of black between them,
    // then black for lightsOut.dark beats (quick fade in, snaps back on).
    // lightsOut.reveal picks what stays readable while dark: 'shadows' = drop
    // shadows glow above the black; 'silhouettes' = the overlay becomes a
    // near-black backdrop behind gameplay (depth −1, above the lights, below the
    // row-0 shadow) and sprites tint solid black. Stateless, gated on song time
    let lightsOutAlpha = 0;
    let reveal = null;
    if (section.lightsOut) {
      const { lit, dark, gap = 0, bursts = 1 } = section.lightsOut;
      const { beatMs } = this.conductor;
      const litMs = lit * beatMs;
      const burstMs = (lit + gap) * beatMs; // one blink + the gap after it
      const burstsMs = bursts * burstMs - gap * beatMs; // the last blink has no gap, the long dark follows
      const phaseMs = (songMs - section.startMs) % (burstsMs + dark * beatMs);
      // ms since the current (or last) blink began: lit while < litMs, black after
      const sinceLitMs = phaseMs < burstsMs ? phaseMs % burstMs : phaseMs - burstsMs + litMs;
      if (sinceLitMs >= litMs) {
        // lit: 0 = dark throughout — no fade, or it would dip at every cycle wrap
        lightsOutAlpha = lit > 0 ? Math.min(1, (sinceLitMs - litMs) / LIGHTS_OUT_FADE_MS) : 1;
        reveal = section.lightsOut.reveal ?? null;
      } else if (section.lightsOut.strobe) {
        // The lights come on with a strobe flash: same peak and decay as the
        // section strobe above, derived from time since the blink began
        const litFlash = STROBE_ALPHA - STROBE_DECAY * (sinceLitMs / 1000);
        this.strobeOverlay.setAlpha(Math.max(this.strobeOverlay.alpha, litFlash));
      }
    }
    const silhouettes = section.lightsOut?.reveal === 'silhouettes';
    this.lightsOutOverlay
      .setFillStyle(silhouettes ? LIGHTS_OUT_SILHOUETTE_BG : 0x000000)
      .setDepth(silhouettes ? -1 : 9)
      .setAlpha(lightsOutAlpha);
    this.player.setReveal(reveal);
    this.enemy.setReveal(reveal);
    this.spawner.reveal = reveal;

    // Scroll background — global world multiplier from the current section
    this.scenery.scroll(this.player.speed * section.speedMult * (delta / 1000));

    this.enemy.trackRow(this.player.row, this.conductor.beatCrossed, beatSyncOn);
    this.enemy.update(delta / 1000, this.player.speed, songMs, section.speedMult);

    // Once the enemy pins the player into the speed band, time spawns off the
    // band average instead of the instantaneous player speed (docs/speed-design.md)
    const timingSpeed =
      (songMs >= OBSTACLE_TIMING_SWITCH_MS ? OBSTACLE_TIMING_SPEED : this.player.speed) *
      section.speedMult;
    this.spawner.update(songMs, this.player.speed * section.speedMult, delta, timingSpeed);

    // Continuous camera spin during the final highlight — visual only, collision/rows untouched.
    // Negative camera.rotation makes the world spin counterclockwise on screen — the direction
    // we want (confirmed by play-testing); after each full turn it reverses (rotateTurns).
    const cam = this.cameras.main;
    if (section.rotate) {
      const turnMs = this.conductor.beatMs * ROTATE_BEATS_PER_TURN;
      cam.setRotation(-rotateTurns(section, songMs, turnMs) * Math.PI * 2);
    } else {
      cam.setRotation(0);
    }

    // Zoom punch — subtle pulse on the (down)beat that decays, multiplied onto the
    // base zoom so it composes with ROTATE_ZOOM. Stateless: derived from beat phase.
    const baseZoom = section.rotate ? ROTATE_ZOOM : 1;
    let zoomPunch = 1;
    if (section.lights) {
      const decay = Math.max(0, 1 - this.conductor.phaseMs(ZOOM_PUNCH_BEATS) / ZOOM_PUNCH_DECAY_MS);
      zoomPunch = 1 + ZOOM_PUNCH_AMOUNT * decay;
    }
    cam.setZoom(baseZoom * zoomPunch);

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

    if (songMs >= WIN_MS) {
      this.endRun(true);
      return;
    }

    this.hudTimer += delta;
    if (this.hudTimer >= HUD_REFRESH_MS) {
      this.hudTimer = 0;
      this.speedText.setText(
        `speed: ${Math.floor(this.player.speed)}   time: ${formatSongTime(songMs)}`
      );
    }
  }

  endRun(won) {
    const durationMs = this.music.duration * 1000;
    // A win is at WIN_MS, or at the track's end when WIN_MS lies past it (on
    // COMPLETE the sound's seek has already reset, so it can't be read back);
    // song time starts slightly negative (output latency), hence the clamp
    const songMs = won ? Math.min(durationMs, WIN_MS) : Math.max(0, this.conductor.songMs);
    const progress = won ? 1 : Math.min(1, durationMs > 0 ? songMs / durationMs : 0);
    this.music.stop();
    this.enemy.destroy();
    this.spawner.destroyAll();
    this.disco.destroy();
    this.scene.start('GameOverScene', { won, score: Math.floor(songMs / 1000), progress });
  }
}
