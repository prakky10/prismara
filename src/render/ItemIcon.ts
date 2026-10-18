/**
 * Small vector item icons drawn entirely with Phaser Graphics so they need no
 * emoji or external fonts. `createItemIcon` returns a container the caller can
 * position, scale or destroy.
 */

import Phaser from 'phaser';
import { ITEMS, type ItemEffect, type ItemId } from '../data/items';

type MarkKind = 'none' | 'wave' | 'leaf' | 'bolt' | 'clock' | 'nest' | 'star' | 'moon';

interface OrbStyle {
  top: number;
  bottom: number;
  mark: MarkKind;
  markColor: number;
}

const BALL_RADIUS = 18;
const SHELL = 0x141019;
const IVORY = 0xf4ecd9;

const ORB_STYLES: Partial<Record<ItemId, OrbStyle>> = {
  'prism-orb': { top: 0xd9534f, bottom: IVORY, mark: 'none', markColor: 0xffffff },
  'great-prism': { top: 0x3f8fd4, bottom: IVORY, mark: 'none', markColor: 0xffffff },
  'ultra-prism': { top: 0xd4af37, bottom: IVORY, mark: 'none', markColor: 0xffffff },
  'dusk-orb': { top: 0x4a3b7a, bottom: 0x1a1730, mark: 'moon', markColor: 0xe8e0ff },
  'luxe-orb': { top: 0x1a1730, bottom: 0xd4af37, mark: 'star', markColor: 0xffe9a8 },
  'tide-orb': { top: 0x2f7fbf, bottom: 0xbfe3f2, mark: 'wave', markColor: 0xeaf6ff },
  'bloom-orb': { top: 0x4f9d5a, bottom: 0xdff0d0, mark: 'leaf', markColor: 0xeaffe0 },
  'quick-orb': { top: 0xe0b32f, bottom: 0xfff3c4, mark: 'bolt', markColor: 0xfff8dc },
  'timer-orb': { top: 0x9a6d3b, bottom: 0xead9bf, mark: 'clock', markColor: 0xfff3dc },
  'nest-orb': { top: 0x6b8f3f, bottom: 0xe4e0c0, mark: 'nest', markColor: 0xf3ecd0 },
  'master-prism': { top: 0x7b4fd4, bottom: 0xe8ddff, mark: 'star', markColor: 0xfdf6ff },
};

const DEFAULT_ORB: OrbStyle = { top: 0xd9534f, bottom: IVORY, mark: 'none', markColor: 0xffffff };

export function createItemIcon(
  scene: Phaser.Scene,
  id: ItemId,
  x: number,
  y: number,
  scale = 1,
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y).setScale(scale);
  const g = scene.add.graphics();
  container.add(g);

  const effect: ItemEffect | undefined = ITEMS[id]?.effect;
  if (effect && effect.kind === 'orb') {
    drawOrb(g, ORB_STYLES[id] ?? DEFAULT_ORB);
  } else {
    drawGeneric(g, effect);
  }

  return container;
}

function drawOrb(g: Phaser.GameObjects.Graphics, style: OrbStyle): void {
  g.fillStyle(SHELL, 1);
  g.fillCircle(0, 0, BALL_RADIUS);

  g.fillStyle(style.bottom, 1);
  g.slice(0, 0, BALL_RADIUS - 1.5, 0, Math.PI, false);
  g.fillPath();

  g.fillStyle(style.top, 1);
  g.slice(0, 0, BALL_RADIUS - 1.5, Math.PI, Math.PI * 2, false);
  g.fillPath();

  g.fillStyle(SHELL, 1);
  g.fillRect(-BALL_RADIUS, -2.5, BALL_RADIUS * 2, 5);

  g.fillStyle(SHELL, 1);
  g.fillCircle(0, 0, 6);
  g.fillStyle(style.bottom, 1);
  g.fillCircle(0, 0, 4);
  g.lineStyle(1.5, SHELL, 1);
  g.strokeCircle(0, 0, 6);

  drawMark(g, style.mark, style.markColor, style.top);

  g.lineStyle(2, 0x05070d, 0.9);
  g.strokeCircle(0, 0, BALL_RADIUS);
}

function drawMark(
  g: Phaser.GameObjects.Graphics,
  mark: MarkKind,
  color: number,
  topColor: number,
): void {
  switch (mark) {
    case 'wave':
      g.lineStyle(2, color, 0.95);
      g.beginPath();
      g.moveTo(-7, -8);
      g.lineTo(-3.5, -11);
      g.lineTo(0, -8);
      g.lineTo(3.5, -11);
      g.lineTo(7, -8);
      g.strokePath();
      break;
    case 'leaf':
      g.fillStyle(color, 0.95);
      g.fillEllipse(0, -8, 9, 14);
      g.lineStyle(1, SHELL, 0.7);
      g.lineBetween(0, -14, 0, -2);
      break;
    case 'bolt':
      g.fillStyle(color, 0.95);
      g.fillPoints(
        [
          new Phaser.Geom.Point(-1, -14),
          new Phaser.Geom.Point(5, -14),
          new Phaser.Geom.Point(1, -8),
          new Phaser.Geom.Point(6, -8),
          new Phaser.Geom.Point(-2, -1),
          new Phaser.Geom.Point(1, -7),
          new Phaser.Geom.Point(-4, -7),
        ],
        true,
      );
      break;
    case 'clock':
      g.lineStyle(2, color, 0.95);
      g.strokeCircle(0, -8, 6);
      g.lineBetween(0, -8, 0, -12);
      g.lineBetween(0, -8, 3.5, -6);
      break;
    case 'nest':
      g.lineStyle(1.6, color, 0.95);
      g.beginPath();
      g.arc(0, -6, 8, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340), false);
      g.strokePath();
      g.beginPath();
      g.arc(0, -8, 5.5, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340), false);
      g.strokePath();
      g.lineBetween(-8, -6, -3, -9);
      g.lineBetween(-3, -3, 2, -10);
      g.lineBetween(2, -3, 7, -9);
      break;
    case 'star':
      g.fillStyle(color, 0.95);
      g.fillPoints(starPoints(0, -8, 7, 3, 5), true);
      break;
    case 'moon':
      g.fillStyle(color, 0.95);
      g.fillCircle(-1, -8, 6);
      g.fillStyle(topColor, 1);
      g.fillCircle(2.5, -9, 5.5);
      break;
    default:
      break;
  }
}

function starPoints(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  points: number,
): Phaser.Geom.Point[] {
  const result: Phaser.Geom.Point[] = [];
  const step = Math.PI / points;
  let angle = -Math.PI / 2;
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    result.push(
      new Phaser.Geom.Point(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius),
    );
    angle += step;
  }
  return result;
}

function drawGeneric(g: Phaser.GameObjects.Graphics, effect: ItemEffect | undefined): void {
  g.fillStyle(0x101a2e, 1);
  g.fillRoundedRect(-16, -16, 32, 32, 6);
  g.lineStyle(2, 0x8a7a4a, 0.95);
  g.strokeRoundedRect(-16, -16, 32, 32, 6);

  switch (effect?.kind) {
    case 'heal-hp':
    case 'heal-fraction':
    case 'revive':
    case 'restore-pp':
    case 'cure-status':
      g.fillStyle(0x6bd98a, 1);
      g.fillRect(-4, -11, 8, 22);
      g.fillRect(-11, -4, 22, 8);
      g.lineStyle(1.5, 0x0a0f1e, 0.9);
      g.strokeRect(-4, -11, 8, 22);
      g.strokeRect(-11, -4, 22, 8);
      break;
    case 'battle-stat':
      g.fillStyle(0xd4af37, 1);
      g.fillPoints(
        [
          new Phaser.Geom.Point(0, -12),
          new Phaser.Geom.Point(10, 2),
          new Phaser.Geom.Point(3, 2),
          new Phaser.Geom.Point(3, 12),
          new Phaser.Geom.Point(-3, 12),
          new Phaser.Geom.Point(-3, 2),
          new Phaser.Geom.Point(-10, 2),
        ],
        true,
      );
      break;
    case 'field':
      g.fillStyle(0x8fd6c4, 1);
      g.fillPoints(
        [
          new Phaser.Geom.Point(0, -12),
          new Phaser.Geom.Point(11, 0),
          new Phaser.Geom.Point(0, 12),
          new Phaser.Geom.Point(-11, 0),
        ],
        true,
      );
      g.lineStyle(1.5, 0x0a0f1e, 0.7);
      g.strokeCircle(0, 0, 12);
      break;
    case 'quality-of-life':
      g.lineStyle(2, 0xbfb7a2, 0.95);
      g.strokeCircle(0, 0, 9);
      g.lineBetween(0, 0, 0, -9);
      g.lineBetween(0, 0, 6, 3);
      break;
    default:
      g.fillStyle(0xbfb7a2, 0.9);
      g.fillCircle(0, 0, 5);
      break;
  }
}
