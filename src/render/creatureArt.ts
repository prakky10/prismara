/**
 * Procedural creature art.
 *
 * Instead of 40 hand-drawn sprites, every creature is *generated* as a small
 * set of layered SVG "parts" built from a shared body plan (quadruped, bird,
 * serpent, ...) and its palette. Each part rasterises to its own texture, and
 * because each part declares a pivot the rig can animate them independently —
 * tails sway, wings flap, eyes blink — with no frame-by-frame drawing.
 *
 * The drawing style is "neon storybook": a vertical gradient body, an ink
 * outline, a rim light along the top-left, and bright accent details.
 */

import type { CreatureSpecies, Palette } from '../data/creatures';
import { getSpecies } from '../data/creatures';
import { inkFor, shade, toHex, shinyPalette } from './palette';

/** Everything is drawn in a 128x128 box with the feet at y = GROUND. */
export const ART_SIZE = 128;
export const GROUND = 114;

export interface SvgPart {
  /** Stable suffix for the texture key, e.g. "body" or "tail". */
  id: string;
  svg: string;
  /** Pivot in art coordinates (0..128). */
  pivotX: number;
  pivotY: number;
  /** Draw order, lowest first. */
  z: number;
  /** Suggested idle sway in degrees; 0 disables. */
  sway?: number;
  /** Which way the sway should start, to keep parts out of phase. */
  swayOffset?: number;
}

interface Ctx {
  p: Palette;
  ink: string;
  light: string;
  dark: string;
  id: string;
}

function makeCtx(p: Palette, id: string): Ctx {
  return {
    p,
    ink: toHex(inkFor(p.primary)),
    light: toHex(shade(p.primary, 0.45)),
    dark: toHex(shade(p.primary, -0.35)),
    id,
  };
}

function svgWrap(inner: string, defs: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ART_SIZE}" height="${ART_SIZE}" ` +
    `viewBox="0 0 ${ART_SIZE} ${ART_SIZE}">` +
    `<defs>${defs}</defs>${inner}</svg>`
  );
}

/** Vertical three-stop gradient for the main body mass. */
function bodyGradient(ctx: Ctx): { defs: string; fill: string } {
  const gid = `${ctx.id}-body`;
  return {
    defs:
      `<linearGradient id="${gid}" x1="0" y1="0" x2="0.25" y2="1">` +
      `<stop offset="0" stop-color="${ctx.light}"/>` +
      `<stop offset="0.5" stop-color="${toHex(ctx.p.primary)}"/>` +
      `<stop offset="1" stop-color="${ctx.dark}"/>` +
      `</linearGradient>`,
    fill: `url(#${gid})`,
  };
}

function accentGradient(ctx: Ctx): { defs: string; fill: string } {
  const gid = `${ctx.id}-acc`;
  return {
    defs:
      `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="${toHex(shade(ctx.p.accent, 0.4))}"/>` +
      `<stop offset="1" stop-color="${toHex(shade(ctx.p.accent, -0.25))}"/>` +
      `</linearGradient>`,
    fill: `url(#${gid})`,
  };
}

const stroke = (ctx: Ctx, width = 3.2): string =>
  `stroke="${ctx.ink}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"`;

/** A soft rim light across the top-left of a shape. */
function rim(ctx: Ctx, d: string, width = 3): string {
  return (
    `<path d="${d}" fill="none" stroke="${toHex(shade(ctx.p.primary, 0.75))}" ` +
    `stroke-width="${width}" stroke-linecap="round" opacity="0.55"/>`
  );
}

function eyeGroup(ctx: Ctx, cx: number, cy: number, r: number, tilt = 0): string {
  const c = toHex(ctx.p.eye);
  const gleam = toHex(shade(ctx.p.eye, 0.85));
  const white = '#ffffff';
  return (
    `<g transform="translate(${cx} ${cy}) rotate(${tilt})">` +
    `<ellipse rx="${r}" ry="${r * 1.12}" fill="${white}" opacity="0.92"/>` +
    `<ellipse rx="${r * 0.72}" ry="${r * 0.86}" cx="0.6" cy="0.5" fill="${c}"/>` +
    `<circle r="${r * 0.26}" cx="-${r * 0.3}" cy="-${r * 0.42}" fill="${gleam}"/>` +
    `<circle r="${r * 0.12}" cx="${r * 0.28}" cy="${r * 0.3}" fill="${white}" opacity="0.8"/>` +
    `</g>`
  );
}

/* ------------------------------------------------------------ body plans -- */

function quadrupedParts(ctx: Ctx): SvgPart[] {
  const { defs, fill } = bodyGradient(ctx);
  const acc = accentGradient(ctx);
  const p = ctx.p;

  const legs =
    `<g ${stroke(ctx)}>` +
    [46, 60, 74, 88]
      .map((x, i) => {
        const h = i < 2 ? 26 : 24;
        return `<rect x="${x}" y="${GROUND - h}" width="9" height="${h}" rx="4.4" fill="${toHex(shade(p.primary, -0.18))}"/>`;
      })
      .join('') +
    `</g>`;

  const tailD =
    `M44 74 C24 70 18 52 26 40 C34 30 48 34 44 48 C41 58 40 64 46 70 Z`;

  const body =
    `<ellipse cx="64" cy="74" rx="31" ry="21" fill="${fill}" ${stroke(ctx)}/>` +
    `<ellipse cx="60" cy="84" rx="19" ry="10" fill="${toHex(p.secondary)}" opacity="0.9"/>` +
    rim(ctx, 'M40 62 C50 52 74 50 90 60');

  const head =
    `<g>` +
    `<path d="M92 36 L84 52 L100 52 Z" fill="${acc.fill}" ${stroke(ctx, 2.6)}/>` +
    `<path d="M100 34 L104 50 L112 46 Z" fill="${acc.fill}" ${stroke(ctx, 2.6)}/>` +
    `<circle cx="92" cy="54" r="19" fill="${fill}" ${stroke(ctx)}/>` +
    `<ellipse cx="102" cy="60" rx="9" ry="7" fill="${toHex(p.secondary)}" ${stroke(ctx, 2.4)}/>` +
    `<circle cx="107" cy="58" r="2.6" fill="${ctx.ink}"/>` +
    `<path d="M96 30 L92 18 L102 26 Z" fill="${acc.fill}" ${stroke(ctx, 2.4)}/>` +
    `</g>`;

  return [
    { id: 'body', svg: svgWrap(legs + body, defs + acc.defs), pivotX: 64, pivotY: GROUND, z: 0 },
    {
      id: 'tail',
      svg: svgWrap(
        `<path d="${tailD}" fill="${acc.fill}" ${stroke(ctx)}/>` +
          `<path d="M44 70 C34 66 28 58 30 48" fill="none" stroke="${toHex(shade(p.accent, 0.5))}" stroke-width="2.4" stroke-linecap="round" opacity="0.7"/>`,
        acc.defs + defs,
      ),
      pivotX: 46,
      pivotY: 72,
      z: -1,
      sway: 7,
    },
    { id: 'head', svg: svgWrap(head, defs + acc.defs), pivotX: 92, pivotY: 66, z: 2 },
    {
      id: 'eyes',
      svg: svgWrap(eyeGroup(ctx, 97, 52, 5.4, -8), ''),
      pivotX: 97,
      pivotY: 52,
      z: 3,
    },
  ];
}

function bipedParts(ctx: Ctx): SvgPart[] {
  const { defs, fill } = bodyGradient(ctx);
  const acc = accentGradient(ctx);
  const p = ctx.p;

  const legs =
    `<g ${stroke(ctx)}>` +
    `<rect x="55" y="${GROUND - 30}" width="11" height="30" rx="5.5" fill="${toHex(shade(p.primary, -0.22))}"/>` +
    `<rect x="70" y="${GROUND - 30}" width="11" height="30" rx="5.5" fill="${toHex(shade(p.primary, -0.22))}"/>` +
    `<ellipse cx="60" cy="${GROUND - 1}" rx="9" ry="4" fill="${ctx.ink}"/>` +
    `<ellipse cx="76" cy="${GROUND - 1}" rx="9" ry="4" fill="${ctx.ink}"/>` +
    `</g>`;

  const torso =
    `<ellipse cx="68" cy="72" rx="24" ry="26" fill="${fill}" ${stroke(ctx)}/>` +
    `<ellipse cx="68" cy="80" rx="14" ry="15" fill="${toHex(p.secondary)}" opacity="0.85"/>`;

  const arms =
    `<g ${stroke(ctx)}>` +
    `<path d="M48 60 C36 66 32 78 38 88" fill="none" stroke-width="9" stroke="${toHex(shade(p.primary, -0.15))}"/>` +
    `<path d="M48 60 C36 66 32 78 38 88" fill="none" ${stroke(ctx, 2.4)}/>` +
    `<path d="M88 60 C100 66 104 78 98 88" fill="none" stroke-width="9" stroke="${toHex(shade(p.primary, -0.15))}"/>` +
    `<path d="M88 60 C100 66 104 78 98 88" fill="none" ${stroke(ctx, 2.4)}/>` +
    `</g>`;

  const head =
    `<circle cx="68" cy="36" r="19" fill="${fill}" ${stroke(ctx)}/>` +
    `<path d="M58 22 L54 8 L68 18 Z" fill="${acc.fill}" ${stroke(ctx, 2.4)}/>` +
    `<path d="M78 22 L82 8 L68 18 Z" fill="${acc.fill}" ${stroke(ctx, 2.4)}/>` +
    `<ellipse cx="68" cy="42" rx="8" ry="6" fill="${toHex(p.secondary)}" ${stroke(ctx, 2.2)}/>`;

  return [
    { id: 'body', svg: svgWrap(legs + torso + arms, defs + acc.defs), pivotX: 68, pivotY: GROUND, z: 0 },
    { id: 'head', svg: svgWrap(head, defs + acc.defs), pivotX: 68, pivotY: 50, z: 2 },
    {
      id: 'eyes',
      svg: svgWrap(
        eyeGroup(ctx, 61, 34, 5.2, -4) + eyeGroup(ctx, 76, 34, 5.2, 4),
        '',
      ),
      pivotX: 68,
      pivotY: 34,
      z: 3,
    },
  ];
}

function birdParts(ctx: Ctx): SvgPart[] {
  const { defs, fill } = bodyGradient(ctx);
  const acc = accentGradient(ctx);
  const p = ctx.p;

  const tailFeathers =
    `<g ${stroke(ctx)}>` +
    `<path d="M56 78 C34 76 24 84 18 96 C34 96 50 90 58 84 Z" fill="${acc.fill}"/>` +
    `<path d="M58 82 C40 84 30 92 26 102 C42 100 54 94 60 88 Z" fill="${toHex(shade(p.accent, -0.2))}"/>` +
    `</g>`;

  const body =
    `<ellipse cx="72" cy="72" rx="26" ry="22" fill="${fill}" ${stroke(ctx)}/>` +
    `<ellipse cx="70" cy="80" rx="16" ry="11" fill="${toHex(p.secondary)}" opacity="0.85"/>` +
    rim(ctx, 'M54 60 C64 50 84 50 94 60');

  const head =
    `<circle cx="94" cy="46" r="15" fill="${fill}" ${stroke(ctx)}/>` +
    `<path d="M106 44 L120 48 L106 52 Z" fill="${toHex(shade(p.accent, 0.1))}" ${stroke(ctx, 2.4)}/>` +
    `<path d="M96 34 C92 22 100 18 104 28" fill="${acc.fill}" ${stroke(ctx, 2.4)}/>`;

  const legs =
    `<g ${stroke(ctx)}>` +
    `<rect x="66" y="${GROUND - 20}" width="6" height="20" rx="3" fill="${toHex(shade(p.primary, -0.2))}"/>` +
    `<rect x="80" y="${GROUND - 20}" width="6" height="20" rx="3" fill="${toHex(shade(p.primary, -0.2))}"/>` +
    `<path d="M62 ${GROUND} H76 M76 ${GROUND} H90" stroke="${ctx.ink}" stroke-width="3.4" stroke-linecap="round"/>` +
    `</g>`;

  return [
    {
      id: 'wing-back',
      svg: svgWrap(
        `<path d="M76 60 C60 36 40 34 30 46 C44 52 56 66 66 78 Z" fill="${toHex(shade(p.primary, -0.25))}" ${stroke(ctx)}/>`,
        defs,
      ),
      pivotX: 74,
      pivotY: 66,
      z: -1,
      sway: 10,
      swayOffset: 0.5,
    },
    { id: 'body', svg: svgWrap(legs + body + tailFeathers, defs + acc.defs), pivotX: 72, pivotY: GROUND, z: 0 },
    {
      id: 'wing-front',
      svg: svgWrap(
        `<path d="M78 62 C66 44 52 40 44 46 C56 54 66 70 72 82 Z" fill="${acc.fill}" ${stroke(ctx)}/>`,
        acc.defs,
      ),
      pivotX: 74,
      pivotY: 68,
      z: 1,
      sway: 12,
    },
    { id: 'head', svg: svgWrap(head, defs + acc.defs), pivotX: 92, pivotY: 56, z: 2 },
    {
      id: 'eyes',
      svg: svgWrap(eyeGroup(ctx, 97, 44, 4.8, -6), ''),
      pivotX: 97,
      pivotY: 44,
      z: 3,
    },
  ];
}

function serpentParts(ctx: Ctx): SvgPart[] {
  const { defs, fill } = bodyGradient(ctx);
  const acc = accentGradient(ctx);
  const p = ctx.p;

  const coils =
    `<path d="M28 104 C10 96 14 78 34 76 C56 74 64 88 84 84 C104 80 108 62 92 54" ` +
    `fill="none" stroke-width="18" stroke="${fill}" stroke-linecap="round"/>` +
    `<path d="M28 104 C10 96 14 78 34 76 C56 74 64 88 84 84 C104 80 108 62 92 54" ` +
    `fill="none" ${stroke(ctx, 3)}/>` +
    `<path d="M30 98 C18 92 20 82 34 80" fill="none" stroke="${toHex(shade(p.primary, 0.6))}" stroke-width="2.6" opacity="0.55" stroke-linecap="round"/>`;

  const fins =
    `<g ${stroke(ctx)}>` +
    `<path d="M40 62 C30 50 34 40 44 44 Z" fill="${acc.fill}"/>` +
    `<path d="M64 72 C56 60 62 50 72 54 Z" fill="${acc.fill}"/>` +
    `<path d="M90 62 C84 50 92 42 100 48 Z" fill="${acc.fill}"/>` +
    `</g>`;

  const head =
    `<g>` +
    `<ellipse cx="96" cy="46" rx="17" ry="13" fill="${fill}" ${stroke(ctx)}/>` +
    `<path d="M108 40 L124 34 L112 50 Z" fill="${acc.fill}" ${stroke(ctx, 2.4)}/>` +
    `<path d="M88 32 L82 18 L98 28 Z" fill="${acc.fill}" ${stroke(ctx, 2.4)}/>` +
    `</g>`;

  return [
    { id: 'body', svg: svgWrap(coils + fins, defs + acc.defs), pivotX: 60, pivotY: 100, z: 0 },
    { id: 'head', svg: svgWrap(head, defs + acc.defs), pivotX: 96, pivotY: 56, z: 2 },
    {
      id: 'eyes',
      svg: svgWrap(eyeGroup(ctx, 100, 44, 5.4, -8), ''),
      pivotX: 100,
      pivotY: 44,
      z: 3,
    },
  ];
}

function floaterParts(ctx: Ctx): SvgPart[] {
  const { defs, fill } = bodyGradient(ctx);
  const acc = accentGradient(ctx);
  const p = ctx.p;

  const body =
    `<ellipse cx="64" cy="62" rx="30" ry="28" fill="${fill}" ${stroke(ctx)}/>` +
    `<ellipse cx="62" cy="74" rx="19" ry="13" fill="${toHex(p.secondary)}" opacity="0.85"/>` +
    rim(ctx, 'M40 46 C52 32 78 32 90 46');

  const wisps =
    `<g ${stroke(ctx, 2.4)} opacity="0.9">` +
    `<path d="M46 86 C40 96 46 104 54 100" fill="none" stroke="${toHex(p.accent)}"/>` +
    `<path d="M64 90 C60 102 66 110 74 106" fill="none" stroke="${toHex(p.accent)}"/>` +
    `<path d="M82 86 C88 96 84 104 76 102" fill="none" stroke="${toHex(p.accent)}"/>` +
    `</g>`;

  const crest =
    `<g ${stroke(ctx, 2.4)}>` +
    `<path d="M64 34 C56 18 68 10 74 22 C78 12 90 16 86 30 Z" fill="${acc.fill}"/>` +
    `</g>`;

  return [
    {
      id: 'aura',
      svg: svgWrap(
        `<circle cx="64" cy="62" r="42" fill="${toHex(p.accent)}" opacity="0.14"/>`,
        acc.defs,
      ),
      pivotX: 64,
      pivotY: 62,
      z: -2,
      sway: 4,
    },
    { id: 'body', svg: svgWrap(wisps + body + crest, defs + acc.defs), pivotX: 64, pivotY: 62, z: 0 },
    {
      id: 'eyes',
      svg: svgWrap(
        eyeGroup(ctx, 54, 58, 5.6, 0) + eyeGroup(ctx, 74, 58, 5.6, 0),
        '',
      ),
      pivotX: 64,
      pivotY: 58,
      z: 3,
    },
  ];
}

function bugParts(ctx: Ctx): SvgPart[] {
  const { defs, fill } = bodyGradient(ctx);
  const acc = accentGradient(ctx);
  const p = ctx.p;

  const legs =
    `<g ${stroke(ctx, 2.6)}>` +
    [0, 1, 2]
      .flatMap((i) => {
        const y = 66 + i * 12;
        return [
          `<path d="M46 ${y} C34 ${y + 4} 30 ${y + 12} 26 ${y + 18}" fill="none" stroke="${toHex(shade(p.primary, -0.2))}" stroke-width="5"/>`,
          `<path d="M82 ${y} C94 ${y + 4} 98 ${y + 12} 102 ${y + 18}" fill="none" stroke="${toHex(shade(p.primary, -0.2))}" stroke-width="5"/>`,
        ];
      })
      .join('') +
    `</g>`;

  const shell =
    `<ellipse cx="64" cy="66" rx="26" ry="30" fill="${fill}" ${stroke(ctx)}/>` +
    `<path d="M64 38 V96" stroke="${ctx.ink}" stroke-width="2.4" opacity="0.5"/>` +
    `<ellipse cx="56" cy="56" rx="10" ry="16" fill="${toHex(shade(p.primary, 0.25))}" opacity="0.5"/>` +
    `<circle cx="76" cy="60" r="5" fill="${acc.fill}" opacity="0.9"/>` +
    `<circle cx="70" cy="80" r="4" fill="${acc.fill}" opacity="0.9"/>`;

  const head =
    `<circle cx="64" cy="34" r="14" fill="${fill}" ${stroke(ctx)}/>` +
    `<path d="M56 22 C48 10 44 16 50 24" fill="none" ${stroke(ctx, 2.6)}/>` +
    `<path d="M72 22 C80 10 84 16 78 24" fill="none" ${stroke(ctx, 2.6)}/>` +
    `<circle cx="49" cy="11" r="3.4" fill="${acc.fill}" ${stroke(ctx, 2)}/>` +
    `<circle cx="79" cy="11" r="3.4" fill="${acc.fill}" ${stroke(ctx, 2)}/>`;

  return [
    { id: 'body', svg: svgWrap(legs + shell + head, defs + acc.defs), pivotX: 64, pivotY: 96, z: 0 },
    {
      id: 'eyes',
      svg: svgWrap(eyeGroup(ctx, 58, 33, 4.4, 0) + eyeGroup(ctx, 71, 33, 4.4, 0), ''),
      pivotX: 64,
      pivotY: 33,
      z: 3,
    },
  ];
}

function moleParts(ctx: Ctx): SvgPart[] {
  const { defs, fill } = bodyGradient(ctx);
  const acc = accentGradient(ctx);
  const p = ctx.p;

  const body =
    `<ellipse cx="64" cy="80" rx="34" ry="24" fill="${fill}" ${stroke(ctx)}/>` +
    `<ellipse cx="60" cy="88" rx="20" ry="11" fill="${toHex(p.secondary)}" opacity="0.8"/>` +
    rim(ctx, 'M36 68 C48 58 80 58 92 68');

  const claws =
    `<g ${stroke(ctx, 2.6)}>` +
    `<path d="M34 84 L14 76 L20 90 L8 92 L30 98 Z" fill="${acc.fill}"/>` +
    `<path d="M94 84 L114 76 L108 90 L120 92 L98 98 Z" fill="${acc.fill}"/>` +
    `</g>`;

  const head =
    `<ellipse cx="64" cy="52" rx="22" ry="18" fill="${fill}" ${stroke(ctx)}/>` +
    `<ellipse cx="64" cy="58" rx="9" ry="7" fill="${toHex(shade(p.secondary, -0.1))}" ${stroke(ctx, 2.2)}/>` +
    `<circle cx="60" cy="58" r="2" fill="${ctx.ink}"/>` +
    `<circle cx="68" cy="58" r="2" fill="${ctx.ink}"/>`;

  return [
    { id: 'body', svg: svgWrap(claws + body, defs + acc.defs), pivotX: 64, pivotY: GROUND, z: 0 },
    { id: 'head', svg: svgWrap(head, defs + acc.defs), pivotX: 64, pivotY: 64, z: 2 },
    {
      id: 'eyes',
      svg: svgWrap(eyeGroup(ctx, 56, 48, 4.6, 0) + eyeGroup(ctx, 72, 48, 4.6, 0), ''),
      pivotX: 64,
      pivotY: 48,
      z: 3,
    },
  ];
}

function crustaceanParts(ctx: Ctx): SvgPart[] {
  const { defs, fill } = bodyGradient(ctx);
  const acc = accentGradient(ctx);
  const p = ctx.p;

  const legs =
    `<g ${stroke(ctx, 2.6)}>` +
    [0, 1, 2]
      .flatMap((i) => {
        const y = 82 + i * 9;
        return [
          `<path d="M44 ${y} C32 ${y + 3} 28 ${y + 10} 24 ${y + 14}" fill="none" stroke="${toHex(shade(p.primary, -0.25))}" stroke-width="5"/>`,
          `<path d="M84 ${y} C96 ${y + 3} 100 ${y + 10} 104 ${y + 14}" fill="none" stroke="${toHex(shade(p.primary, -0.25))}" stroke-width="5"/>`,
        ];
      })
      .join('') +
    `</g>`;

  const shell =
    `<path d="M64 34 C44 34 32 52 34 74 C36 92 50 102 64 102 C78 102 92 92 94 74 C96 52 84 34 64 34 Z" ` +
    `fill="${fill}" ${stroke(ctx)}/>` +
    `<path d="M64 42 V94" stroke="${ctx.ink}" stroke-width="2.2" opacity="0.45"/>` +
    `<circle cx="64" cy="52" r="8" fill="${toHex(shade(p.accent, 0.2))}" opacity="0.85"/>` +
    rim(ctx, 'M46 52 C52 42 76 40 86 52');

  const claws =
    `<g ${stroke(ctx, 2.8)}>` +
    `<path d="M34 62 C18 56 10 66 16 76 C22 84 36 80 36 70 Z" fill="${acc.fill}"/>` +
    `<path d="M94 62 C110 56 118 66 112 76 C106 84 92 80 92 70 Z" fill="${acc.fill}"/>` +
    `</g>`;

  return [
    { id: 'body', svg: svgWrap(legs + claws + shell, defs + acc.defs), pivotX: 64, pivotY: 100, z: 0 },
    {
      id: 'eyes',
      svg: svgWrap(eyeGroup(ctx, 56, 46, 5, 0) + eyeGroup(ctx, 72, 46, 5, 0), ''),
      pivotX: 64,
      pivotY: 46,
      z: 3,
    },
  ];
}

function mothParts(ctx: Ctx): SvgPart[] {
  const { defs, fill } = bodyGradient(ctx);
  const acc = accentGradient(ctx);
  const p = ctx.p;

  const body =
    `<ellipse cx="64" cy="72" rx="13" ry="30" fill="${fill}" ${stroke(ctx)}/>` +
    `<ellipse cx="64" cy="82" rx="9" ry="16" fill="${toHex(p.secondary)}" opacity="0.8"/>` +
    `<circle cx="64" cy="42" r="13" fill="${fill}" ${stroke(ctx)}/>` +
    `<path d="M56 30 C48 16 44 22 52 32" fill="none" ${stroke(ctx, 2.6)}/>` +
    `<path d="M72 30 C80 16 84 22 76 32" fill="none" ${stroke(ctx, 2.6)}/>` +
    `<circle cx="49" cy="17" r="3.2" fill="${acc.fill}" ${stroke(ctx, 2)}/>` +
    `<circle cx="79" cy="17" r="3.2" fill="${acc.fill}" ${stroke(ctx, 2)}/>`;

  const wings =
    `<g ${stroke(ctx, 2.8)}>` +
    `<path d="M58 46 C34 24 8 34 12 58 C16 78 44 74 58 66 Z" fill="${acc.fill}" opacity="0.95"/>` +
    `<path d="M70 46 C94 24 120 34 116 58 C112 78 84 74 70 66 Z" fill="${acc.fill}" opacity="0.95"/>` +
    `<path d="M58 74 C40 70 24 80 28 94 C32 106 52 102 60 92 Z" fill="${toHex(shade(p.accent, -0.25))}" opacity="0.95"/>` +
    `<path d="M70 74 C88 70 104 80 100 94 C96 106 76 102 68 92 Z" fill="${toHex(shade(p.accent, -0.25))}" opacity="0.95"/>` +
    `</g>`;

  return [
    {
      id: 'wing-back',
      svg: svgWrap(
        `<path d="M58 48 C36 30 12 40 16 60 C20 78 44 74 58 66 Z" fill="${toHex(shade(p.accent, -0.4))}" ${stroke(ctx)}/>` +
          `<path d="M70 48 C92 30 116 40 112 60 C108 78 84 74 70 66 Z" fill="${toHex(shade(p.accent, -0.4))}" ${stroke(ctx)}/>`,
        acc.defs,
      ),
      pivotX: 64,
      pivotY: 56,
      z: -1,
      sway: 6,
      swayOffset: 0.5,
    },
    { id: 'body', svg: svgWrap(body, defs + acc.defs), pivotX: 64, pivotY: GROUND, z: 0 },
    { id: 'wing-front', svg: svgWrap(wings, acc.defs), pivotX: 64, pivotY: 56, z: 1, sway: 8 },
    {
      id: 'eyes',
      svg: svgWrap(eyeGroup(ctx, 59, 42, 4.4, 0) + eyeGroup(ctx, 70, 42, 4.4, 0), ''),
      pivotX: 64,
      pivotY: 42,
      z: 3,
    },
  ];
}

const BUILDERS: Record<string, (ctx: Ctx) => SvgPart[]> = {
  quadruped: quadrupedParts,
  biped: bipedParts,
  bird: birdParts,
  serpent: serpentParts,
  floater: floaterParts,
  bug: bugParts,
  mole: moleParts,
  crustacean: crustaceanParts,
  moth: mothParts,
};

/** Build every SVG part for a species, honouring the shiny palette. */
export function creatureParts(speciesOrId: CreatureSpecies | string, shiny = false): SvgPart[] {
  const species = typeof speciesOrId === 'string' ? getSpecies(speciesOrId) : speciesOrId;
  const palette = shiny ? shinyPalette(species.palette) : species.palette;
  const builder = BUILDERS[species.body] ?? quadrupedParts;
  return builder(makeCtx(palette, `${species.id}${shiny ? '-s' : ''}`));
}

/** Texture keys for a creature: one per part, e.g. `mon:emberkit:body`. */
export function textureKey(speciesId: string, partId: string, shiny = false): string {
  return `mon:${speciesId}:${shiny ? 's:' : ''}${partId}`;
}

/** All parts addressable as `{ partId -> SvgPart }`. */
export function partsById(speciesOrId: CreatureSpecies | string, shiny = false): Record<string, SvgPart> {
  const out: Record<string, SvgPart> = {};
  for (const part of creatureParts(speciesOrId, shiny)) out[part.id] = part;
  return out;
}
