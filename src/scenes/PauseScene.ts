/**
 * The pause menu, launched as an overlay scene on top of the overworld:
 * Party, Bag, Prismadex, Storage, Map, Save and Settings.
 */

import Phaser from 'phaser';
import { SCENES } from './keys';
import { COLORS, DEPTHS, FONTS, VIEW_HEIGHT, VIEW_WIDTH } from '../ui/Theme';
import { InputManager } from '../core/InputManager';
import { MenuList, type MenuItem } from '../ui/MenuList';
import { Panel } from '../ui/Panel';
import { Audio } from '../audio/AudioManager';
import { Game } from '../world/GameContext';
import { toast } from '../ui/Popups';
import { clockLabel, formatPlaytime } from '../core/Time';
import { autosave, listSlots, saveToSlot } from '../core/SaveManager';
import { requireMap } from '../world/maps';
import { getSpecies } from '../data/creatures';

export class PauseScene extends Phaser.Scene {
  private controls!: InputManager;
  private menu!: MenuList;
  private infoText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private saving = false;

  constructor() {
    super(SCENES.pause);
  }

  create(): void {
    this.controls = new InputManager(this);
    this.saving = false;

    const dim = this.add.rectangle(0, 0, VIEW_WIDTH, VIEW_HEIGHT, 0x05070f, 0.6);
    dim.setOrigin(0, 0).setDepth(DEPTHS.ui);

    const panel = new Panel(this, VIEW_WIDTH / 2 - 210, VIEW_HEIGHT / 2, {
      width: 300,
      height: VIEW_HEIGHT - 100,
      glow: COLORS.panelGlow,
    });
    panel.setDepth(DEPTHS.ui + 1);

    const statPanel = new Panel(this, VIEW_WIDTH / 2 + 175, VIEW_HEIGHT / 2, {
      width: 330,
      height: VIEW_HEIGHT - 100,
      glow: COLORS.panelEdge,
    });
    statPanel.setDepth(DEPTHS.ui + 1);

    this.add
      .text(VIEW_WIDTH / 2 - 210, 78, 'PAUSE', {
        fontFamily: FONTS.body,
        fontSize: '20px',
        color: '#f2f6ff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.ui + 2);

    this.menu = new MenuList(this, VIEW_WIDTH / 2 - 340, 135, {
      items: this.mainItems(),
      width: 260,
      rowHeight: 34,
      fontSize: 16,
      onSelect: (value) => this.choose(value),
      onHighlight: () => Audio.playSfx('cursor'),
    });
    this.menu.setDepth(DEPTHS.ui + 2);

    this.infoText = this.add
      .text(VIEW_WIDTH / 2 + 30, 116, '', {
        fontFamily: FONTS.body,
        fontSize: '14px',
        color: '#dce6f7',
        lineSpacing: 8,
        wordWrap: { width: 290 },
      })
      .setDepth(DEPTHS.ui + 2);

    this.timeText = this.add
      .text(VIEW_WIDTH / 2 + 30, VIEW_HEIGHT - 96, '', {
        fontFamily: FONTS.body,
        fontSize: '13px',
        color: '#9fb0cc',
        lineSpacing: 6,
      })
      .setDepth(DEPTHS.ui + 2);

    this.refreshInfo();

    // Make sure the world underneath is frozen.
    if (this.scene.isActive(SCENES.overworld)) this.scene.pause(SCENES.overworld);
    this.scene.bringToTop(SCENES.pause);
  }

  private refreshInfo(): void {
    const state = Game.state;
    const map = requireMap(state.position.mapId);
    const sigils = state.sigils.length;

    this.infoText.setText(
      [
        `${state.playerName}`,
        `\u00a3${state.money.toLocaleString()}`,
        '',
        `Area: ${map.name}`,
        `Trophies: ${sigils} / 6`,
        `Caught: ${state.caughtCount()} / 40`,
        `Seen:   ${state.seenCount()} / 40`,
        '',
        `Starter: ${
          state.starterChosen ? getSpecies(state.starterChosen).name : 'none'
        }`,
      ].join('\n'),
    );

    this.timeText.setText(`Time ${clockLabel(state.clock)}  \u00b7  ${formatPlaytime(state.playtimeMinutes)}`);
  }

  private choose(value: string): void {
    if (this.saving) {
      this.chooseSlot(value);
      return;
    }
    switch (value) {
      case 'journal':
        Audio.playSfx('select');
        this.scene.start(SCENES.journal, { tab: 'journal', returnTo: SCENES.pause });
        break;
      case 'party':
        Audio.playSfx('select');
        this.scene.start(SCENES.party, { returnTo: SCENES.pause });
        break;
      case 'bag':
        Audio.playSfx('select');
        this.scene.start(SCENES.bag, { returnTo: SCENES.pause });
        break;
      case 'dex':
        Audio.playSfx('select');
        this.scene.start(SCENES.dex, { returnTo: SCENES.pause });
        break;
      case 'storage':
        Audio.playSfx('select');
        this.scene.start(SCENES.storage, { returnTo: SCENES.pause });
        break;
      case 'map':
        Audio.playSfx('blip');
        this.scene.start(SCENES.journal, { tab: 'map', returnTo: SCENES.pause });
        break;
      case 'save':
        this.openSaveSelector();
        break;
      case 'settings':
        Audio.playSfx('select');
        this.scene.start(SCENES.settings, { returnTo: SCENES.overworld });
        break;
      case 'close':
        this.close();
        break;
      default:
        break;
    }
  }

  private mainItems(): MenuItem[] {
    return [
      { value: 'journal', label: 'Journal & Trophies' },
      { value: 'party', label: 'Party', sublabel: `${Game.state.party.length}/6` },
      { value: 'bag', label: 'Bag' },
      {
        value: 'dex',
        label: 'Prismadex',
        sublabel: `${Game.state.caughtCount()}/40`,
      },
      { value: 'storage', label: 'Storage' },
      { value: 'map', label: 'Region Map' },
      { value: 'save', label: 'Save', sublabel: '3 slots + autosave' },
      { value: 'settings', label: 'Options' },
      { value: 'close', label: 'Close' },
    ];
  }

  private openSaveSelector(): void {
    this.saving = true;
    Audio.playSfx('select');
    const items: MenuItem[] = listSlots().map((meta) => ({
      value: `slot-${meta.slot}`,
      label: `Slot ${meta.slot}`,
      sublabel: meta.exists
        ? `${meta.playerName} \u00b7 ${meta.caught}/40 \u00b7 ${meta.sigils} trophies`
        : 'Empty',
      trailing: meta.exists ? formatPlaytime(meta.playtimeMinutes) : '',
    }));
    items.push({ value: 'back', label: 'Back' });
    this.menu.setItems(items);
    this.menu.setCursor(0);
  }

  private chooseSlot(value: string): void {
    if (value === 'back') {
      Audio.playSfx('back');
      this.saving = false;
      this.menu.setItems(this.mainItems());
      this.menu.setCursor(0);
      return;
    }
    const slot = Number(value.replace('slot-', ''));
    if (!Number.isFinite(slot) || slot < 1) return;
    const ok = saveToSlot(slot, Game.state);
    if (ok) {
      Game.slot = slot;
      autosave(Game.state);
      Audio.playSfx('save');
      toast(this, `Saved to slot ${slot} and autosaved.`, COLORS.hpHigh);
    } else {
      Audio.playSfx('denied');
      toast(this, 'Could not save: storage is full.', COLORS.danger);
    }
    this.saving = false;
    this.menu.setItems(this.mainItems());
    this.menu.setCursor(0);
    this.refreshInfo();
  }

  private close(): void {
    Audio.playSfx('back');
    this.scene.stop(SCENES.pause);
    this.scene.resume(SCENES.overworld);
  }

  override update(time: number): void {
    this.controls.update();

    const vertical = this.controls.verticalNav(time);
    if (vertical !== 0) {
      this.menu.moveCursor(vertical);
      Audio.playSfx('cursor');
    }
    if (this.controls.justPressed('confirm')) this.menu.confirm();
    if (this.controls.justPressed('cancel') && this.saving) {
      Audio.playSfx('back');
      this.saving = false;
      this.menu.setItems(this.mainItems());
      this.menu.setCursor(0);
      return;
    }
    if (this.controls.justPressed('cancel') || this.controls.justPressed('menu')) this.close();
  }
}
