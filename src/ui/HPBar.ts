/**
 * An animated, segmented HP bar with a lag-behind "damage ghost".
 *
 *  - The fill drains smoothly and shifts green -> amber -> red with a glossy
 *    gradient, split into thin segments.
 *  - A pale ghost bar trails behind so the player can see how much was lost.
 *  - An optional "37 / 52" readout and a slim XP bar with a level-up flash.
 */

import Phaser from 'phaser';
import { COLORS, FONTS, mixColor } from './Theme';

export interface HPBarOptions {
  width: number;
  height?: number;
  /** Show the "current / max" number beside the bar. */
  showNumbers?: boolean;
  /** Where the numbers sit relative to the bar. Defaults to above, right-aligned. */
  numbersPlacement?: 'above' | 'below';
  /** Show the XP bar underneath. */
  showXp?: boolean;
  /** Draw thin segment dividers over the fill (default true). */
  segmented?: boolean;
}

const XP_HEIGHT = 4;

export class HPBar extends Phaser.GameObjects.Container {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text | null;
  private readonly barWidth: number;
  private readonly barHeight: number;
  private readonly segmented: boolean;
  private readonly hasXp: boolean;

  /** Tweened HP state; `draw()` renders from these. */
  private readonly hpState = { fill: 1, ghost: 1, alpha: 1 };
  /** Tweened XP state, kept apart so HP tweens never cancel XP tweens. */
  private readonly xpState = { xp: 0, alpha: 1 };
  private xpVisible = true;
  private ratio = 1;
  private ghostRatio = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, options: HPBarOptions) {
    super(scene, x, y);
    const {
      width,
      height = 8,
      showNumbers = false,
      showXp = false,
      numbersPlacement = 'above',
      segmented = true,
    } = options;
    this.barWidth = width;
    this.barHeight = height;
    this.segmented = segmented;
    this.hasXp = showXp;

    this.gfx = scene.add.graphics();
    this.add(this.gfx);

    if (showNumbers) {
      const below = numbersPlacement === 'below';
      const offset = below ? height / 2 + (showXp ? XP_HEIGHT + 13 : 10) : -height / 2 - 12;
      this.label = scene.add
        .text(width / 2, offset, '', {
          fontFamily: FONTS.body,
          fontSize: '13px',
          color: '#f4efe2',
          fontStyle: '700',
        })
        .setOrigin(1, 0.5);
      this.add(this.label);
    } else {
      this.label = null;
    }

    this.draw();
    scene.add.existing(this);
  }

  /** Animate to a new HP value. */
  set(current: number, max: number, animate = true): void {
    const next = max <= 0 ? 0 : Phaser.Math.Clamp(current / max, 0, 1);
    const previous = this.ratio;
    this.ratio = next;
    this.ghostRatio = next;

    this.scene.tweens.killTweensOf(this.hpState);
    this.hpState.alpha = 1;
    if (animate) {
      const drain = next < previous;
      this.scene.tweens.add({
        targets: this.hpState,
        fill: next,
        duration: Math.max(140, Math.abs(next - previous) * 900),
        ease: 'Quad.easeOut',
        onUpdate: () => this.draw(),
      });
      if (drain) {
        // The ghost keeps its old length, then catches up a beat later.
        this.scene.tweens.add({
          targets: this.hpState,
          ghost: next,
          delay: 320,
          duration: 460,
          ease: 'Quad.easeOut',
          onUpdate: () => this.draw(),
        });
      } else {
        this.hpState.ghost = next;
      }
    } else {
      this.hpState.fill = next;
      this.hpState.ghost = next;
    }

    if (this.label) this.label.setText(`${Math.max(0, Math.round(current))} / ${max}`);
    this.draw();
  }

  private colorFor(ratio: number): { top: number; bottom: number } {
    // Blend smoothly through green -> amber -> red.
    let base: number;
    if (ratio > 0.5) base = mixColor(COLORS.hpMid, COLORS.hpHigh, (ratio - 0.5) / 0.5);
    else if (ratio > 0.2) base = mixColor(COLORS.hpLow, COLORS.hpMid, (ratio - 0.2) / 0.3);
    else base = COLORS.hpLow;
    return { top: mixColor(base, 0xffffff, 0.35), bottom: mixColor(base, 0x000000, 0.25) };
  }

  private draw(): void {
    const g = this.gfx;
    const w = this.barWidth;
    const h = this.barHeight;
    const left = -w / 2;
    const top = -h / 2;
    const r = Math.min(h / 2, 4);
    g.clear();

    // Shell: dark well with a brass rim.
    g.fillStyle(COLORS.ink, 0.9);
    g.fillRoundedRect(left - 2, top - 2, w + 4, h + 4, r + 2);
    g.lineStyle(1, COLORS.brass, 0.55);
    g.strokeRoundedRect(left - 2, top - 2, w + 4, h + 4, r + 2);

    // Ghost (what was just lost).
    const ghostW = w * this.hpState.ghost;
    if (ghostW > 0.5) {
      g.fillStyle(0xffffff, 0.6);
      g.fillRoundedRect(left, top, ghostW, h, Math.min(r, ghostW / 2));
    }

    // Fill: two-tone gradient (light top, darker bottom).
    const fillW = w * this.hpState.fill;
    if (fillW > 0.5) {
      const { top: lightC, bottom: darkC } = this.colorFor(this.hpState.fill);
      const a = this.hpState.alpha;
      const rad = Math.min(r, fillW / 2);
      g.fillStyle(darkC, a);
      g.fillRoundedRect(left, top, fillW, h, rad);
      g.fillStyle(lightC, a);
      g.fillRoundedRect(left, top, fillW, h * 0.55, { tl: rad, tr: rad, bl: 0, br: 0 });
      g.fillStyle(0xffffff, 0.28 * a);
      g.fillRect(left + rad, top + 1, Math.max(0, fillW - rad * 2), 1);
    }

    // Segment dividers.
    if (this.segmented && w >= 60) {
      const segments = Math.max(4, Math.round(w / 22));
      g.fillStyle(COLORS.ink, 0.55);
      for (let i = 1; i < segments; i++) {
        g.fillRect(left + (w * i) / segments - 0.5, top, 1, h);
      }
    }

    // Slim XP strip.
    if (this.hasXp && this.xpVisible) {
      const y = h / 2 + 3;
      g.fillStyle(COLORS.ink, 0.8);
      g.fillRoundedRect(left, y, w, XP_HEIGHT, 2);
      const xpW = w * this.xpState.xp;
      if (xpW > 0.5) {
        const a = this.xpState.alpha;
        g.fillStyle(COLORS.xp, a);
        g.fillRoundedRect(left, y, xpW, XP_HEIGHT, Math.min(2, xpW / 2));
        g.fillStyle(0xffffff, 0.3 * a);
        g.fillRect(left + 1, y, Math.max(0, xpW - 2), 1);
      }
    }
  }

  /** Flash the bar when the creature takes a hit. */
  flashDamage(): void {
    this.scene.tweens.add({
      targets: this.hpState,
      alpha: 0.35,
      duration: 80,
      yoyo: true,
      repeat: 1,
      onUpdate: () => this.draw(),
      onComplete: () => {
        this.hpState.alpha = 1;
        this.draw();
      },
    });
  }

  /** Update the XP bar under the HP bar (0..1). */
  setXp(progress: number): void {
    if (!this.hasXp) return;
    const clamped = Phaser.Math.Clamp(progress, 0, 1);
    this.scene.tweens.killTweensOf(this.xpState);
    this.xpState.alpha = 1;
    this.scene.tweens.add({
      targets: this.xpState,
      xp: clamped,
      duration: 320,
      ease: 'Quad.easeOut',
      onUpdate: () => this.draw(),
    });
  }

  /** A bright flash used on level-up. */
  flashXp(): void {
    if (!this.hasXp) return;
    this.scene.tweens.add({
      targets: this.xpState,
      alpha: 0.2,
      duration: 90,
      yoyo: true,
      repeat: 3,
      onUpdate: () => this.draw(),
      onComplete: () => {
        this.xpState.alpha = 1;
        this.draw();
      },
    });
  }

  /** Hide the XP strip for wild or already-fainted creatures. */
  setXpVisible(visible: boolean): void {
    this.xpVisible = visible;
    this.draw();
  }

  get value(): number {
    return this.ratio;
  }

  /** Current ghost (lagging) value, for tests and the debug overlay. */
  get ghostValue(): number {
    return this.ghostRatio;
  }
}
