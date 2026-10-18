import { describe, expect, it } from 'vitest';
import {
  ELEMENTS,
  NOT_VERY_EFFECTIVE,
  STRONG_AGAINST,
  SUPER_EFFECTIVE,
  WEAK_TO,
  stabMultiplier,
  typeEffectiveness,
} from '../src/data/types';

describe('type chart', () => {
  it('is 2x for every declared strength', () => {
    for (const attacker of ELEMENTS) {
      for (const defender of STRONG_AGAINST[attacker]) {
        expect(typeEffectiveness(attacker, defender), `${attacker} -> ${defender}`).toBe(
          SUPER_EFFECTIVE,
        );
      }
    }
  });

  it('is 2x for every declared weakness (symmetry check)', () => {
    for (const defender of ELEMENTS) {
      for (const attacker of WEAK_TO[defender]) {
        expect(typeEffectiveness(attacker, defender), `${attacker} -> ${defender}`).toBe(
          SUPER_EFFECTIVE,
        );
      }
    }
  });

  it('gives every element exactly two strengths and two weaknesses', () => {
    for (const element of ELEMENTS) {
      expect(STRONG_AGAINST[element]).toHaveLength(2);
      expect(WEAK_TO[element]).toHaveLength(2);
    }
  });

  it('is 0.5x for the reverse of a super-effective pair', () => {
    // Grass hits Fire for 0.5x because Fire hits Grass for 2x.
    expect(typeEffectiveness('grass', 'fire')).toBe(NOT_VERY_EFFECTIVE);
    expect(typeEffectiveness('fire', 'grass')).toBe(SUPER_EFFECTIVE);
  });

  it('is 0.5x when a type hits itself', () => {
    for (const element of ELEMENTS) {
      expect(typeEffectiveness(element, element)).toBe(NOT_VERY_EFFECTIVE);
    }
  });

  it('treats Neutral as always 1x', () => {
    for (const defender of ELEMENTS) {
      expect(typeEffectiveness('neutral', defender)).toBe(1);
    }
  });

  it('is balanced: no element is strong against more than two others', () => {
    for (const element of ELEMENTS) {
      const strong = ELEMENTS.filter((d) => typeEffectiveness(element, d) === SUPER_EFFECTIVE);
      expect(strong).toHaveLength(2);
    }
  });
});

describe('STAB', () => {
  it('is 1.5x for a matching element', () => {
    expect(stabMultiplier('fire', ['fire'])).toBe(1.5);
  });

  it('is 1x for a non-matching element', () => {
    expect(stabMultiplier('water', ['fire'])).toBe(1);
  });

  it('never applies to Neutral moves', () => {
    expect(stabMultiplier('neutral', ['fire', 'water'])).toBe(1);
  });
});
