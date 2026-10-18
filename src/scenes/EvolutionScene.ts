/**
 * The evolution cinematic: a white silhouette pulse morphs the old form into
 * the new one over a swirling elemental backdrop. Press B to cancel.
 */

import Phaser from 'phaser';
import { SCENES } from './keys';
import { COLORS, DEPTHS, FONTS, VIEW_HEIGHT, VIEW_WIDTH } from '../ui/Theme';
import { InputManager } from '../core/InputManager';
import { Audio } from '../audio/AudioManager';
import { Game } from '../world/GameContext';
import { CreatureRig } from '../render/CreatureRig';
import {
  displayName,
  restorePp,
  speciesOf,
  type CreatureInstance,
} from '../battle/Creature';
import { getSpecies } from '../data/creatures';
import { ELEMENT_INFO } from '../data/types';
import { banner } from '../ui/Popups';
import { toast } from '../ui/Popups';

export interface EvolutionData {
  uid: string;
  into: string;
  returnTo?: string;
}

export class EvolutionScene extends Phaser.Scene {
  private controls!: InputManager;
  private creature: CreatureInstance | null = null;
  private into = '';
  private cancelling = false;
  private evolving = false;

  constructor() {
    super(SCENES.evolution);
  }

  create(data: EvolutionData): void {
    this.controls = new InputManager(this);
    this.into = data.into;
    this.creature = Game.state.party.find((c) => c.uid === data.uid) ?? null;

    this.cameras.main.setBackgroundColor('#05070f');
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x121a33, 0x121a33, 0x05070f, 0x05070f, 1);
    bg.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    if (!this.creature) {
      this.finish();
      return;
    }

    this.buildBackdrop();
    this.startSequence();
  }

  private buildBackdrop(): void {
    const species = getSpecies(this.into);
    const color = ELEMENT_INFO[species.element].color;

    // Swirling motes drawn toward the centre.
    const emitter = this.add.particles(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, undefined, {
      speed: { min: 40, max: 140 },
      angle: { min: 0, max: 360 },
      lifespan: 2200,
      frequency: 30,
      quantity: 2,
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: [color, 0xffffff, ELEMENT_INFO[species.element].lightColor],
      blendMode: Phaser.BlendModes.ADD,
      texture: this.moteTexture(),
    });
    emitter.setDepth(DEPTHS.background + 1);
    this.time.delayedCall(4200, () => emitter.stop());

    const ring = this.add.graphics().setDepth(DEPTHS.background + 2);
    ring.lineStyle(3, color, 0.5);
    ring.strokeCircle(VIEW_WIDTH / 2, 300, 120);
    this.tweens.add({
      targets: ring,
      scale: 1.6,
      alpha: 0,
      duration: 1600,
      yoyo: true,
      repeat: -1,
    });
  }

  private moteTexture(): string {
    const key = 'evolution-mote';
    if (!this.textures.exists(key)) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(8, 8, 8);
      g.generateTexture(key, 16, 16);
      g.destroy();
    }
    return key;
  }

  private async startSequence(): Promise<void> {
    const creature = this.creature!;
    const fromSpecies = speciesOf(creature);
    const intoSpecies = getSpecies(this.into);

    Audio.playMusic('evolution');
    Audio.playCry(creature.speciesId, fromSpecies.dexNumber, fromSpecies.tier);

    const label = this.add
      .text(VIEW_WIDTH / 2, 120, `What? ${displayName(creature)} is evolving!`, {
        fontFamily: FONTS.body,
        fontSize: '20px',
        color: '#f2f6ff',
        stroke: '#0b1020',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.overlay)
      .setAlpha(0);

    this.tweens.add({ targets: label, alpha: 1, duration: 300 });

    const rig = new CreatureRig(this, creature.speciesId, {
      shiny: creature.shiny,
      scale: 2.1,
      facing: -1,
    });
    rig.setPosition(VIEW_WIDTH / 2, 400);
    rig.setDepth(DEPTHS.actors);

    const hint = this.add
      .text(VIEW_WIDTH / 2, VIEW_HEIGHT - 34, 'Press B to cancel', {
        fontFamily: FONTS.body,
        fontSize: '12px',
        color: '#9fb0cc',
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.overlay);

    this.evolving = true;

    // Wait through the "hold" window so the player can cancel.
    await wait(this, 900);
    if (this.cancelling) return;

    // The silhouette pulse: the rig goes white and shrinks while the new form
    // is being prepared.
    const flash = this.add.rectangle(VIEW_WIDTH / 2, 400, 420, 420, 0xffffff, 0);
    flash.setDepth(DEPTHS.actors + 1).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: flash, fillAlpha: 0.85, duration: 200 });
    this.tweens.add({
      targets: rig,
      scaleX: -2.4,
      scaleY: 2.4,
      duration: 420,
      ease: 'Quad.easeInOut',
    });
    Audio.playSfx('evolve');

    await wait(this, 520);
    if (this.cancelling) return;

    // Swap to the evolved form.
    creature.pendingEvolution = null;
    const beforeName = displayName(creature);
    creature.speciesId = this.into;
    creature.ability = intoSpecies.ability;
    // The evolved form keeps its moves but learns nothing new for free.
    restorePp(creature);

    rig.destroy();
    const newRig = new CreatureRig(this, this.into, {
      shiny: creature.shiny,
      scale: 1.2,
      facing: -1,
    });
    newRig.setPosition(VIEW_WIDTH / 2, 400);
    newRig.setDepth(DEPTHS.actors);
    newRig.setAlpha(1);

    this.tweens.add({ targets: flash, fillAlpha: 0, duration: 400 });
    this.tweens.add({
      targets: newRig,
      scaleX: -2.1,
      scaleY: 2.1,
      duration: 520,
      ease: 'Back.easeOut',
    });

    Game.state.markCaught(this.into, creature.shiny, creature.metLocation);
    Audio.playCry(this.into, intoSpecies.dexNumber, intoSpecies.tier);

    label.setText(`${beforeName} evolved into ${intoSpecies.name}!`);
    banner(this, 'EVOLUTION!', ELEMENT_INFO[intoSpecies.element].color, 1400);
    hint.destroy();

    this.evolving = false;
    await wait(this, 2200);
    this.finish();
  }

  private finish(): void {
    Audio.playMusic('title');
    this.scene.start(SCENES.overworld);
  }

  override update(): void {
    this.controls.update();
    if (!this.evolving) return;
    if (this.controls.justPressed('cancel')) {
      this.cancelling = true;
      this.evolving = false;
      Audio.playSfx('back');
      toast(this, 'Evolution cancelled.', COLORS.textDim);
      this.time.delayedCall(700, () => this.finish());
    }
  }
}

function wait(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((resolve) => scene.time.delayedCall(ms, () => resolve()));
}
