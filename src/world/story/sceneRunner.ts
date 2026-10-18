/**
 * Pure scene runner: decides which story scenes are due for a trigger, marks
 * them played and turns them into display lines. No Phaser, so it is unit-tested.
 *
 * The OverworldScene calls the `scenesFor*` queries at map entry, NPC talk and
 * after a trainer battle, then `runScenes` to apply them and get the lines.
 */

import type { GameState } from '../../core/GameState';
import { toDialogue, type DialogueLine } from './dialogue';
import { SCENES, triggersOf, type SceneTrigger, type StoryScene } from './scenes';

type Flags = Record<string, boolean>;

export function sceneFlag(scene: StoryScene): string {
  return `scene-${scene.id}`;
}

export function isSceneDone(state: GameState, scene: StoryScene): boolean {
  return state.getFlag(sceneFlag(scene));
}

function available(flags: Flags, scene: StoryScene): boolean {
  if (!scene.repeat && flags[sceneFlag(scene)] === true) return false;
  if (scene.requires?.some((flag) => flags[flag] !== true)) return false;
  if (scene.forbids?.some((flag) => flags[flag] === true)) return false;
  return true;
}

/** What the scene does to the flag table, applied to a scratch copy for look-ahead. */
function simulate(flags: Flags, scene: StoryScene): void {
  if (!scene.repeat) flags[sceneFlag(scene)] = true;
  for (const flag of scene.sets ?? []) flags[flag] = true;
}

function matches(scene: StoryScene, test: (trigger: SceneTrigger) => boolean): boolean {
  return triggersOf(scene).some(test);
}

/**
 * Scenes due for a trigger, in script order. Each scene is evaluated against the
 * flags the earlier ones would set, so a sequence plays in one go.
 */
function collect(state: GameState, test: (trigger: SceneTrigger) => boolean): StoryScene[] {
  const flags: Flags = { ...state.flags };
  const due: StoryScene[] = [];
  for (const scene of SCENES) {
    if (scene.repeat || !matches(scene, test) || !available(flags, scene)) continue;
    due.push(scene);
    simulate(flags, scene);
  }
  return due;
}

/** Scenes that fire the first time the player enters a map. */
export function scenesForMapEntry(state: GameState, mapId: string): StoryScene[] {
  return collect(state, (t) => t.kind === 'entry' && t.mapId === mapId);
}

/** Scenes that play once the player has won a battle against this trainer. */
export function scenesAfterBattle(state: GameState, trainerId: string): StoryScene[] {
  return collect(state, (t) => t.kind === 'after' && t.trainerId === trainerId);
}

/**
 * Scenes unlocked by every trainer the player has already beaten. Uses the
 * durable `defeated-<id>` marker written by applyTrainerVictory, so a victory
 * whose after-battle story was cut short by a reload still plays its scenes
 * (journal pages, lore) instead of losing them with the transient battle state.
 */
export function scenesForDefeatedTrainers(state: GameState): StoryScene[] {
  return collect(
    state,
    (t) => t.kind === 'after' && state.getFlag(`defeated-${t.trainerId}`) === true,
  );
}

/**
 * Scenes for talking to an NPC: the first available once-only scene plus any
 * `chain` scenes that follow it, otherwise the first repeatable variant.
 */
export function scenesForNpcTalk(state: GameState, mapId: string, npcId: string): StoryScene[] {
  const test = (t: SceneTrigger): boolean =>
    t.kind === 'talk' && t.mapId === mapId && t.npcId === npcId;
  const flags: Flags = { ...state.flags };
  const due: StoryScene[] = [];

  for (const scene of SCENES) {
    if (scene.repeat || !matches(scene, test) || !available(flags, scene)) continue;
    if (due.length > 0 && !scene.chain) continue;
    due.push(scene);
    simulate(flags, scene);
  }
  if (due.length > 0) return due;

  const variant = SCENES.find((scene) => scene.repeat && matches(scene, test) && available(flags, scene));
  return variant ? [variant] : [];
}

/**
 * Mark a scene played and set its flags. Once-only scenes record `scene-<id>`.
 * Returns the message for a reward that was actually granted, if any.
 */
export function applyScene(state: GameState, scene: StoryScene): string[] {
  const messages: string[] = [];
  const reward = scene.reward;
  if (reward && !(reward.unlessFlag && state.getFlag(reward.unlessFlag))) {
    state.addItem(reward.item, reward.count);
    messages.push(reward.message);
  }
  if (!scene.repeat) state.setFlag(sceneFlag(scene));
  for (const flag of scene.sets ?? []) state.setFlag(flag);
  return messages;
}

/**
 * Apply scenes and return their display lines with names substituted. Flags are
 * set up front, before any dialogue shows, so a reload mid-scene cannot replay it.
 */
export function runScenes(state: GameState, scenes: readonly StoryScene[]): DialogueLine[] {
  const lines: DialogueLine[] = [];
  for (const scene of scenes) {
    const rewards = applyScene(state, scene);
    lines.push(...toDialogue(scene.lines, state));
    lines.push(...rewards.map((text) => ({ text })));
  }
  return lines;
}
