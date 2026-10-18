/**
 * Colour helpers shared by the art pipeline.
 *
 * Colours are plain 24-bit integers everywhere in the game so they can be fed
 * straight to Phaser; these helpers convert to CSS strings and derive shades
 * for gradients, ink outlines and rim light.
 */

import type { Palette } from '../data/creatures';

export function toHex(color: number): string {
  return `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;
}

export function toRgb(color: number): { r: number; g: number; b: number } {
  return { r: (color >> 16) & 0xff, g: (color >> 8) & 0xff, b: color & 0xff };
}

export function fromRgb(r: number, g: number, b: number): number {
  return ((clamp255(r) << 16) | (clamp255(g) << 8) | clamp255(b)) >>> 0;
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/** Interpolate between two colours; t=0 returns a, t=1 returns b. */
export function mix(a: number, b: number, t: number): number {
  const ca = toRgb(a);
  const cb = toRgb(b);
  return fromRgb(
    ca.r + (cb.r - ca.r) * t,
    ca.g + (cb.g - ca.g) * t,
    ca.b + (cb.b - ca.b) * t,
  );
}

/** Lighten (amount > 0) or darken (amount < 0) toward white/black. */
export function shade(color: number, amount: number): number {
  return amount >= 0 ? mix(color, 0xffffff, amount) : mix(color, 0x000000, -amount);
}

/** Perceived luminance, 0..1. Used to pick readable text colours. */
export function luminance(color: number): number {
  const { r, g, b } = toRgb(color);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** A dark ink colour derived from the body colour, for outlines. */
export function inkFor(color: number): number {
  return shade(mix(color, 0x101828, 0.55), -0.35);
}

/**
 * Rotate a hue by `degrees`, keeping saturation and lightness roughly intact.
 * Used to build shiny palettes and the day/night tint without hand-authoring.
 */
export function rotateHue(color: number, degrees: number): number {
  const { r, g, b } = toRgb(color);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }
  h = (h + degrees / 360 + 1) % 1;

  const hue2rgb = (p: number, q: number, t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  let rr: number;
  let gg: number;
  let bb: number;
  if (s === 0) {
    rr = gg = bb = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    rr = hue2rgb(p, q, h + 1 / 3);
    gg = hue2rgb(p, q, h);
    bb = hue2rgb(p, q, h - 1 / 3);
  }
  return fromRgb(rr * 255, gg * 255, bb * 255);
}

/**
 * Alternate palette for a shiny creature. Each creature gets a distinct but
 * related look: the body hue rotates, the accent inverts toward its complement
 * and the eye glows.
 */
export function shinyPalette(p: Palette): Palette {
  return {
    primary: rotateHue(p.primary, 150),
    secondary: rotateHue(p.secondary, 150),
    accent: rotateHue(p.accent, 180),
    eye: mix(0xfff0a0, rotateHue(p.primary, 60), 0.35),
  };
}

/** Blend a whole palette toward a tint, for day/night grading and status auras. */
export function tintPalette(p: Palette, tint: number, amount: number): Palette {
  return {
    primary: mix(p.primary, tint, amount),
    secondary: mix(p.secondary, tint, amount),
    accent: mix(p.accent, tint, amount),
    eye: p.eye,
  };
}

/** Convert a 0xRRGGBB integer to the `rgba()` form the DOM APIs expect. */
export function toCssRgba(color: number, alpha = 1): string {
  const { r, g, b } = toRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function paletteFromColors(
  primary: number,
  secondary: number,
  accent: number,
  eye = 0x12202c,
): Palette {
  return { primary, secondary, accent, eye };
}
