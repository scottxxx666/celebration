import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { addFullscreenButton } from '../objects/FullscreenButton.js';

// Desktop layout: two keycap demo columns side by side
const LEFT_X = 250;   // run-demo column center
const RIGHT_X = 550;  // rows-demo column center
const DEMO_Y = 160;

// Mobile layout: one landscape phone mock mirroring the real play screen
const PHONE_W = 320;
const PHONE_H = 170;
const SWIPE_MARGIN = 30; // swipe dot travel stops this far from the phone edge

export class HowToPlayScene extends Phaser.Scene {
  constructor() {
    super('HowToPlayScene');
  }

  create() {
    const cx = GAME_WIDTH / 2;
    this.isDesktop = this.sys.game.device.os.desktop;

    this.add.text(cx, 40, 'HOW TO PLAY', {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    if (this.isDesktop) {
      this.createDesktop();
    } else {
      this.createMobile();
    }

    const backHint = this.isDesktop ? 'ESC / ENTER / tap to go back' : 'Tap anywhere to go back';
    this.add.text(cx, GAME_HEIGHT - 30, backHint, { fontSize: '14px', color: '#666666' }).setOrigin(0.5);

    const goBack = () => this.scene.start('MenuScene');
    this.input.keyboard.on('keydown-ESC', goBack);
    this.input.keyboard.on('keydown-ENTER', goBack);
    this.input.keyboard.on('keydown-SPACE', goBack);
    this.input.on('pointerdown', goBack);

    addFullscreenButton(this);
  }

  caption(x, y, text) {
    return this.add.text(x, y, text, { fontSize: '18px', color: '#aaaaaa' }).setOrigin(0.5);
  }

  // ---- Desktop: ←/→ and ↑/↓ keycap columns ----

  createDesktop() {
    const cx = GAME_WIDTH / 2;
    this.runDemo = this.add.container(LEFT_X, DEMO_Y);
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

    this.caption(LEFT_X, DEMO_Y + 110, 'Alternate ← → to run faster');
    this.caption(RIGHT_X, DEMO_Y + 110, 'Press ↑ ↓ to change rows');
    this.caption(cx, 320, 'Dodge the obstacles');
    this.caption(cx, 345, "Don't let the chaser catch you");

    // Half-beat tap cadence (~350ms); rows keys press once per beat (~700ms)
    this.runSide = 1; // first tick flips it, so the demo leads with ←
    this.time.addEvent({ delay: 350, loop: true, callback: () => {
      this.runSide = 1 - this.runSide;
      this.pressKeycap(this.runDemo, this.runPads[this.runSide]);
    } });
    this.rowSide = 1; // first tick flips it, so the demo leads with ↑
    this.time.addEvent({ delay: 700, loop: true, callback: () => {
      this.rowSide = 1 - this.rowSide;
      this.pressKeycap(this.rowsDemo, this.rowPads[this.rowSide]);
    } });
  }

  buildKeycap(label) {
    const bg = this.add.rectangle(0, 0, 44, 44, 0x2f2f44).setStrokeStyle(2, 0x777788);
    const text = this.add.text(0, 0, label, { fontSize: '22px', color: '#dddddd' }).setOrigin(0.5);
    const pad = this.add.container(0, 0, [bg, text]);
    pad.bg = bg;
    return pad;
  }

  // Shared press treatment for a keycap pad: squash, flash, and a ripple at its position
  pressKeycap(parentDemo, pad) {
    this.tweens.add({ targets: pad, scale: 0.82, duration: 90, yoyo: true });
    pad.bg.setFillStyle(0x88aa66);
    this.time.delayedCall(180, () => pad.bg.setFillStyle(0x2f2f44));
    const ripple = this.add.circle(pad.x, pad.y, 12, 0xffffff, 0.45);
    parentDemo.add(ripple);
    this.tweens.add({
      targets: ripple,
      scale: 2.6,
      alpha: 0,
      duration: 320,
      onComplete: () => ripple.destroy(),
    });
  }

  // ---- Mobile: one landscape phone mock, sequenced like real play ----
  // Six alternating half-beat taps, then one swipe along the divider (direction
  // alternates per cycle), then a rest tick while the swipe finishes — all
  // driven by a single 350ms clock so the demo reads as one continuous play loop

  createMobile() {
    const cx = GAME_WIDTH / 2;
    this.phone = this.add.container(cx, 150);
    this.phone.add(this.add.rectangle(0, 0, PHONE_W, PHONE_H, 0x000000, 0).setStrokeStyle(2, 0x777788));
    this.divider = this.add.rectangle(0, 0, 2, PHONE_H, 0x777788);
    this.phone.add(this.divider);
    this.chevron = this.add.text(PHONE_W / 2 + 24, 0, '▲', { fontSize: '22px', color: '#88aa66' })
      .setOrigin(0.5)
      .setAlpha(0);
    this.phone.add(this.chevron);

    // Captions stacked full-width so the long monospace lines can't collide
    this.caption(cx, 272, 'Tap left / right alternately to run faster');
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
    const ripple = this.add.circle(x, 0, 12, 0xffffff, 0.45);
    this.phone.add(finger);
    this.phone.add(ripple);
    this.tweens.add({ targets: finger, scale: 1.3, alpha: 0, duration: 220, onComplete: () => finger.destroy() });
    this.tweens.add({ targets: ripple, scale: 2.6, alpha: 0, duration: 320, onComplete: () => ripple.destroy() });
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
