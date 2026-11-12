import { randomUUID } from 'node:crypto';
import type { AgentSink, PermissionAnswer } from '../../domain/agent.js';

interface Waiting {
  input: Record<string, unknown>;
  suggestions: unknown[] | undefined;
  resolve(result: Record<string, unknown>): void;
}

interface AskOptions {
  signal: AbortSignal;
  suggestions?: unknown[];
  decisionReason?: string;
}

/** The questions the SDK asks before using a tool: each becomes a `permission` step the person answers. */
export class ClaudePermissions {
  private readonly waiting = new Map<string, Waiting>();

  constructor(private readonly sink: AgentSink) {}

  /** The `canUseTool` callback. */
  readonly ask = (
    tool: string,
    input: Record<string, unknown>,
    options: AskOptions,
  ): Promise<Record<string, unknown>> =>
    new Promise((resolve) => {
      const id = randomUUID();
      this.waiting.set(id, { input, suggestions: options.suggestions, resolve });
      options.signal.addEventListener('abort', () => {
        if (this.waiting.delete(id)) {
          resolve({ behavior: 'deny', message: 'Cancelled' });
          this.sink.event({ t: 'permission-done', id, allowed: false });
        }
      });
      this.sink.event({
        t: 'permission',
        id,
        tool,
        input,
        canAlways: (options.suggestions?.length ?? 0) > 0,
        reason: options.decisionReason ?? null,
      });
    });

  answer(id: string, answer: PermissionAnswer): void {
    const item = this.waiting.get(id);
    if (!item) return;
    this.waiting.delete(id);
    item.resolve(
      answer.allow
        ? {
            behavior: 'allow',
            updatedInput: answer.answers ? { ...item.input, answers: answer.answers } : item.input,
            ...(answer.always && item.suggestions ? { updatedPermissions: item.suggestions } : {}),
          }
        : { behavior: 'deny', message: answer.message || 'The user denied this action.' },
    );
    this.sink.event({ t: 'permission-done', id, allowed: answer.allow });
  }

  /** Denies everything still waiting (the run is ending). */
  denyAll(): void {
    for (const id of [...this.waiting.keys()]) this.answer(id, { allow: false, message: 'Ended' });
  }
}
