/**
 * The party screen: six slots with HP bars and status, a summary panel with a
 * stat radar, drag-free reordering, and item use.
 */

import Phaser from 'phaser';
import { SCENES, type SceneKey } from './keys';
import { COLORS, DEPTHS, FONTS, VIEW_HEIGHT, VIEW_WIDTH, statusColor } from '../ui/Theme';
import { InputManager } from '../core/InputManager';
import { Panel } from '../ui/Panel';
import { HPBar } from '../ui/HPBar';
import { TypeBadge } from '../ui/TypeBadge';
import { MenuList } from '../ui/MenuList';
import { Audio } from '../audio/AudioManager';
import { Game } from '../world/GameContext';
import {
  displayName,
  expProgress,
  maxHp,
  rawStat,
  speciesOf,
  hpFraction,
} from '../battle/Creature';
import { STATUS_INFO } from '../data/battleTypes';
import { STAT_SHORT } from '../battle/stats';
import { CreatureRig } from '../render/CreatureRig';
import { toast } from '../ui/Popups';
import { ITEMS, type ItemId } from '../data/items';
import { fullHealCreature, heal, restorePp, type CreatureInstance } from '../battle/Creature';

/** Restore PP across every move, up to `amount` each. Returns true if any PP was restored. */
function restoreMovePp(creature: CreatureInstance, amount: number | 'full'): boolean {
  let restored = false;
  for (const move of creature.moves) {
    if (move.pp >= move.maxPp) continue;
    const gain = amount === 'full' ? move.maxPp - move.pp : Math.min(amount, move.maxPp - move.pp);
    if (gain > 0) {
      move.pp += gain;
      restored = true;
    }
  }
  return restored;
}

export class PartyScene extends Phaser.Scene {
  private controls!: InputManager;
  private returnTo: SceneKey = SCENES.pause;
  private cursor = 0;
  private slots: Array<{
    hp: HPBar;
    name: Phaser.GameObjects.Text;
    level: Phaser.GameObjects.Text;
    status: Phaser.GameObjects.Text;
    badge: TypeBadge | null;
    panel: Phaser.GameObjects.Graphics;
  }> = [];
  private detail!: Phaser.GameObjects.Container;
  private submenu: MenuList | null = null;
  private mode: 'list' | 'submenu' | 'item' = 'list';
  private itemMenu: MenuList | null = null;

  constructor() {
    super(SCENES.party);
  }

  init(data: { returnTo?: SceneKey }): void {
    this.returnTo = data?.returnTo ?? SCENES.pause;
  }

  create(): void {
    this.mode = 'list';
    this.cursor = 0;
    this.submenu = null;
    this.itemMenu = null;
    this.slots.length = 0;
    this.controls = new InputManager(this);
    this.cameras.main.setBackgroundColor('#05070f');
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x101a30, 0x101a30, 0x05070f, 0x05070f, 1);
    bg.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    this.add
      .text(48, 28, 'PARTY', {
        fontFamily: FONTS.body,
        fontSize: '24px',
        color: '#f2f6ff',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.ui);

    this.buildSlots();
    this.detail = this.add.container(0, 0).setDepth(DEPTHS.ui + 2);
    this.refresh();

    this.add
      .text(VIEW_WIDTH / 2, VIEW_HEIGHT - 22, 'Z select \u00b7 X back \u00b7 \u2190 \u2192 move slot', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        color: '#6d7d99',
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.overlay);
  }

  private buildSlots(): void {
    const startY = 76;
    const spacing = 62;

    for (let i = 0; i < 6; i++) {
      const y = startY + i * spacing;
      const panelBg = this.add.graphics();
      panelBg.fillStyle(COLORS.panel, 0.85);
      panelBg.fillRoundedRect(40, y - 24, 420, 52, 10);
      panelBg.setDepth(DEPTHS.ui);
      this.add.existing(panelBg);

      const name = this.add
        .text(66, y - 8, '', {
          fontFamily: FONTS.body,
          fontSize: '16px',
          color: '#f2f6ff',
        })
        .setOrigin(0, 0.5)
        .setDepth(DEPTHS.ui + 1);

      const level = this.add
        .text(430, y - 8, '', {
          fontFamily: FONTS.body,
          fontSize: '13px',
          color: '#ffd60a',
        })
        .setOrigin(1, 0.5)
        .setDepth(DEPTHS.ui + 1);

      const hp = new HPBar(this, 200, y + 10, { width: 240, height: 7, showNumbers: true });
      hp.setDepth(DEPTHS.ui + 1);

      const status = this.add
        .text(66, y + 10, '', {
          fontFamily: FONTS.body,
          fontSize: '11px',
          color: '#9fb0cc',
        })
        .setOrigin(0, 0.5)
        .setDepth(DEPTHS.ui + 1);

      this.slots.push({ hp, name, level, status, badge: null, panel: panelBg });
    }
  }

  private refresh(): void {
    const party = Game.state.party;

    this.slots.forEach((slot, index) => {
      const creature = party[index];
      const selected = index === this.cursor;
      slot.panel.clear();
      if (!creature) {
        slot.name.setText('  \u2014 empty \u2014');
        slot.level.setText('');
        slot.status.setText('');
        slot.hp.set(0, 1, false);
        slot.hp.setVisible(false);
        slot.badge?.destroy();
        slot.badge = null;
        if (selected) {
          slot.panel.lineStyle(2, COLORS.cursor, 0.9);
          slot.panel.strokeRoundedRect(40, 76 - 24 + index * 62, 420, 52, 10);
        }
        return;
      }
      if (selected) {
        slot.panel.lineStyle(2, COLORS.cursor, 0.9);
        slot.panel.strokeRoundedRect(40, 76 - 24 + index * 62, 420, 52, 10);
      }
      slot.panel.fillStyle(selected ? COLORS.panelEdge : COLORS.panel, 0.85);
      slot.panel.fillRoundedRect(40, 76 - 24 + index * 62, 420, 52, 10);

      slot.name.setText(displayName(creature));
      slot.level.setText(`Lv ${creature.level}`);
      slot.hp.setVisible(true);
      slot.hp.set(creature.currentHp, maxHp(creature), false);
      const status = creature.status;
      slot.status.setText(status ? STATUS_INFO[status].name.toUpperCase() : '');
      slot.status.setColor(status ? `#${statusColor(status).toString(16).padStart(6, '0')}` : '#9fb0cc');

      if (!slot.badge) {
        slot.badge = new TypeBadge(this, 500, 76 + index * 62 - 8, speciesOf(creature).element, false);
        this.add.existing(slot.badge);
        slot.badge.setDepth(DEPTHS.ui + 1);
      }
    });

    this.drawDetail();
  }

  private drawDetail(): void {
    this.detail.removeAll(true);
    const creature = Game.state.party[this.cursor];
    if (!creature) return;

    const panel = new Panel(this, 700, 260, { width: 460, height: 420, glow: COLORS.panelGlow });
    this.detail.add(panel);

    const species = speciesOf(creature);
    const rig = new CreatureRig(this, creature.speciesId, {
      shiny: creature.shiny,
      scale: 0.65,
      facing: -1,
    });
    rig.setPosition(560, 210);
    this.detail.add(rig);

    const title = this.add
      .text(660, 76, `${displayName(creature)}`, {
        fontFamily: FONTS.body,
        fontSize: '22px',
        color: '#f2f6ff',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);
    this.detail.add(title);

    const meta = this.add
      .text(660, 100, `#${String(species.dexNumber).padStart(3, '0')}  ${species.element.toUpperCase()}  \u00b7  ${species.role}`, {
        fontFamily: FONTS.body,
        fontSize: '12px',
        color: '#9fb0cc',
      })
      .setOrigin(0, 0.5);
    this.detail.add(meta);

    const badge = new TypeBadge(this, 850, 76, species.element);
    this.detail.add(badge);

    // Stats.
    const stats = ['attack', 'defense', 'spPower', 'spGuard', 'speed'] as const;
    const lines = stats.map((stat) => {
      const value = rawStat(creature, stat);
      const bar = Math.min(30, Math.round(value / 6));
      return `${STAT_SHORT[stat].padEnd(4)} ${'\u2588'.repeat(bar)}${'\u2591'.repeat(Math.max(0, 12 - bar))} ${value}`;
    });

    const statText = this.add
      .text(560, 300, lines.join('\n'), {
        fontFamily: FONTS.body,
        fontSize: '13px',
        color: '#dce6f7',
        lineSpacing: 6,
      })
      .setOrigin(0, 0);
    this.detail.add(statText);

    const hpLine = this.add
      .text(
        560,
        420,
        `HP ${creature.currentHp}/${maxHp(creature)}   EXP ${Math.round(expProgress(creature) * 100)}%\n` +
          `Ability: ${species.ability.replace(/-/g, ' ')}\n` +
          `Friendship: ${creature.friendship}`,
        {
          fontFamily: FONTS.body,
          fontSize: '13px',
          color: '#9fb0cc',
          lineSpacing: 6,
        },
      )
      .setOrigin(0, 0);
    this.detail.add(hpLine);

    const moves = creature.moves
      .map((slot) => `${slot.id.replace(/-/g, ' ')}  ${slot.pp}/${slot.maxPp}`)
      .join('\n');
    const moveText = this.add
      .text(760, 300, moves, {
        fontFamily: FONTS.body,
        fontSize: '13px',
        color: '#dce6f7',
        align: 'left',
        wordWrap: { width: 150 },
        lineSpacing: 8,
      })
      .setOrigin(0, 0);
    this.detail.add(moveText);
  }

  private openSubmenu(): void {
    const creature = Game.state.party[this.cursor];
    if (!creature) return;
    this.mode = 'submenu';
    Audio.playSfx('select');

    this.submenu = new MenuList(this, 500, 120, {
      items: [
        { value: 'summary', label: 'Summary' },
        { value: 'heal', label: 'Use item' },
        { value: 'move-up', label: 'Move up' },
        { value: 'move-down', label: 'Move down' },
        { value: 'cancel', label: 'Cancel' },
      ],
      width: 200,
      rowHeight: 30,
      fontSize: 15,
      wrap: false,
      onSelect: (value) => this.applySubmenu(value),
      onCancel: () => this.closeSubmenu(),
    });
    this.submenu.setDepth(DEPTHS.overlay);
  }

  private closeSubmenu(): void {
    this.submenu?.destroy();
    this.submenu = null;
    this.itemMenu?.destroy();
    this.itemMenu = null;
    this.mode = 'list';
    Audio.playSfx('back');
  }

  private applySubmenu(value: string): void {
    const party = Game.state.party;
    if (value === 'move-up' && this.cursor > 0) {
      party[this.cursor - 1] = party.splice(this.cursor, 1, party[this.cursor - 1])[0];
      this.closeSubmenu();
      Audio.playSfx('cursor');
      this.refresh();
      return;
    }
    if (value === 'move-down' && this.cursor < party.length - 1) {
      const temp = party[this.cursor];
      party[this.cursor] = party[this.cursor + 1];
      party[this.cursor + 1] = temp;
      this.closeSubmenu();
      Audio.playSfx('cursor');
      this.refresh();
      return;
    }
    if (value === 'heal') {
      this.openItemMenu();
      return;
    }
    if (value === 'summary') {
      toast(this, 'Summary pages use the panel on the right.', COLORS.panelGlow);
      this.closeSubmenu();
      return;
    }
    this.closeSubmenu();
  }

  private openItemMenu(): void {
    const entries = Game.state
      .bagEntries()
      .filter((entry) => ITEMS[entry.id].usableInField && ITEMS[entry.id].pocket === 'healing');
    if (entries.length === 0) {
      toast(this, 'No usable healing items.', COLORS.danger);
      this.closeSubmenu();
      return;
    }
    this.mode = 'item';
    this.itemMenu?.destroy();
    this.itemMenu = new MenuList(this, 460, 120, {
      items: entries.map((entry) => ({
        value: entry.id,
        label: ITEMS[entry.id].name,
        trailing: `x${entry.count}`,
      })),
      width: 240,
      rowHeight: 26,
      fontSize: 14,
      visibleRows: 8,
      onSelect: (value) => this.useItem(value as ItemId),
      onCancel: () => this.closeSubmenu(),
    });
    this.itemMenu.setDepth(DEPTHS.overlay);
  }

  private useItem(id: ItemId): void {
    const creature = Game.state.party[this.cursor];
    if (!creature) return;
    const item = ITEMS[id];
    let used = false;

    switch (item.effect.kind) {
      case 'heal-hp': {
        if (creature.currentHp <= 0) break;
        const amount = item.effect.amount === 'full' ? maxHp(creature) : Number(item.effect.amount);
        used = heal(creature, amount) > 0;
        break;
      }
      case 'heal-fraction':
        if (creature.currentHp <= 0) break;
        used = heal(creature, Math.floor(maxHp(creature) * item.effect.fraction)) > 0;
        break;
      case 'revive':
        if (creature.currentHp <= 0) {
          creature.currentHp = Math.max(1, Math.floor(maxHp(creature) * item.effect.fraction));
          used = true;
        }
        break;
      case 'cure-status': {
        const statuses = item.effect.statuses;
        if (creature.status && (statuses === 'all' || statuses.includes(creature.status))) {
          creature.status = null;
          creature.statusTurns = 0;
          used = true;
        }
        break;
      }
      case 'restore-pp':
        used = restoreMovePp(creature, item.effect.amount);
        break;
      default:
        break;
    }

    if (!used) {
      Audio.playSfx('denied');
      toast(this, 'It would have no effect.', COLORS.danger);
      return;
    }

    Game.state.removeItem(id, 1);
    Audio.playSfx('heal');
    toast(this, `Used ${item.name} on ${displayName(creature)}.`, COLORS.hpHigh);
    this.closeSubmenu();
    this.refresh();
  }

  /** Used by the overworld to fully restore the party. */
  static healAll(): void {
    for (const creature of Game.state.party) {
      fullHealCreature(creature);
      restorePp(creature);
    }
  }

  private goBack(): void {
    Audio.playSfx('back');
    const target = this.returnTo;
    if (this.scene.isPaused(target) || this.scene.isSleeping(target)) {
      this.scene.stop(SCENES.party);
      this.scene.resume(target);
      return;
    }
    this.scene.start(target);
  }

  override update(time: number): void {
    this.controls.update();

    if (this.mode === 'submenu' && this.submenu) {
      const v = this.controls.verticalNav(time);
      if (v !== 0) {
        this.submenu.moveCursor(v);
        Audio.playSfx('cursor');
      }
      if (this.controls.justPressed('confirm')) this.submenu.confirm();
      if (this.controls.justPressed('cancel')) this.closeSubmenu();
      return;
    }

    if (this.mode === 'item' && this.itemMenu) {
      const v = this.controls.verticalNav(time);
      if (v !== 0) {
        this.itemMenu.moveCursor(v);
        Audio.playSfx('cursor');
      }
      if (this.controls.justPressed('confirm')) this.itemMenu.confirm();
      if (this.controls.justPressed('cancel')) this.closeSubmenu();
      return;
    }

    const v = this.controls.verticalNav(time);
    if (v !== 0) {
      const max = Math.max(0, Game.state.party.length - 1);
      this.cursor = Phaser.Math.Clamp(this.cursor + v, 0, max);
      Audio.playSfx('cursor');
      this.refresh();
    }

    if (this.controls.justPressed('confirm')) {
      if (Game.state.party.length === 0) return;
      this.openSubmenu();
    }
    if (this.controls.justPressed('cancel')) this.goBack();
    void hpFraction;
  }
}
