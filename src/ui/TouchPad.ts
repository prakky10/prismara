/**
 * On-screen controls for phones and tablets.
 *
 * A floating D-pad on the left and A/B buttons on the right, both feeding the
 * shared `InputManager` so no game code has to know whether the player is using
 * a keyboard, a controller or their thumbs.
 */

import Phaser from 'phaser';
import type { InputManager, InputAction } from '../core/InputManager';
import { COLORS, DEPTHS, FONTS, VIEW_HEIGHT, VIEW_WIDTH } from './Theme';

interface ButtonSpec {
  action: InputAction;
  label: string;
  x: number;
  y: number;
  radius: number;
  color: number;
}

export class TouchPad extends Phaser.GameObjects.Container {
  private readonly inputManager: InputManager;
  private readonly buttons: Array<{
    spec: ButtonSpec;
    circle: Phaser.GameObjects.Arc;
    label: Phaser.GameObjects.Text;
  }> = [];

  constructor(scene: Phaser.Scene, input: InputManager) {
    super(scene, 0, 0);
    this.inputManager = input;

    const padX = 118;
    const padY = VIEW_HEIGHT - 108;
    const spread = 40;

    const specs: ButtonSpec[] = [
      { action: 'up', label: '\u25b2', x: padX, y: padY - spread, radius: 24, color: 0x2a3a5a },
      { action: 'down', label: '\u25bc', x: padX, y: padY + spread, radius: 24, color: 0x2a3a5a },
      { action: 'left', label: '\u25c0', x: padX - spread, y: padY, radius: 24, color: 0x2a3a5a },
      { action: 'right', label: '\u25b6', x: padX + spread, y: padY, radius: 24, color: 0x2a3a5a },
      {
        action: 'confirm',
        label: 'A',
        x: VIEW_WIDTH - 92,
        y: VIEW_HEIGHT - 118,
        radius: 30,
        color: 0x2f6f4f,
      },
      {
        action: 'cancel',
        label: 'B',
        x: VIEW_WIDTH - 152,
        y: VIEW_HEIGHT - 78,
        radius: 26,
        color: 0x6f3f3f,
      },
      {
        action: 'menu',
        label: 'C',
        x: VIEW_WIDTH - 46,
        y: VIEW_HEIGHT - 56,
        radius: 22,
        color: 0x3f4a6f,
      },
    ];

    for (const spec of specs) {
      const circle = scene.add.circle(spec.x, spec.y, spec.radius, spec.color, 0.55);
      circle.setStrokeStyle(2, 0xffffff, 0.35);
      circle.setScrollFactor(0);
      circle.setDepth(DEPTHS.ui);
      circle.setInteractive({ useHandCursor: false });

      const label = scene.add
        .text(spec.x, spec.y, spec.label, {
          fontFamily: FONTS.body,
          fontSize: '16px',
          color: '#f2f6ff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(DEPTHS.ui + 1);

      const press = (isDown: boolean) => {
        this.inputManager.setTouch(spec.action, isDown);
        circle.setFillStyle(spec.color, isDown ? 0.9 : 0.55);
        circle.setScale(isDown ? 0.94 : 1);
      };

      circle.on('pointerdown', () => press(true));
      circle.on('pointerup', () => press(false));
      circle.on('pointerout', () => press(false));
      circle.on('pointerupoutside', () => press(false));

      this.buttons.push({ spec, circle, label });
    }

    this.setScrollFactor(0).setDepth(DEPTHS.ui);
    scene.add.existing(this);
  }

  override setVisible(visible: boolean): this {
    for (const button of this.buttons) {
      button.circle.setVisible(visible);
      button.label.setVisible(visible);
    }
    // Release everything when hidden so the player never gets stuck moving.
    if (!visible) this.inputManager.clearTouch();
    return this;
  }

  /** Highlight a virtual button (used by the tutorial prompts). */
  flash(action: InputAction): void {
    const button = this.buttons.find((b) => b.spec.action === action);
    if (!button) return;
    this.scene.tweens.add({
      targets: button.circle,
      alpha: 0.35,
      duration: 180,
      yoyo: true,
      repeat: 2,
    });
  }
}

/** True when the device looks touch-first. */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
  );
}

export { COLORS };
