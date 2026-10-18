/**
 * Preload: bakes every creature's 3D portrait into a texture, paints the
 * biome tilesets, and shows an animated progress bar.
 *
 * Doing this once up front means battles and the overworld never stall. The
 * work is batched (a few creatures per frame) so the progress bar actually
 * animates between 3D renders.
 */

import Phaser from 'phaser';
import { SCENES } from './keys';
import { COLORS, FONTS, VIEW_HEIGHT, VIEW_WIDTH } from '../ui/Theme';
import { CREATURE_IDS, STARTERS } from '../data/creatures';
import { CreatureRig } from '../render/CreatureRig';
import { paintTileset, type Biome } from '../render/tiles/TilePainter';
import { Audio } from '../audio/AudioManager';

const BIOMES: Biome[] = [
  'meadow',
  'forest',
  'city',
  'beach',
  'volcano',
  'cave',
  'ruins',
  'summit',
];

export class PreloadScene extends Phaser.Scene {
  private barFill!: Phaser.GameObjects.Rectangle;
  private statusText!: Phaser.GameObjects.Text;
  private prism!: Phaser.GameObjects.Container;

  private queue: Array<() => Promise<void>> = [];
  private total = 0;
  private completed = 0;

  constructor() {
    super(SCENES.preload);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#05070f');
    this.queue = [];
    this.completed = 0;
    this.total = 0;
    this.buildUi();
    this.buildQueue();
    void this.runQueue();
  }

  private buildUi(): void {
    const cx = VIEW_WIDTH / 2;
    const cy = VIEW_HEIGHT / 2;

    this.prism = this.add.container(cx, cy - 70);
    const colors = [0xff6b35, 0xffd60a, 0x4cd964, 0x2ea8ff, 0x8e5cff, 0x7fffe5];
    const g = this.add.graphics();
    colors.forEach((color, index) => {
      const angle = (index / colors.length) * Math.PI * 2;
      g.fillStyle(color, 1);
      g.fillTriangle(
        0,
        -26,
        Math.cos(angle) * 26,
        Math.sin(angle) * 26,
        Math.cos(angle + 0.7) * 26,
        Math.sin(angle + 0.7) * 26,
      );
    });
    this.prism.add(g);
    this.tweens.add({ targets: this.prism, angle: 360, duration: 2600, repeat: -1 });

    // Progress bar shell.
    const shell = this.add.graphics();
    shell.fillStyle(COLORS.ink, 0.9);
    shell.fillRoundedRect(cx - 210, cy + 24, 420, 14, 7);
    shell.lineStyle(2, COLORS.panelEdge, 0.9);
    shell.strokeRoundedRect(cx - 210, cy + 24, 420, 14, 7);

    this.barFill = this.add.rectangle(cx - 207, cy + 31, 0, 8, COLORS.panelGlow, 1);
    this.barFill.setOrigin(0, 0.5);

    this.statusText = this.add
      .text(cx, cy + 62, 'Preparing creature models...', {
        fontFamily: FONTS.body,
        fontSize: '14px',
        color: '#9fb0cc',
      })
      .setOrigin(0.5);
  }

  private buildQueue(): void {
    const q = this.queue;

    // Starters first so the title screen can show one immediately.
    for (const id of STARTERS) {
      q.push(async () => {
        await CreatureRig.preload(this, id, false);
      });
    }

    // Then everything else, skipping starters already queued.
    for (const id of CREATURE_IDS) {
      if (STARTERS.includes(id)) continue;
      q.push(async () => {
        await CreatureRig.preload(this, id, false);
      });
    }

    // Shiny variants are generated lazily on first encounter, which keeps boot
    // fast; only the starters get theirs up front for the title screen.
    for (const id of STARTERS) {
      q.push(async () => {
        await CreatureRig.preload(this, id, true);
      });
    }

    // Tilesets and backgrounds are synchronous canvas painting.
    for (const biome of BIOMES) {
      q.push(async () => {
        paintTileset(this, biome);
      });
    }

    this.total = q.length;
  }

  private async runQueue(): Promise<void> {
    const batchSize = 2;
    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, batchSize);
        await Promise.all(batch.map((task) => task()));
        this.completed += batch.length;
        this.updateProgress();
        await nextFrame(this);
      }
    } catch (error) {
      console.error('Prismara 3D startup failed', error);
      this.statusText.setFontSize('12px');
      this.statusText.setWordWrapWidth(700, true);
      this.statusText.setText('Prismara 3D startup failed. Reload the page to retry.');
      this.barFill.fillColor = COLORS.danger;
      return;
    }

    this.statusText.setText('Ready!');
    this.barFill.fillColor = COLORS.hpHigh;
    await delay(this, 320);

    // Try to start the music; if audio is still locked it will begin on the
    // player's first interaction instead.
    Audio.playMusic('title');
    this.scene.start(SCENES.title);
  }

  private updateProgress(): void {
    const ratio = this.total === 0 ? 1 : this.completed / this.total;
    this.barFill.width = 414 * ratio;
    if (ratio < 0.98) {
      this.statusText.setText(`Drawing 3D creatures... ${Math.round(ratio * 100)}%`);
    }
  }
}

function nextFrame(scene: Phaser.Scene): Promise<void> {
  return new Promise((resolve) => {
    scene.time.delayedCall(0, () => resolve());
  });
}

function delay(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((resolve) => {
    scene.time.delayedCall(ms, () => resolve());
  });
}
