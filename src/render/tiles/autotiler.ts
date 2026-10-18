/**
 * Auto-tiling.
 *
 * Maps are authored as plain name grids; this pass looks at neighbours and
 * swaps in the right edge variant so water gets shorelines, paths get borders
 * and cliffs get their lips — without the author placing a single edge tile.
 */

import { type TileName } from './TilePainter';

const WATER_TILES = new Set<string>([
  'water',
  'water-a',
  'water-b',
  'water-c',
  'water-edge-n',
  'water-edge-s',
  'water-edge-e',
  'water-edge-w',
]);

const isWater = (name: TileName | undefined): boolean =>
  name !== undefined && WATER_TILES.has(name);

/**
 * Replace plain water with edge variants where it meets land. Edges are
 * resolved north-first so a corner reads naturally.
 */
export function autotileWater(grid: TileName[][]): TileName[][] {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const out: TileName[][] = grid.map((row) => row.slice());

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isWater(grid[y][x])) continue;
      const north = isWater(grid[y - 1]?.[x]);
      const south = isWater(grid[y + 1]?.[x]);
      const east = isWater(grid[y]?.[x + 1]);
      const west = isWater(grid[y]?.[x - 1]);

      if (!north) out[y][x] = 'water-edge-n';
      else if (!south) out[y][x] = 'water-edge-s';
      else if (!east) out[y][x] = 'water-edge-e';
      else if (!west) out[y][x] = 'water-edge-w';
      else out[y][x] = ((x + y) % 3 === 0 ? 'water-a' : (x + y) % 3 === 1 ? 'water-b' : 'water') as TileName;
    }
  }
  return out;
}

/** Sprinkle deterministic grass/flower variety so large lawns are not flat. */
export function autotileGround(grid: TileName[][], seed = 1): TileName[][] {
  const out = grid.map((row) => row.slice());
  const grassVariants: TileName[] = ['grass', 'grass-a', 'grass-b', 'grass-c'];
  for (let y = 0; y < out.length; y++) {
    for (let x = 0; x < (out[y]?.length ?? 0); x++) {
      if (out[y][x] !== 'grass') continue;
      const h = (x * 7349 + y * 9151 + seed * 2654435761) >>> 0;
      out[y][x] = grassVariants[h % grassVariants.length];
    }
  }
  return out;
}

/** Apply both passes in the order a map loader wants them. */
export function autotile(grid: TileName[][], seed = 1): TileName[][] {
  return autotileWater(autotileGround(grid, seed));
}

/** Which of the four cliff/path edge bits are set, for future 16-tile sets. */
export function edgeMask(
  grid: TileName[][],
  x: number,
  y: number,
  match: (name: TileName | undefined) => boolean,
): number {
  let mask = 0;
  if (match(grid[y - 1]?.[x])) mask |= 1;
  if (match(grid[y]?.[x + 1])) mask |= 2;
  if (match(grid[y + 1]?.[x])) mask |= 4;
  if (match(grid[y]?.[x - 1])) mask |= 8;
  return mask;
}
