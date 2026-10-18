import { describe, expect, it } from 'vitest';
import { GameState } from '../src/core/GameState';
import {
  TROPHIES,
  QUESTS,
  getChapter,
  trialLockedReason,
  questStatus,
  claimQuest,
} from '../src/world/campaign';

describe('trophies', () => {
  it('lists six trophies in sigil order', () => {
    expect(TROPHIES.map((t) => t.id)).toEqual([
      'sigil-grass',
      'sigil-electric',
      'sigil-water',
      'sigil-fire',
      'sigil-crystal',
      'sigil-shadow',
    ]);
    expect(TROPHIES.map((t) => t.trainerId)).toEqual([
      'trial-ivy',
      'trial-volta',
      'trial-marin',
      'trial-blaze',
      'trial-opal',
      'trial-raven',
    ]);
  });
});

describe('chapters', () => {
  it('starts at the first chapter and ends after Edda returns', () => {
    const state = new GameState();
    const early = getChapter(state);
    expect(early.number).toBe(1);
    state.setFlag('edda-returned');
    const late = getChapter(state);
    expect(late.number).toBeGreaterThan(early.number);
  });
});

describe('trial gates', () => {
  it('orders the six trials and the champion', () => {
    const state = new GameState();
    expect(trialLockedReason(state, 'trial-ivy')).not.toBeNull();
    state.setFlag('eclipse-forest-cleared');
    expect(trialLockedReason(state, 'trial-ivy')).toBeNull();

    expect(trialLockedReason(state, 'trial-volta')).not.toBeNull();
    state.sigils.push('sigil-grass');
    expect(trialLockedReason(state, 'trial-volta')).not.toBeNull();
    state.setFlag('eclipse-plant-cleared');
    expect(trialLockedReason(state, 'trial-volta')).toBeNull();

    state.sigils.push('sigil-electric');
    expect(trialLockedReason(state, 'trial-marin')).toBeNull();
    state.sigils.push('sigil-water');
    expect(trialLockedReason(state, 'trial-blaze')).toBeNull();
    state.sigils.push('sigil-fire');
    expect(trialLockedReason(state, 'trial-opal')).toBeNull();
    state.sigils.push('sigil-crystal');
    expect(trialLockedReason(state, 'trial-raven')).toBeNull();

    expect(trialLockedReason(state, 'champion-aurelia')).not.toBeNull();
    state.sigils.push('sigil-shadow');
    expect(trialLockedReason(state, 'champion-aurelia')).not.toBeNull();
    state.setFlag('eclipse-ritual-broken');
    expect(trialLockedReason(state, 'champion-aurelia')).toBeNull();

    expect(trialLockedReason(state, 'youngster-ben')).toBeNull();
  });
});

describe('side quests', () => {
  it('claims a quest only once', () => {
    const state = new GameState();
    state.markCaught('sparkit');
    state.markCaught('bubbloon');
    const quest = QUESTS.find((q) => q.id === 'first-catch')!;
    expect(questStatus(state, quest)).toBe('ready');
    const first = claimQuest(state, 'first-catch');
    expect(first.length).toBeGreaterThan(0);
    expect(state.getFlag('quest-first-catch-claimed')).toBe(true);
    expect(claimQuest(state, 'first-catch')).toEqual([]);
    expect(questStatus(state, quest)).toBe('claimed');
  });

  it('keeps a quest active until its condition is met', () => {
    const state = new GameState();
    const quest = QUESTS.find((q) => q.id === 'scholar')!;
    expect(questStatus(state, quest)).toBe('active');
    expect(claimQuest(state, 'scholar')).toEqual([]);
  });

  it('ignores unknown quests', () => {
    const state = new GameState();
    expect(claimQuest(state, 'nope')).toEqual([]);
  });
});

describe('story and finale', () => {
  it('opens the epilogue only once Edda has stepped out of the prism', () => {
    const state = new GameState();
    state.setFlag('eclipse-forest-cleared');
    state.setFlag('eclipse-plant-cleared');
    state.setFlag('eclipse-ritual-broken');
    state.setFlag('champion-defeated');
    state.sigils.push(...TROPHIES.map((t) => t.id));
    expect(getChapter(state).number).toBe(10);
    expect(getChapter(state).title).toBe('The Last Light');
    state.setFlag('edda-returned');
    expect(getChapter(state)).toMatchObject({ number: 11, title: 'Still Tending It' });
  });

  it('uses the rewritten chapter titles and Trophy memories', () => {
    const state = new GameState();
    expect(getChapter(state).title).toBe('A Dark Lighthouse');
    expect(TROPHIES[0].memory).toContain('Edda planted');
    expect(TROPHIES[1].memory).toContain('11:58');
  });
});
