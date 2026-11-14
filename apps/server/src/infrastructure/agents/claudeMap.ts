import { ClaudeRetry } from './claudeRetry.js';
import type { AgentSink } from '../../domain/agent.js';
import { assistantEvents, resultEvents } from './claudeBlocks.js';
import { assistantAuthLine, turnEnd } from './claudeEnd.js';
import { mapTask, type TaskMessage, type Tasks } from './claudeTasks.js';
import { usageOf, type UsageMessage } from './claudeUsage.js';

/** The few fields of an SDK message the deck reads; everything else is ignored on purpose. */
export interface SdkMessage extends TaskMessage, UsageMessage {
  type?: string;
  subtype?: string;
  session_id?: string;
  /** On `system` `init`: the model this run uses. */
  model?: string;
  parent_tool_use_id?: string | null;
  is_error?: boolean;
  /** Set on an assistant message the SDK produced for a failed request. */
  error?: string;
  result?: string;
  errors?: string[];
  total_cost_usd?: number;
  duration_ms?: number;
  event?: {
    type?: string;
    message?: { id?: string };
    index?: number;
    delta?: { type?: string; text?: string; thinking?: string };
  };
  message?: UsageMessage['message'] & { id?: string; model?: string; content?: unknown };
}

export type { Block } from './claudeBlocks.js';

/** Where we are in the stream: the id of the message being written (it names its text blocks). */
export interface MapState {
  messageId: string;
  chatId: string | null;
  /** The CLI's own "Not logged in" line, seen as an answer: the turn then ends as a sign-in failure. */
  authText: string | null;
  retry: ClaudeRetry;
  /** The background jobs of this run. */
  tasks: Tasks;
  /** Blocks already finalized per API message id: the SDK sends one message per block, so each starts at its stream index. */
  seen: Map<string, number>;
}

export const newMapState = (): MapState => ({
  messageId: '',
  chatId: null,
  authText: null,
  retry: new ClaudeRetry(),
  tasks: new Map(),
  seen: new Map(),
});

/** Turns one Claude Agent SDK message into steps of the chat, deltas and the conversation id. */
export function mapClaudeMessage(msg: SdkMessage, state: MapState, sink: AgentSink): void {
  state.retry.observe(msg);
  if (msg.session_id && msg.session_id !== state.chatId) {
    state.chatId = msg.session_id;
    sink.chatId(msg.session_id);
  }
  if (msg.type === 'system' || msg.type === 'rate_limit_event') {
    if (msg.subtype === 'init' && msg.model) sink.model(msg.model);
    mapTask(msg, state.tasks, sink);
    const reading = usageOf(msg);
    if (reading) sink.usage(reading);
    const rejected = msg.type === 'rate_limit_event' ? state.retry.rejection() : null;
    if (rejected?.hint)
      sink.event({
        t: 'turn-end',
        error: 'Usage limit reached',
        retry: rejected.hint,
        costUsd: null,
        durationMs: null,
      });
    return;
  }
  if (msg.parent_tool_use_id) return; // what a sub-agent does inside a tool is not shown line by line
  if (msg.type === 'stream_event' && msg.event) {
    const { event } = msg;
    if (event.type === 'message_start') state.messageId = event.message?.id ?? '';
    const delta = event.delta;
    if (event.type !== 'content_block_delta' || !delta) return;
    const id = `${state.messageId}:${event.index ?? 0}`;
    if (delta.type === 'text_delta' && delta.text) sink.delta(id, 'text', delta.text);
    if (delta.type === 'thinking_delta' && delta.thinking)
      sink.delta(id, 'thinking', delta.thinking);
  } else if (msg.type === 'assistant') {
    const model = msg.message?.model;
    if (model && !model.startsWith('<')) sink.model(model); // `<synthetic>` is the SDK's own notice
    const reading = usageOf(msg);
    if (reading) sink.usage(reading);
    const auth = assistantAuthLine(msg);
    if (auth !== null) state.authText = auth; // shown as the turn's error, not also as an answer
    const mid = msg.message?.id ?? '';
    const offset = state.seen.get(mid) ?? 0;
    const count = Array.isArray(msg.message?.content) ? msg.message.content.length : 0;
    state.seen.set(mid, offset + count);
    for (const event of assistantEvents(msg, offset))
      if ((auth === null && !msg.error) || event.t !== 'text') sink.event(event);
  } else if (msg.type === 'user') {
    for (const event of resultEvents(msg)) sink.event(event);
  } else if (msg.type === 'result') {
    const reading = usageOf(msg);
    if (reading) sink.usage(reading);
    sink.event(turnEnd(msg, state.authText, state.retry.result(msg)));
    state.authText = null;
  }
}
