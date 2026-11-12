import type { ChatEvent } from '@deck/shared';
import { AUTH_MARKER, isAuthLine, markAuth } from '../../domain/authError.js';
import type { Block, SdkMessage } from './claudeMap.js';

/** The text of an assistant message that is only the CLI saying it is not signed in, else null. */
export function assistantAuthLine(msg: SdkMessage): string | null {
  const blocks = Array.isArray(msg.message?.content) ? (msg.message.content as Block[]) : [];
  const texts = blocks.flatMap((b) => (b.type === 'text' && b.text?.trim() ? [b.text.trim()] : []));
  if (msg.error === 'authentication_failed') return texts.join(' ') || 'Not logged in';
  return texts.length === 1 && texts[0] !== undefined && isAuthLine(texts[0]) ? texts[0] : null;
}

export function turnEnd(msg: SdkMessage, authText: string | null): ChatEvent {
  const failed = msg.is_error === true || (msg.subtype !== undefined && msg.subtype !== 'success');
  const reason = msg.result || msg.errors?.join('\n') || msg.subtype || 'The agent failed';
  return {
    t: 'turn-end',
    error: authText !== null ? `${AUTH_MARKER}${authText}` : failed ? markAuth(reason) : null,
    costUsd: msg.total_cost_usd ?? null,
    durationMs: msg.duration_ms ?? null,
  };
}
