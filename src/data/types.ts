/**
 * The six elements of Prismara, plus the Neutral *move* type.
 *
 * The chart is deliberately balanced: every element has exactly two strengths
 * and two weaknesses, so no element is strictly better than another. See the
 * design doc (section 2) for the flavour of each element and the status it
 * tends to inflict.
 */

export const ELEMENTS = ['fire', 'water', 'grass', 'electric', 'shadow', 'crystal'] as const;
export type Element = (typeof ELEMENTS)[number];

/** Neutral exists only for moves (Tackle, Quick Strike...). It is always 1x. */
export const MOVE_TYPES = [...ELEMENTS, 'neutral'] as const;
export type MoveType = (typeof MOVE_TYPES)[number];

export interface ElementInfo {
  id: MoveType;
  /** Display name, e.g. "Fire". */
  name: string;
  /** Primary brand colour used for badges, glows, HP-bar fuel and VFX. */
  color: number;
  /** A slightly darker shade for borders and gradients. */
  darkColor: number;
  /** A pale shade for highlights and rim light. */
  lightColor: number;
  /** CSS hex string matching `color`, for DOM/HTML contexts. */
  hex: string;
  /** Emoji glyph used in the Prismadex filters and menus. */
  glyph: string;
  /** One-line description of the element's theme. */
  blurb: string;
}

export const ELEMENT_INFO: Record<MoveType, ElementInfo> = {
  fire: {
    id: 'fire',
    name: 'Fire',
    color: 0xff6b35,
    darkColor: 0xb23a12,
    lightColor: 0xffc2a3,
    hex: '#FF6B35',
    glyph: '🔥',
    blurb: 'flame, magma, sun',
  },
  water: {
    id: 'water',
    name: 'Water',
    color: 0x2ea8ff,
    darkColor: 0x1361a8,
    lightColor: 0xbfe3ff,
    hex: '#2EA8FF',
    glyph: '💧',
    blurb: 'tides, rain, deep sea',
  },
  grass: {
    id: 'grass',
    name: 'Grass',
    color: 0x4cd964,
    darkColor: 0x2a8f3c,
    lightColor: 0xc8f5cf,
    hex: '#4CD964',
    glyph: '🌿',
    blurb: 'forests, spores, roots',
  },
  electric: {
    id: 'electric',
    name: 'Electric',
    color: 0xffd60a,
    darkColor: 0xb59300,
    lightColor: 0xfff3b0,
    hex: '#FFD60A',
    glyph: '⚡',
    blurb: 'storms, magnetism, tech',
  },
  shadow: {
    id: 'shadow',
    name: 'Shadow',
    color: 0x8e5cff,
    darkColor: 0x4d2aa8,
    lightColor: 0xd9c7ff,
    hex: '#8E5CFF',
    glyph: '🌑',
    blurb: 'night, fear, the void',
  },
  crystal: {
    id: 'crystal',
    name: 'Crystal',
    color: 0x7fffe5,
    darkColor: 0x2fa895,
    lightColor: 0xd6fff7,
    hex: '#7FFFE5',
    glyph: '💎',
    blurb: 'gems, light, refraction',
  },
  neutral: {
    id: 'neutral',
    name: 'Neutral',
    color: 0xc9d4e6,
    darkColor: 0x7c8aa3,
    lightColor: 0xf2f6ff,
    hex: '#C9D4E6',
    glyph: '⬤',
    blurb: 'plain, dependable force',
  },
};

/** Element -> the elements its attacks are 2x against. */
export const STRONG_AGAINST: Record<Element, readonly Element[]> = {
  fire: ['grass', 'shadow'],
  water: ['fire', 'crystal'],
  grass: ['water', 'electric'],
  electric: ['water', 'shadow'],
  shadow: ['crystal', 'grass'],
  crystal: ['electric', 'fire'],
};

/** Element -> the elements it takes 2x damage from (the inverse of the above). */
export const WEAK_TO: Record<Element, readonly Element[]> = {
  fire: ['water', 'crystal'],
  water: ['grass', 'electric'],
  grass: ['fire', 'shadow'],
  electric: ['grass', 'crystal'],
  shadow: ['fire', 'electric'],
  crystal: ['water', 'shadow'],
};

export type Effectiveness = 0.5 | 1 | 2;
export const SUPER_EFFECTIVE: Effectiveness = 2;
export const NOT_VERY_EFFECTIVE: Effectiveness = 0.5;
export const NEUTRAL_DAMAGE: Effectiveness = 1;

/**
 * Effectiveness of `attackType` hitting `defendType`.
 *
 * Rules (design doc §2):
 *  - 2x when the attacker is strong against the defender.
 *  - 0.5x for the reverse of every super-effective pair (attacker is weak to
 *    the defender), so Grass -> Fire is 0.5x because Fire -> Grass is 2x.
 *  - 0.5x for a type hitting itself.
 *  - Everything else 1x. Neutral is always 1x.
 */
export function typeEffectiveness(attackType: MoveType, defendType: Element): Effectiveness {
  if (attackType === 'neutral') return NEUTRAL_DAMAGE;
  if (attackType === defendType) return NOT_VERY_EFFECTIVE;
  if (STRONG_AGAINST[attackType].includes(defendType)) return SUPER_EFFECTIVE;
  if (WEAK_TO[attackType].includes(defendType)) return NOT_VERY_EFFECTIVE;
  return NEUTRAL_DAMAGE;
}

/**
 * STAB (Same Type Attack Bonus): a move that matches one of the user's
 * elements deals 1.5x. Neutral moves never get STAB.
 */
export const STAB_MULTIPLIER = 1.5;

export function stabMultiplier(moveType: MoveType, userElements: readonly Element[]): number {
  if (moveType === 'neutral') return 1;
  return userElements.includes(moveType) ? STAB_MULTIPLIER : 1;
}

/** Human-readable label for a damage multiplier, used by the UI. */
export function effectivenessLabel(mult: number): string | null {
  if (mult >= 2) return "It's super effective!";
  if (mult <= 0.5 && mult > 0) return "It's not very effective...";
  if (mult === 0) return 'It had no effect...';
  return null;
}

export interface TypeMatchup {
  /** Multiplier applied to incoming damage. */
  multiplier: Effectiveness;
  /** The element that is strong against `defender`. */
  source: Element | null;
}

/**
 * The full defensive profile of an element: which attacking elements hit it
 * hard, softly, or normally. Handy for the Prismadex matchup panel and for the
 * AI's switching logic.
 */
export function defensiveProfile(defender: Element): TypeMatchup[] {
  const order: MoveType[] = [...ELEMENTS, 'neutral'];
  return order.map((attackType) => ({
    multiplier: typeEffectiveness(attackType, defender),
    source: attackType === 'neutral' ? null : (attackType as Element),
  }));
}

/** Every attacking element that is 2x against `defender`. */
export function weaknesses(defender: Element): Element[] {
  return [...WEAK_TO[defender]];
}

/** Every attacking element that is 0.5x against `defender`. */
export function resistances(defender: Element): Element[] {
  const out: Element[] = [];
  for (const attack of ELEMENTS) {
    if (attack === defender) continue;
    if (STRONG_AGAINST[defender].includes(attack)) out.push(attack);
  }
  // Same-type resistance.
  out.push(defender);
  return out;
}

/** Convenience: the CSS colour for an element, for DOM-based UI. */
export function elementHex(type: MoveType): string {
  return ELEMENT_INFO[type].hex;
}

export function elementColor(type: MoveType): number {
  return ELEMENT_INFO[type].color;
}

/** True when the value is one of the six real elements (not Neutral). */
export function isElement(value: string): value is Element {
  return (ELEMENTS as readonly string[]).includes(value);
}
