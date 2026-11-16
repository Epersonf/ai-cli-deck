import type { RetryHint } from '@deck/shared';
import { providerRetry } from '../../../domain/providerRetry.js';
import type { SdkMessage } from './claudeMap.js';

export interface ClaudeFailure {
  text: string;
  hint: RetryHint | null;
}

/** A rejected request may be a synthetic assistant message followed by a successful-looking result. */
export class ClaudeRetry {
  private assistant: ClaudeFailure | null = null;
  private rejected: ClaudeFailure | null = null;

  observe(msg: SdkMessage): void {
    if (msg.parent_tool_use_id) return;
    if (msg.type === 'rate_limit_event' && msg.rate_limit_info?.status === 'rejected') {
      const info = msg.rate_limit_info;
      const code = info.errorCode ?? 'usage_limit_reached';
      this.rejected = { text: code, hint: providerRetry({ code, resetsAt: info.resetsAt }) };
    }
    if (msg.type !== 'assistant') return;
    if (msg.error) {
      const blocks: unknown[] = Array.isArray(msg.message?.content) ? msg.message.content : [];
      const text =
        blocks
          .flatMap((b) => {
            const block = b as { type?: string; text?: string };
            return block.type === 'text' && typeof block.text === 'string' ? [block.text] : [];
          })
          .join('\n') || msg.error;
      let hint = providerRetry({ code: msg.error, message: text });
      if (this.rejected && !this.rejected.hint) hint = null;
      else if (hint && this.rejected?.hint)
        hint = { ...this.rejected.hint, retryAt: hint.retryAt ?? this.rejected.hint.retryAt };
      this.assistant = { text, hint };
    } else if (msg.message?.model && !msg.message.model.startsWith('<')) {
      this.assistant = null;
      this.rejected = null;
    }
  }

  rejection(): ClaudeFailure | null {
    return this.rejected?.hint ? this.rejected : null;
  }

  result(msg: SdkMessage): ClaudeFailure | null {
    const failed =
      msg.is_error === true || (msg.subtype !== undefined && msg.subtype !== 'success');
    const result = this.assistant ?? (failed ? this.rejected : null);
    this.assistant = this.rejected = null;
    return result;
  }
}
