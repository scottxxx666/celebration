import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig.js';
import { TITLE_STYLE, HINT_STYLE, textStyle, isDesktop } from '../config/ui.js';
import { addFullscreenButton } from '../objects/FullscreenButton.js';
import { onDismiss, onDirectionKey } from '../input.js';
import { LANGUAGES, getLanguage, setLanguage } from '../i18n.js';
import { MENU_TOUCH_WIDTH } from '../menuLayout.js';

const IDS = Object.keys(LANGUAGES);
const TITLE_Y = 60;
const FIRST_ROW_Y = 130;
const ROW_SPACING = 46; // also the mobile touch zone height, so zones tile

// Language picker: shown by BootScene on the first visit (→ WarningScene) and
// from MenuScene's language row (→ back to MenuScene); `next` says which.
// Nothing here is translated — each language is listed under its own name, in
// its own font — so a player who cannot read the current language can still use it.
export class LanguageScene extends Phaser.Scene {
  constructor() {
    super('LanguageScene');
  }

  init(data) {
    this.next = data.next;
  }

  create() {
    const cx = GAME_WIDTH / 2;
    this.isDesktop = isDesktop(this);
    // Saved language, or the browser's preference on the first visit
    this.selected = IDS.indexOf(getLanguage());

    this.add.text(cx, TITLE_Y, 'Language', textStyle({ ...TITLE_STYLE, fontSize: '28px' }, 'en')).setOrigin(0.5);

    this.rows = IDS.map((id, i) => {
      const y = FIRST_ROW_Y + i * ROW_SPACING;
      const text = this.add.text(cx, y, LANGUAGES[id].label, textStyle({ fontSize: '26px', color: '#ffffff' }, id))
        .setOrigin(0.5);

      // Same targets as MenuScene: the label itself on desktop (hover selects),
      // a finger-sized invisible zone on mobile.
      const target = this.isDesktop
        ? text.setInteractive({ useHandCursor: true })
        : this.add.zone(cx, y, MENU_TOUCH_WIDTH, ROW_SPACING).setInteractive();

      if (this.isDesktop) {
        target.on('pointerover', () => {
          this.selected = i;
          this.highlight();
        });
      }

      // Fires only when the press began on this row: the click that opened the
      // picker from the menu must not also pick whatever lands under it.
      let armed = false;
      target.on('pointerdown', () => {
        armed = true;
        text.setAlpha(0.6);
      });
      target.on('pointerout', () => {
        armed = false;
        text.setAlpha(1);
      });
      target.on('pointerup', () => {
        if (armed) this.choose(i);
      });

      return text;
    });
    this.highlight();

    if (this.isDesktop) {
      this.add.text(cx, GAME_HEIGHT - 30, '↑/↓ · SPACE', textStyle(HINT_STYLE, 'en')).setOrigin(0.5);
      const move = (dir) => (event) => {
        if (event.repeat) return;
        this.selected = Phaser.Math.Wrap(this.selected + dir, 0, IDS.length);
        this.highlight();
      };
      onDirectionKey(this, 'up', move(-1));
      onDirectionKey(this, 'down', move(1));
    }

    const confirm = () => this.choose(this.selected);
    onDismiss(this, { keys: { SPACE: confirm, ENTER: confirm } });

    addFullscreenButton(this);
  }

  // Desktop marks the selected row by colour alone, like MenuScene.
  highlight() {
    if (!this.isDesktop) return;

    this.rows.forEach((text, i) => {
      text.setColor(i === this.selected ? '#ffffff' : '#666666');
    });
  }

  choose(i) {
    setLanguage(IDS[i]);
    this.scene.start(this.next);
  }
}
