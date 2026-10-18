/**
 * An animated HP bar with a lag-behind "damage ghost".
 *
 *  - The fill drains smoothly and shifts green -> yellow -> red.
 *  - A pale ghost bar trails behind so the player can see how much was lost.
 *  - An optional XP bar with a level-up flash sits underneath.
 */

import Phaser from 'phaser';
import { COLORS } from './Theme';

export interface HPBarOptions {
  width: number;
  height?: number;
  /** Show the "current / max" number beside the bar. */
  showNumbers?: boolean;
  /** Show the XP bar underneath. */
  showXp?: boolean;
}

export class HPBar extends Phaser.GameObjects.Container {
  private readonly shell: Phaser.GameObjects.Graphics;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly ghost: Phaser.GameObjects.Rectangle;
  private readonly xpFill: Phaser.GameObjects.Rectangle | null;
  private readonly label: Phaser.GameObjects.Text | null;

  private ratio = 1;
  private ghostRatio = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, options: HPBarOptions) {
    super(scene, x, y);
    const { width, height = 8, showNumbers = false, showXp = false } = options;

    this.shell = scene.add.graphics();
    this.shell.fillStyle(COLORS.ink, 0.85);
    this.shell.fillRoundedRect(-width / 2 - 1, -height / 2 - 1, width + 2, height + 2, 4);
    this.shell.lineStyle(1, 0xffffff, 0.18);
    this.shell.strokeRoundedRect(-width / 2 - 1, -height / 2 - 1, width + 2, height + 2, 4);
    this.add(this.shell);

    this.ghost = scene.add.rectangle(-width / 2, 0, width, height, 0xffffff, 0.55);
    this.ghost.setOrigin(0, 0.5);
    this.add(this.ghost);

    this.fill = scene.add.rectangle(-width / 2, 0, width, height, COLORS.hpHigh, 1);
    this.fill.setOrigin(0, 0.5);
    this.add(this.fill);

    if (showXp) {
      this.xpFill = scene.add.rectangle(-width / 2, height / 2 + 4, 0, 4, COLORS.xp, 1);
      this.xpFill.setOrigin(0, 0.5);
      this.add(this.xpFill);
    } else {
      this.xpFill = null;
    }

    if (showNumbers) {
      this.label = scene.add
        .text(width / 2, -height / 2 - 12, '', {
          fontFamily: '"Nunito", system-ui, sans-serif',
          fontSize: '13px',
          color: '#f2f6ff',
        })
        .setOrigin(1, 0.5);
      this.add(this.label);
    } else {
      this.label = null;
    }

    scene.add.existing(this);
  }

  /** Animate to a new HP value. */
  set(current: number, max: number, animate = true): void {
    const next = max <= 0 ? 0 : Phaser.Math.Clamp(current / max, 0, 1);
    const previous = this.ratio;
    this.ratio = next;

    if (animate) {
      this.scene.tweens.killTweensOf(this.fill);
      this.scene.tweens.add({
        targets: this.fill,
        scaleX: next,
        duration: Math.max(120, Math.abs(next - previous) * 900),
        ease: 'Quad.easeOut',
      });
      // The ghost catches up a beat later.
      this.scene.tweens.add({
        targets: this.ghost,
        scaleX: next,
        delay: 260,
        duration: 420,
        ease: 'Quad.easeOut',
      });
    } else {
      this.fill.scaleX = next;
      this.ghost.scaleX = next;
    }
    this.ghostRatio = next;

    this.fill.fillColor = this.colorFor(next);
    if (this.label) this.label.setText(`${Math.max(0, Math.round(current))} / ${max}`);
  }

  private colorFor(ratio: number): number {
    if (ratio > 0.5) return COLORS.hpHigh;
    if (ratio > 0.2) return COLORS.hpMid;
    return COLORS.hpLow;
  }

  /** Flash the bar when the creature takes a hit. */
  flashDamage(): void {
    this.scene.tweens.add({
      targets: this.fill,
      alpha: 0.35,
      duration: 80,
      yoyo: true,
      repeat: 1,
    });
  }

  /** Update the XP bar under the HP bar (0..1). */
  setXp(progress: number): void {
    if (!this.xpFill) return;
    const clamped = Phaser.Math.Clamp(progress, 0, 1);
    this.scene.tweens.killTweensOf(this.xpFill);
    this.scene.tweens.add({
      targets: this.xpFill,
      scaleX: clamped,
      duration: 320,
      ease: 'Quad.easeOut',
    });
  }

  /** A bright flash used on level-up. */
  flashXp(): void {
    if (!this.xpFill) return;
    this.scene.tweens.add({
      targets: this.xpFill,
      alpha: 0.2,
      duration: 90,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        if (this.xpFill) this.xpFill.alpha = 1;
      },
    });
  }

  /** Hide the XP strip for wild or already-fainted creatures. */
  setXpVisible(visible: boolean): void {
    this.xpFill?.setVisible(visible);
  }

  get value(): number {
    return this.ratio;
  }

  /** Current ghost (lagging) value, for tests and the debug overlay. */
  get ghostValue(): number {
    return this.ghostRatio;
  }
}
