/**
 * Small transient UI: toasts, floating damage numbers and banners.
 */

import Phaser from 'phaser';
import { COLORS, DEPTHS, FONTS, VIEW_HEIGHT, VIEW_WIDTH, mixColor } from './Theme';

/** A short message sliding in from the top of the screen. */
export function toast(
  scene: Phaser.Scene,
  text: string,
  color: number = COLORS.panelGlow,
  durationMs = 1600,
): void {
  const container = scene.add.container(VIEW_WIDTH / 2, 46);
  const label = scene.add
    .text(0, 0, text, {
      fontFamily: FONTS.display,
      fontSize: '15px',
      color: '#f4efe2',
      fontStyle: '700',
    })
    .setOrigin(0.5);
  const width = label.width + 34;
  const bg = scene.add.graphics();
  // Shadow, navy body with a sheen, accent rim and a brass outer line.
  bg.fillStyle(COLORS.shadow, 0.4);
  bg.fillRoundedRect(-width / 2 + 1, -15 + 4, width, 30, 15);
  bg.fillStyle(COLORS.navy, 0.95);
  bg.fillRoundedRect(-width / 2, -15, width, 30, 15);
  bg.fillStyle(COLORS.navyLight, 0.7);
  bg.fillRoundedRect(-width / 2 + 2, -14, width - 4, 13, { tl: 13, tr: 13, bl: 4, br: 4 });
  bg.lineStyle(2, mixColor(color, COLORS.brassDark, 0.2), 1);
  bg.strokeRoundedRect(-width / 2, -15, width, 30, 15);
  bg.lineStyle(1, COLORS.ivory, 0.25);
  bg.strokeRoundedRect(-width / 2 + 2, -13, width - 4, 26, 13);

  container.add([bg, label]);
  container.setDepth(DEPTHS.overlay).setAlpha(0).setY(-10);
  scene.tweens.add({ targets: container, alpha: 1, y: 46, duration: 220, ease: 'Back.easeOut' });
  scene.time.delayedCall(durationMs, () => {
    scene.tweens.add({
      targets: container,
      alpha: 0,
      y: 22,
      duration: 240,
      onComplete: () => container.destroy(),
    });
  });
}

export interface DamageNumberOptions {
  crit?: boolean;
  effectiveness?: number;
  /** "heal" renders green with a plus sign. */
  kind?: 'damage' | 'heal' | 'miss';
  reduced?: boolean;
}

/** A number that pops above a creature and floats away. */
export function damageNumber(
  scene: Phaser.Scene,
  x: number,
  y: number,
  amount: number,
  options: DamageNumberOptions = {},
): void {
  const { crit = false, effectiveness = 1, kind = 'damage', reduced = false } = options;

  if (reduced) {
    // In reduced-effects mode the number simply fades.
    const label = scene.add
      .text(x, y, kind === 'heal' ? `+${amount}` : `${amount}`, {
        fontFamily: FONTS.display,
        fontSize: '22px',
        color: kind === 'heal' ? '#7fff9f' : '#ffffff',
        fontStyle: '700',
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.overlay);
    scene.tweens.add({
      targets: label,
      y: y - 26,
      alpha: 0,
      duration: 600,
      onComplete: () => label.destroy(),
    });
    return;
  }

  const color =
    kind === 'heal'
      ? '#7fff9f'
      : kind === 'miss'
        ? '#9fb0cc'
        : crit
          ? '#ffd60a'
          : effectiveness >= 2
            ? '#ff8f6a'
            : effectiveness <= 0.5
              ? '#9fb0cc'
              : '#ffffff';

  const label = scene.add
    .text(x, y, kind === 'miss' ? 'Miss' : kind === 'heal' ? `+${amount}` : `${amount}`, {
      fontFamily: FONTS.display,
      fontSize: crit ? '32px' : '24px',
      color,
      fontStyle: '700',
      stroke: '#0b1020',
      strokeThickness: 4,
    })
    .setOrigin(0.5)
    .setDepth(DEPTHS.overlay)
    .setScale(0.4);

  scene.tweens.add({
    targets: label,
    scale: crit ? 1.25 : 1,
    duration: 140,
    ease: 'Back.easeOut',
  });

  if (crit) {
    // A little shockwave ring behind a critical hit.
    const ring = scene.add.graphics();
    ring.setDepth(DEPTHS.overlay - 1);
    ring.lineStyle(3, 0xffd60a, 0.9);
    ring.strokeCircle(0, 0, 10);
    ring.setPosition(x, y);
    scene.tweens.add({
      targets: ring,
      scale: 3.2,
      alpha: 0,
      duration: 340,
      onComplete: () => ring.destroy(),
    });
  }

  scene.tweens.add({
    targets: label,
    y: y - 46,
    alpha: 0,
    delay: 220,
    duration: 520,
    ease: 'Quad.easeOut',
    onComplete: () => label.destroy(),
  });
}

/** A big centred banner (level up, evolution, victory). */
export function banner(
  scene: Phaser.Scene,
  text: string,
  color: number = COLORS.gold,
  durationMs = 1500,
): void {
  const label = scene.add
    .text(VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 40, text, {
      fontFamily: FONTS.display,
      fontSize: '30px',
      color: `#${color.toString(16).padStart(6, '0')}`,
      fontStyle: '700',
      stroke: '#0b1020',
      strokeThickness: 7,
    })
    .setOrigin(0.5)
    .setDepth(DEPTHS.overlay)
    .setAlpha(0)
    .setScale(0.8);

  scene.tweens.add({
    targets: label,
    alpha: 1,
    scale: 1,
    duration: 260,
    ease: 'Back.easeOut',
  });
  scene.time.delayedCall(durationMs, () => {
    scene.tweens.add({
      targets: label,
      alpha: 0,
      y: label.y - 30,
      duration: 300,
      onComplete: () => label.destroy(),
    });
  });
}

/** Floating "+N" XP text used after a battle. */
export function xpPopup(scene: Phaser.Scene, x: number, y: number, amount: number): void {
  const label = scene.add
    .text(x, y, `+${amount} EXP`, {
      fontFamily: FONTS.display,
      fontSize: '14px',
      color: '#2ea8ff',
      fontStyle: '700',
      stroke: '#0b1020',
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(DEPTHS.overlay);
  scene.tweens.add({
    targets: label,
    y: y - 34,
    alpha: 0,
    duration: 1100,
    ease: 'Quad.easeOut',
    onComplete: () => label.destroy(),
  });
}
