/**
 * Shared look-and-feel constants.
 *
 * The game renders at a fixed 960x540 logical resolution and is letterboxed to
 * any screen, so every measurement here is in those units.
 */

export const VIEW_WIDTH = 960;
export const VIEW_HEIGHT = 540;

export const COLORS = {
  ink: 0x0a0f1e,
  inkSoft: 0x121a2e,
  panel: 0x0e1729,
  panelEdge: 0x8a7a4a,
  panelGlow: 0x8fd6c4,
  text: 0xf4ecd9,
  textDim: 0xbfb7a2,
  textMuted: 0x7c8aa2,
  white: 0xffffff,
  black: 0x000000,
  hpHigh: 0x6bd98a,
  hpMid: 0xd4af37,
  hpLow: 0xe57373,
  xp: 0x5ba8d4,
  shadow: 0x04070d,
  cursor: 0x8fd6c4,
  danger: 0xe57373,
  gold: 0xd4af37,
} as const;

/**
 * Font stacks built only from faces a desktop browser already ships, so the
 * game never depends on the network.
 */
export const FONTS = {
  pixel: '"Lucida Console", "DejaVu Sans Mono", "Courier New", monospace',
  body: '"Segoe UI", "Trebuchet MS", system-ui, sans-serif',
} as const;

export const FONT_SIZES = {
  tiny: 9,
  small: 11,
  body: 14,
  large: 18,
  title: 34,
  huge: 52,
} as const;

export const LAYOUT = {
  padding: 16,
  panelRadius: 12,
  rowHeight: 26,
  textSpeedMs: 18,
} as const;

export const DEPTHS = {
  background: -40,
  tiles: 0,
  decor: 10,
  actors: 20,
  weather: 60,
  lighting: 80,
  ui: 100,
  textbox: 120,
  menu: 140,
  overlay: 200,
  transition: 300,
  debug: 400,
} as const;

/** A stable colour for a trainer class badge. */
export function trainerColor(tier: string): number {
  switch (tier) {
    case 'master':
      return 0xffd60a;
    case 'trainer':
      return 0x2ea8ff;
    default:
      return 0x9fb0cc;
  }
}

/** Status condition -> colour, for the party list and battle UI. */
export function statusColor(status: string): number {
  switch (status) {
    case 'burn':
      return 0xff6b35;
    case 'paralyze':
      return 0xffd60a;
    case 'sleep':
      return 0xb0b8c8;
    case 'entangled':
      return 0x4cd964;
    case 'fear':
      return 0x8e5cff;
    default:
      return 0x6d7d99;
  }
}
