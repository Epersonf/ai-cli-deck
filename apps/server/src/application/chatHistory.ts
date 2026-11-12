import type { ChatEvent } from '@deck/shared';
import type { ChatTurn } from '../domain/chat.js';

/** A saved conversation, as steps the chat can show (the agent's own file has more than we render). */
export function turnsToEvents(turns: readonly ChatTurn[], at: string): ChatEvent[] {
  const out: ChatEvent[] = [];
  turns.forEach((turn, i) => {
    const id = `saved-${i}`;
    if (turn.role === 'user') out.push({ t: 'user', id, text: turn.text, attachments: [], at });
    else if (turn.role === 'assistant') out.push({ t: 'text', id, text: turn.text });
    else out.push({ t: 'tool', id, name: turn.text, input: null });
  });
  return out;
}

/** The conversation without the details of tools, for a transcript handed to another AI. */
export function eventsToTurns(events: readonly ChatEvent[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const event of events) {
    if (event.t === 'user') turns.push({ role: 'user', text: event.text });
    else if (event.t === 'text') turns.push({ role: 'assistant', text: event.text });
    else if (event.t === 'tool') {
      const input = event.input as { command?: unknown; file_path?: unknown } | null;
      const detail = [input?.command, input?.file_path].find((v) => typeof v === 'string') as
        string | undefined;
      turns.push({
        role: 'tool',
        text: detail ? `${event.name}: ${detail.slice(0, 120)}` : event.name,
      });
    }
  }
  return turns;
}
