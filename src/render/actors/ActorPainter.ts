/**
 * Procedural overworld actors.
 *
 * A single spritesheet is generated per actor style: four facing directions
 * with three frames each (idle, step-left, step-right), 16x24 pixels per frame,
 * drawn from a small palette. Everything is code — no character art ships.
 */

import Phaser from 'phaser';
import type { SpriteStyle } from '../../world/maps';

export const ACTOR_W = 16;
export const ACTOR_H = 24;
export const FRAMES_PER_DIRECTION = 3;
export const DIRECTION_ORDER = ['down', 'left', 'right', 'up'] as const;

export type Direction = (typeof DIRECTION_ORDER)[number];

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
const shade = (n: number, amount: number): number => {
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const mix = (c: number) =>
    Math.max(0, Math.min(255, Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))));
  return (mix(r) << 16) | (mix(g) << 8) | mix(b);
};

export function actorTextureKey(style: SpriteStyle, id: string): string {
  return `actor:${id}:${style.shirt.toString(16)}:${style.hair.toString(16)}`;
}

/**
 * Paint the spritesheet for an actor and register it. Returns the texture key,
 * which is a valid Phaser spritesheet ready for `add.sprite`.
 */
export function paintActor(scene: Phaser.Scene, id: string, style: SpriteStyle): string {
  const key = actorTextureKey(style, id);
  if (scene.textures.exists(key)) return key;

  const canvas = document.createElement('canvas');
  canvas.width = ACTOR_W * FRAMES_PER_DIRECTION;
  canvas.height = ACTOR_H * DIRECTION_ORDER.length;
  const ctx = canvas.getContext('2d');
  if (!ctx) return key;

  DIRECTION_ORDER.forEach((direction, row) => {
    for (let frame = 0; frame < FRAMES_PER_DIRECTION; frame++) {
      drawActor(ctx, frame * ACTOR_W, row * ACTOR_H, direction, frame, style);
    }
  });

  scene.textures.addSpriteSheet(key, canvas as unknown as HTMLImageElement, {
    frameWidth: ACTOR_W,
    frameHeight: ACTOR_H,
  });
  return key;
}

function drawActor(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  direction: Direction,
  frame: number,
  style: SpriteStyle,
): void {
  const px = (x: number, y: number, w: number, h: number, color: number) => {
    ctx.fillStyle = hex(color);
    ctx.fillRect(ox + x, oy + y, w, h);
  };

  const bob = frame === 1 ? 1 : 0;
  const legOffset = frame === 0 ? 0 : frame === 1 ? -1 : 1;

  const shirtDark = shade(style.shirt, -0.25);
  const skinDark = shade(style.skin, -0.2);
  const hairDark = shade(style.hair, -0.3);

  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(ox + 8, oy + 23, 6, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (they alternate as the character walks).
  px(5, 18 + bob, 2, 5, shirtDark);
  px(9, 18 - legOffset + bob, 2, 5, shirtDark);
  px(4, 22 + bob, 3, 2, 0x2a2a33);
  px(9, 22 - legOffset + bob, 3, 2, 0x2a2a33);

  // Torso.
  px(4, 10 + bob, 8, 9, style.shirt);
  px(4, 10 + bob, 8, 2, shade(style.shirt, 0.15));

  // Arms.
  if (direction === 'left') px(3, 11 + bob, 2, 6, shirtDark);
  else if (direction === 'right') px(11, 11 + bob, 2, 6, shirtDark);
  else {
    px(3, 11 + bob, 2, 6, shirtDark);
    px(11, 11 + bob, 2, 6, shirtDark);
  }

  // Head.
  px(4, 3 + bob, 8, 8, style.skin);
  px(4, 3 + bob, 8, 3, style.hair);
  px(3, 4 + bob, 10, 3, style.hair);
  px(3, 2 + bob, 10, 2, hairDark);

  // Face, depending on which way they look.
  const eyeColor = 0x1a1a24;
  if (direction === 'down') {
    px(6, 7 + bob, 1, 2, eyeColor);
    px(9, 7 + bob, 1, 2, eyeColor);
    px(7, 9 + bob, 2, 1, skinDark);
  } else if (direction === 'left') {
    px(5, 7 + bob, 1, 2, eyeColor);
  } else if (direction === 'right') {
    px(10, 7 + bob, 1, 2, eyeColor);
  } else {
    // Facing away: just hair.
    px(4, 3 + bob, 8, 7, style.hair);
    px(3, 4 + bob, 10, 6, style.hair);
  }
}

/** Frame index for a direction and animation frame. */
export function frameFor(direction: Direction, step: number): number {
  const row = DIRECTION_ORDER.indexOf(direction);
  return row * FRAMES_PER_DIRECTION + (step % FRAMES_PER_DIRECTION);
}

/** A wandering step cycle: 0,1,0,2 repeating. */
export function stepCycle(index: number): number {
  const cycle = [0, 1, 0, 2];
  return cycle[index % cycle.length];
}
