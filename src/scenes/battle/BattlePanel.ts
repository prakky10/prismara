/**
 * One side's status panel in battle: name, level, HP/XP bar and status.
 */

import Phaser from 'phaser';
import { DEPTHS, FONTS, statusColor, COLORS } from '../../ui/Theme';
import { HPBar } from '../../ui/HPBar';
import { Panel } from '../../ui/Panel';
import { displayName, expProgress, maxHp, type CreatureInstance } from '../../battle';
import { STATUS_INFO, type Side } from '../../data/battleTypes';

export class BattlePanel {
  readonly panel: Panel;
  readonly name: Phaser.GameObjects.Text;
  readonly level: Phaser.GameObjects.Text;
  readonly hp: HPBar;
  readonly status: Phaser.GameObjects.Text;
  readonly statusIcon: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    side: Side,
  ) {
    this.panel = new Panel(scene, x + width / 2, y + height / 2, {
      width,
      height,
      glow: side === 'player' ? COLORS.panelGlow : COLORS.panelEdge,
    });
    this.panel.setDepth(DEPTHS.ui);

    this.name = scene.add
      .text(x + 16, y + 18, '', {
        fontFamily: FONTS.body,
        fontSize: '16px',
        color: '#f2f6ff',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.ui + 1);

    this.level = scene.add
      .text(x + width - 14, y + 18, '', {
        fontFamily: FONTS.body,
        fontSize: '13px',
        color: '#ffd60a',
      })
      .setOrigin(1, 0.5)
      .setDepth(DEPTHS.ui + 1);

    this.hp = new HPBar(scene, x + width / 2 - 6, y + 46, {
      width: width - 40,
      height: 9,
      showXp: side === 'player',
    });
    this.hp.setDepth(DEPTHS.ui + 1);

    this.statusIcon = scene.add
      .text(x + 14, y + 46, '', {
        fontFamily: FONTS.body,
        fontSize: '10px',
        color: '#ffd60a',
        backgroundColor: 'rgba(5,7,15,0.7)',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.ui + 2);

    this.status = scene.add
      .text(x + 14, y + height - 10, '', {
        fontFamily: FONTS.body,
        fontSize: '10px',
        color: '#9fb0cc',
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.ui + 1);
  }

  update(creature: CreatureInstance): void {
    this.name.setText(displayName(creature));
    this.level.setText(`Lv ${creature.level}`);
    this.hp.set(creature.currentHp, maxHp(creature), false);
    this.hp.setXpVisible(true);
    this.hp.setXp(expProgress(creature));

    const status = creature.status;
    this.status.setText(
      status
        ? `${STATUS_INFO[status].name}${creature.status === 'sleep' ? ` (${creature.statusTurns})` : ''}`
        : '',
    );
    this.status.setColor(
      status ? `#${statusColor(status).toString(16).padStart(6, '0')}` : '#9fb0cc',
    );
    this.statusIcon.setText(status ? STATUS_INFO[status].name.toUpperCase().slice(0, 4) : '');
    this.statusIcon.setVisible(Boolean(status));
  }
}
