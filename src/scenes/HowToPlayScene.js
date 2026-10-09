import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { TITLE_STYLE, CAPTION_STYLE, HINT_STYLE, KEYCAP_DARK, KEYCAP_MID, addKeycap, isDesktop } from '../config/ui.js';
import { addFullscreenButton } from '../objects/FullscreenButton.js';
import { onDismiss } from '../input.js';
import { getDifficulty } from '../difficulty.js';

// Desktop layout: two keycap demo columns side by side
const LEFT_X = 250;   // run-demo column center
const RIGHT_X = 550;  // rows-demo column center
const DEMO_Y = 160;

// Mobile layout: one landscape phone mock mirroring the real play screen
const PHONE_W = 320;
const PHONE_H = 170;
const SWIPE_MARGIN = 30; // swipe dot travel stops this far from the phone edge

// Easy auto-runs (Player autoRun), so the run demo is dimmed and its caption swapped
const EASY_RUN_DEMO_ALPHA = 0.25;

export class HowToPlayScene extends Phaser.Scene {
  constructor() {
    super('HowToPlayScene');
  }

  // Reached two ways: from the menu (back to the menu), or as the gate
  // MenuScene inserts between Start and the intro video on every Start
  // (on to IntroScene).
  // Both callers must pass `next` explicitly — Phaser keeps the previous
  // settings.data when scene.start is called without any, so an omitted `next`
  // reads as the last one used, not as undefined. The default is only a
  // fallback for a first entry that never set it.
  init(data) {
    this.next = data?.next ?? 'MenuScene';
  }

  create() {
    const cx = GAME_WIDTH / 2;
    this.isDesktop = isDesktop(this);
    this.autoRun = getDifficulty() === 'easy';
    // Derived from "not the menu" rather than naming the gate's target, so it
    // survives the gate being moved around the boot flow.
    const isGate = this.next !== 'MenuScene';

    this.add.text(cx, 40, 'HOW TO PLAY', { ...TITLE_STYLE, fontSize: '28px' }).setOrigin(0.5);

    if (this.isDesktop) {
      this.createDesktop();
    } else {
      this.createMobile();
    }

    let hint;
    if (isGate) {
      // "continue", not "play": the press leads to the intro video, not gameplay
      hint = this.isDesktop ? 'SPACE / tap to continue' : 'Tap to continue';
    } else {
      hint = this.isDesktop ? 'ESC / SPACE / tap to go back' : 'Tap anywhere to go back';
    }
    this.add.text(cx, GAME_HEIGHT - 30, hint, HINT_STYLE).setOrigin(0.5);

    // Every exit goes to the same target, so ESC needs no special-casing: it
    // means "back" from the menu and "skip ahead" in the gate, matching IntroScene.
    // onDismiss's fresh-press guards matter here: the input that confirmed Start
    // must not also dismiss the gate before it can be read.
    const leave = () => this.scene.start(this.next);
    onDismiss(this, { keys: { ESC: leave, ENTER: leave, SPACE: leave }, tap: leave });

    addFullscreenButton(this);
  }

  caption(x, y, text) {
    return this.add.text(x, y, text, { ...CAPTION_STYLE, align: 'center' }).setOrigin(0.5);
  }

  // Expanding tap ripple inside `container` at (x, y)
  ripple(container, x, y) {
    const circle = this.add.circle(x, y, 12, 0xffffff, 0.45);
    container.add(circle);
    this.tweens.add({ targets: circle, scale: 2.6, alpha: 0, duration: 320, onComplete: () => circle.destroy() });
  }

  // ---- Desktop: ←/→ and ↑/↓ keycap columns ----

  createDesktop() {
    const cx = GAME_WIDTH / 2;
    this.runDemo = this.add.container(LEFT_X, DEMO_Y).setAlpha(this.autoRun ? EASY_RUN_DEMO_ALPHA : 1);
    this.rowsDemo = this.add.container(RIGHT_X, DEMO_Y);

    this.runPads = [-1, 1].map((side) => {
      const pad = this.buildKeycap(side < 0 ? '←' : '→');
      pad.setPosition(side * 30, 0);
      this.runDemo.add(pad);
      return pad;
    });
    this.rowPads = [
      { y: -32, label: '↑' },
      { y: 32, label: '↓' },
    ].map(({ y, label }) => {
      const pad = this.buildKeycap(label);
      pad.setPosition(0, y);
      this.rowsDemo.add(pad);
      return pad;
    });

    // Two lines each: on one line the captions are wider than the column spacing and collide
    this.caption(LEFT_X, DEMO_Y + 110, this.autoRun ? 'Easy mode:\nyou run automatically' : 'Alternate ← → (A D)\nto run faster');
    this.caption(RIGHT_X, DEMO_Y + 110, 'Press ↑ ↓ (W S)\nto change rows');
    this.caption(cx, 320, 'Dodge the obstacles');
    this.caption(cx, 345, "Don't let the chaser catch you");

    this.add.text(cx, 385, 'F — fullscreen', HINT_STYLE).setOrigin(0.5);

    // Half-beat tap cadence (~350ms); rows keys press once per beat (~700ms)
    this.startPressLoop(350, this.runDemo, this.runPads);
    this.startPressLoop(700, this.rowsDemo, this.rowPads);
  }

  // Alternates presses between the two pads every `delay` ms, leading with pads[0]
  startPressLoop(delay, demo, pads) {
    let side = 1; // first tick flips it
    this.time.addEvent({ delay, loop: true, callback: () => {
      side = 1 - side;
      this.pressKeycap(demo, pads[side]);
    } });
  }

  buildKeycap(label) {
    const { bg, text } = addKeycap(this, label, { size: 44, fontSize: '22px', stroke: 2 });
    const pad = this.add.container(0, 0, [bg, text]);
    pad.bg = bg;
    return pad;
  }

  // Shared press treatment for a keycap pad: squash, flash, and a ripple at its position
  pressKeycap(parentDemo, pad) {
    this.tweens.add({ targets: pad, scale: 0.82, duration: 90, yoyo: true });
    pad.bg.setFillStyle(0x88aa66);
    this.time.delayedCall(180, () => pad.bg.setFillStyle(KEYCAP_DARK));
    this.ripple(parentDemo, pad.x, pad.y);
  }

  // ---- Mobile: one landscape phone mock, sequenced like real play ----
  // Six alternating half-beat taps, then one swipe along the divider (direction
  // alternates per cycle), then a rest tick while the swipe finishes — all
  // driven by a single 350ms clock so the demo reads as one continuous play loop

  createMobile() {
    const cx = GAME_WIDTH / 2;
    this.phone = this.add.container(cx, 150);
    this.phone.add(this.add.rectangle(0, 0, PHONE_W, PHONE_H, 0x000000, 0).setStrokeStyle(2, KEYCAP_MID));
    this.divider = this.add.rectangle(0, 0, 2, PHONE_H, KEYCAP_MID);
    this.phone.add(this.divider);
    this.chevron = this.add.text(PHONE_W / 2 + 24, 0, '▲', { fontSize: '22px', color: '#88aa66' })
      .setOrigin(0.5)
      .setAlpha(0);
    this.phone.add(this.chevron);
    // Tap fingers/ripples get their own layer so Easy can dim them without the swipe
    this.tapLayer = this.add.container(0, 0).setAlpha(this.autoRun ? EASY_RUN_DEMO_ALPHA : 1);
    this.phone.add(this.tapLayer);

    // Captions stacked full-width so the long monospace lines can't collide
    this.caption(cx, 272, this.autoRun ? 'Easy mode: you run automatically' : 'Tap left / right alternately to run faster');
    this.caption(cx, 300, 'Swipe up / down to change rows');
    this.caption(cx, 344, 'Dodge the obstacles');
    this.caption(cx, 370, "Don't let the chaser catch you");

    this.step = 0;
    this.swipeDir = 'down'; // first swipe flips it, so the demo leads with swipe-up
    this.time.addEvent({ delay: 350, loop: true, callback: () => this.mobileTick() });
  }

  mobileTick() {
    const step = this.step % 8;
    this.step++;
    if (step < 6) {
      this.mobileTap(step % 2);
    } else if (step === 6) {
      this.mobileSwipe();
    }
    // step 7: rest — the swipe finishes during it
  }

  mobileTap(side) {
    const x = side === 0 ? -PHONE_W / 4 : PHONE_W / 4;
    const finger = this.add.circle(x, 0, 8, 0xdddddd, 0.9);
    this.tapLayer.add(finger);
    this.ripple(this.tapLayer, x, 0);
    this.tweens.add({ targets: finger, scale: 1.3, alpha: 0, duration: 220, onComplete: () => finger.destroy() });
  }

  mobileSwipe() {
    this.swipeDir = this.swipeDir === 'up' ? 'down' : 'up';
    const travel = PHONE_H / 2 - SWIPE_MARGIN;
    const fromY = this.swipeDir === 'up' ? travel : -travel;
    // Swipe on a thumb side, not the divider (a vertical swipe works anywhere in
    // the real game); alternating halves per cycle quietly says "anywhere works"
    const x = this.swipeDir === 'up' ? PHONE_W / 4 : -PHONE_W / 4;
    const duration = 550;

    this.chevron.setText(this.swipeDir === 'up' ? '▲' : '▼');
    this.chevron.setX(Math.sign(x) * (PHONE_W / 2 + 24)); // beside the half that's swiping
    this.tweens.add({ targets: this.chevron, alpha: { from: 0, to: 1 }, duration: 150, yoyo: true, hold: 250 });

    // Dim the tap-zone divider while the swipe plays so the two messages don't compete
    this.tweens.add({ targets: this.divider, alpha: 0.2, duration: 150 });
    this.time.delayedCall(duration + 150, () =>
      this.tweens.add({ targets: this.divider, alpha: 1, duration: 150 })
    );

    const dot = this.add.circle(x, fromY, 8, 0xdddddd);
    const trail = this.add.circle(x, fromY, 8, 0xdddddd, 0.5);
    this.phone.add(trail);
    this.phone.add(dot);
    this.tweens.add({
      targets: dot,
      y: -fromY,
      duration,
      ease: 'Sine.easeOut',
      onComplete: () => this.tweens.add({ targets: dot, alpha: 0, duration: 120, onComplete: () => dot.destroy() }),
    });
    this.tweens.add({ targets: trail, y: -fromY, duration, delay: 80, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: trail, alpha: 0, duration, delay: 80, onComplete: () => trail.destroy() });
  }
}
