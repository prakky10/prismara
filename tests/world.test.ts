import { describe, expect, it, vi } from 'vitest';

// TilePainter imports Phaser at module scope for typing; stub it out.
vi.mock('phaser', () => ({ default: {} }));

import { MAPS, STARTING_MAP, tileNameFor } from '../src/world/maps';
import { TILE_SPECS, type TileName } from '../src/render/tiles/TilePainter';

type Ability = 'surf' | 'cut' | 'light' | 'smash' | 'night-sight' | 'magnet';

const ALL_ABILITIES: Ability[] = ['surf', 'cut', 'light', 'smash', 'night-sight', 'magnet'];

const DIRS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function tileNameAt(mapId: string, x: number, y: number): TileName | undefined {
  const map = MAPS[mapId];
  if (!map) return undefined;
  const ch = map.tiles[y]?.[x];
  if (ch === undefined) return undefined;
  return tileNameFor(ch, map.biome);
}

function isWalkableTile(mapId: string, x: number, y: number, abilities: Set<Ability>): boolean {
  const name = tileNameAt(mapId, x, y);
  if (!name) return false;
  const spec = TILE_SPECS[name];
  if (!spec) return false;
  // Ability gates must be checked before solidity: a magnet-plate (like water)
  // is non-solid but still requires its ability, otherwise the gate is bypassed.
  const req = spec.requires as Ability | undefined;
  if (req && !abilities.has(req)) return false;
  if (!spec.solid) return true;
  return Boolean(req && (name.startsWith('water') ||
    name === 'cut-tree' || name === 'crystal-smashable' || name === 'bush'));
}

const OCCUPIED = new Set<string>();
for (const map of Object.values(MAPS)) {
  for (const npc of map.npcs) OCCUPIED.add(`${map.id}:${npc.x}:${npc.y}`);
}

function walkable(mapId: string, x: number, y: number, abilities: Set<Ability>): boolean {
  return isWalkableTile(mapId, x, y, abilities) && !OCCUPIED.has(`${mapId}:${x}:${y}`);
}

function warpsAt(mapId: string, x: number, y: number) {
  const map = MAPS[mapId];
  if (!map) return [];
  return map.warps.filter(
    (w) => x >= w.x && x < w.x + (w.width ?? 1) && y >= w.y && y < w.y + (w.height ?? 1),
  );
}

interface Node {
  mapId: string;
  x: number;
  y: number;
}

function reachable(abilities: Ability[], start: Node = { mapId: STARTING_MAP, x: 10, y: 14 }): Set<string> {
  const abs = new Set(abilities);
  const seen = new Set<string>([`${start.mapId}:${start.x}:${start.y}`]);
  const queue: Node[] = [start];
  while (queue.length > 0) {
    const cur = queue.shift() as Node;
    const map = MAPS[cur.mapId];
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const warp = warpsAt(cur.mapId, nx, ny)[0];
      if (warp) {
        if (warp.requires && !abs.has(warp.requires as Ability)) continue;
        if (!MAPS[warp.to.mapId]) continue;
        // The runtime only warps when the player can stand on the entrance and
        // on the landing (walkable tile, no NPC). Model that faithfully and
        // credit the entrance tile as reached, without re-queuing it.
        if (!walkable(cur.mapId, nx, ny, abs)) continue;
        const srcKey = `${cur.mapId}:${nx}:${ny}`;
        if (!seen.has(srcKey)) seen.add(srcKey);
        if (!walkable(warp.to.mapId, warp.to.x, warp.to.y, abs)) continue;
        const destKey = `${warp.to.mapId}:${warp.to.x}:${warp.to.y}`;
        if (!seen.has(destKey)) {
          seen.add(destKey);
          queue.push({ mapId: warp.to.mapId, x: warp.to.x, y: warp.to.y });
        }
        continue;
      }
      if (!walkable(cur.mapId, nx, ny, abs)) continue;
      const key = `${cur.mapId}:${nx}:${ny}`;
      if (!seen.has(key)) {
        seen.add(key);
        queue.push({ mapId: cur.mapId, x: nx, y: ny });
      }
    }
  }
  return seen;
}

function npcReachable(mapId: string, npcId: string, abilities: Ability[]): boolean {
  const npc = MAPS[mapId]?.npcs.find((n) => n.id === npcId);
  if (!npc) throw new Error(`missing npc ${mapId}/${npcId}`);
  const reached = reachable(abilities);
  return DIRS.some(([dx, dy]) => reached.has(`${mapId}:${npc.x + dx}:${npc.y + dy}`));
}

function trialMaster(trainerId: string): { mapId: string; npcId: string } {
  for (const map of Object.values(MAPS)) {
    const npc = map.npcs.find((n) => n.trainerId === trainerId);
    if (npc) return { mapId: map.id, npcId: npc.id };
  }
  throw new Error(`no trial master ${trainerId}`);
}

describe('Prismara world structure', () => {
  it('builds 37 rectangular maps', () => {
    const maps = Object.values(MAPS);
    expect(maps).toHaveLength(37);
    for (const map of maps) {
      expect(map.tiles, map.id).toHaveLength(map.height);
      for (const row of map.tiles) expect(row.length, map.id).toBe(map.width);
    }
  });

  it('keeps every warp destination inside its target map', () => {
    for (const map of Object.values(MAPS)) {
      for (const warp of map.warps) {
        const dest = MAPS[warp.to.mapId];
        expect(dest, `${map.id} -> ${warp.to.mapId}`).toBeTruthy();
        expect(warp.to.x, `${map.id} -> ${warp.to.mapId}`).toBeGreaterThanOrEqual(0);
        expect(warp.to.y, `${map.id} -> ${warp.to.mapId}`).toBeGreaterThanOrEqual(0);
        expect(warp.to.x).toBeLessThan(dest.width);
        expect(warp.to.y).toBeLessThan(dest.height);
      }
    }
  });

  it('lands every warp on open ground that no NPC occupies', () => {
    const abs = new Set<Ability>(ALL_ABILITIES);
    for (const map of Object.values(MAPS)) {
      for (const warp of map.warps) {
        const where = `${map.id} -> ${warp.to.mapId} (${warp.to.x},${warp.to.y})`;
        expect(isWalkableTile(warp.to.mapId, warp.to.x, warp.to.y, abs), where).toBe(true);
        expect(OCCUPIED.has(`${warp.to.mapId}:${warp.to.x}:${warp.to.y}`), where).toBe(false);
      }
    }
  });

  it('never bounces the player straight back and always offers a landing', () => {
    const abs = new Set<Ability>(ALL_ABILITIES);
    for (const map of Object.values(MAPS)) {
      for (const warp of map.warps) {
        const where = `${map.id} -> ${warp.to.mapId} (${warp.to.x},${warp.to.y})`;
        expect(warpsAt(warp.to.mapId, warp.to.x, warp.to.y).length, where).toBe(0);
        const landing = DIRS.some(([dx, dy]) =>
          walkable(warp.to.mapId, warp.to.x + dx, warp.to.y + dy, abs),
        );
        expect(landing, `${where} has no free adjacent landing`).toBe(true);
      }
    }
  });

  it('makes every warp source reachable with all abilities', () => {
    const reached = reachable(ALL_ABILITIES);
    for (const map of Object.values(MAPS)) {
      for (const warp of map.warps) {
        let ok = false;
        for (let x = warp.x; x < warp.x + (warp.width ?? 1) && !ok; x++) {
          for (let y = warp.y; y < warp.y + (warp.height ?? 1) && !ok; y++) {
            if (reached.has(`${map.id}:${x}:${y}`)) ok = true;
          }
        }
        expect(ok, `${map.id} warp at (${warp.x},${warp.y}) unreachable`).toBe(true);
      }
    }
  });

  it('spawns the player on walkable ground', () => {
    expect(walkable(STARTING_MAP, 10, 14, new Set())).toBe(true);
  });
});

describe('Prismara progression', () => {
  it('reaches the Eclipse grunt in the forest with no Trophies', () => {
    expect(npcReachable('whisperwood-forest', 'eclipse-grunt-1', [])).toBe(true);
  });

  it('walks through all six Trials as the Trophies are earned', () => {
    const stages: Array<[string, Ability[]]> = [
      ['trial-ivy', []],
      ['trial-volta', ['cut']],
      ['trial-marin', ['cut', 'magnet']],
      ['trial-blaze', ['cut', 'magnet', 'surf']],
      ['trial-opal', ['cut', 'magnet', 'surf', 'light']],
      ['trial-raven', ['cut', 'magnet', 'surf', 'light', 'smash']],
    ];
    for (const [trainerId, abs] of stages) {
      const { mapId, npcId } = trialMaster(trainerId);
      expect(npcReachable(mapId, npcId, abs), trainerId).toBe(true);
    }
  });

  it('reaches Voss and the Champion once all six Trophies are held', () => {
    const six: Ability[] = ['cut', 'magnet', 'surf', 'light', 'smash', 'night-sight'];
    expect(npcReachable('duskmoor-ruins', 'eclipse-admin-voss', six)).toBe(true);
    expect(npcReachable('prism-summit', 'champion-aurelia', six)).toBe(true);
  });

  it('publishes a reachable Shadow Trial for Raven in Duskmoor', () => {
    const raven = MAPS['duskmoor-ruins'].npcs.find((n) => n.id === 'trial-raven');
    expect(raven?.kind).toBe('trial');
    expect(raven?.trainerId).toBe('trial-raven');
    expect(npcReachable('duskmoor-ruins', 'trial-raven', ['cut', 'magnet', 'surf', 'light', 'smash'])).toBe(true);
  });

  it('gates the Geode side-cave behind Smash', () => {
    expect(reachable(['cut', 'magnet', 'surf', 'light']).has('glimmer-caverns:17:27')).toBe(false);
    expect(reachable(['cut', 'magnet', 'surf', 'light', 'smash']).has('glimmer-caverns:17:27')).toBe(true);
  });

  it('names a Trophy on every town sign so players know the goal', () => {
    const towns = [
      'thistlebrook',
      'voltspire-city',
      'tidehaven',
      'ashfall-town',
      'geode-hollow',
      'duskmoor-ruins',
    ];
    for (const town of towns) {
      const guided = MAPS[town].npcs.some(
        (npc) => npc.kind === 'sign' && (npc.dialogue ?? []).some((line) => line.includes('Trophy')),
      );
      expect(guided, town).toBe(true);
    }
  });
});
