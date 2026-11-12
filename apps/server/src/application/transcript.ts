import type { ChatTurn } from '../domain/chat.js';

/** Characters handed to the next AI at most: enough for a long chat, small enough to read in one go. */
const MAX_TOTAL = 120_000;
const MAX_REQUEST = 8_000;
const MAX_ANSWER = 6_000;

export interface TranscriptOrigin {
  /** The CLI or profile the conversation happened in. */
  from: string;
  cwd: string;
  date: Date;
}

const clip = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max)}\n… (cut, ${text.length - max} more characters)` : text;

const header = (origin: TranscriptOrigin): string =>
  [
    '# Conversation so far',
    '',
    `With ${origin.from}, in ${origin.cwd}, saved ${origin.date.toISOString().slice(0, 16).replace('T', ' ')} UTC.`,
    '"User" is what the user asked, "Assistant" what the AI answered; lines starting with → are actions it took.',
  ].join('\n');

/** Sections: one per request, one per answer (with its actions). */
function sections(turns: readonly ChatTurn[]): string[] {
  const out: string[] = [];
  let answer: string[] | null = null;
  const close = (): void => {
    if (answer && answer.length > 0) out.push(`## Assistant\n\n${answer.join('\n')}`);
    answer = null;
  };
  for (const turn of turns) {
    if (turn.role === 'user') {
      close();
      out.push(`## User\n\n${clip(turn.text.trim(), MAX_REQUEST)}`);
      continue;
    }
    answer ??= [];
    answer.push(
      turn.role === 'tool' ? `→ ${turn.text}` : `${clip(turn.text.trim(), MAX_ANSWER)}\n`,
    );
  }
  close();
  return out;
}

/**
 * The conversation as Markdown another AI can read: every request and answer, each tool call on one line,
 * tool output left out. A very long chat keeps its latest part and says how much was left out.
 */
export function transcript(turns: readonly ChatTurn[], origin: TranscriptOrigin): string {
  const parts = sections(turns);
  let size = parts.reduce((sum, part) => sum + part.length + 2, 0);
  let dropped = 0;
  while (size > MAX_TOTAL && parts.length > 1) {
    size -= (parts.shift()?.length ?? 0) + 2;
    dropped += 1;
  }
  const note = dropped > 0 ? [`_(${dropped} earlier messages left out to keep this short.)_`] : [];
  return [header(origin), ...note, ...parts].join('\n\n') + '\n';
}
