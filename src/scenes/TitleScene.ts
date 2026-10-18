/**
 * The title screen: an asymmetric scenic vista anchoring the PRISMARA logo and
 * menu on the left, with the three starter creatures staged on a ledge at right.
 */

import Phaser from 'phaser';
import { SCENES } from './keys';
import { COLORS, DEPTHS, FONTS, VIEW_HEIGHT } from '../ui/Theme';
import { MenuList, type MenuItem } from '../ui/MenuList';
import { InputManager } from '../core/InputManager';
import { Audio } from '../audio/AudioManager';
import { hasAutosave, listSlots, loadAutosave, loadFromSlot } from '../core/SaveManager';
import { Game } from '../world/GameContext';
import { createScenicVista } from '../render/ScenicVista';
import { toast } from '../ui/Popups';
import { formatPlaytime } from '../core/Time';

const LOGO_X = 64;
const LOGO_Y = 120;
const MENU_X = 72;
const MENU_Y = 275;
const MENU_WIDTH = 320;
const MENU_ROW = 38;

const IVORY = '#f4efe2';
const BRASS = '#c9a227';
const NAVY = '#0b1020';

export class TitleScene extends Phaser.Scene {
  private controls!: InputManager;
  private menu!: MenuList;
  private choosingSlot = false;

  constructor() {
    super(SCENES.title);
  }

  create(): void {
    this.choosingSlot = false;
    this.controls = new InputManager(this);
    this.cameras.main.transparent = true;
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    this.registry.set('reducedEffects', Game.settings.reducedEffects);
    createScenicVista(this);

    this.buildLogo();
    this.buildMenu();

    Audio.playMusic('title');

    // Browsers block audio until a gesture: start the music on the first input.
    const kick = () => {
      Audio.unlock();
      Audio.playMusic('title');
    };
    this.input.keyboard?.once('keydown', kick);
    this.input.once('pointerdown', kick);

    this.cameras.main.fadeIn(500, 5, 7, 15);
  }

  private buildLogo(): void {
    this.add
      .text(LOGO_X, LOGO_Y, 'PRISMARA', {
        fontFamily: FONTS.body,
        fontSize: '58px',
        color: IVORY,
        fontStyle: 'bold',
        stroke: NAVY,
        strokeThickness: 8,
      })
      .setOrigin(0, 0)
      .setDepth(DEPTHS.ui);

    this.add
      .text(LOGO_X + 2, LOGO_Y + 78, 'THE LAST LIGHT', {
        fontFamily: FONTS.body,
        fontSize: '24px',
        color: BRASS,
        fontStyle: 'bold',
        stroke: NAVY,
        strokeThickness: 4,
      })
      .setOrigin(0, 0)
      .setDepth(DEPTHS.ui);

    this.add
      .text(LOGO_X + 2, LOGO_Y + 116, 'Six elements. One shattered sky. One last keeper.', {
        fontFamily: FONTS.body,
        fontSize: '13px',
        color: '#9fb0cc',
      })
      .setOrigin(0, 0)
      .setDepth(DEPTHS.ui);

    // A shine sweeping across the logo band on the left.
    const shine = this.add.graphics().setDepth(DEPTHS.ui + 1).setBlendMode(Phaser.BlendModes.ADD);
    const proxy = { x: 0 };
    this.tweens.add({
      targets: proxy,
      x: 320,
      duration: 2600,
      repeat: -1,
      repeatDelay: 1400,
      onUpdate: () => {
        shine.clear();
        const x = LOGO_X + proxy.x;
        const strength = Math.max(0, 1 - Math.abs(proxy.x - 160) / 200) * 0.12;
        for (let i = 0; i < 6; i++) {
          shine.fillStyle(0xffffff, strength * (1 - i / 6));
          shine.fillRect(x + i * 5, LOGO_Y - 4, 4, 66);
        }
      },
    });
  }

  private buildMenu(): void {
    this.menu = new MenuList(this, MENU_X, MENU_Y, {
      items: this.mainItems(),
      width: MENU_WIDTH,
      rowHeight: MENU_ROW,
      fontSize: 19,
      onSelect: (value) => this.choose(value),
      onHighlight: () => Audio.playSfx('cursor'),
    });
    this.menu.setDepth(DEPTHS.ui);
    this.menu.animateIn();

    this.add
      .text(MENU_X, VIEW_HEIGHT - 22, 'Arrows / WASD to move  ·  Z or Enter to confirm', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        color: '#6d7d99',
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.ui);
  }

  private mainItems(): MenuItem[] {
    return [
      { value: 'new', label: 'New Game' },
      {
        value: 'continue',
        label: 'Continue',
        disabled: !hasAutosave() && !listSlots().some((slot) => slot.exists),
      },
      { value: 'options', label: 'Settings' },
      { value: 'credits', label: 'Credits' },
    ];
  }

  private choose(value: string): void {
    // The single funnel for BOTH pointer clicks and keyboard confirms.
    if (value.startsWith('slot-')) {
      this.loadSlot(Number(value.slice('slot-'.length)));
      return;
    }
    if (value === 'auto') {
      this.loadAutosave();
      return;
    }

    Audio.playSfx('select');
    switch (value) {
      case 'new':
        this.scene.start(SCENES.intro);
        break;
      case 'continue':
        this.openSlotPicker();
        break;
      case 'options':
        this.scene.start(SCENES.settings, { returnTo: SCENES.title });
        break;
      case 'credits':
        this.scene.start(SCENES.credits);
        break;
      default:
        break;
    }
  }

  private openSlotPicker(): void {
    if (this.choosingSlot) return;
    this.choosingSlot = true;

    const items: MenuItem[] = [
      {
        value: 'auto',
        label: 'Autosave',
        sublabel: hasAutosave() ? 'Resume where you left off' : 'No autosave yet',
        disabled: !hasAutosave(),
      },
    ];

    for (const slot of listSlots()) {
      items.push({
        value: `slot-${slot.slot}`,
        label: `Slot ${slot.slot}`,
        sublabel: slot.exists
          ? `${slot.playerName} · ${formatPlaytime(slot.playtimeMinutes)}`
          : 'Empty',
        disabled: !slot.exists,
      });
    }

    this.menu.setItems(items);
    const first = items.findIndex((item) => !item.disabled);
    this.menu.setCursor(first >= 0 ? first : 0);
    toast(this, 'Choose a save to continue. Press X to go back.', COLORS.panelGlow);
  }

  private returnToMain(): void {
    this.choosingSlot = false;
    this.menu.setItems(this.mainItems());
    this.menu.setCursor(0);
  }

  private loadSlot(slot: number): void {
    const state = loadFromSlot(slot);
    if (!state) {
      toast(this, 'That slot is empty.', COLORS.danger);
      return;
    }
    Game.state = state;
    Game.slot = slot;
    Audio.playSfx('save');
    this.cameras.main.fadeOut(320, 5, 7, 15);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop(SCENES.title);
      this.scene.start(SCENES.overworld);
    });
  }

  private loadAutosave(): void {
    const state = loadAutosave();
    if (!state) {
      toast(this, 'No autosave found.', COLORS.danger);
      return;
    }
    Game.state = state;
    Audio.playSfx('save');
    this.cameras.main.fadeOut(320, 5, 7, 15);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop(SCENES.title);
      this.scene.start(SCENES.overworld);
    });
  }

  /** Exposed so the settings scene can return here without a fresh boot. */
  resumeFromSettings(): void {
    Audio.playMusic('title');
  }

  override update(time: number): void {
    this.controls.update();

    const vertical = this.controls.verticalNav(time);
    if (vertical !== 0) {
      this.menu.moveCursor(vertical);
      Audio.playSfx('cursor');
    }

    if (this.controls.justPressed('confirm')) {
      this.menu.confirm();
    }

    if (this.choosingSlot && this.controls.justPressed('cancel')) {
      Audio.playSfx('back');
      this.returnToMain();
    }
  }
}
