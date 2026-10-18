/**
 * A shop counter: buy stock, sell what is in the bag, and watch the purse.
 */

import Phaser from 'phaser';
import { SCENES } from './keys';
import { COLORS, DEPTHS, FONTS, VIEW_HEIGHT, VIEW_WIDTH } from '../ui/Theme';
import { InputManager } from '../core/InputManager';
import { Panel } from '../ui/Panel';
import { MenuList } from '../ui/MenuList';
import { Audio } from '../audio/AudioManager';
import { Game } from '../world/GameContext';
import { ITEMS, SHOP_STOCK, type ItemId } from '../data/items';
import { toast } from '../ui/Popups';

type Mode = 'menu' | 'buy' | 'sell' | 'quantity';

export class ShopScene extends Phaser.Scene {
  private controls!: InputManager;
  private mode: Mode = 'menu';
  private menu!: MenuList;
  private stockList!: MenuList;
  private sellList!: MenuList;
  private quantityList!: MenuList;
  private header!: Phaser.GameObjects.Text;
  private detail!: Phaser.GameObjects.Text;
  private pendingItem: ItemId | null = null;

  constructor() {
    super(SCENES.shop);
  }

  create(): void {
    this.mode = 'menu';
    this.pendingItem = null;
    this.controls = new InputManager(this);
    this.cameras.main.setBackgroundColor('#05070f');
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x101a30, 0x101a30, 0x05070f, 0x05070f, 1);
    bg.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    this.add
      .text(48, 26, 'MART', {
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
        fontSize: '14px',
        color: '#ffd60a',
      })
      .setOrigin(1, 0.5)
      .setDepth(DEPTHS.ui);

    new Panel(this, 480, 310, { width: 620, height: 400, glow: COLORS.panelGlow }).setDepth(DEPTHS.ui);
    new Panel(this, 830, 310, { width: 220, height: 400, glow: COLORS.panelEdge }).setDepth(DEPTHS.ui);

    this.menu = new MenuList(this, 220, 150, {
      items: [
        { value: 'buy', label: 'Buy' },
        { value: 'sell', label: 'Sell' },
        { value: 'exit', label: 'Leave' },
      ],
      width: 220,
      rowHeight: 34,
      fontSize: 16,
      wrap: false,
      onSelect: (value) => this.choose(value),
    });
    this.menu.setDepth(DEPTHS.overlay);

    this.stockList = new MenuList(this, 260, 140, {
      items: [],
      width: 560,
      rowHeight: 28,
      fontSize: 15,
      visibleRows: 10,
      onSelect: (value) => this.beginBuy(value as ItemId),
      onHighlight: (value) => this.showDetail(value as ItemId),
    });
    this.stockList.setDepth(DEPTHS.overlay);
    this.stockList.setVisible(false);

    this.sellList = new MenuList(this, 260, 140, {
      items: [],
      width: 560,
      rowHeight: 28,
      fontSize: 15,
      visibleRows: 10,
      onSelect: (value) => this.sell(value as ItemId, 1),
      onHighlight: (value) => this.showDetail(value as ItemId),
    });
    this.sellList.setDepth(DEPTHS.overlay);
    this.sellList.setVisible(false);

    this.quantityList = new MenuList(this, 620, 220, {
      items: [1, 5, 10].map((n) => ({ value: String(n), label: `x${n}` })),
      width: 140,
      rowHeight: 32,
      fontSize: 16,
      wrap: false,
      onSelect: (value) => this.buy(this.pendingItem!, Number(value)),
    });
    this.quantityList.setDepth(DEPTHS.overlay + 1);
    this.quantityList.setVisible(false);

    this.detail = this.add
      .text(760, 150, '', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        color: '#9fb0cc',
        wordWrap: { width: 190 },
        lineSpacing: 6,
      })
      .setDepth(DEPTHS.overlay);

    this.refreshHeader();
    Audio.playMusic('city');
  }

  private refreshHeader(): void {
    this.header.setText(`\u00a3${Game.state.money.toLocaleString()}`);
  }

  private choose(value: string): void {
    Audio.playSfx('select');
    if (value === 'buy') {
      this.mode = 'buy';
      this.menu.setVisible(false);
      this.stockList.setItems(
        SHOP_STOCK.map((id) => ({
          value: id,
          label: ITEMS[id].name,
          trailing: `\u00a3${ITEMS[id].price}`,
        })),
      );
      this.stockList.setVisible(true);
      this.showDetail(SHOP_STOCK[0]);
    } else if (value === 'sell') {
      const entries = Game.state.bagEntries().filter((entry) => ITEMS[entry.id].price > 0);
      if (entries.length === 0) {
        Audio.playSfx('denied');
        toast(this, 'You have nothing to sell.', COLORS.danger);
        return;
      }
      this.mode = 'sell';
      this.menu.setVisible(false);
      this.sellList.setItems(
        entries.map((entry) => ({
          value: entry.id,
          label: ITEMS[entry.id].name,
          trailing: `x${entry.count} \u00a3${Math.floor(ITEMS[entry.id].price / 2)}`,
        })),
      );
      this.sellList.setVisible(true);
      this.showDetail(entries[0].id);
    } else {
      this.leave();
    }
  }

  private showDetail(id: ItemId): void {
    const item = ITEMS[id];
    if (!item) return;
    this.detail.setText(`${item.name}\n\n${item.description}\n\nPrice \u00a3${item.price}`);
  }

  private beginBuy(id: ItemId): void {
    this.pendingItem = id;
    this.mode = 'quantity';
    Audio.playSfx('select');
    this.quantityList.setVisible(true);
    this.quantityList.setCursor(0);
  }

  private buy(id: ItemId, count: number): void {
    const item = ITEMS[id];
    const cost = item.price * count;
    if (count <= 0) return this.closeQuantity();
    if (!Game.state.spendMoney(cost)) {
      Audio.playSfx('denied');
      toast(this, 'Not enough money.', COLORS.danger);
      return this.closeQuantity();
    }
    Game.state.addItem(id, count);
    Audio.playSfx('money');
    toast(this, `Bought ${count}x ${item.name}.`, COLORS.gold);
    this.closeQuantity();
    this.refreshHeader();
  }

  private sell(id: ItemId, count: number): void {
    const item = ITEMS[id];
    if (!Game.state.removeItem(id, count)) {
      Audio.playSfx('denied');
      return;
    }
    const value = Math.floor(item.price / 2) * count;
    Game.state.addMoney(value);
    Audio.playSfx('money');
    toast(this, `Sold ${count}x ${item.name} for \u00a3${value}.`, COLORS.gold);
    this.refreshHeader();
    // Refresh the sell list.
    const entries = Game.state.bagEntries().filter((entry) => ITEMS[entry.id].price > 0);
    this.sellList.setItems(
      entries.map((entry) => ({
        value: entry.id,
        label: ITEMS[entry.id].name,
        trailing: `x${entry.count} \u00a3${Math.floor(ITEMS[entry.id].price / 2)}`,
      })),
    );
    if (entries.length === 0) this.backToMenu();
  }

  private closeQuantity(): void {
    this.quantityList.setVisible(false);
    this.pendingItem = null;
    this.mode = 'buy';
  }

  private backToMenu(): void {
    this.stockList.setVisible(false);
    this.sellList.setVisible(false);
    this.quantityList.setVisible(false);
    this.menu.setVisible(true);
    this.mode = 'menu';
  }

  private leave(): void {
    Audio.playSfx('back');
    const overworld = this.scene.get(SCENES.overworld);
    this.scene.stop(SCENES.shop);
    if (overworld) {
      if (this.scene.isPaused(SCENES.overworld) || this.scene.isSleeping(SCENES.overworld)) {
        this.scene.resume(SCENES.overworld);
      } else if (!this.scene.isActive(SCENES.overworld)) {
        this.scene.start(SCENES.overworld);
      }
      overworld.events.emit('shop-closed');
    }
  }

  override update(time: number): void {
    this.controls.update();
    const v = this.controls.verticalNav(time, 300, 90);
    if (v !== 0) Audio.playSfx('cursor');

    switch (this.mode) {
      case 'menu':
        if (v !== 0) this.menu.moveCursor(v);
        if (this.controls.justPressed('confirm')) this.menu.confirm();
        if (this.controls.justPressed('cancel')) this.leave();
        break;
      case 'buy':
        if (v !== 0) this.stockList.moveCursor(v);
        if (this.controls.justPressed('confirm')) this.stockList.confirm();
        if (this.controls.justPressed('cancel')) this.backToMenu();
        break;
      case 'sell':
        if (v !== 0) this.sellList.moveCursor(v);
        if (this.controls.justPressed('confirm')) this.sellList.confirm();
        if (this.controls.justPressed('cancel')) this.backToMenu();
        break;
      case 'quantity':
        if (v !== 0) this.quantityList.moveCursor(v);
        if (this.controls.justPressed('confirm')) this.quantityList.confirm();
        if (this.controls.justPressed('cancel')) this.closeQuantity();
        break;
      default:
        break;
    }
  }
}
