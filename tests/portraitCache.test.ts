import { describe, expect, it } from 'vitest';
import { PortraitCache, runWithinBudget } from '../src/render/portraitCache';

describe('PortraitCache', () => {
  it('renders each species/shiny pair only once', () => {
    const cache = new PortraitCache((id, shiny) => ({ id, shiny }));
    const a = cache.get('emberkit');
    expect(cache.get('emberkit')).toBe(a);
    cache.get('emberkit', true);
    cache.get('emberkit', true);
    cache.get('sproutle');
    expect(cache.renders).toBe(3);
    expect(cache.has('emberkit', true)).toBe(true);
    expect(cache.has('drizzlet')).toBe(false);
  });
});

describe('runWithinBudget', () => {
  it('stops when the budget is spent but always makes progress', () => {
    let t = 0;
    const done: number[] = [];
    const queue = [1, 2, 3, 4, 5].map((n) => () => {
      done.push(n);
      t += 3;
    });
    expect(runWithinBudget(queue, 8, () => t)).toBe(3);
    expect(queue.length).toBe(2);
    expect(runWithinBudget(queue, 0, () => t)).toBe(1);
    expect(done).toEqual([1, 2, 3, 4]);
  });
});
