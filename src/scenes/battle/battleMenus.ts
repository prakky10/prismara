/**
 * Builders for the battle menus. Pure: they read battle and bag state and
 * return rows, so the scene only decides when to show them.
 */

import { displayName, getMove, isFainted, maxHp, type BattleState } from '../../battle';
import type { MenuItem } from '../../ui/MenuList';
import { ELEMENT_INFO } from '../../data/types';
import { ITEMS, type ItemId } from '../../data/items';

export function actionMenuItems(battle: BattleState): MenuItem[] {
  return [
    { value: 'fight', label: 'Fight' },
    { value: 'bag', label: 'Bag' },
    { value: 'party', label: 'Creature' },
    {
      value: 'run',
      label: battle.canFlee ? 'Run' : '—',
      disabled: !battle.canFlee,
    },
  ];
}

export function moveMenuItems(battle: BattleState): MenuItem[] {
  const player = battle.active('player');
  const items: MenuItem[] = player.moves.map((slot, index) => {
    const move = getMove(slot.id);
    return {
      value: String(index),
      label: move?.name ?? slot.id,
      sublabel: `${slot.pp}/${slot.maxPp}`,
      disabled: slot.pp <= 0,
      trailing: move ? move.type.toUpperCase() : '',
      color: move ? ELEMENT_INFO[move.type].color : undefined,
    };
  });
  // Struggle is the fallback when every move is out of PP (engine reads -1).
  const anyPp = player.moves.some((slot) => slot.pp > 0);
  if (items.length === 0 || !anyPp) items.push({ value: '-1', label: 'Struggle' });
  return items;
}

/**
 * Party rows. A forced switch (after a faint) may pick any living creature but
 * the active one; a voluntary switch also respects being entangled.
 */
export function partyMenuItems(battle: BattleState, forced: boolean): MenuItem[] {
  return battle.player.party.map((creature, index) => ({
    value: String(index),
    label: displayName(creature),
    sublabel: `${creature.currentHp}/${maxHp(creature)}`,
    disabled:
      isFainted(creature) ||
      index === battle.player.activeIndex ||
      (!forced && creature.status === 'entangled'),
  }));
}

export function bagMenuItems(
  entries: Array<{ id: ItemId; count: number }>,
  isWild: boolean,
): MenuItem[] {
  // Only real, non-empty entries — never a duplicate or a zero-count orb row.
  const usable = entries
    .filter((entry) => entry.count > 0)
    .filter((entry) => ITEMS[entry.id].usableInBattle || ITEMS[entry.id].throwable);
  const items: MenuItem[] = usable.map((entry) => {
    const item = ITEMS[entry.id];
    const isOrb = item.throwable === true;
    return {
      value: `item-${entry.id}`,
      label: item.name,
      trailing: `x${entry.count}`,
      disabled: isOrb && !isWild,
    };
  });
  items.push({ value: 'back', label: 'Back' });
  return items;
}

export function learnMenuItems(
  moves: Array<{ id: string; pp: number; maxPp: number }>,
): MenuItem[] {
  return [
    ...moves.map((slot, index) => ({
      value: String(index),
      label: prettyMove(slot.id),
      sublabel: `${slot.pp}/${slot.maxPp}`,
    })),
    { value: 'skip', label: "Don't learn it" },
  ];
}

export function statLabel(stat: string): string {
  const labels: Record<string, string> = {
    attack: 'Attack',
    defense: 'Defense',
    spPower: 'Sp. Power',
    spGuard: 'Sp. Guard',
    speed: 'Speed',
    accuracy: 'accuracy',
    evasion: 'evasiveness',
  };
  return labels[stat] ?? stat;
}

export function prettyMove(id: string): string {
  return id
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Which battle arena each map uses. */
export function arenaBiomeFor(mapId: string): string {
  const zones: Record<string, string> = {
    'emberleaf-town': 'meadow',
    'route-1': 'meadow',
    'whisperwood-forest': 'forest',
    thistlebrook: 'forest',
    'route-2': 'city',
    'voltspire-city': 'city',
    'route-3': 'beach',
    tidehaven: 'beach',
    'route-4': 'beach',
    'ashfall-town': 'volcano',
    'cinder-peak': 'volcano',
    'route-5': 'volcano',
    'route-6': 'ruins',
    'geode-hollow': 'cave',
    'glimmer-caverns': 'cave',
    'route-7': 'forest',
    'duskmoor-ruins': 'ruins',
    'prism-summit': 'summit',
  };
  return zones[mapId] ?? 'meadow';
}
