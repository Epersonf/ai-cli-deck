import type { ChatEvent } from '@deck/shared';
import { obj, str, type Json } from './codexJson.js';

/**
 * Codex's own checklist, shown the way every agent's is: a `TodoWrite` step whose input is `{ todos: [{ content, status }] }`.
 * It is updated in place (same id) as items are ticked.
 */
export function todoEvents(type: string, item: Json, id: string): ChatEvent[] {
  const items = Array.isArray(item['items']) ? item['items'] : [];
  const todos = items.map((entry) => ({
    content: str(obj(entry)?.['text']),
    status: obj(entry)?.['completed'] === true ? 'completed' : 'pending',
  }));
  const out: ChatEvent[] = [{ t: 'tool', id, name: 'TodoWrite', input: { todos } }];
  if (type === 'item.completed') out.push({ t: 'tool-result', id, output: '', isError: false });
  return out;
}
