import { describe, expect, it } from 'vitest';
import { GameState } from '../src/core/GameState';
import {
  TROPHIES,
  QUESTS,
  getChapter,
  trialLockedReason,
  questStatus,
  claimQuest,
  storyForMap,
  finaleLines,
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
  it('starts at the first chapter and ends after the champion', () => {
    const state = new GameState();
    const early = getChapter(state);
    expect(early.number).toBe(1);
    state.setFlag('champion-defeated');
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
  it('shows each map story once', () => {
    const state = new GameState();
    const pages = storyForMap(state, 'emberleaf-town');
    expect(pages).not.toBeNull();
    expect(pages!.length).toBe(3);
    expect(state.getFlag('story-emberleaf-town-seen')).toBe(true);
    expect(storyForMap(state, 'emberleaf-town')).toBeNull();
    expect(storyForMap(state, 'nowhere')).toBeNull();
  });

  it('gates the finale on the champion flag', () => {
    const fresh = new GameState();
    expect(finaleLines(fresh)).toEqual([]);
    fresh.setFlag('champion-defeated');
    expect(finaleLines(fresh).length).toBeGreaterThan(0);
  });
});
