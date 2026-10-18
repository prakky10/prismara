import { describe, expect, it } from 'vitest';
import { rectContains, rectCoverage, rectCoversPlayer } from '../src/render/three/occlusion';

const rect = { minX: -0.5, maxX: 0.5, minY: -0.2, maxY: 0.6 };

describe('occlusion rect helpers', () => {
  it('detects contained points', () => {
    expect(rectContains(rect, 0, 0)).toBe(true);
    expect(rectContains(rect, 0.6, 0)).toBe(false);
    expect(rectContains(rect, 0.6, 0, 0.2)).toBe(true);
  });
  it('requires the whole body to be covered', () => {
    const body = [{ x: 0, y: 0.5 }, { x: 0, y: 0.3 }, { x: 0, y: 0.1 }];
    expect(rectCoversPlayer(rect, body)).toBe(true);
    const brushing = [{ x: 0, y: 0.7 }, { x: 0, y: 0.5 }, { x: 0, y: 0.3 }];
    expect(rectCoverage(rect, brushing)).toBeCloseTo(2 / 3);
    expect(rectCoversPlayer(rect, brushing)).toBe(false);
    expect(rectCoversPlayer(rect, [])).toBe(false);
  });
});
