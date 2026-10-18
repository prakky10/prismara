/**
 * The animated creature sprite.
 *
 * A rig shows a cached 3D portrait of a species inside a container and drives it
 * with procedural animation:
 *
 *   idle    breathing scale and a gentle float
 *   attack  anticipation squash -> lunge -> overshoot -> settle
 *   hurt    white flash, knock-back, shake
 *   faint   drop plus a dissolve into elemental particles
 *   shiny   sparkle burst on entry
 */

import Phaser from 'phaser';
import { getSpecies } from '../data/creatures';
import { ELEMENT_INFO } from '../data/types';
import { renderCreaturePortrait } from './three/Portraits3D';

const ART_SIZE = 256;
const GROUND = 256;

function modelTextureKey(speciesId: string, shiny: boolean): string {
  return `model3d-${speciesId}-${shiny ? 1 : 0}`;
}

export interface RigOptions {
  shiny?: boolean;
  /** 1 faces right (the wild side), -1 mirrors for the player's side. */
  facing?: 1 | -1;
  /** Extra scale on top of the art's natural size. */
  scale?: number;
  /** Floating creatures hover; this adds a gentle vertical bob. */
  floating?: boolean;
}

const FLOATING_PLANS = new Set(['floater', 'moth', 'bird', 'bug']);

export class CreatureRig extends Phaser.GameObjects.Container {
  readonly speciesId: string;
  readonly shiny: boolean;

  private readonly partImages = new Map<string, Phaser.GameObjects.Image>();
  private readonly eyes: Phaser.GameObjects.Image | null;
  private readonly head: Phaser.GameObjects.Image | null;
  private readonly swayParts: Phaser.GameObjects.Image[] = [];
  private blinkTimer?: Phaser.Time.TimerEvent;
  private idleTweens: Phaser.Tweens.Tween[] = [];
  private isFloating: boolean;
  private baseScale: number;
  private destroyed = false;

  constructor(scene: Phaser.Scene, speciesId: string, options: RigOptions = {}) {
    super(scene, 0, 0);
    this.speciesId = speciesId;
    this.shiny = options.shiny ?? false;

    const species = getSpecies(speciesId);

    const image = scene.add.image(0, -ART_SIZE / 2, modelTextureKey(speciesId, this.shiny));
    image.setOrigin(0.5, 0.5);
    this.partImages.set('body', image);
    this.add(image);

    this.eyes = null;
    this.head = null;
    this.isFloating = options.floating ?? FLOATING_PLANS.has(species.body);

    this.baseScale = options.scale ?? 1;
    this.setScale((options.facing ?? 1) * this.baseScale, this.baseScale);
    scene.add.existing(this);

    this.startIdle();
    if (this.shiny) this.playShinyBurst();
  }

  /** Render the portrait this rig needs into a texture. Await before constructing. */
  static async preload(scene: Phaser.Scene, speciesId: string, shiny = false): Promise<void> {
    const key = modelTextureKey(speciesId, shiny);
    if (scene.textures.exists(key)) return;
    scene.textures.addCanvas(key, renderCreaturePortrait(speciesId, shiny));
  }

  /** Preload a whole list of species (deduplicated). */
  static async preloadMany(
    scene: Phaser.Scene,
    entries: Array<{ speciesId: string; shiny?: boolean }>,
  ): Promise<void> {
    const seen = new Set<string>();
    const jobs: Promise<void>[] = [];
    for (const entry of entries) {
      const id = `${entry.speciesId}:${entry.shiny ? 's' : ''}`;
      if (seen.has(id)) continue;
      seen.add(id);
      jobs.push(CreatureRig.preload(scene, entry.speciesId, entry.shiny ?? false));
    }
    await Promise.all(jobs);
  }

  /** Height of the drawn art at the current scale. */
  get artHeight(): number {
    return GROUND * this.baseScale;
  }

  get artWidth(): number {
    return ART_SIZE * this.baseScale;
  }

  private startIdle(): void {
    const scene = this.scene;
    if (!scene) return;

    // Breathing.
    this.idleTweens.push(
      scene.tweens.add({
        targets: this,
        scaleY: this.scaleY * 1.025,
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    );

    // Head bob.
    if (this.head) {
      this.idleTweens.push(
        scene.tweens.add({
          targets: this.head,
          y: this.head.y - 2.2,
          duration: 1700,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }),
      );
    }

    // Tail / wing sway.
    for (const part of this.swayParts) {
      const amount = (part.getData('sway') as number) ?? 6;
      const offset = (part.getData('swayOffset') as number) ?? 0;
      scene.tweens.add({
        targets: part,
        angle: { from: -amount, to: amount },
        duration: 1500 + offset * 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: offset * 400,
      });
    }

    // Floating creatures gently hover.
    if (this.isFloating) {
      this.idleTweens.push(
        scene.tweens.add({
          targets: this,
          y: this.y - 5,
          duration: 1900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }),
      );
    }

    // Blinking.
    this.blinkTimer = scene.time.addEvent({
      delay: Phaser.Math.Between(2200, 4600),
      loop: true,
      callback: () => this.blink(),
    });
  }

  private blink(): void {
    if (this.destroyed || !this.eyes) return;
    this.scene?.tweens.add({
      targets: this.eyes,
      scaleY: 0.12,
      duration: 70,
      yoyo: true,
      hold: 10,
      ease: 'Quad.easeOut',
    });
  }

  /** The anticipation-squash, lunge, overshoot and settle of an attack. */
  playAttack(onImpact?: () => void): void {
    const scene = this.scene;
    if (!scene || this.destroyed) return;
    const dir = Math.sign(this.scaleX) || 1;
    const baseY = this.y;

    scene.tweens.chain({
      targets: this,
      tweens: [
        { scaleX: this.scaleX * 0.94, scaleY: this.scaleY * 1.1, duration: 110, ease: 'Quad.easeOut' },
        {
          x: this.x + 46 * dir,
          y: baseY - 10,
          scaleX: this.scaleX * 1.12,
          scaleY: this.scaleY * 0.94,
          duration: 130,
          ease: 'Quad.easeIn',
          onStart: () => onImpact?.(),
        },
        { x: this.x, y: baseY, scaleX: Math.sign(this.scaleX) * this.baseScale, scaleY: this.baseScale, duration: 190, ease: 'Back.easeOut' },
      ],
    });
  }

  /** White flash, a shove backwards and a rattle. */
  playHurt(direction = 1): void {
    const scene = this.scene;
    if (!scene || this.destroyed) return;
    const images = [...this.partImages.values()];
    for (const img of images) img.setTintFill(0xffffff);
    scene.time.delayedCall(90, () => {
      if (this.destroyed) return;
      for (const img of images) {
        if (this.shiny) img.setTint(0xffe9a0);
        else img.clearTint();
      }
    });

    const baseX = this.x;
    scene.tweens.chain({
      targets: this,
      tweens: [
        { x: baseX - 14 * direction, duration: 70, ease: 'Quad.easeOut' },
        { x: baseX + 6 * direction, duration: 70, ease: 'Quad.easeInOut' },
        {
          x: baseX,
          duration: 90,
          ease: 'Quad.easeInOut',
        },
      ],
    });
    scene.cameras.main.shake(120, 0.004);
  }

  /** Drop, then dissolve into elemental motes. */
  playFaint(element = 'neutral'): void {
    const scene = this.scene;
    if (!scene || this.destroyed) return;
    const color = ELEMENT_INFO[element as keyof typeof ELEMENT_INFO]?.color ?? 0xffffff;

    this.stopIdle();
    scene.tweens.add({
      targets: this,
      angle: 26 * (Math.sign(this.scaleX) || 1),
      y: this.y + 26,
      alpha: 0,
      duration: 520,
      ease: 'Quad.easeIn',
    });

    const emitter = scene.add.particles(this.x, this.y - 40, undefined, {
      speed: { min: 40, max: 150 },
      angle: { min: 200, max: 340 },
      lifespan: 700,
      quantity: 26,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [color, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
      // A tiny generated sprite keeps this dependency-free.
      texture: this.generatedMoteTexture(color),
    });
    emitter.setDepth(this.depth + 1);
    emitter.explode(26);
    scene.time.delayedCall(900, () => emitter.destroy());
  }

  /** A 1-frame soft circle used for particle effects. */
  private generatedMoteTexture(color: number): string {
    const key = `mote-${color.toString(16)}`;
    if (!this.scene.textures.exists(key)) {
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(8, 8, 8);
      g.generateTexture(key, 16, 16);
      g.destroy();
    }
    return key;
  }

  /** Shiny entry sparkle. */
  playShinyBurst(): void {
    const scene = this.scene;
    if (!scene || this.destroyed) return;
    const emitter = scene.add.particles(this.x, this.y - 50, undefined, {
      speed: { min: 30, max: 90 },
      lifespan: 800,
      quantity: 14,
      scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xfff3a0, 0xffffff, 0x9fffe5],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
      texture: this.generatedMoteTexture(0xfff3a0),
    });
    emitter.explode(14);
    scene.time.delayedCall(1000, () => emitter.destroy());
  }

  /** A brief pop used on level-up and evolution. */
  playCelebrate(): void {
    const scene = this.scene;
    if (!scene || this.destroyed) return;
    scene.tweens.add({
      targets: this,
      scaleX: Math.sign(this.scaleX) * this.baseScale * 1.15,
      scaleY: this.baseScale * 1.15,
      duration: 160,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  /** Shake + red tint for a fraction of a second, for damage feedback. */
  playDamageFlash(): void {
    const scene = this.scene;
    if (!scene || this.destroyed) return;
    const images = [...this.partImages.values()];
    for (const img of images) img.setTint(0xff8080);
    scene.time.delayedCall(110, () => {
      if (this.destroyed) return;
      for (const img of images) {
        if (this.shiny) img.setTint(0xffe9a0);
        else img.clearTint();
      }
    });
  }

  private stopIdle(): void {
    this.idleTweens.forEach((t) => t.stop());
    this.idleTweens = [];
    this.blinkTimer?.remove();
    this.blinkTimer = undefined;
  }

  /** Face left or right without changing the rest of the rig. */
  setFacing(facing: 1 | -1): void {
    this.setScale(facing * this.baseScale, this.baseScale);
  }

  override destroy(fromScene?: boolean): void {
    this.destroyed = true;
    this.stopIdle();
    super.destroy(fromScene);
  }
}
