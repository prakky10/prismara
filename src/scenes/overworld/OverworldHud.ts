/**
 * The overworld's fixed-to-screen layer: location and chapter panel, trophy
 * count, objective line, controls hint, area banner and the day/night grade.
 */

import Phaser from 'phaser';
import { COLORS, DEPTHS, FONTS, VIEW_HEIGHT, VIEW_WIDTH } from '../../ui/Theme';
import { Game } from '../../world/GameContext';
import { getChapter } from '../../world/campaign';
import { lightingFor } from '../../core/Time';
import type { MapDef } from '../../world/maps';

export class OverworldHud {
  private readonly gradeOverlay: Phaser.GameObjects.Rectangle;
  private readonly hudText: Phaser.GameObjects.Text;
  private readonly hudTrophy: Phaser.GameObjects.Text;
  private readonly hudObjective: Phaser.GameObjects.Text;
  private areaBanner?: Phaser.GameObjects.Text;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly map: MapDef,
  ) {
    this.gradeOverlay = scene.add.rectangle(0, 0, VIEW_WIDTH, VIEW_HEIGHT, 0x000000, 0);
    this.gradeOverlay.setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTHS.lighting);
    this.gradeOverlay.setVisible(false);

    const frame = scene.add.graphics();
    frame.fillStyle(0x05070f, 0.6);
    frame.fillRoundedRect(10, 8, 300, 54, 8);
    frame.lineStyle(2, COLORS.panelEdge, 0.8);
    frame.strokeRoundedRect(10, 8, 300, 54, 8);
    frame.setScrollFactor(0).setDepth(DEPTHS.ui);

    this.hudText = scene.add
      .text(22, 18, '', {
        fontFamily: FONTS.body,
        fontSize: '14px',
        color: '#f2f6ff',
        fontStyle: 'bold',
        lineSpacing: 4,
      })
      .setScrollFactor(0)
      .setDepth(DEPTHS.ui + 1);

    this.hudTrophy = scene.add
      .text(VIEW_WIDTH - 22, 18, '', {
        fontFamily: FONTS.body,
        fontSize: '14px',
        color: '#ffd60a',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(DEPTHS.ui + 1);

    this.hudObjective = scene.add
      .text(24, VIEW_HEIGHT - 28, '', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        color: '#dce6f7',
        wordWrap: { width: 660 },
        lineSpacing: 4,
        backgroundColor: 'rgba(5,7,15,0.55)',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(DEPTHS.ui);

    scene.add
      .text(VIEW_WIDTH - 22, VIEW_HEIGHT - 14, 'Move Arrows · Confirm Z · Menu C', {
        fontFamily: FONTS.body,
        fontSize: '10px',
        color: '#6d7d99',
      })
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(DEPTHS.ui);
  }

  update(): void {
    const state = Game.state;
    const chapter = getChapter(state);
    this.hudText.setText(`${this.map.name}\nChapter ${chapter.number} · ${chapter.title}`);
    this.hudTrophy.setText(`Trophies ${state.sigils.length}/6`);
    this.hudObjective.setText(chapter.objective);
  }

  showAreaBanner(): void {
    this.areaBanner?.destroy();
    const banner = this.scene.add
      .text(VIEW_WIDTH / 2, 64, this.map.name, {
        fontFamily: FONTS.body,
        fontSize: '24px',
        color: '#f2f6ff',
        fontStyle: 'bold',
        stroke: '#0b1020',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTHS.overlay);

    const blurb = this.scene.add
      .text(VIEW_WIDTH / 2, 90, this.map.blurb ?? '', {
        fontFamily: FONTS.body,
        fontSize: '13px',
        color: '#cfe0f5',
        stroke: '#0b1020',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTHS.overlay);

    this.areaBanner = banner;
    this.scene.tweens.add({
      targets: [banner, blurb],
      alpha: 0,
      delay: 2200,
      duration: 700,
      onComplete: () => {
        banner.destroy();
        blurb.destroy();
      },
    });
  }

  applyDayNightGrade(): void {
    const lighting = lightingFor(Game.state.clock);
    if (this.map.indoor || this.map.isCave) {
      this.gradeOverlay.fillColor = this.map.isCave ? 0x1a1630 : 0x000000;
      this.gradeOverlay.fillAlpha = this.map.isCave ? 0.34 : 0.05;
      return;
    }
    this.gradeOverlay.fillColor = lighting.tint;
    this.gradeOverlay.fillAlpha = lighting.alpha * 0.7;
  }
}
