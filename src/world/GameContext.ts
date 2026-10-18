/**
 * The single place scenes reach for shared, non-Phaser state: the active save,
 * the settings, and the world clock. Also the launch configuration used when
 * starting a battle from anywhere (overworld, debug menu or title screen).
 */

import { GameState } from '../core/GameState';
import { DEFAULT_SETTINGS, loadSettings, type GameSettings } from '../core/SaveManager';
import { Audio } from '../audio/AudioManager';
import type { TrainerDef, TrainerMon } from './trainers';
import type { AITier } from '../battle/BattleState';
import type { CreatureInstance } from '../battle/Creature';
import { createCreature } from '../battle/Creature';
import { getSpecies } from '../data/creatures';
import { random } from '../core/SeededRNG';
import { maximizeMovesForLevel } from './battleSetup';

export interface WildBattleRequest {
  kind: 'wild';
  speciesId: string;
  level: number;
  shiny: boolean;
  /** Higher chance of a shiny in rustling grass. */
  rustling?: boolean;
}

export interface TrainerBattleRequest {
  kind: 'trainer';
  trainer: TrainerDef;
  /** Optional pre-built party (used by the rival). */
  party?: TrainerMon[];
  /** Shown on the VS banner. */
  trainerName: string;
  isRival?: boolean;
}

export type BattleRequest = WildBattleRequest | TrainerBattleRequest;

export interface BattleOutcome {
  winner: 'player' | 'enemy' | 'draw';
  reason: 'faint' | 'catch' | 'flee' | 'forfeit';
  caught: CreatureInstance | null;
  moneyEarned: number;
  fled: boolean;
}

class GameContextImpl {
  state: GameState = new GameState();
  settings: GameSettings = { ...DEFAULT_SETTINGS };
  /** Set by the Title scene when a save is loaded. */
  slot = 0;
  /** The request the Battle scene should pick up when it starts. */
  pendingBattle: BattleRequest | null = null;
  /** The exact wild instance the overworld rolled, so it is not re-rolled. */
  pendingWildCreature: CreatureInstance | null = null;
  /** Populated by the Battle scene when it finishes. */
  lastOutcome: BattleOutcome | null = null;
  /** The trainer fought in the battle that just ended, for post-battle story scenes. */
  lastTrainer: TrainerDef | null = null;
  /** True while an evolution cinematic should play after the battle. */
  pendingEvolutions: string[] = [];
  /** Where the player was standing before entering a battle. */
  returnPosition: { mapId: string; x: number; y: number; facing: 'up' | 'down' | 'left' | 'right' } | null =
    null;
  /** Set by the settings scene so the overworld can react without a reload. */
  touchControlsVisible = false;

  constructor() {
    this.settings = loadSettings();
    this.touchControlsVisible = this.settings.showTouchControls;
    Audio.applySettings(this.settings);
  }

  applySettings(settings: GameSettings): void {
    this.settings = { ...settings };
    this.touchControlsVisible = settings.showTouchControls;
    Audio.applySettings(this.settings);
  }

  /** Build a creature instance for a wild encounter. */
  createWild(speciesId: string, level: number, shiny = false): CreatureInstance {
    return createCreature(speciesId, level, {
      rng: random,
      shiny,
      originalTrainer: this.state.playerName,
      metLocation: this.state.position.mapId,
      metLevel: level,
    });
  }

  /** Build a trainer's party from its data. */
  buildTrainerParty(mons: TrainerMon[]): CreatureInstance[] {
    return mons.map((mon) => buildTrainerMon(mon, this.state.playerName));
  }
}

/** Create a trainer-owned creature with its full learnset at that level. */
export function buildTrainerMon(mon: TrainerMon, playerName: string): CreatureInstance {
  const creature = createCreature(mon.speciesId, mon.level, {
    rng: random,
    originalTrainer: playerName,
    metLocation: 'Prismara',
    metLevel: mon.level,
  });
  maximizeMovesForLevel(creature, mon.moves);
  void getSpecies(mon.speciesId);
  return creature;
}

export const Game = new GameContextImpl();

/** Convenience: the AI tier for a wild creature. */
export const WILD_TIER: AITier = 'youngster';
