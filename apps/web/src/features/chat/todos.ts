import type { Block } from './blocks';

export type TodoState = 'pending' | 'active' | 'done';
export interface Todo {
  text: string;
  state: TodoState;
}

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

function stateOf(item: Record<string, unknown>): TodoState {
  const status = String(item['status'] ?? '').toLowerCase();
  if (item['completed'] === true || status === 'completed' || status === 'done') return 'done';
  if (status === 'in_progress' || status === 'active' || status === 'running') return 'active';
  return 'pending';
}

/**
 * The agent's checklist: the newest tool step that carries `todos` (Claude's TodoWrite, and Codex's checklist,
 * which the server maps to the same shape). Items may name themselves `content`, `text` or `step`.
 */
export function todosOf(blocks: readonly Block[]): Todo[] {
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = blocks[i];
    if (block?.kind !== 'tool') continue;
    const list = record(block.input)?.['todos'];
    if (!Array.isArray(list)) continue;
    return list.flatMap((entry) => {
      const item = record(entry);
      const text = String(item?.['content'] ?? item?.['text'] ?? item?.['step'] ?? '').trim();
      return item && text !== '' ? [{ text, state: stateOf(item) }] : [];
    });
  }
  return [];
}

export const doneCount = (todos: readonly Todo[]): number =>
  todos.filter((todo) => todo.state === 'done').length;
