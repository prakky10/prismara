/**
 * A crisp, warm panel used for every dialog and menu surface.
 *
 * Midnight-navy body, a muted-brass border, a small dark drop shadow and thin
 * corner ornaments. Deliberately no large translucent top highlight, so text
 * sitting on a panel stays readable against busy backgrounds.
 */

import Phaser from 'phaser';
import { COLORS, LAYOUT } from './Theme';

export interface PanelOptions {
  width: number;
  height: number;
  radius?: number;
  fill?: number;
  fillAlpha?: number;
  border?: number;
  glow?: number;
  glowAlpha?: number;
  /** Draw a brighter 1px top edge for a subtle highlight. */
  highlight?: boolean;
}

export class Panel extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  panelWidth: number;
  panelHeight: number;

  private readonly radius: number;
  private readonly fill: number;
  private readonly fillAlpha: number;
  private readonly border: number;
  private readonly highlight: boolean;
  private glow: number;
  private glowAlpha: number;

  constructor(scene: Phaser.Scene, x: number, y: number, options: PanelOptions) {
    super(scene, x, y);
    const {
      width,
      height,
      radius = LAYOUT.panelRadius,
      fill = COLORS.panel,
      fillAlpha = 0.94,
      border = COLORS.panelEdge,
      glow = COLORS.panelGlow,
      glowAlpha = 0.25,
      highlight = true,
    } = options;

    this.panelWidth = width;
    this.panelHeight = height;
    this.radius = radius;
    this.fill = fill;
    this.fillAlpha = fillAlpha;
    this.border = border;
    this.glow = glow;
    this.glowAlpha = glowAlpha;
    this.highlight = highlight;

    this.bg = scene.add.graphics();
    this.add(this.bg);
    this.setSize(width, height);
    scene.add.existing(this);
  }

  /**
   * Resize the panel. Phaser's inherited Container.setSize only records the new
   * width/height, so without this override the drawn frame would keep its old
   * size. Re-renders using the stored border/glow defaults (see setGlow).
   */
  override setSize(width: number, height: number): this {
    this.panelWidth = width;
    this.panelHeight = height;
    super.setSize(width, height);
    this.render(this.border, this.glow, this.glowAlpha);
    return this;
  }

  private render(border: number, glow: number, glowAlpha: number): void {
    const g = this.bg;
    const width = this.panelWidth;
    const height = this.panelHeight;
    const radius = this.radius;
    const left = -width / 2;
    const top = -height / 2;

    g.clear();

    // A short dark drop shadow, offset down so it never sits under the text.
    g.fillStyle(COLORS.shadow, 0.35);
    g.fillRoundedRect(left + 3, top + 5, width, height, radius);
    g.fillStyle(COLORS.shadow, 0.2);
    g.fillRoundedRect(left + 6, top + 9, width, height, radius);

    // Body.
    g.fillStyle(this.fill, this.fillAlpha);
    g.fillRoundedRect(left, top, width, height, radius);

    // Faint accent rim (recoloured by setGlow/pulse).
    if (glowAlpha > 0) {
      g.lineStyle(1, glow, Math.min(0.5, glowAlpha) * 0.6);
      g.strokeRoundedRect(left - 1, top - 1, width + 2, height + 2, radius + 1);
    }

    // Crisp border.
    g.lineStyle(2, border, 0.95);
    g.strokeRoundedRect(left, top, width, height, radius);

    // Inner hairline.
    g.lineStyle(1, COLORS.white, 0.05);
    g.strokeRoundedRect(left + 2, top + 2, width - 4, height - 4, Math.max(0, radius - 2));

    // Subtle 1px top edge.
    if (this.highlight) {
      g.lineStyle(1, COLORS.white, 0.16);
      g.beginPath();
      g.moveTo(left + radius, top + 1);
      g.lineTo(left + width - radius, top + 1);
      g.strokePath();
    }

    // Corner ornaments.
    const corner = Math.min(12, radius + 6);
    g.lineStyle(1, COLORS.gold, 0.55);
    g.beginPath();
    g.moveTo(left, top + corner);
    g.lineTo(left, top);
    g.lineTo(left + corner, top);
    g.strokePath();
    g.beginPath();
    g.moveTo(left + width - corner, top);
    g.lineTo(left + width, top);
    g.lineTo(left + width, top + corner);
    g.strokePath();
    g.beginPath();
    g.moveTo(left, top + height - corner);
    g.lineTo(left, top + height);
    g.lineTo(left + corner, top + height);
    g.strokePath();
    g.beginPath();
    g.moveTo(left + width - corner, top + height);
    g.lineTo(left + width, top + height);
    g.lineTo(left + width, top + height - corner);
    g.strokePath();
  }

  /** Recolour the border glow, e.g. to the current element. */
  setGlow(color: number, alpha = 0.45): this {
    this.glow = color;
    this.glowAlpha = alpha;
    this.render(this.border, color, alpha);
    return this;
  }

  /** Pulse the glow for emphasis (level-ups, catches). */
  pulse(color: number): this {
    const proxy = { a: 0 };
    this.scene.tweens.add({
      targets: proxy,
      a: 1,
      duration: 220,
      yoyo: true,
      onUpdate: () => this.setGlow(color, 0.25 + proxy.a * 0.5),
      onComplete: () => this.setGlow(color, 0.25),
    });
    return this;
  }
}
