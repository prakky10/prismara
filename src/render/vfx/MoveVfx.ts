/**
 * Move VFX library — one template per element, configured per move.
 *
 * Each template is a small choreography built from particles, generated
 * sprites and Graphics strokes. `playMoveVfx` returns the moment the effect
 * "lands" so the battle scene can apply hit-stop, shake and damage pop-ups in
 * sync with the visuals.
 */

import Phaser from 'phaser';
import { ELEMENT_INFO, type MoveType } from '../../data/types';

export interface VfxContext {
  scene: Phaser.Scene;
  /** Where the attack starts (the attacker's centre). */
  from: { x: number; y: number };
  /** Where the attack lands (the defender's centre). */
  to: { x: number; y: number };
  depth?: number;
  /** Turn all effects down a notch (the "reduced effects" setting). */
  reduced?: boolean;
}

export interface VfxHandle {
  /** Milliseconds from play() until the attack visually lands. */
  impactAtMs: number;
  /** Resolves when the whole effect has finished. */
  done: Promise<void>;
}

/* ---------------------------------------------------------- particles -- */

function particleTexture(scene: Phaser.Scene, kind: 'mote' | 'shard' | 'spark' | 'leaf' | 'ring'): string {
  const key = `vfx:${kind}`;
  if (scene.textures.exists(key)) return key;

  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  switch (kind) {
    case 'mote':
      g.fillStyle(0xffffff, 1);
      g.fillCircle(8, 8, 8);
      break;
    case 'spark':
      g.fillStyle(0xffffff, 1);
      g.fillRect(7, 0, 2, 16);
      g.fillRect(0, 7, 16, 2);
      break;
    case 'shard':
      g.fillStyle(0xffffff, 1);
      g.beginPath();
      g.moveTo(8, 0);
      g.lineTo(14, 8);
      g.lineTo(8, 16);
      g.lineTo(2, 8);
      g.closePath();
      g.fillPath();
      break;
    case 'leaf':
      g.fillStyle(0xffffff, 1);
      g.beginPath();
      g.moveTo(8, 0);
      g.lineTo(14, 10);
      g.lineTo(8, 16);
      g.lineTo(2, 10);
      g.closePath();
      g.fillPath();
      break;
    case 'ring':
      g.lineStyle(3, 0xffffff, 1);
      g.strokeCircle(16, 16, 14);
      break;
  }
  g.generateTexture(key, kind === 'ring' ? 32 : 16, kind === 'ring' ? 32 : 16);
  g.destroy();
  return key;
}

function elementColor(type: MoveType): number {
  return ELEMENT_INFO[type]?.color ?? 0xffffff;
}

function emitter(
  ctx: VfxContext,
  x: number,
  y: number,
  texture: string,
  config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig,
): Phaser.GameObjects.Particles.ParticleEmitter {
  const e = ctx.scene.add.particles(x, y, texture, {
    blendMode: Phaser.BlendModes.ADD,
    emitting: false,
    ...config,
  });
  e.setDepth(ctx.depth ?? 40);
  return e;
}

/** Destroy an emitter once its longest-lived particle has gone. */
function autoDestroy(ctx: VfxContext, e: Phaser.GameObjects.Particles.ParticleEmitter, ms: number): void {
  ctx.scene.time.delayedCall(ms, () => e.destroy());
}

function impactRing(ctx: VfxContext, x: number, y: number, color: number, size = 1): void {
  const ring = ctx.scene.add.image(x, y, particleTexture(ctx.scene, 'ring'));
  ring.setDepth((ctx.depth ?? 40) - 1);
  ring.setTint(color);
  ring.setScale(size * 0.2);
  ring.setAlpha(0.9);
  ctx.scene.tweens.add({
    targets: ring,
    scale: size * 1.9,
    alpha: 0,
    duration: 380,
    ease: 'Quad.easeOut',
    onComplete: () => ring.destroy(),
  });
}

function flash(ctx: VfxContext, color: number, alpha = 0.5, duration = 140): void {
  const cam = ctx.scene.cameras.main;
  const rect = ctx.scene.add.rectangle(
    cam.width / 2,
    cam.height / 2,
    cam.width * 2,
    cam.height * 2,
    color,
    alpha,
  );
  rect.setScrollFactor(0).setDepth(200).setBlendMode(Phaser.BlendModes.ADD);
  ctx.scene.tweens.add({
    targets: rect,
    alpha: 0,
    duration,
    onComplete: () => rect.destroy(),
  });
}

/* ------------------------------------------------------------ lightning -- */

/**
 * Procedural jagged bolt via midpoint displacement — the classic technique.
 * Returns the stroke points so it can also feed arc sparks.
 */
export function lightningPoints(
  from: Phaser.Math.Vector2,
  to: Phaser.Math.Vector2,
  displacement: number,
  detail: number,
): Phaser.Math.Vector2[] {
  let points = [from.clone(), to.clone()];
  let d = displacement;
  for (let pass = 0; pass < detail; pass++) {
    const next: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const mid = new Phaser.Math.Vector2((a.x + b.x) / 2, (a.y + b.y) / 2);
      const angle = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
      const offset = Phaser.Math.FloatBetween(-d, d);
      mid.x += Math.cos(angle) * offset;
      mid.y += Math.sin(angle) * offset;
      next.push(a, mid);
    }
    next.push(points[points.length - 1]);
    points = next;
    d *= 0.55;
  }
  return points;
}

function drawBolt(
  scene: Phaser.Scene,
  points: Phaser.Math.Vector2[],
  color: number,
  width: number,
  depth: number,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.setDepth(depth);
  g.lineStyle(width, color, 1);
  g.beginPath();
  g.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
  g.strokePath();
  return g;
}

/* ------------------------------------------------------------ templates -- */

function fireVfx(ctx: VfxContext): VfxHandle {
  const { scene, from, to } = ctx;
  const color = elementColor('fire');
  const mote = particleTexture(scene, 'mote');

  const stream = emitter(ctx, from.x, from.y, mote, {
    speed: { min: 200, max: 340 },
    angle: { min: Phaser.Math.RadToDeg(Math.atan2(to.y - from.y, to.x - from.x)) - 18, max: Phaser.Math.RadToDeg(Math.atan2(to.y - from.y, to.x - from.x)) + 18 },
    lifespan: 420,
    quantity: ctx.reduced ? 8 : 18,
    frequency: 26,
    scale: { start: 1.1, end: 0.1 },
    alpha: { start: 0.95, end: 0 },
    tint: [color, 0xffd60a, 0xfff3b0],
  });
  stream.start();

  scene.time.delayedCall(340, () => {
    stream.stop();
    impactRing(ctx, to.x, to.y, color, 1.6);
    const burst = emitter(ctx, to.x, to.y, mote, {
      speed: { min: 60, max: 220 },
      lifespan: 560,
      quantity: ctx.reduced ? 14 : 30,
      scale: { start: 1.3, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [color, 0xffd60a],
    });
    burst.explode(ctx.reduced ? 14 : 30);
    autoDestroy(ctx, burst, 900);
  });
  autoDestroy(ctx, stream, 1000);

  return { impactAtMs: 340, done: wait(scene, 900) };
}

function waterVfx(ctx: VfxContext): VfxHandle {
  const { scene, from, to } = ctx;
  const color = elementColor('water');
  const mote = particleTexture(scene, 'mote');

  const arc = emitter(ctx, from.x, from.y, mote, {
    speed: { min: 180, max: 300 },
    angle: { min: Phaser.Math.RadToDeg(Math.atan2(to.y - from.y, to.x - from.x)) - 26, max: Phaser.Math.RadToDeg(Math.atan2(to.y - from.y, to.x - from.x)) + 26 },
    gravityY: 380,
    lifespan: 520,
    quantity: ctx.reduced ? 6 : 14,
    frequency: 22,
    scale: { start: 0.9, end: 0.2 },
    tint: [color, 0xbfe3ff, 0xffffff],
  });
  arc.start();

  scene.time.delayedCall(360, () => {
    arc.stop();
    const splash = emitter(ctx, to.x, to.y, mote, {
      speed: { min: 50, max: 190 },
      angle: { min: 200, max: 340 },
      gravityY: 300,
      lifespan: 620,
      quantity: ctx.reduced ? 10 : 22,
      scale: { start: 1.1, end: 0 },
      tint: [color, 0xffffff],
    });
    splash.explode(ctx.reduced ? 10 : 22);
    autoDestroy(ctx, splash, 1000);
    impactRing(ctx, to.x, to.y + 10, 0xe0f5ff, 1.4);
  });
  autoDestroy(ctx, arc, 1100);

  return { impactAtMs: 360, done: wait(scene, 1000) };
}

function grassVfx(ctx: VfxContext): VfxHandle {
  const { scene, from, to } = ctx;
  const color = elementColor('grass');
  const leaf = particleTexture(scene, 'leaf');

  const swirl = emitter(ctx, (from.x + to.x) / 2, (from.y + to.y) / 2, leaf, {
    speed: { min: 60, max: 180 },
    lifespan: 700,
    quantity: ctx.reduced ? 6 : 16,
    frequency: 40,
    rotate: { min: 0, max: 360 },
    scale: { start: 1, end: 0.2 },
    tint: [color, 0x2f8f3c, 0xd9f5b8],
  });
  swirl.start();

  // Grow a vine from the attacker toward the target.
  const vine = scene.add.graphics();
  vine.setDepth((ctx.depth ?? 40) - 1);
  const points = [
    new Phaser.Math.Vector2(from.x, from.y),
    new Phaser.Math.Vector2((from.x + to.x) / 2, from.y - 46),
    new Phaser.Math.Vector2(to.x, to.y),
  ];
  const curve = new Phaser.Curves.Spline(points);
  const dots = curve.getSpacedPoints(30);
  const proxy = { t: 0 };
  scene.tweens.add({
    targets: proxy,
    t: 1,
    duration: 320,
    ease: 'Quad.easeIn',
    onUpdate: () => {
      vine.clear();
      vine.lineStyle(5, color, 1);
      vine.beginPath();
      vine.moveTo(dots[0].x, dots[0].y);
      const upto = Math.floor(proxy.t * dots.length);
      for (let i = 1; i < upto; i++) vine.lineTo(dots[i].x, dots[i].y);
      vine.strokePath();
    },
    onComplete: () => {
      impactRing(ctx, to.x, to.y, color, 1.3);
      scene.tweens.add({ targets: vine, alpha: 0, duration: 260, onComplete: () => vine.destroy() });
    },
  });

  scene.time.delayedCall(420, () => swirl.stop());
  autoDestroy(ctx, swirl, 1300);
  return { impactAtMs: 320, done: wait(scene, 1000) };
}

function electricVfx(ctx: VfxContext): VfxHandle {
  const { scene, from, to } = ctx;
  const color = elementColor('electric');
  const spark = particleTexture(scene, 'spark');

  flash(ctx, 0xffffff, 0.4, 110);

  const bolts: Phaser.GameObjects.Graphics[] = [];
  const drawStrike = () => {
    const pts = lightningPoints(
      new Phaser.Math.Vector2(from.x, from.y),
      new Phaser.Math.Vector2(to.x, to.y),
      26,
      4,
    );
    const outer = drawBolt(scene, pts, color, 7, (ctx.depth ?? 40) - 1);
    const inner = drawBolt(scene, pts, 0xffffff, 3, ctx.depth ?? 40);
    outer.setAlpha(0.8);
    bolts.push(outer, inner);
    scene.time.delayedCall(90, () => {
      outer.destroy();
      inner.destroy();
    });
  };

  drawStrike();
  scene.time.delayedCall(120, drawStrike);

  scene.time.delayedCall(120, () => {
    const burst = emitter(ctx, to.x, to.y, spark, {
      speed: { min: 80, max: 260 },
      lifespan: 420,
      quantity: ctx.reduced ? 8 : 18,
      scale: { start: 1.2, end: 0 },
      tint: [color, 0xffffff],
    });
    burst.explode(ctx.reduced ? 8 : 18);
    autoDestroy(ctx, burst, 800);
    impactRing(ctx, to.x, to.y, color, 1.5);
  });

  return { impactAtMs: 120, done: wait(scene, 800) };
}

function shadowVfx(ctx: VfxContext): VfxHandle {
  const { scene, from, to } = ctx;
  const color = elementColor('shadow');
  const mote = particleTexture(scene, 'mote');

  // Tendrils reaching from the attacker to the target.
  const g = scene.add.graphics();
  g.setDepth((ctx.depth ?? 40) - 1);
  const proxy = { t: 0 };
  const tendrils = 5;
  scene.tweens.add({
    targets: proxy,
    t: 1,
    duration: 380,
    ease: 'Quad.easeIn',
    onUpdate: () => {
      g.clear();
      for (let i = 0; i < tendrils; i++) {
        const spread = (i - (tendrils - 1) / 2) * 16;
        const ctrl = new Phaser.Math.Vector2(
          (from.x + to.x) / 2 + spread,
          (from.y + to.y) / 2 + spread * 0.7 - 20,
        );
        const end = new Phaser.Math.Vector2(
          Phaser.Math.Linear(from.x, to.x, proxy.t),
          Phaser.Math.Linear(from.y, to.y, proxy.t),
        );
        g.lineStyle(6 - i * 0.6, color, 0.85);
        g.beginPath();
        g.moveTo(from.x, from.y);
        g.lineTo(ctrl.x, ctrl.y);
        g.lineTo(end.x, end.y);
        g.strokePath();
      }
    },
    onComplete: () => {
      scene.tweens.add({ targets: g, alpha: 0, duration: 300, onComplete: () => g.destroy() });
    },
  });

  scene.time.delayedCall(380, () => {
    const burst = emitter(ctx, to.x, to.y, mote, {
      speed: { min: 40, max: 150 },
      lifespan: 640,
      quantity: ctx.reduced ? 10 : 24,
      scale: { start: 1.2, end: 0 },
      tint: [color, 0x2e2050, 0x120c28],
    });
    burst.explode(ctx.reduced ? 10 : 24);
    autoDestroy(ctx, burst, 1000);
    impactRing(ctx, to.x, to.y, color, 1.6);
    // A brief vignette pulse.
    const vignette = scene.add.rectangle(
      scene.cameras.main.width / 2,
      scene.cameras.main.height / 2,
      scene.cameras.main.width * 2,
      scene.cameras.main.height * 2,
      0x120c28,
      0,
    );
    vignette.setScrollFactor(0).setDepth(190);
    scene.tweens.add({
      targets: vignette,
      alpha: 0.42,
      duration: 180,
      yoyo: true,
      onComplete: () => vignette.destroy(),
    });
  });

  return { impactAtMs: 380, done: wait(scene, 1000) };
}

function crystalVfx(ctx: VfxContext): VfxHandle {
  const { scene, from, to } = ctx;
  const color = elementColor('crystal');
  const shard = particleTexture(scene, 'shard');

  const shards = emitter(ctx, from.x, from.y, shard, {
    speed: { min: 220, max: 380 },
    angle: { min: Phaser.Math.RadToDeg(Math.atan2(to.y - from.y, to.x - from.x)) - 14, max: Phaser.Math.RadToDeg(Math.atan2(to.y - from.y, to.x - from.x)) + 14 },
    lifespan: 480,
    quantity: ctx.reduced ? 6 : 12,
    frequency: 24,
    rotate: { min: 0, max: 360 },
    scale: { start: 1.1, end: 0.3 },
    tint: [color, 0xffffff, 0xffd0ff],
  });
  shards.start();

  // A prismatic beam between the two creatures.
  const beam = scene.add.graphics();
  beam.setDepth((ctx.depth ?? 40) - 2);
  const proxy = { a: 0 };
  scene.tweens.add({
    targets: proxy,
    a: 0.75,
    duration: 180,
    yoyo: true,
    hold: 140,
    onUpdate: () => {
      beam.clear();
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * 12;
      const ny = (dx / len) * 12;
      const bands = [
        { c: 0xff6b35, o: -1 },
        { c: 0xffd60a, o: -0.35 },
        { c: 0x4cd964, o: 0.35 },
        { c: 0x8e5cff, o: 1 },
      ];
      for (const band of bands) {
        beam.lineStyle(6, band.c, proxy.a);
        beam.beginPath();
        beam.moveTo(from.x + nx * band.o, from.y + ny * band.o);
        beam.lineTo(to.x + nx * band.o, to.y + ny * band.o);
        beam.strokePath();
      }
    },
    onComplete: () => beam.destroy(),
  });

  scene.time.delayedCall(300, () => {
    shards.stop();
    const burst = emitter(ctx, to.x, to.y, shard, {
      speed: { min: 70, max: 240 },
      lifespan: 560,
      quantity: ctx.reduced ? 10 : 22,
      rotate: { min: 0, max: 360 },
      scale: { start: 1.3, end: 0 },
      tint: [color, 0xffffff],
    });
    burst.explode(ctx.reduced ? 10 : 22);
    autoDestroy(ctx, burst, 900);
    impactRing(ctx, to.x, to.y, color, 1.5);
  });
  autoDestroy(ctx, shards, 1200);

  return { impactAtMs: 300, done: wait(scene, 1000) };
}

function neutralVfx(ctx: VfxContext): VfxHandle {
  const { scene, from, to } = ctx;
  const color = 0xf2f6ff;
  const mote = particleTexture(scene, 'mote');

  const dash = emitter(ctx, from.x, from.y, mote, {
    speed: { min: 260, max: 340 },
    angle: { min: Phaser.Math.RadToDeg(Math.atan2(to.y - from.y, to.x - from.x)) - 8, max: Phaser.Math.RadToDeg(Math.atan2(to.y - from.y, to.x - from.x)) + 8 },
    lifespan: 220,
    quantity: ctx.reduced ? 5 : 10,
    frequency: 16,
    scale: { start: 0.7, end: 0.1 },
    tint: [color, 0xffffff],
  });
  dash.start();

  scene.time.delayedCall(200, () => {
    dash.stop();
    impactRing(ctx, to.x, to.y, color, 1.1);
    const burst = emitter(ctx, to.x, to.y, mote, {
      speed: { min: 40, max: 160 },
      lifespan: 380,
      quantity: ctx.reduced ? 6 : 14,
      scale: { start: 0.9, end: 0 },
      tint: [color, 0xffffff],
    });
    burst.explode(ctx.reduced ? 6 : 14);
    autoDestroy(ctx, burst, 700);
  });
  autoDestroy(ctx, dash, 700);

  return { impactAtMs: 200, done: wait(scene, 700) };
}

const TEMPLATES: Record<MoveType, (ctx: VfxContext) => VfxHandle> = {
  fire: fireVfx,
  water: waterVfx,
  grass: grassVfx,
  electric: electricVfx,
  shadow: shadowVfx,
  crystal: crystalVfx,
  neutral: neutralVfx,
};

function wait(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((resolve) => scene.time.delayedCall(ms, () => resolve()));
}

/** Play the effect for a move type. Never throws — falls back to Neutral. */
export function playMoveVfx(ctx: VfxContext, type: MoveType): VfxHandle {
  const template = TEMPLATES[type] ?? neutralVfx;
  try {
    return template(ctx);
  } catch {
    return { impactAtMs: 160, done: Promise.resolve() };
  }
}

/** A type-coloured shatter wipe used for battle transitions. */
export function typeWipe(scene: Phaser.Scene, type: MoveType, onCovered: () => void): void {
  const color = elementColor(type);
  const { width, height } = scene.cameras.main;
  const shards: Phaser.GameObjects.Rectangle[] = [];
  const cols = 12;
  const rows = 7;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const rect = scene.add.rectangle(
        (x + 0.5) * (width / cols),
        (y + 0.5) * (height / rows),
        width / cols + 2,
        height / rows + 2,
        Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.IntegerToColor(color),
          Phaser.Display.Color.IntegerToColor(0x0b1020),
          100,
          (x + y) % 100,
        ).color,
        0,
      );
      rect.setScrollFactor(0).setDepth(300);
      rect.setScale(0);
      shards.push(rect);
    }
  }

  let done = 0;
  shards.forEach((rect, index) => {
    scene.tweens.add({
      targets: rect,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 320,
      delay: index * 6,
      ease: 'Quad.easeOut',
      onComplete: () => {
        done++;
        if (done === 1) onCovered();
      },
    });
  });
}

/** Cover the screen in a type colour, run `midpoint`, then reveal again. */
export async function wipeTransition(
  scene: Phaser.Scene,
  type: MoveType,
  midpoint?: () => void | Promise<void>,
): Promise<void> {
  const color = elementColor(type);
  const { width, height } = scene.cameras.main;
  const cover = scene.add.rectangle(width / 2, height / 2, width * 2, height * 2, color, 1);
  cover.setScrollFactor(0).setDepth(300).setAlpha(0);
  await tween(scene, cover, { alpha: 1, duration: 220 });
  await midpoint?.();
  await tween(scene, cover, { alpha: 0, duration: 260 });
  cover.destroy();
}

function tween(
  scene: Phaser.Scene,
  target: object,
  props: Record<string, number>,
): Promise<void> {
  return new Promise((resolve) => {
    scene.tweens.add({ targets: target, ...props, onComplete: () => resolve() });
  });
}
