/**
 * Overworld rules that do not need a scene: which tiles can be walked on, who
 * can see the player, where story battles trigger and what an altar does.
 *
 * The overworld scene asks these questions and animates the answers, so the
 * rules can be unit-tested without Phaser.
 */

import { TILE_SPECS, isSolid, type TileName } from '../render/tiles/TilePainter';
import { isMidnight, isNoon } from '../core/Time';
import type { GameState } from '../core/GameState';
import type { Facing, MapDef, NpcDef } from './maps';

export type FieldAbility = NonNullable<MapDef['requires']>;

export interface TilePos {
  x: number;
  y: number;
}

const ABILITY_SIGILS: Record<FieldAbility, string> = {
  cut: 'sigil-grass',
  magnet: 'sigil-electric',
  surf: 'sigil-water',
  light: 'sigil-fire',
  smash: 'sigil-crystal',
  'night-sight': 'sigil-shadow',
};

export function hasFieldAbility(state: GameState, ability: FieldAbility): boolean {
  const sigil = ABILITY_SIGILS[ability];
  return sigil ? state.hasSigil(sigil) : false;
}

/**
 * Whether a tile can be stepped on. `occupied` reports tiles blocked by a
 * visible NPC.
 */
export function canWalkTo(
  map: MapDef,
  grid: TileName[][],
  x: number,
  y: number,
  hasAbility: (ability: FieldAbility) => boolean,
  occupied: (x: number, y: number) => boolean,
): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const tile = grid[y]?.[x];
  if (!tile) return false;
  const spec = TILE_SPECS[tile];
  if (!spec) return true;

  // Only these explicit field obstacles open up once their ability is earned;
  // every other blocked tile (cave walls, crystal walls, buildings, rocks,
  // trees, fences) stays blocked.
  if (tile.startsWith('water')) {
    if (!hasAbility('surf')) return false;
  } else if (tile === 'cut-tree') {
    if (!hasAbility('cut')) return false;
  } else if (tile === 'crystal-smashable') {
    if (!hasAbility('smash')) return false;
  } else if (tile === 'bush') {
    if (!hasAbility('night-sight')) return false;
  } else if (tile === 'magnet-plate') {
    if (!hasAbility('magnet')) return false;
  } else if (spec.solid) {
    return false;
  }

  return !occupied(x, y);
}

export function facingTile(pos: TilePos, facing: Facing): TilePos {
  switch (facing) {
    case 'up':
      return { x: pos.x, y: pos.y - 1 };
    case 'down':
      return { x: pos.x, y: pos.y + 1 };
    case 'left':
      return { x: pos.x - 1, y: pos.y };
    default:
      return { x: pos.x + 1, y: pos.y };
  }
}

/** Whether the player stands in a straight line within the NPC's sight range. */
export function inSightLine(def: NpcDef, sight: number, player: TilePos): boolean {
  const dx = player.x - def.x;
  const dy = player.y - def.y;
  const facing = def.facing;
  return (
    (facing === 'left' && dy === 0 && dx < 0 && -dx <= sight) ||
    (facing === 'right' && dy === 0 && dx > 0 && dx <= sight) ||
    (facing === 'up' && dx === 0 && dy < 0 && -dy <= sight) ||
    (facing === 'down' && dx === 0 && dy > 0 && dy <= sight)
  );
}

/** No solid tile lies strictly between the two points (a straight line). */
export function lineOfSightClear(
  grid: TileName[][],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  const dx = Math.sign(x1 - x0);
  const dy = Math.sign(y1 - y0);
  let x = x0 + dx;
  let y = y0 + dy;
  while (x !== x1 || y !== y1) {
    const tile = grid[y]?.[x];
    if (!tile || isSolid(tile)) return false;
    x += dx;
    y += dy;
  }
  return true;
}

/** Which rival battle (1-4) the player's step triggers, if any. */
export function rivalTriggerAt(state: GameState, mapId: string, player: TilePos): number | null {
  const flags = state.flags;

  // Rival battle 1: first time leaving Emberleaf Town.
  if (mapId === 'route-1' && player.y >= 24 && !flags['rival-1-defeated'] && state.starterChosen) {
    return 1;
  }

  // Rival battle 2: entering Route 2 after the first Sigil.
  if (mapId === 'route-2' && player.y >= 27 && flags['trial-1-cleared'] && !flags['rival-2-defeated']) {
    return 2;
  }

  // Rival battle 3: entering Route 4 after the third Sigil.
  if (mapId === 'route-4' && player.y >= 27 && flags['trial-3-cleared'] && !flags['rival-3-defeated']) {
    return 3;
  }

  // Rival battle 4: entering Route 7 after five Sigils.
  if (
    mapId === 'route-7' &&
    player.y >= 28 &&
    state.getSigilCount() >= 5 &&
    !flags['rival-4-defeated']
  ) {
    return 4;
  }

  return null;
}

export type AltarEvent =
  | { kind: 'legendary'; speciesId: string; level: number; flag: string; lines: string[] }
  | { kind: 'champion' }
  | { kind: 'none' };

/** What happens when the player inspects an empty tile on this map. */
export function altarEventAt(state: GameState, map: MapDef, player: TilePos): AltarEvent {
  // Solarion, at noon in the caldera.
  if (map.id === 'cinder-peak' && isNoon(state.clock) && !state.getFlag('solarion-caught')) {
    return {
      kind: 'legendary',
      speciesId: 'solarion',
      level: 58,
      flag: 'solarion-caught',
      lines: ['The caldera shimmers. Something golden stirs in the heat.', 'Challenge Solarion?'],
    };
  }

  // Eclipsor, at midnight in the ruins.
  if (
    map.id === 'duskmoor-ruins' &&
    isMidnight(state.clock) &&
    state.getFlag('eclipse-ritual-broken') &&
    !state.getFlag('eclipsor-caught')
  ) {
    return {
      kind: 'legendary',
      speciesId: 'eclipsor',
      level: 60,
      flag: 'eclipsor-caught',
      lines: ['The altar splits. Light pours in and does not come back out.', 'Eclipsor rises!'],
    };
  }

  // Aetherion, after the Champion, once 39 others are caught.
  if (
    map.id === 'prism-summit' &&
    state.getFlag('champion-defeated') &&
    state.caughtCount() >= 39 &&
    !state.getFlag('aetherion-caught')
  ) {
    return {
      kind: 'legendary',
      speciesId: 'aetherion',
      level: 60,
      flag: 'aetherion-caught',
      lines: [
        'Six sockets, six sigils, one empty sky.',
        'The elements rush together and the clouds tear open.',
      ],
    };
  }

  // The Champion — only at the summit altar beside Aurelia herself.
  const championNpc = map.npcs.find((n) => n.trainerId === 'champion-aurelia');
  const nearChampion =
    championNpc !== undefined &&
    Math.abs(championNpc.x - player.x) <= 2 &&
    Math.abs(championNpc.y - player.y) <= 2;
  if (map.id === 'prism-summit' && !state.getFlag('champion-defeated') && nearChampion) {
    return { kind: 'champion' };
  }

  return { kind: 'none' };
}

/** Where a white-out sends the player. */
export function whiteOutDestination(state: GameState): { mapId: string; x: number; y: number } {
  return state.sigils.length >= 3
    ? { mapId: 'tidehaven', x: 17, y: 22 }
    : { mapId: 'emberleaf-town', x: 10, y: 14 };
}
