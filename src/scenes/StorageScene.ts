/**
 * The Storage PC: eight boxes of thirty, with moving between the party and the
 * active box. Pressing B on a party creature with fewer than six members is the
 * standard way to shuffle the roster.
 */

import Phaser from 'phaser';
import { SCENES, type SceneKey } from './keys';
import { COLORS, DEPTHS, FONTS, VIEW_HEIGHT, VIEW_WIDTH } from '../ui/Theme';
import { InputManager } from '../core/InputManager';
import { Panel } from '../ui/Panel';
import { MenuList } from '../ui/MenuList';
import { Audio } from '../audio/AudioManager';
import { Game } from '../world/GameContext';
import { BOX_COUNT, BOX_SIZE, MAX_PARTY } from '../core/GameState';
import { displayName, maxHp, speciesOf, type CreatureInstance } from '../battle/Creature';
import { getSpecies } from '../data/creatures';
import { toast } from '../ui/Popups';
import { CreatureRig } from '../render/CreatureRig';

export class StorageScene extends Phaser.Scene {
  private controls!: InputManager;
  private returnTo: SceneKey = SCENES.pause;
  private boxIndex = 0;
  private partyList!: MenuList;
  private boxList!: MenuList;
  private header!: Phaser.GameObjects.Text;
  private detail!: Phaser.GameObjects.Container;
  private focus: 'party' | 'box' = 'party';

  constructor() {
    super(SCENES.storage);
  }

  init(data: { returnTo?: SceneKey }): void {
    this.returnTo = data?.returnTo ?? SCENES.pause;
  }

  create(): void {
    this.boxIndex = 0;
    this.focus = 'party';
    this.controls = new InputManager(this);
    this.cameras.main.setBackgroundColor('#05070f');
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x101a30, 0x101a30, 0x05070f, 0x05070f, 1);
    bg.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    this.add
      .text(48, 26, 'STORAGE', {
        fontFamily: FONTS.body,
        fontSize: '22px',
        color: '#f2f6ff',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.ui);

    this.header = this.add
      .text(VIEW_WIDTH - 48, 26, '', {
        fontFamily: FONTS.body,
        fontSize: '13px',
        color: '#9fb0cc',
      })
      .setOrigin(1, 0.5)
      .setDepth(DEPTHS.ui);

    new Panel(this, 200, 300, { width: 320, height: 400, glow: COLORS.panelEdge }).setDepth(DEPTHS.ui);
    new Panel(this, 560, 300, { width: 380, height: 400, glow: COLORS.panelGlow }).setDepth(DEPTHS.ui);
    new Panel(this, 830, 300, { width: 200, height: 400, glow: COLORS.panelEdge }).setDepth(DEPTHS.ui);

    this.partyList = new MenuList(this, 60, 116, {
      items: [],
      width: 300,
      rowHeight: 30,
      fontSize: 14,
      visibleRows: 10,
      onSelect: () => this.deposit(),
      onHighlight: () => this.drawDetail(),
    });
    this.partyList.setDepth(DEPTHS.ui + 1);

    this.boxList = new MenuList(this, 390, 116, {
      items: [],
      width: 360,
      rowHeight: 30,
      fontSize: 14,
      visibleRows: 10,
      onSelect: () => this.withdraw(),
      onHighlight: () => this.drawDetail(),
    });
    this.boxList.setDepth(DEPTHS.ui + 1);

    this.detail = this.add.container(0, 0).setDepth(DEPTHS.ui + 1);

    this.refresh();

    this.add
      .text(VIEW_WIDTH / 2, VIEW_HEIGHT - 20, '\u2191\u2193 move \u00b7 \u2190\u2192 switch side \u00b7 Z transfer \u00b7 Q/E change box \u00b7 X back', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        color: '#6d7d99',
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.overlay);
  }

  private refresh(): void {
    const party = Game.state.party;
    this.partyList.setItems(
      party.map((creature) => ({
        value: creature.uid,
        label: displayName(creature),
        sublabel: `Lv${creature.level} ${creature.currentHp}/${maxHp(creature)}`,
      })),
    );

    const box = Game.state.boxes[this.boxIndex] ?? [];
    const occupants = box
      .map((creature, index) => ({ creature, index }))
      .filter((entry) => entry.creature !== null);

    this.boxList.setItems(
      occupants.map((entry) => ({
        value: String(entry.index),
        label: displayName(entry.creature!),
        sublabel: `Lv${entry.creature!.level}`,
      })),
    );

    const used = box.filter((c) => c !== null).length;
    this.header.setText(`Box ${this.boxIndex + 1} / ${BOX_COUNT}   ${used}/${BOX_SIZE}`);
    this.drawDetail();
  }

  private drawDetail(): void {
    this.detail.removeAll(true);
    const creature =
      this.focus === 'party'
        ? Game.state.party[this.partyList.selectedIndex]
        : this.currentBoxCreature();

    if (!creature) {
      const empty = this.add
        .text(830, 300, 'No\ncreature', {
          fontFamily: FONTS.body,
          fontSize: '13px',
          color: '#5c6b85',
          align: 'center',
        })
        .setOrigin(0.5);
      this.detail.add(empty);
      return;
    }

    const rig = new CreatureRig(this, creature.speciesId, { shiny: creature.shiny, scale: 0.48 });
    rig.setPosition(830, 250);
    this.detail.add(rig);

    const species = getSpecies(creature.speciesId);
    const text = this.add
      .text(830, 330, `${species.name}\nLv ${creature.level}\n${species.element}`, {
        fontFamily: FONTS.body,
        fontSize: '12px',
        color: '#dce6f7',
        align: 'center',
        lineSpacing: 4,
      })
      .setOrigin(0.5, 0);
    this.detail.add(text);
  }

  private currentBoxCreature(): CreatureInstance | null {
    const index = Number(this.boxList.selectedValue);
    if (Number.isNaN(index)) return null;
    return Game.state.boxes[this.boxIndex]?.[index] ?? null;
  }

  private deposit(): void {
    const party = Game.state.party;
    const creature = party[this.partyList.selectedIndex];
    if (!creature) return;
    const livingInParty = party.filter((c) => c.currentHp > 0).length;
    if (party.length <= 1 || (creature.currentHp > 0 && livingInParty <= 1)) {
      Audio.playSfx('denied');
      toast(this, 'You must keep at least one able-bodied creature.', COLORS.danger);
      return;
    }
    const slot = Game.state.boxes[this.boxIndex].findIndex((c) => c === null);
    if (slot < 0) {
      Audio.playSfx('denied');
      toast(this, 'This box is full.', COLORS.danger);
      return;
    }
    Game.state.boxes[this.boxIndex][slot] = creature;
    party.splice(this.partyList.selectedIndex, 1);
    Audio.playSfx('select');
    this.refresh();
  }

  private withdraw(): void {
    if (Game.state.party.length >= MAX_PARTY) {
      Audio.playSfx('denied');
      toast(this, 'Your party is full.', COLORS.danger);
      return;
    }
    const index = Number(this.boxList.selectedValue);
    const creature = Game.state.boxes[this.boxIndex]?.[index];
    if (!creature) return;
    Game.state.boxes[this.boxIndex][index] = null;
    Game.state.party.push(creature);
    Audio.playSfx('select');
    this.refresh();
  }

  private goBack(): void {
    Audio.playSfx('back');
    const target = this.returnTo;
    if (this.scene.isPaused(target) || this.scene.isSleeping(target)) {
      this.scene.stop(SCENES.storage);
      this.scene.resume(target);
      return;
    }
    this.scene.start(target);
  }

  override update(time: number): void {
    this.controls.update();

    const v = this.controls.verticalNav(time, 300, 90);
    if (v !== 0) {
      if (this.focus === 'party') this.partyList.moveCursor(v);
      else this.boxList.moveCursor(v);
      Audio.playSfx('cursor');
    }

    const h = this.controls.horizontalNav(time, 320, 200);
    if (h !== 0) {
      this.focus = this.focus === 'party' ? 'box' : 'party';
      Audio.playSfx('cursor');
      this.drawDetail();
    }

    if (this.controls.justPressed('page-left')) {
      this.boxIndex = (this.boxIndex - 1 + BOX_COUNT) % BOX_COUNT;
      Audio.playSfx('cursor');
      this.refresh();
    }
    if (this.controls.justPressed('page-right')) {
      this.boxIndex = (this.boxIndex + 1) % BOX_COUNT;
      Audio.playSfx('cursor');
      this.refresh();
    }

    if (this.controls.justPressed('confirm')) {
      if (this.focus === 'party') this.partyList.confirm();
      else this.boxList.confirm();
    }
    if (this.controls.justPressed('cancel')) this.goBack();
    void speciesOf;
  }
}
