import { HANDOVER_START } from '../../domain/chat.js';
import { obj, str } from './jsonLines.js';

const TITLE_LENGTH = 80;

/**
 * A chat's title from its requests: the first one the user typed; a chat handed over from another AI
 * shows where it came from until the user asks something.
 */
export function chatTitle(requests: readonly string[]): string | null {
  const typed = requests.find((text) => !text.startsWith(HANDOVER_START));
  if (typed !== undefined) return titleOf(typed);
  const handed = requests[0];
  if (handed === undefined) return null;
  return titleOf(`↪ ${handed.slice(HANDOVER_START.length).split(' in this folder')[0] ?? ''}`);
}

/** One line, shortened. */
export function titleOf(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > TITLE_LENGTH ? `${line.slice(0, TITLE_LENGTH - 1)}…` : line;
}

/**
 * Text the CLI adds to the user's turn that the user never typed: environment blocks, command echoes,
 * reminders, instruction files. Not part of the conversation.
 */
export const isInjected = (text: string): boolean => {
  const start = text.trimStart();
  return start.startsWith('<') || start.startsWith('# AGENTS.md') || start.startsWith('Caveat:');
};

/** A tool call in one line: the command, the file, or the start of its input. */
export function toolLine(name: string, input: unknown): string {
  const fields = obj(input);
  const command = Array.isArray(fields?.command) ? fields.command.join(' ') : null;
  const pick =
    command ??
    str(fields?.command) ??
    str(fields?.cmd) ??
    str(fields?.file_path) ??
    str(fields?.path) ??
    str(fields?.pattern) ??
    str(fields?.url) ??
    str(fields?.description);
  const detail = pick ?? (input === undefined ? '' : JSON.stringify(input));
  const short = detail.replace(/\s+/g, ' ').trim();
  return `${name}${short ? `: ${short.length > 160 ? `${short.slice(0, 159)}…` : short}` : ''}`;
}

/** The text blocks of a message content (a string, or a list of typed blocks). */
export function textBlocks(content: unknown, types: readonly string[]): string[] {
  if (typeof content === 'string') return [content];
  if (!Array.isArray(content)) return [];
  return content
    .map(obj)
    .filter((block) => block !== null && types.includes(str(block.type) ?? ''))
    .map((block) => str(block?.text) ?? '')
    .filter((text) => text.trim() !== '');
}
