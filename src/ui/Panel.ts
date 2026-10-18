/**
 * A crisp, warm panel used for every dialog and menu surface.
 *
 * Layered dusk-navy body (soft sheen top, darker foot), a double brass border,
 * a soft stacked drop shadow and brass corner studs. The sheen is kept subtle so
 * text sitting on a panel stays readable against busy backgrounds.
 */

import Phaser from 'phaser';
import { COLORS, LAYOUT, mixColor } from './Theme';

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

    // Soft layered drop shadow, offset down so it never sits under the text.
    g.fillStyle(COLORS.shadow, 0.16);
    g.fillRoundedRect(left + 1, top + 8, width, height, radius + 2);
    g.fillStyle(COLORS.shadow, 0.22);
    g.fillRoundedRect(left + 2, top + 5, width, height, radius + 1);
    g.fillStyle(COLORS.shadow, 0.3);
    g.fillRoundedRect(left + 2, top + 3, width, height, radius);

    // Body: deep navy base, a lighter dusk-sea sheen at the top and a darker
    // band at the bottom to fake a vertical gradient on a rounded shape.
    g.fillStyle(this.fill, this.fillAlpha);
    g.fillRoundedRect(left, top, width, height, radius);
    const sheenH = Math.max(radius * 2, height * 0.5);
    g.fillStyle(mixColor(this.fill, COLORS.navyLight, 0.9), this.fillAlpha * 0.5);
    g.fillRoundedRect(left + 1, top + 1, width - 2, sheenH, {
      tl: radius,
      tr: radius,
      bl: 0,
      br: 0,
    });
    g.fillStyle(mixColor(this.fill, COLORS.navyLight, 0.45), this.fillAlpha * 0.35);
    g.fillRoundedRect(left + 1, top + 1, width - 2, sheenH * 0.45, {
      tl: radius,
      tr: radius,
      bl: 0,
      br: 0,
    });
    const footH = Math.min(height * 0.3, 28);
    g.fillStyle(COLORS.ink, 0.28);
    g.fillRoundedRect(left + 1, top + height - footH - 1, width - 2, footH, {
      tl: 0,
      tr: 0,
      bl: radius,
      br: radius,
    });

    // Faint accent rim (recoloured by setGlow/pulse).
    if (glowAlpha > 0) {
      g.lineStyle(3, glow, Math.min(0.5, glowAlpha) * 0.22);
      g.strokeRoundedRect(left - 2, top - 2, width + 4, height + 4, radius + 2);
      g.lineStyle(1, glow, Math.min(0.5, glowAlpha) * 0.7);
      g.strokeRoundedRect(left - 1, top - 1, width + 2, height + 2, radius + 1);
    }

    // Brass border: dark outer line, bright inner line.
    g.lineStyle(2, mixColor(border, COLORS.brassDark, 0.5), 0.95);
    g.strokeRoundedRect(left, top, width, height, radius);
    g.lineStyle(1, mixColor(border, COLORS.brassLight, 0.45), 0.85);
    g.strokeRoundedRect(left + 1.5, top + 1.5, width - 3, height - 3, Math.max(0, radius - 1.5));

    // Inner hairline.
    g.lineStyle(1, COLORS.white, 0.05);
    g.strokeRoundedRect(left + 4, top + 4, width - 8, height - 8, Math.max(0, radius - 4));

    // Bright top edge highlight.
    if (this.highlight) {
      g.lineStyle(1, COLORS.ivory, 0.28);
      g.beginPath();
      g.moveTo(left + radius, top + 2.5);
      g.lineTo(left + width - radius, top + 2.5);
      g.strokePath();
    }

    // Brass corner studs.
    const inset = Math.min(8, radius * 0.7 + 2);
    for (const [sx, sy] of [
      [left + inset, top + inset],
      [left + width - inset, top + inset],
      [left + inset, top + height - inset],
      [left + width - inset, top + height - inset],
    ] as const) {
      g.fillStyle(COLORS.brassDark, 0.8);
      g.fillCircle(sx, sy, 2.2);
      g.fillStyle(COLORS.brassLight, 0.9);
      g.fillCircle(sx - 0.4, sy - 0.4, 1.2);
    }
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
