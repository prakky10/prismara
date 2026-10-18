/**
 * A keyboard/controller-friendly list menu with a cursor, optional columns,
 * sub-labels, disabled rows and a scrolling window.
 *
 * Navigation is driven by the scene (`moveCursor`, `confirm`, `cancel`) so the
 * same widget works in a pause menu, a battle move list or a shop.
 *
 * Rows are reflowed whenever the list scrolls, so a scrolling window keeps the
 * text, sub-labels, trailing columns and hit zones aligned with the highlight.
 */

import Phaser from 'phaser';
import { COLORS, FONTS, mixColor } from './Theme';

export interface MenuItem {
  /** Stable identifier returned by `confirm`. */
  value: string;
  label: string;
  /** Small text to the right of the label. */
  sublabel?: string;
  /** Prefixed glyph (a type badge character, an item icon). */
  icon?: string;
  /** Tint for the label. */
  color?: number;
  disabled?: boolean;
  /** Optional right-aligned trailing text (prices, counts). */
  trailing?: string;
}

export interface MenuListOptions {
  items: MenuItem[];
  width: number;
  rowHeight?: number;
  /** Visible rows before the list scrolls. */
  visibleRows?: number;
  columns?: 1 | 2;
  fontSize?: number;
  onSelect?: (value: string, index: number) => void;
  onHighlight?: (value: string, index: number) => void;
  onCancel?: () => void;
  /** Wrap the cursor around the ends of the list. */
  wrap?: boolean;
}

const PAD_LEFT = 12;
/** Extra indent that leaves room for the selection arrow. */
const ARROW_INDENT = 12;
const PAD_RIGHT = 12;
const GAP = 8;
const MIN_LABEL = 28;
const STACK_COLUMN_WIDTH = 150;
const STACK_MIN_ROW_HEIGHT = 36;
const ELLIPSIS = '\u2026';

interface Row {
  text: Phaser.GameObjects.Text;
  sub: Phaser.GameObjects.Text;
  trail: Phaser.GameObjects.Text;
  hit: Phaser.GameObjects.Zone;
}

export class MenuList extends Phaser.GameObjects.Container {
  private items: MenuItem[];
  private cursor = 0;
  private scroll = 0;
  private columns: 1 | 2;
  private visibleRows: number;
  private readonly rows: Row[] = [];
  private readonly highlight: Phaser.GameObjects.Graphics;
  private readonly upHint: Phaser.GameObjects.Text;
  private readonly downHint: Phaser.GameObjects.Text;

  private readonly listWidth: number;
  private readonly rowHeight: number;
  private readonly fontSize: number;
  readonly options: MenuListOptions;

  constructor(scene: Phaser.Scene, x: number, y: number, options: MenuListOptions) {
    super(scene, x, y);
    this.options = options;
    this.items = options.items;
    this.listWidth = options.width;
    this.rowHeight = options.rowHeight ?? 26;
    this.columns = options.columns ?? 1;
    this.fontSize = options.fontSize ?? 16;
    this.visibleRows =
      options.visibleRows ?? Math.max(1, Math.ceil(this.items.length / this.columns));

    this.highlight = scene.add.graphics();
    this.add(this.highlight);

    this.upHint = scene.add
      .text(0, 0, '\u25b2', { fontFamily: FONTS.body, fontSize: '10px', color: '#d4af37' })
      .setOrigin(1, 0.5)
      .setAlpha(0.7)
      .setVisible(false);
    this.downHint = scene.add
      .text(0, 0, '\u25bc', { fontFamily: FONTS.body, fontSize: '10px', color: '#d4af37' })
      .setOrigin(1, 0.5)
      .setAlpha(0.7)
      .setVisible(false);
    this.add(this.upHint);
    this.add(this.downHint);

    this.buildRows();
    this.cursor = this.firstEnabled();
    this.refresh();
    scene.add.existing(this);
  }

  private columnWidth(): number {
    return this.columns === 2 ? this.listWidth / 2 : this.listWidth;
  }

  private buildRows(): void {
    const width = this.columnWidth() - GAP;
    this.items.forEach((_item, index) => {
      const text = this.scene.add
        .text(0, 0, '', {
          fontFamily: FONTS.body,
          fontSize: `${this.fontSize}px`,
          color: '#f4ecd9',
        })
        .setOrigin(0, 0.5);
      const sub = this.scene.add
        .text(0, 0, '', {
          fontFamily: FONTS.body,
          fontSize: `${Math.max(8, this.fontSize - 3)}px`,
          color: '#bfb7a2',
        })
        .setOrigin(1, 0.5);
      const trail = this.scene.add
        .text(0, 0, '', {
          fontFamily: FONTS.body,
          fontSize: `${Math.max(8, this.fontSize - 2)}px`,
          color: '#d4af37',
        })
        .setOrigin(1, 0.5);

      const hit = this.scene.add
        .zone(0, 0, width, this.rowHeight)
        .setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => {
        if (!this.items[index]?.disabled) this.setCursor(index);
      });
      hit.on('pointerdown', () => this.confirmAt(index));

      this.add(text);
      this.add(sub);
      this.add(trail);
      this.add(hit);
      this.rows.push({ text, sub, trail, hit });
    });
  }

  private destroyRows(): void {
    this.rows.forEach((row) => {
      row.text.destroy();
      row.sub.destroy();
      row.trail.destroy();
      row.hit.destroy();
    });
    this.rows.length = 0;
  }

  /** Replace the whole list (shops, bags, move lists). */
  setItems(items: MenuItem[]): void {
    const previous = this.cursor;
    this.items = items;
    this.destroyRows();
    this.cursor = this.resolveCursor(previous);
    this.buildRows();
    this.ensureVisible();
    this.refresh();
  }

  /** Reflow the list to a new column count / visible window without rebuilding the caller's data. */
  setLayout(columns: 1 | 2, visibleRows: number): this {
    this.columns = columns;
    this.visibleRows = Math.max(1, Math.floor(visibleRows));
    this.destroyRows();
    this.buildRows();
    this.cursor = this.resolveCursor(this.cursor);
    this.ensureVisible();
    this.refresh();
    return this;
  }

  private firstEnabled(): number {
    const index = this.items.findIndex((item) => !item.disabled);
    return index >= 0 ? index : 0;
  }

  private resolveCursor(preferred: number): number {
    const count = this.items.length;
    if (count === 0) return 0;
    const candidate = this.items[preferred];
    if (preferred >= 0 && preferred < count && candidate && !candidate.disabled) return preferred;
    return this.firstEnabled();
  }

  private layoutRow(index: number): void {
    const item = this.items[index];
    const row = this.rows[index];
    if (!item || !row) return;

    const columnWidth = this.columnWidth();
    const col = this.columns === 2 ? index % 2 : 0;
    const logicalRow = this.columns === 2 ? Math.floor(index / 2) : index;
    const displayRow = logicalRow - this.scroll;
    const visible = displayRow >= 0 && displayRow < this.visibleRows;

    if (visible) {
      if (!row.hit.input || !row.hit.input.enabled) {
        row.hit.setInteractive({ useHandCursor: true });
      }
    } else if (row.hit.input?.enabled) {
      row.hit.disableInteractive();
    }

    row.text.setVisible(visible);
    row.sub.setVisible(false);
    row.trail.setVisible(false);
    if (!visible) return;

    const baseX = col * columnWidth;
    const y = displayRow * this.rowHeight + this.rowHeight / 2;
    const left = baseX + PAD_LEFT + ARROW_INDENT;
    const right = baseX + columnWidth - PAD_RIGHT;
    const usable = Math.max(0, right - left);

    row.hit.setPosition(baseX + GAP / 2, y);

    const selected = index === this.cursor;
    const disabled = item.disabled === true;
    const prefix = `${item.icon ? `${item.icon} ` : ''}${selected ? '\u25b6 ' : '  '}`;
    row.text.setColor(
      disabled
        ? '#5c6b85'
        : selected
          ? '#fff4cf'
          : item.color !== undefined
            ? `#${item.color.toString(16).padStart(6, '0')}`
            : '#f4ecd9',
    );

    const hasSub = item.sublabel !== undefined && item.sublabel !== '';
    const hasTrail = item.trailing !== undefined && item.trailing !== '';

    let trailWidth = 0;
    if (hasTrail) {
      this.fitText(row.trail, item.trailing ?? '', usable * 0.5);
      trailWidth = row.trail.width;
      row.trail.setPosition(right, y).setVisible(true);
    }

    const stack =
      hasSub &&
      hasTrail &&
      columnWidth <= STACK_COLUMN_WIDTH &&
      this.rowHeight >= STACK_MIN_ROW_HEIGHT;

    if (stack) {
      row.sub.setFontSize(Math.max(8, this.fontSize - 4));
      const labelRegion = Math.max(
        MIN_LABEL,
        right - (trailWidth > 0 ? trailWidth + GAP : 0) - left,
      );
      this.fitText(row.text, prefix + item.label, labelRegion);
      row.text.setPosition(left, y - this.rowHeight * 0.18);
      this.fitText(row.sub, item.sublabel ?? '', labelRegion);
      row.sub
        .setOrigin(0, 0.5)
        .setPosition(left, y + this.rowHeight * 0.22)
        .setVisible(true);
    } else {
      row.sub.setFontSize(Math.max(8, this.fontSize - 3));
      let labelRegion: number;
      if (hasSub) {
        this.fitText(row.sub, item.sublabel ?? '', usable * 0.5);
        const subWidth = row.sub.width;
        const subRight = right - (trailWidth > 0 ? trailWidth + GAP : 0);
        row.sub.setOrigin(1, 0.5).setPosition(subRight, y).setVisible(true);
        labelRegion = Math.max(MIN_LABEL, subRight - subWidth - GAP - left);
      } else {
        labelRegion = Math.max(MIN_LABEL, right - (trailWidth > 0 ? trailWidth + GAP : 0) - left);
      }
      this.fitText(row.text, prefix + item.label, labelRegion);
      row.text.setPosition(left, y);
    }
  }

  /** Trim `text` to `maxWidth`, appending an ellipsis when it has to shrink. */
  private fitText(text: Phaser.GameObjects.Text, full: string, maxWidth: number): void {
    text.setText(full);
    if (maxWidth <= 0) {
      text.setText('');
      return;
    }
    if (text.width <= maxWidth) return;
    let low = 0;
    let high = full.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      text.setText(`${full.slice(0, mid)}${ELLIPSIS}`);
      if (text.width <= maxWidth) low = mid;
      else high = mid - 1;
    }
    text.setText(low > 0 ? `${full.slice(0, low)}${ELLIPSIS}` : ELLIPSIS);
  }

  private refresh(): void {
    const columnWidth = this.columnWidth();
    this.items.forEach((_item, index) => this.layoutRow(index));

    const col = this.columns === 2 ? this.cursor % 2 : 0;
    const rowIndex = this.columns === 2 ? Math.floor(this.cursor / 2) : this.cursor;
    const visibleRow = rowIndex - this.scroll;

    this.highlight.clear();
    if (visibleRow >= 0 && visibleRow < this.visibleRows) {
      const hx = col * columnWidth + 4;
      const hy = visibleRow * this.rowHeight + 2;
      const hw = columnWidth - 8;
      const hh = this.rowHeight - 4;
      const radius = Math.min(hh / 2, 12);
      const g = this.highlight;
      // Brass pill: soft glow, dusk-sea body, bright rim and a top sheen.
      g.fillStyle(COLORS.brass, 0.1);
      g.fillRoundedRect(hx - 2, hy - 2, hw + 4, hh + 4, radius + 2);
      g.fillStyle(mixColor(COLORS.navyLight, COLORS.brass, 0.25), 0.9);
      g.fillRoundedRect(hx, hy, hw, hh, radius);
      g.fillStyle(COLORS.brassLight, 0.12);
      g.fillRoundedRect(hx + 2, hy + 1, hw - 4, hh * 0.45, radius);
      g.lineStyle(1.5, COLORS.brassLight, 0.9);
      g.strokeRoundedRect(hx, hy, hw, hh, radius);
      // Selection arrow.
      const ax = hx + 10;
      const ay = hy + hh / 2;
      g.fillStyle(COLORS.brassLight, 1);
      g.fillTriangle(ax - 3, ay - 4.5, ax - 3, ay + 4.5, ax + 4, ay);
    }

    const totalRows = Math.ceil(this.items.length / this.columns);
    this.upHint.setVisible(this.scroll > 0).setPosition(this.listWidth - 4, -8);
    this.downHint
      .setVisible(this.scroll + this.visibleRows < totalRows)
      .setPosition(this.listWidth - 4, this.visibleRows * this.rowHeight + 8);
  }

  private ensureVisible(): void {
    const rowIndex = this.columns === 2 ? Math.floor(this.cursor / 2) : this.cursor;
    if (rowIndex < this.scroll) this.scroll = rowIndex;
    const maxRow = this.scroll + this.visibleRows - 1;
    if (rowIndex > maxRow) this.scroll = rowIndex - this.visibleRows + 1;
    this.scroll = Math.max(0, this.scroll);
  }

  get selectedIndex(): number {
    return this.cursor;
  }

  get selectedItem(): MenuItem | undefined {
    return this.items[this.cursor];
  }

  get selectedValue(): string | undefined {
    return this.items[this.cursor]?.value;
  }

  setCursor(index: number): void {
    if (index < 0 || index >= this.items.length) return;
    if (this.items[index]?.disabled) return;
    this.cursor = index;
    this.ensureVisible();
    this.refresh();
    const selected = this.items[this.cursor];
    if (selected) this.options.onHighlight?.(selected.value, this.cursor);
  }

  moveCursor(delta: number): void {
    const count = this.items.length;
    if (count === 0 || delta === 0) return;
    const rows = Math.ceil(count / this.columns);
    const wrap = this.options.wrap ?? true;
    const col = this.cursor % this.columns;
    let row = Math.floor(this.cursor / this.columns);
    for (let guard = 0; guard < rows; guard++) {
      row += delta;
      if (row < 0) row = wrap ? rows - 1 : 0;
      else if (row >= rows) row = wrap ? 0 : rows - 1;
      let index = row * this.columns + col;
      if (index >= count) index = count - 1;
      if (index < 0) index = 0;
      if (!this.items[index]?.disabled) {
        this.setCursor(index);
        return;
      }
      if (!wrap && (row === 0 || row === rows - 1)) return;
    }
  }

  moveHorizontal(delta: number): void {
    if (this.columns !== 2) return;
    const count = this.items.length;
    if (count === 0 || delta === 0) return;
    const wrap = this.options.wrap ?? true;
    const row = Math.floor(this.cursor / 2);
    const col = this.cursor % 2;
    let targetCol = col + delta;
    if (targetCol < 0 || targetCol > 1) {
      if (!wrap) return;
      targetCol = targetCol < 0 ? 1 : 0;
    }
    let index = row * 2 + targetCol;
    if (index >= count) index = count - 1;
    if (!this.items[index]?.disabled) this.setCursor(index);
  }

  /** Confirm the current row. Returns true when the selection was valid. */
  confirm(): boolean {
    return this.confirmAt(this.cursor);
  }

  confirmAt(index: number): boolean {
    const item = this.items[index];
    if (!item || item.disabled) return false;
    this.cursor = index;
    this.ensureVisible();
    this.refresh();
    this.options.onSelect?.(item.value, index);
    return true;
  }

  cancel(): void {
    this.options.onCancel?.();
  }

  /** A gentle pop when the list appears. */
  animateIn(): void {
    this.setAlpha(0);
    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      x: this.x + 0,
      duration: 150,
      ease: 'Quad.easeOut',
    });
  }
}
