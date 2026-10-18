/**
 * Boot: the smallest possible scene. It configures input and hands straight
 * over to Preload, which does the heavy lifting (rasterising every creature).
 */

import Phaser from 'phaser';
import { SCENES } from './keys';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../ui/Theme';
import { registerSpeciesIndex } from '../core/GameState';
import { CREATURE_IDS } from '../data/creatures';
import { Audio } from '../audio/AudioManager';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create(): void {
    // The Dex needs to know how many species exist for completion percentages.
    registerSpeciesIndex([...CREATURE_IDS]);

    this.cameras.main.setBackgroundColor('#05070f');

    // Draw a tiny prism so there is something on screen even for one frame.
    const g = this.add.graphics();
    const cx = VIEW_WIDTH / 2;
    const cy = VIEW_HEIGHT / 2;
    const colors = [0xff6b35, 0xffd60a, 0x4cd964, 0x2ea8ff, 0x8e5cff, 0x7fffe5];
    colors.forEach((color, index) => {
      const angle = (index / colors.length) * Math.PI * 2;
      g.fillStyle(color, 1);
      g.fillTriangle(
        cx,
        cy - 20,
        cx + Math.cos(angle) * 20,
        cy + Math.sin(angle) * 20,
        cx + Math.cos(angle + 0.6) * 20,
        cy + Math.sin(angle + 0.6) * 20,
      );
    });

    // Audio needs a gesture in every modern browser; the first keypress or tap
    // unlocks it. This is registered once, here.
    const unlock = () => Audio.unlock();
    this.input.keyboard?.once('keydown', unlock);
    this.input.once('pointerdown', unlock);

    this.scene.start(SCENES.preload);
  }
}
