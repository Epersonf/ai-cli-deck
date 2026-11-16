import { codexWebEvents } from './codexWeb.js';
import { codexTurnUsage } from './codexTurnUsage.js';
import { providerRetry } from '../../../domain/providerRetry.js';
import type { ChatEvent } from '@deck/shared';
import { friendlyError, RETRY_NOISE, type CodexState } from './codexState.js';
export { friendlyError, newCodexState } from './codexState.js';
export type { CodexState } from './codexState.js';
import type { AgentSink } from '../../../domain/agent.js';

import { obj, str, type Json } from './codexJson.js';
import { todoEvents } from './codexTodos.js';

// Display/log bound only. Prompt output budgets belong to Codex; MCP tools paginate before returning.
const MAX_OUTPUT = 20_000;
const clip = (text: string): string =>
  text.length > MAX_OUTPUT ? `${text.slice(0, MAX_OUTPUT)}\n… (cut)` : text;

const TOOL_TYPES = new Set(['command_execution', 'file_change', 'mcp_tool_call', 'web_search']);

/** The tool name and input the chat shows for an item. */
function toolOf(item: Json): { name: string; input: unknown } {
  switch (item['type']) {
    case 'command_execution':
      return { name: 'shell', input: { command: str(item['command']) } };
    case 'file_change':
      return { name: 'apply_patch', input: { changes: item['changes'] ?? [] } };
    case 'mcp_tool_call':
      return {
        name: `${str(item['server'])}.${str(item['tool'])}`,
        input: item['arguments'] ?? {},
      };
    default:
      return { name: str(item['type']), input: {} };
  }
}

/** The result text and failure flag of a finished tool item. */
function resultOf(item: Json): { output: string; isError: boolean } {
  switch (item['type']) {
    case 'command_execution': {
      const code = item['exit_code'];
      return {
        output: clip(str(item['aggregated_output'])),
        isError: typeof code === 'number' && code !== 0,
      };
    }
    case 'file_change': {
      const changes = Array.isArray(item['changes']) ? item['changes'] : [];
      const lines = changes.map((c) => `${str(obj(c)?.['kind'])} ${str(obj(c)?.['path'])}`.trim());
      return { output: lines.join('\n'), isError: item['status'] === 'failed' };
    }
    case 'mcp_tool_call': {
      const error = obj(item['error']);
      const result = obj(item['result']);
      const text = error
        ? str(error['message'])
        : JSON.stringify(result?.['content'] ?? result ?? '');
      return { output: clip(text), isError: error !== null };
    }
    default:
      return { output: '', isError: false };
  }
}

function itemEvents(type: string, item: Json, state: CodexState): ChatEvent[] {
  const id = state.itemPrefix + (str(item['id']) || `item-${state.started.size}`);
  const kind = str(item['type']);
  if (kind === 'todo_list') return todoEvents(type, item, id);
  if (kind === 'agent_message' && type === 'item.completed' && str(item['text']).trim())
    return [{ t: 'text', id, text: str(item['text']) }];
  if (kind === 'reasoning' && type === 'item.completed' && str(item['text']).trim())
    return [{ t: 'thinking', id, text: str(item['text']) }];
  if (kind === 'error') {
    const text = str(item['message']);
    return RETRY_NOISE.test(text) ? [] : [{ t: 'notice', level: 'error', text }];
  }
  if (kind === 'web_search') return codexWebEvents(type, item, id, state);
  if (!TOOL_TYPES.has(kind)) return [];
  const out: ChatEvent[] = [];
  if (!state.started.has(id)) {
    state.started.add(id);
    out.push({ t: 'tool', id, ...toolOf(item) });
  }
  if (type === 'item.completed') out.push({ t: 'tool-result', id, ...resultOf(item) });
  return out;
}

/** Turns one line of `codex exec --json` into chat steps. Unknown lines are ignored. */
export function mapCodexLine(line: Json, state: CodexState, sink: AgentSink): void {
  const type = str(line['type']);
  if (type === 'thread.started') {
    const id = str(line['thread_id']);
    if (id) sink.chatId(id);
  } else if (type === 'item.started' || type === 'item.completed' || type === 'item.updated') {
    const item = obj(line['item']);
    if (
      type === 'item.completed' &&
      ['context_compaction', 'contextCompaction'].includes(str(item?.['type']))
    )
      sink.usage({ compacted: true });
    if (item) for (const event of itemEvents(type, item, state)) sink.event(event);
  } else if (type === 'turn.completed') {
    state.finished = true;
    const reading = codexTurnUsage(obj(line['usage']), state);
    if (reading) sink.usage(reading);
    sink.event({ t: 'turn-end', error: null, costUsd: null, durationMs: null });
  } else if (type === 'turn.failed' || type === 'error') {
    const message = str(obj(line['error'])?.['message']) || str(line['message']);
    if (message && !RETRY_NOISE.test(message)) {
      state.lastError = message;
      const retry = providerRetry(line['error'] ?? message);
      state.retry = retry
        ? {
            ...retry,
            retryAt:
              retry.retryAt ?? (state.retry?.kind === retry.kind ? state.retry.retryAt : null),
          }
        : null;
    }
    if (type === 'turn.failed') {
      state.finished = true;
      sink.event({
        t: 'turn-end',
        error: friendlyError(state.lastError ?? 'The turn failed'),
        ...(state.retry ? { retry: state.retry } : {}),
        costUsd: null,
        durationMs: null,
      });
    }
  }
}
