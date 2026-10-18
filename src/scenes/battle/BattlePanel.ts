/**
 * One side's status panel in battle: name, level, HP/XP bar and status.
 *
 * Layout: an element-coloured accent stripe on the left, the name and level on
 * the first row, a segmented HP bar under them (with "37 / 52" and the slim XP
 * strip on the player's side) and a status chip in the bottom-left corner.
 */

import Phaser from 'phaser';
import { DEPTHS, FONTS, statusColor, COLORS, cssColor, mixColor } from '../../ui/Theme';
import { HPBar } from '../../ui/HPBar';
import { Panel } from '../../ui/Panel';
import { displayName, expProgress, maxHp, speciesOf, type CreatureInstance } from '../../battle';
import { STATUS_INFO, type Side } from '../../data/battleTypes';
import { ELEMENT_INFO } from '../../data/types';

export class BattlePanel {
  readonly panel: Panel;
  readonly name: Phaser.GameObjects.Text;
  readonly level: Phaser.GameObjects.Text;
  readonly hp: HPBar;
  readonly status: Phaser.GameObjects.Text;
  readonly statusIcon: Phaser.GameObjects.Text;

  private readonly accent: Phaser.GameObjects.Graphics;
  private readonly chip: Phaser.GameObjects.Graphics;
  private readonly x: number;
  private readonly y: number;
  private readonly height: number;
  private readonly side: Side;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    side: Side,
  ) {
    this.x = x;
    this.y = y;
    this.height = height;
    this.side = side;

    this.panel = new Panel(scene, x + width / 2, y + height / 2, {
      width,
      height,
      glow: side === 'player' ? COLORS.panelGlow : COLORS.panelEdge,
    });
    this.panel.setDepth(DEPTHS.ui);

    this.accent = scene.add.graphics().setDepth(DEPTHS.ui + 1);
    this.chip = scene.add.graphics().setDepth(DEPTHS.ui + 1);
    this.drawAccent(COLORS.brass);

    this.name = scene.add
      .text(x + 22, y + 18, '', {
        fontFamily: FONTS.display,
        fontSize: '18px',
        color: '#f4efe2',
        fontStyle: '700',
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.ui + 1);

    this.level = scene.add
      .text(x + width - 16, y + 19, '', {
        fontFamily: FONTS.display,
        fontSize: '14px',
        color: '#e8cf7a',
        fontStyle: '700',
      })
      .setOrigin(1, 0.5)
      .setDepth(DEPTHS.ui + 1);

    const barWidth = width - 44;
    this.hp = new HPBar(scene, x + 20 + barWidth / 2, y + 42, {
      width: barWidth,
      height: 10,
      showXp: side === 'player',
      showNumbers: side === 'player',
      numbersPlacement: 'below',
    });
    this.hp.setDepth(DEPTHS.ui + 1);

    const chipY = y + height - 15;
    this.statusIcon = scene.add
      .text(x + 23, chipY, '', {
        fontFamily: FONTS.display,
        fontSize: '11px',
        color: '#0b1020',
        fontStyle: '700',
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.ui + 2);

    this.status = scene.add
      .text(x + 22, chipY, '', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        color: '#bfb7a2',
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.ui + 1);
  }

  /** Left-edge stripe in the creature's element colour. */
  private drawAccent(color: number): void {
    const g = this.accent;
    const { x, y, height } = this;
    g.clear();
    g.fillStyle(mixColor(color, 0x000000, 0.35), 1);
    g.fillRoundedRect(x + 8, y + 12, 6, height - 24, 3);
    g.fillStyle(color, 1);
    g.fillRoundedRect(x + 8, y + 12, 4, height - 24, 2);
    g.fillStyle(0xffffff, 0.35);
    g.fillRect(x + 9, y + 14, 1, height - 28);
  }

  private drawChip(color: number, show: boolean): void {
    const g = this.chip;
    g.clear();
    if (!show) return;
    const w = this.statusIcon.width + 14;
    const h = 16;
    const left = this.x + 16;
    const top = this.y + this.height - 15 - h / 2;
    g.fillStyle(mixColor(color, 0x000000, 0.35), 1);
    g.fillRoundedRect(left, top + 1, w, h, 8);
    g.fillStyle(color, 1);
    g.fillRoundedRect(left, top, w, h, 8);
    g.fillStyle(0xffffff, 0.3);
    g.fillRoundedRect(left + 3, top + 1, w - 6, 4, 2);
    g.lineStyle(1, 0xffffff, 0.35);
    g.strokeRoundedRect(left, top, w, h, 8);
  }

  update(creature: CreatureInstance): void {
    const element = ELEMENT_INFO[speciesOf(creature).element];
    if (element) {
      this.drawAccent(element.color);
      this.panel.setGlow(element.color, 0.4);
    }

    this.name.setText(displayName(creature));
    this.level.setText(`Lv ${creature.level}`);
    this.hp.set(creature.currentHp, maxHp(creature), false);
    this.hp.setXpVisible(this.side === 'player');
    this.hp.setXp(expProgress(creature));

    const status = creature.status;
    if (status) {
      const color = statusColor(status);
      const abbr = STATUS_INFO[status].name.toUpperCase().slice(0, 4);
      this.statusIcon.setText(abbr).setVisible(true);
      this.drawChip(color, true);
      const detail = `${STATUS_INFO[status].name}${status === 'sleep' ? ` (${creature.statusTurns})` : ''}`;
      this.status
        .setText(detail)
        .setColor(cssColor(mixColor(color, 0xffffff, 0.35)))
        .setX(this.x + 16 + this.statusIcon.width + 14 + 8);
    } else {
      this.statusIcon.setText('').setVisible(false);
      this.status.setText('');
      this.drawChip(0, false);
    }
  }
}
