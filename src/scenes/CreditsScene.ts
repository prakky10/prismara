/**
 * Credits: a slow scroll of the team plus the full Prismadex roll call, with
 * the region's creature silhouettes drifting past.
 */

import Phaser from 'phaser';
import { SCENES } from './keys';
import { DEPTHS, FONTS, VIEW_HEIGHT, VIEW_WIDTH } from '../ui/Theme';
import { InputManager } from '../core/InputManager';
import { Audio } from '../audio/AudioManager';
import { CREATURE_IDS, getSpecies } from '../data/creatures';
import { CreatureRig } from '../render/CreatureRig';

const LINES: string[] = [
  'PRISMARA',
  '',
  'An original monster-collecting RPG',
  '',
  'Design, code and art pipeline',
  '  the Prismara team',
  '',
  'Engine',
  '  Phaser 3 + TypeScript + Vite',
  '',
  'Creature art',
  '  Procedurally generated SVG rigs',
  '  9 body plans \u00d7 40 palettes',
  '',
  'Music and sound',
  '  Synthesised at runtime by the',
  '  built-in chiptune sequencer',
  '',
  'Battle engine',
  '  Pure TypeScript, fully unit tested',
  '',
  'Every creature, move, item and map',
  'in this game was authored for it.',
  '',
  'No third-party assets were used.',
  '',
];

export class CreditsScene extends Phaser.Scene {
  private controls!: InputManager;
  private scrollContainer!: Phaser.GameObjects.Container;
  private totalHeight = 0;
  private speed = 42;

  constructor() {
    super(SCENES.credits);
  }

  create(): void {
    this.controls = new InputManager(this);
    this.cameras.main.setBackgroundColor('#05070f');
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x161f3d, 0x161f3d, 0x05070f, 0x05070f, 1);
    bg.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    Audio.playMusic('credits');

    this.scrollContainer = this.add.container(VIEW_WIDTH / 2, VIEW_HEIGHT + 40).setDepth(DEPTHS.ui);
    this.buildRoll();

    this.add
      .text(VIEW_WIDTH / 2, VIEW_HEIGHT - 22, 'Press X to return to the title', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        color: '#6d7d99',
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.overlay);
  }

  private buildRoll(): void {
    let y = 0;
    for (const line of LINES) {
      const isTitle = line === 'PRISMARA';
      const text = this.add
        .text(0, y, line, {
          fontFamily: FONTS.body,
          fontSize: isTitle ? '38px' : '16px',
          color: isTitle ? '#7fffe5' : '#dce6f7',
          fontStyle: isTitle ? 'bold' : 'normal',
          align: 'left',
        })
        .setOrigin(0.5, 0);
      this.scrollContainer.add(text);
      y += isTitle ? 60 : 26;
    }

    y += 30;
    const dexTitle = this.add
      .text(0, y, 'THE PRISMADEX', {
        fontFamily: FONTS.body,
        fontSize: '24px',
        color: '#ffd60a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);
    this.scrollContainer.add(dexTitle);
    y += 48;

    // The roll call, with a small silhouette beside each name.
    CREATURE_IDS.forEach((id, index) => {
      const species = getSpecies(id);
      const rowY = y + index * 34;
      const label = this.add
        .text(-40, rowY, `#${String(species.dexNumber).padStart(3, '0')}  ${species.name}`, {
          fontFamily: FONTS.body,
          fontSize: '15px',
          color: '#dce6f7',
        })
        .setOrigin(0, 0.5);
      this.scrollContainer.add(label);

      const element = this.add
        .text(300, rowY, species.element.toUpperCase(), {
          fontFamily: FONTS.body,
          fontSize: '13px',
          color: '#7d8aa3',
        })
        .setOrigin(1, 0.5);
      this.scrollContainer.add(element);

      const rig = new CreatureRig(this, id, { scale: 0.42 });
      rig.setPosition(-170, rowY + 14);
      this.scrollContainer.add(rig);
    });

    y += CREATURE_IDS.length * 34 + 60;
    const end = this.add
      .text(0, y, 'Thank you for playing.', {
        fontFamily: FONTS.body,
        fontSize: '22px',
        color: '#7fffe5',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);
    this.scrollContainer.add(end);

    this.totalHeight = y + 80;
  }

  override update(_time: number, delta: number): void {
    this.controls.update();

    this.scrollContainer.y -= (this.speed * delta) / 1000;

    // Loop back to the top once the whole roll has passed.
    if (this.scrollContainer.y < -this.totalHeight) {
      this.scrollContainer.y = VIEW_HEIGHT + 40;
    }

    if (this.controls.justPressed('cancel') || this.controls.justPressed('confirm')) {
      Audio.playSfx('back');
      this.scene.start(SCENES.title);
    }
  }
}
