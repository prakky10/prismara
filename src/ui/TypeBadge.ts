/**
 * A small pill showing a move's or creature's element, tinted with its colour.
 */

import Phaser from 'phaser';
import { ELEMENT_INFO, type MoveType } from '../data/types';

export class TypeBadge extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly textObject: Phaser.GameObjects.Text;
  private badgeWidth = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, type: MoveType, showGlyph = true) {
    super(scene, x, y);
    const info = ELEMENT_INFO[type];

    this.bg = scene.add.graphics();
    this.add(this.bg);

    this.textObject = scene.add
      .text(0, 0, showGlyph ? `${info.glyph} ${info.name}` : info.name, {
        fontFamily: '"Nunito", system-ui, sans-serif',
        fontSize: '12px',
        color: '#0b1020',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5);
    this.add(this.textObject);

    this.badgeWidth = this.textObject.width + 18;
    this.draw(info.color);
    scene.add.existing(this);
  }

  private draw(color: number): void {
    const h = 20;
    this.bg.clear();
    this.bg.fillStyle(color, 1);
    this.bg.fillRoundedRect(-this.badgeWidth / 2, -h / 2, this.badgeWidth, h, 10);
    this.bg.lineStyle(1.5, 0xffffff, 0.35);
    this.bg.strokeRoundedRect(-this.badgeWidth / 2, -h / 2, this.badgeWidth, h, 10);
  }

  get width2(): number {
    return this.badgeWidth;
  }

  /** Slightly enlarge the badge for emphasis (super-effective hits). */
  pop(): void {
    this.scene.tweens.add({
      targets: this,
      scale: 1.25,
      duration: 110,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }
}

/** A tiny coloured dot, for compact lists. */
export function typeDot(scene: Phaser.Scene, x: number, y: number, type: MoveType): Phaser.GameObjects.Arc {
  const dot = scene.add.circle(x, y, 4, ELEMENT_INFO[type].color, 1);
  dot.setStrokeStyle(1, 0xffffff, 0.4);
  return dot;
}
