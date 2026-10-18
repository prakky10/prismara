/**
 * Dialogue formatting shared by every story, NPC and trainer line.
 *
 * Authored text uses `{player}` and `{rival}` placeholders and an optional
 * "Speaker: line" prefix. Placeholders are replaced at display time from the
 * game state, so renaming the companion (default "Kai") or the player never
 * leaves a hardcoded name behind. This module is pure (no Phaser).
 */

export interface NameSource {
  playerName: string;
  rivalName: string;
}

export interface DialogueLine {
  /** Name tag shown above the box; narration has none. */
  speaker?: string;
  text: string;
}

/**
 * Names that may open a line as "Name: text" (optionally "Name (note): text").
 * A whitelist keeps narration such as "Page 3: ..." or "Carved here: ..." from
 * being mistaken for a speaker.
 */
export const KNOWN_SPEAKERS: ReadonlySet<string> = new Set([
  'Aunt Wren',
  'Prof. Lumen',
  '{rival}',
  'Soren',
  'Ivy',
  'Volta',
  'Marin',
  'Blaze',
  'Opal',
  'Raven',
  'Voss',
  'Aurelia',
  'Edda',
  'Nerys',
  'Pilgrim',
  'Gran',
  'Eclipse Grunt',
  'Voltspire Tech',
  'Eclipse radio',
  'Aide',
]);

const SPEAKER_RE = /^([^:()]+?)(?: \(([^)]+)\))?: (.+)$/;

/** Replace `{player}` and `{rival}` with the current names. */
export function formatLine(text: string, names: NameSource): string {
  const player = names.playerName.trim() || 'Rowan';
  const rival = names.rivalName.trim() || 'Kai';
  return text.replace(/\{player\}/g, () => player).replace(/\{rival\}/g, () => rival);
}

/** Split an authored template into speaker and text, without substituting names. */
export function parseLine(raw: string): { speaker?: string; text: string } {
  const match = SPEAKER_RE.exec(raw);
  if (match && KNOWN_SPEAKERS.has(match[1])) {
    const speaker = match[2] ? `${match[1]} (${match[2]})` : match[1];
    return { speaker, text: match[3] };
  }
  return { text: raw };
}

/**
 * Turn authored templates into display lines with names substituted, speaker
 * included. Lines without a speaker prefix use `defaultSpeaker` when given.
 */
export function toDialogue(
  raw: readonly string[],
  names: NameSource,
  defaultSpeaker?: string,
): DialogueLine[] {
  return raw.map((entry) => {
    const parsed = parseLine(entry);
    const speaker = parsed.speaker ?? defaultSpeaker;
    return {
      speaker: speaker ? formatLine(speaker, names) : undefined,
      text: formatLine(parsed.text, names),
    };
  });
}

/** Group consecutive lines by speaker so each group is one text-box call. */
export function groupBySpeaker(lines: readonly DialogueLine[]): Array<{ speaker?: string; pages: string[] }> {
  const groups: Array<{ speaker?: string; pages: string[] }> = [];
  for (const line of lines) {
    const last = groups[groups.length - 1];
    if (last && last.speaker === line.speaker) last.pages.push(line.text);
    else groups.push({ speaker: line.speaker, pages: [line.text] });
  }
  return groups;
}
