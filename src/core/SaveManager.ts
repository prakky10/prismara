/**
 * Save data: three manual slots plus an autosave, all in localStorage.
 *
 * Saves carry a version number and are migrated forward on load, so an old
 * file from a previous build keeps working instead of being thrown away.
 */

import { GameState, SAVE_VERSION, type GameStateData } from './GameState';
import { getSpecies, type CreatureId } from '../data/creatures';

const PREFIX = 'prismara.save.';
const AUTOSAVE_KEY = `${PREFIX}auto`;
const SETTINGS_KEY = 'prismara.settings';
const SLOT_COUNT = 3;

export interface SaveSlotMeta {
  slot: number;
  exists: boolean;
  playerName: string;
  playtimeMinutes: number;
  caught: number;
  sigils: number;
  updatedAt: number;
  starter: CreatureId | null;
}

export interface GameSettings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  textSpeed: 'slow' | 'normal' | 'fast' | 'instant';
  battleAnimations: boolean;
  reducedEffects: boolean;
  damageNumbers: boolean;
  colorblindTypeIcons: boolean;
  showTouchControls: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  musicVolume: 0.5,
  sfxVolume: 0.7,
  muted: false,
  textSpeed: 'normal',
  battleAnimations: true,
  reducedEffects: false,
  damageNumbers: true,
  colorblindTypeIcons: false,
  showTouchControls: false,
};

/** Milliseconds per character for each text-speed setting. */
export const TEXT_SPEED_MS: Record<GameSettings['textSpeed'], number> = {
  slow: 42,
  normal: 22,
  fast: 10,
  instant: 0,
};

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function slotKey(slot: number): string {
  return `${PREFIX}slot${slot}`;
}

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const STAT_KEYS = ['hp', 'attack', 'defense', 'spPower', 'spGuard', 'speed'] as const;
const STAGE_KEYS = ['attack', 'defense', 'spPower', 'spGuard', 'speed', 'accuracy', 'evasion'] as const;
const VOLATILE_BOOLEAN_KEYS = [
  'soaked',
  'dazzled',
  'protected',
  'flinch',
  'sureHit',
  'focusEnergy',
  'magnetPull',
  'leechSeed',
] as const;
const VOLATILE_NUMBER_KEYS = ['trapped', 'reflectTurns', 'daze'] as const;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isValidBaseStats(raw: unknown): boolean {
  if (!isPlainObject(raw)) return false;
  return STAT_KEYS.every((key) => isFiniteNumber(raw[key]));
}

function isValidStages(raw: unknown): boolean {
  if (!isPlainObject(raw)) return false;
  return STAGE_KEYS.every((key) => isFiniteNumber(raw[key]));
}

function isValidVolatiles(raw: unknown): boolean {
  if (!isPlainObject(raw)) return false;
  for (const key of VOLATILE_BOOLEAN_KEYS) if (typeof raw[key] !== 'boolean') return false;
  for (const key of VOLATILE_NUMBER_KEYS) if (!isFiniteNumber(raw[key])) return false;
  if (!isFiniteNumber(raw.reflectFraction)) return false;
  if (raw.charging !== null && typeof raw.charging !== 'string') return false;
  return true;
}

function isValidMoveSlot(raw: unknown): boolean {
  if (!isPlainObject(raw)) return false;
  if (typeof raw.id !== 'string' || raw.id.length === 0) return false;
  if (!isNonNegativeInteger(raw.pp) || !isNonNegativeInteger(raw.maxPp)) return false;
  return raw.pp <= raw.maxPp;
}

function isValidMoves(raw: unknown): boolean {
  if (!Array.isArray(raw) || raw.length === 0) return false;
  return raw.every(isValidMoveSlot);
}

function isValidCreature(raw: unknown): boolean {
  if (!isPlainObject(raw)) return false;
  const speciesId = raw.speciesId;
  if (typeof speciesId !== 'string' || speciesId.length === 0) return false;
  try {
    if (getSpecies(speciesId as CreatureId) == null) return false;
  } catch {
    return false;
  }
  if (typeof raw.uid !== 'string' || raw.uid.length === 0) return false;
  if (raw.nickname !== null && typeof raw.nickname !== 'string') return false;
  if (!isNonNegativeInteger(raw.level) || raw.level < 1) return false;
  if (!isNonNegativeInteger(raw.expIntoLevel)) return false;
  if (!isNonNegativeInteger(raw.exp)) return false;
  if (!isValidBaseStats(raw.ivs)) return false;
  if (!isNonNegativeInteger(raw.currentHp)) return false;
  if (raw.status !== null && typeof raw.status !== 'string') return false;
  if (!isNonNegativeInteger(raw.statusTurns)) return false;
  if (!isValidVolatiles(raw.volatiles)) return false;
  if (!isValidStages(raw.stages)) return false;
  if (!isValidMoves(raw.moves)) return false;
  if (typeof raw.ability !== 'string' || raw.ability.length === 0) return false;
  if (typeof raw.shiny !== 'boolean') return false;
  if (raw.gender !== 'male' && raw.gender !== 'female' && raw.gender !== 'none') return false;
  if (!isNonNegativeInteger(raw.friendship)) return false;
  if (typeof raw.originalTrainer !== 'string') return false;
  if (typeof raw.metLocation !== 'string') return false;
  if (!isNonNegativeInteger(raw.metLevel)) return false;
  if (typeof raw.revivedThisBattle !== 'boolean') return false;
  if (raw.pendingEvolution !== null && typeof raw.pendingEvolution !== 'string') return false;
  return true;
}

function isValidPosition(raw: unknown): boolean {
  if (!isPlainObject(raw)) return false;
  return (
    typeof raw.mapId === 'string' &&
    typeof raw.x === 'number' &&
    typeof raw.y === 'number' &&
    Number.isFinite(raw.x) &&
    Number.isFinite(raw.y)
  );
}

function isValidBag(raw: unknown): boolean {
  if (!isPlainObject(raw)) return false;
  return Object.values(raw).every(isNonNegativeInteger);
}

function isValidDexEntry(raw: unknown): boolean {
  if (!isPlainObject(raw)) return false;
  if (typeof raw.seen !== 'boolean' || typeof raw.caught !== 'boolean') return false;
  if (!isNonNegativeInteger(raw.caughtCount)) return false;
  if (typeof raw.shinySeen !== 'boolean') return false;
  if (raw.firstMet !== null && typeof raw.firstMet !== 'string') return false;
  return true;
}

function isValidDex(raw: unknown): boolean {
  if (!isPlainObject(raw)) return false;
  return Object.values(raw).every(isValidDexEntry);
}

function isValidBoxes(raw: unknown): boolean {
  if (!Array.isArray(raw)) return false;
  return raw.every(
    (box) => Array.isArray(box) && box.every((slot) => slot === null || isValidCreature(slot)),
  );
}

function isValidSaveData(value: unknown): value is GameStateData {
  if (!isPlainObject(value)) return false;
  const version = value.version;
  if (version !== undefined && (typeof version !== 'number' || version > SAVE_VERSION)) {
    return false;
  }
  if (typeof value.playerName !== 'string') return false;
  if (value.rivalName !== undefined && typeof value.rivalName !== 'string') return false;
  if (value.money !== undefined && !isNonNegativeInteger(value.money)) return false;
  if (value.playtimeMinutes !== undefined &&
      (!isFiniteNumber(value.playtimeMinutes) || value.playtimeMinutes < 0)) {
    return false;
  }
  if (!Array.isArray(value.party) || value.party.length === 0) return false;
  for (const creature of value.party) {
    if (!isValidCreature(creature)) return false;
  }
  if (value.position !== undefined && !isValidPosition(value.position)) return false;
  if (value.boxes !== undefined && !isValidBoxes(value.boxes)) return false;
  if (value.bag !== undefined && !isValidBag(value.bag)) return false;
  if (value.dex !== undefined && !isValidDex(value.dex)) return false;
  return true;
}

function parseSaveData(raw: string | null | undefined): GameStateData | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isValidSaveData(parsed)) return null;
  return migrate(parsed);
}

/* ------------------------------------------------------------- settings -- */

const TEXT_SPEEDS: GameSettings['textSpeed'][] = ['slow', 'normal', 'fast', 'instant'];

function clampVolume(value: unknown, fallback: number): number {
  if (!isFiniteNumber(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

/** Keep only known, well-typed fields; never merge arbitrary stored keys. */
function sanitizeSettings(raw: unknown): GameSettings {
  if (!isPlainObject(raw)) return { ...DEFAULT_SETTINGS };
  return {
    musicVolume: clampVolume(raw.musicVolume, DEFAULT_SETTINGS.musicVolume),
    sfxVolume: clampVolume(raw.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
    muted: typeof raw.muted === 'boolean' ? raw.muted : DEFAULT_SETTINGS.muted,
    textSpeed:
      typeof raw.textSpeed === 'string' &&
      TEXT_SPEEDS.includes(raw.textSpeed as GameSettings['textSpeed'])
        ? (raw.textSpeed as GameSettings['textSpeed'])
        : DEFAULT_SETTINGS.textSpeed,
    battleAnimations:
      typeof raw.battleAnimations === 'boolean'
        ? raw.battleAnimations
        : DEFAULT_SETTINGS.battleAnimations,
    reducedEffects:
      typeof raw.reducedEffects === 'boolean' ? raw.reducedEffects : DEFAULT_SETTINGS.reducedEffects,
    damageNumbers:
      typeof raw.damageNumbers === 'boolean' ? raw.damageNumbers : DEFAULT_SETTINGS.damageNumbers,
    colorblindTypeIcons:
      typeof raw.colorblindTypeIcons === 'boolean'
        ? raw.colorblindTypeIcons
        : DEFAULT_SETTINGS.colorblindTypeIcons,
    showTouchControls:
      typeof raw.showTouchControls === 'boolean'
        ? raw.showTouchControls
        : DEFAULT_SETTINGS.showTouchControls,
  };
}

export function loadSettings(): GameSettings {
  const store = storage();
  if (!store) return { ...DEFAULT_SETTINGS };
  try {
    const raw = store.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* storage full or blocked: settings are non-critical */
  }
}

/* --------------------------------------------------------------- saving -- */

function writeSlot(key: string, state: GameState): boolean {
  const store = storage();
  if (!store) return false;
  try {
    const payload = state.toJSON();
    payload.updatedAt = Date.now();
    store.setItem(key, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function saveToSlot(slot: number, state: GameState): boolean {
  if (slot < 1 || slot > SLOT_COUNT) return false;
  return writeSlot(slotKey(slot), state);
}

export function autosave(state: GameState): boolean {
  return writeSlot(AUTOSAVE_KEY, state);
}

export function hasAutosave(): boolean {
  try {
    const store = storage();
    if (!store) return false;
    return parseSaveData(store.getItem(AUTOSAVE_KEY)) !== null;
  } catch {
    return false;
  }
}

export function loadAutosave(): GameState | null {
  return readSlot(AUTOSAVE_KEY);
}

/* -------------------------------------------------------------- loading -- */

function readSlot(key: string): GameState | null {
  const store = storage();
  if (!store) return null;
  let raw: string | null = null;
  try {
    raw = store.getItem(key);
  } catch {
    return null;
  }
  const data = parseSaveData(raw);
  if (!data) return null;
  try {
    return GameState.fromJSON(data);
  } catch {
    return null;
  }
}

export function loadFromSlot(slot: number): GameState | null {
  if (slot < 1 || slot > SLOT_COUNT) return null;
  return readSlot(slotKey(slot));
}

export function deleteSlot(slot: number): void {
  try {
    storage()?.removeItem(slotKey(slot));
  } catch {
    /* storage failures are non-critical */
  }
}

export function listSlots(): SaveSlotMeta[] {
  const store = storage();
  const out: SaveSlotMeta[] = [];
  for (let slot = 1; slot <= SLOT_COUNT; slot++) {
    let raw: string | null = null;
    try {
      raw = store ? store.getItem(slotKey(slot)) : null;
    } catch {
      raw = null;
    }
    out.push(describeSlot(slot, raw));
  }
  return out;
}

function describeSlot(slot: number, raw: string | null | undefined): SaveSlotMeta {
  const data = parseSaveData(raw);
  if (!data) {
    return {
      slot,
      exists: false,
      playerName: '',
      playtimeMinutes: 0,
      caught: 0,
      sigils: 0,
      updatedAt: 0,
      starter: null,
    };
  }
  const caught = Object.values(data.dex ?? {}).filter(
    (entry) => isPlainObject(entry) && entry.caught === true,
  ).length;
  return {
    slot,
    exists: true,
    playerName: data.playerName ?? 'Trainer',
    playtimeMinutes: data.playtimeMinutes ?? 0,
    caught,
    sigils: (data.sigils ?? []).length,
    updatedAt: data.updatedAt ?? 0,
    starter: data.starterChosen ?? null,
  };
}

/* ------------------------------------------------------------ migration -- */

/**
 * Bring an older save up to the current schema. Each step is idempotent so a
 * partially migrated file is still safe to read.
 */
function migrate(data: GameStateData): GameStateData {
  const out: GameStateData = { ...data };
  let version = out.version ?? 0;

  if (version < 1) {
    out.clock = out.clock ?? { minutes: 8 * 60, total: 8 * 60 };
    out.sigils = out.sigils ?? [];
    out.steps = out.steps ?? 0;
    out.hallOfFame = out.hallOfFame ?? false;
    version = 1;
  }

  out.version = SAVE_VERSION;
  return out;
}

/** A short human-readable summary of every slot, for the load menu. */
export function slotSummaries(): Array<{ slot: number; label: string }> {
  return listSlots().map((meta) => ({
    slot: meta.slot,
    label: meta.exists
      ? `${meta.playerName} \u00b7 ${meta.caught}/40 \u00b7 ${meta.sigils} sigils`
      : 'Empty',
  }));
}

export { SLOT_COUNT };

/** Export the current save as a downloadable JSON string (backup/manual). */
export function exportSave(state: GameState): string {
  return JSON.stringify(state.toJSON(), null, 2);
}

/** Import from a previously exported string. Returns null when malformed. */
export function importSave(json: string): GameState | null {
  const data = parseSaveData(json);
  if (!data) return null;
  try {
    return GameState.fromJSON(data);
  } catch {
    return null;
  }
}
