/**
 * The Bag: four pockets (Healing, Orbs, Battle, Key Items) with field use of
 * healing items and PP restores.
 */

import Phaser from 'phaser';
import { SCENES, type SceneKey } from './keys';
import { COLORS, DEPTHS, FONTS, VIEW_HEIGHT, VIEW_WIDTH } from '../ui/Theme';
import { InputManager } from '../core/InputManager';
import { Panel } from '../ui/Panel';
import { MenuList, type MenuItem } from '../ui/MenuList';
import { Audio } from '../audio/AudioManager';
import { Game } from '../world/GameContext';
import { ITEMS, type ItemId, type ItemPocket } from '../data/items';
import { toast } from '../ui/Popups';
import { displayName, heal, maxHp, type CreatureInstance } from '../battle/Creature';
import { createItemIcon } from '../render/ItemIcon';

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

const POCKETS: Array<{ id: ItemPocket; label: string; glyph: string }> = [
  { id: 'healing', label: 'Healing', glyph: '\u2764' },
  { id: 'orbs', label: 'Orbs', glyph: '\u25cf' },
  { id: 'battle', label: 'Battle items', glyph: '\u2694' },
  { id: 'key', label: 'Key items', glyph: '\u2605' },
];

export class BagScene extends Phaser.Scene {
  private controls!: InputManager;
  private returnTo: SceneKey = SCENES.pause;
  private pocketIndex = 0;
  private pocketList!: MenuList;
  private itemList!: MenuList;
  private detail!: Phaser.GameObjects.Text;
  private mode: 'browse' | 'target' = 'browse';
  private targetList: MenuList | null = null;
  private pendingItem: ItemId | null = null;
  private itemIcon: Phaser.GameObjects.Container | null = null;
  private captureLabel!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENES.bag);
  }

  init(data: { returnTo?: SceneKey }): void {
    this.returnTo = data?.returnTo ?? SCENES.pause;
  }

  create(): void {
    this.mode = 'browse';
    this.pocketIndex = 0;
    this.targetList = null;
    this.pendingItem = null;
    this.itemIcon = null;
    this.controls = new InputManager(this);
    this.cameras.main.setBackgroundColor('#05070f');
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x101a30, 0x101a30, 0x05070f, 0x05070f, 1);
    bg.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    this.add
      .text(48, 28, 'BAG', {
        fontFamily: FONTS.body,
        fontSize: '24px',
        color: '#f2f6ff',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.ui);

    new Panel(this, 190, 300, { width: 260, height: 400, glow: COLORS.panelEdge }).setDepth(DEPTHS.ui);
    new Panel(this, 560, 300, { width: 440, height: 400, glow: COLORS.panelGlow }).setDepth(DEPTHS.ui);
    new Panel(this, 860, 300, { width: 160, height: 400, glow: COLORS.panelEdge }).setDepth(DEPTHS.ui);

    this.pocketList = new MenuList(this, 76, 116, {
      items: POCKETS.map((pocket) => ({
        value: pocket.id,
        label: pocket.label,
        icon: pocket.glyph,
        trailing: `${Game.state.bagEntries().filter((entry) => ITEMS[entry.id].pocket === pocket.id).length}`,
      })),
      width: 230,
      rowHeight: 34,
      fontSize: 15,
      wrap: false,
      onSelect: (value) => {
        this.pocketIndex = POCKETS.findIndex((p) => p.id === value);
        Audio.playSfx('select');
        this.refreshItems();
      },
      onHighlight: (value) => {
        this.pocketIndex = POCKETS.findIndex((p) => p.id === value);
        this.refreshItems();
      },
    });
    this.pocketList.setDepth(DEPTHS.ui + 1);

    this.itemList = new MenuList(this, 350, 116, {
      items: [],
      width: 400,
      rowHeight: 32,
      fontSize: 15,
      visibleRows: 9,
      onSelect: (value) => this.useItem(value as ItemId),
      onHighlight: (value) => this.showDetail(value as ItemId),
    });
    this.itemList.setDepth(DEPTHS.ui + 1);

    this.detail = this.add
      .text(800, 172, '', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        color: '#bfb7a2',
        wordWrap: { width: 120 },
        lineSpacing: 6,
      })
      .setDepth(DEPTHS.ui + 1);

    this.captureLabel = this.add
      .text(860, 150, '', {
        fontFamily: FONTS.body,
        fontSize: '9px',
        color: '#d4af37',
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.ui + 1);

    this.refreshItems();

    this.add
      .text(VIEW_WIDTH / 2, VIEW_HEIGHT - 22, 'Z use \u00b7 X back \u00b7 \u2190 \u2192 change pocket', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        color: '#6d7d99',
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.overlay);
  }

  private refreshItems(): void {
    const pocket = POCKETS[this.pocketIndex].id;
    const entries = Game.state.bagEntries().filter((entry) => ITEMS[entry.id].pocket === pocket);
    const items: MenuItem[] = entries.map((entry) => ({
      value: entry.id,
      label: ITEMS[entry.id].name,
      trailing: `x${entry.count}`,
      color: ITEMS[entry.id].effect.kind === 'orb' ? 0x7fffe5 : undefined,
    }));
    this.itemList.setItems(items);
    if (items.length > 0) this.showDetail(items[0].value as ItemId);
    else {
      this.detail.setText('Nothing here yet.');
      this.itemIcon?.destroy();
      this.itemIcon = null;
      this.captureLabel.setText('');
    }
  }

  private showDetail(id: ItemId): void {
    const item = ITEMS[id];
    if (!item) return;
    this.itemIcon?.destroy();
    this.itemIcon = createItemIcon(this, id, 860, 122, 1).setDepth(DEPTHS.ui + 1);
    this.captureLabel.setText(item.effect.kind === 'orb' ? 'CAPTURE GEAR' : '');
    const price = item.price > 0 ? `\u00a3${item.price}` : '\u2014';
    this.detail.setText(`${item.name}\n\n${item.description}\n\n${price}`);
  }

  private useItem(id: ItemId): void {
    const item = ITEMS[id];
    if (!item) return;

    if (!item.usableInField) {
      Audio.playSfx('denied');
      toast(this, `${item.name} can\u2019t be used here.`, COLORS.danger);
      return;
    }

    if (item.effect.kind === 'quality-of-life') {
      toast(this, `${item.name} can only be used at a cave entrance.`, COLORS.textDim);
      return;
    }

    if (Game.state.party.length === 0) {
      toast(this, 'You have no creatures.', COLORS.danger);
      return;
    }

    this.pendingItem = id;
    this.mode = 'target';
    Audio.playSfx('select');

    this.targetList = new MenuList(this, 560, 116, {
      items: Game.state.party.map((creature) => ({
        value: creature.uid,
        label: displayName(creature),
        sublabel: `${creature.currentHp}/${maxHp(creature)}`,
      })),
      width: 340,
      rowHeight: 30,
      fontSize: 15,
      wrap: false,
      onSelect: (uid) => this.applyToTarget(uid),
      onCancel: () => this.closeTargets(),
    });
    this.targetList.setDepth(DEPTHS.overlay);
  }

  private closeTargets(): void {
    this.targetList?.destroy();
    this.targetList = null;
    this.pendingItem = null;
    this.mode = 'browse';
    Audio.playSfx('back');
  }

  private applyToTarget(uid: string): void {
    const item = this.pendingItem ? ITEMS[this.pendingItem] : null;
    const creature = Game.state.party.find((c) => c.uid === uid);
    if (!item || !creature) return this.closeTargets();

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
      return this.closeTargets();
    }

    Game.state.removeItem(item.id, 1);
    Audio.playSfx('heal');
    toast(this, `Used ${item.name} on ${displayName(creature)}.`, COLORS.hpHigh);
    this.closeTargets();
    this.refreshItems();
  }

  private goBack(): void {
    Audio.playSfx('back');
    const target = this.returnTo;
    if (this.scene.isPaused(target) || this.scene.isSleeping(target)) {
      this.scene.stop(SCENES.bag);
      this.scene.resume(target);
      return;
    }
    this.scene.start(target);
  }

  override update(time: number): void {
    this.controls.update();

    if (this.mode === 'target' && this.targetList) {
      const v = this.controls.verticalNav(time);
      if (v !== 0) {
        this.targetList.moveCursor(v);
        Audio.playSfx('cursor');
      }
      if (this.controls.justPressed('confirm')) this.targetList.confirm();
      if (this.controls.justPressed('cancel')) this.closeTargets();
      return;
    }

    const v = this.controls.verticalNav(time);
    if (v !== 0) {
      this.itemList.moveCursor(v);
      Audio.playSfx('cursor');
    }
    const h = this.controls.horizontalNav(time);
    if (h !== 0) {
      this.pocketIndex = (this.pocketIndex + h + POCKETS.length) % POCKETS.length;
      this.pocketList.setCursor(this.pocketIndex);
      Audio.playSfx('cursor');
      this.refreshItems();
    }

    if (this.controls.justPressed('confirm')) this.itemList.confirm();
    if (this.controls.justPressed('cancel')) this.goBack();
  }
}
