import type { ChatEvent } from '@deck/shared';
import { AUTH_MARKER } from '../../domain/authError.js';
import type { AgentSink } from '../../domain/agent.js';

type Json = Record<string, unknown>;

const obj = (value: unknown): Json | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : null;
const str = (value: unknown): string => (typeof value === 'string' ? value : '');

const MAX_OUTPUT = 20_000;
const clip = (text: string): string =>
  text.length > MAX_OUTPUT ? `${text.slice(0, MAX_OUTPUT)}\n… (cut)` : text;

/** What the mapper remembers between lines of one `codex exec` run. */
export interface CodexState {
  /** Tool items already announced (so their completion only adds the result). */
  started: Set<string>;
  /** The last error Codex printed; used when the process ends without finishing the turn. */
  lastError: string | null;
  finished: boolean;
}

export const newCodexState = (): CodexState => ({
  started: new Set(),
  lastError: null,
  finished: false,
});

/** Codex retries a failing connection five times and says so on every try: not worth showing. */
const RETRY_NOISE = /^(Reconnecting|Falling back)/;

const NOT_SIGNED_IN = /401|unauthori[sz]ed|bearer|api key|not logged in|log in/i;

/** What Codex said when a turn failed, with a hint when the cause is a missing or wrong key. */
export function friendlyError(message: string): string {
  return NOT_SIGNED_IN.test(message)
    ? `${AUTH_MARKER}Codex could not sign in: sign in again or set a key for this profile. ${message.slice(0, 200)}`
    : message;
}

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
      return { name: 'web_search', input: { query: str(item['query']) } };
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
  const id = str(item['id']) || `item-${state.started.size}`;
  const kind = str(item['type']);
  if (kind === 'agent_message' && type === 'item.completed' && str(item['text']).trim())
    return [{ t: 'text', id, text: str(item['text']) }];
  if (kind === 'reasoning' && type === 'item.completed' && str(item['text']).trim())
    return [{ t: 'thinking', id, text: str(item['text']) }];
  if (kind === 'error') {
    const text = str(item['message']);
    return RETRY_NOISE.test(text) ? [] : [{ t: 'notice', level: 'error', text }];
  }
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
    if (item) for (const event of itemEvents(type, item, state)) sink.event(event);
  } else if (type === 'turn.completed') {
    state.finished = true;
    const used = obj(line['usage']);
    const tokens = Number(used?.['input_tokens'] ?? 0) + Number(used?.['output_tokens'] ?? 0);
    if (tokens > 0) sink.usage({ contextTokens: tokens });
    sink.event({ t: 'turn-end', error: null, costUsd: null, durationMs: null });
  } else if (type === 'turn.failed' || type === 'error') {
    const message = str(obj(line['error'])?.['message']) || str(line['message']);
    if (message && !RETRY_NOISE.test(message)) state.lastError = message;
    if (type === 'turn.failed') {
      state.finished = true;
      sink.event({
        t: 'turn-end',
        error: friendlyError(state.lastError ?? 'The turn failed'),
        costUsd: null,
        durationMs: null,
      });
    }
  }
}
