import type { ChatEvent } from '@deck/shared';
import type { Block, PartialText } from './blockTypes';

export type { Attachment, Block, PartialText } from './blockTypes';

const indexOf = (blocks: readonly Block[], kind: Block['kind'], id: string): number => {
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = blocks[i];
    if (block?.kind === kind && block.id === id) return i;
  }
  return -1;
};

const replaceAt = (blocks: readonly Block[], at: number, block: Block): Block[] => {
  const next = blocks.slice();
  next[at] = block;
  return next;
};

/** Rows without an event id of their own get one from their place in the list. */
const rowId = (blocks: readonly Block[], prefix: string): string => `${prefix}-${blocks.length}`;

/** The conversation after one more event; the list is copied, the rows that did not change are shared. */
export function applyEvent(blocks: readonly Block[], event: ChatEvent): Block[] {
  switch (event.t) {
    case 'user':
      return [
        ...blocks,
        { kind: 'user', id: event.id, text: event.text, attachments: event.attachments },
      ];
    case 'text':
    case 'thinking': {
      const at = indexOf(blocks, event.t, event.id);
      const block: Block = { kind: event.t, id: event.id, text: event.text, streaming: false };
      return at < 0 ? [...blocks, block] : replaceAt(blocks, at, block);
    }
    case 'tool': {
      const at = indexOf(blocks, 'tool', event.id);
      const old = at < 0 ? null : blocks[at];
      const result = old?.kind === 'tool' ? old.result : null;
      const block: Block = {
        kind: 'tool',
        id: event.id,
        name: event.name,
        input: event.input,
        result,
      };
      return at < 0 ? [...blocks, block] : replaceAt(blocks, at, block);
    }
    case 'tool-result': {
      const at = indexOf(blocks, 'tool', event.id);
      const old = at < 0 ? null : blocks[at];
      if (old?.kind !== 'tool') return [...blocks];
      return replaceAt(blocks, at, {
        ...old,
        result: { output: event.output, isError: event.isError },
      });
    }
    case 'permission':
      return [
        ...blocks,
        {
          kind: 'permission',
          id: event.id,
          tool: event.tool,
          input: event.input,
          canAlways: event.canAlways,
          reason: event.reason,
          state: 'pending',
        },
      ];
    case 'permission-done': {
      const at = indexOf(blocks, 'permission', event.id);
      const old = at < 0 ? null : blocks[at];
      if (old?.kind !== 'permission') return [...blocks];
      return replaceAt(blocks, at, { ...old, state: event.allowed ? 'allowed' : 'denied' });
    }
    case 'turn-start':
    case 'task': // tasks live in their own list (see tasks.ts)
      return [...blocks];
    case 'turn-end': {
      // The agent often says the failure itself, then the turn repeats it: show it once.
      const last = blocks[blocks.length - 1];
      const said = last?.kind === 'text' && last.text.trim() === event.error?.trim();
      return [
        ...blocks,
        {
          kind: 'turn',
          id: rowId(blocks, 'turn'),
          error: said ? null : event.error,
          costUsd: event.costUsd,
          durationMs: event.durationMs,
        },
      ];
    }
    case 'notice':
      return [
        ...blocks,
        { kind: 'notice', id: rowId(blocks, 'notice'), level: event.level, text: event.text },
      ];
  }
}

/** More text for an answer being written (it becomes final when its `text`/`thinking` event arrives). */
export function applyDelta(blocks: readonly Block[], delta: PartialText): Block[] {
  const at = indexOf(blocks, delta.kind, delta.id);
  const old = at < 0 ? null : blocks[at];
  if (old && (old.kind === 'text' || old.kind === 'thinking')) {
    return replaceAt(blocks, at, { ...old, text: old.text + delta.text });
  }
  return [...blocks, { kind: delta.kind, id: delta.id, text: delta.text, streaming: true }];
}

/** The whole conversation from a replay: its events, then the text still being written. */
export function fromReplay(
  events: readonly ChatEvent[],
  partials: readonly PartialText[],
): Block[] {
  let blocks: Block[] = [];
  for (const event of events) blocks = applyEvent(blocks, event);
  for (const partial of partials) {
    blocks = [
      ...blocks,
      { kind: partial.kind, id: partial.id, text: partial.text, streaming: true },
    ];
  }
  return blocks;
}
