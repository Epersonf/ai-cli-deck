import type { ChatUsage } from '@deck/shared';
import type { UsageReading } from '../domain/agent.js';
import type { LimitBook } from './LimitBook.js';

/** What one chat has used: its own cost and context, and the account's limit it shares with others. */
export class UsageMeter {
  private before = 0;
  private run: number | null = null;
  private context: number | null = null;
  private window: number | null = null;

  constructor(
    private readonly limits: LimitBook,
    /** The account: sessions of one profile share its limit. */
    private readonly account: string,
  ) {}

  /** Takes in what the agent reported; true when the chat's own figures changed. */
  reading(reading: UsageReading): boolean {
    const before = JSON.stringify([this.run, this.context, this.window]);
    if (reading.costUsd !== undefined) this.run = reading.costUsd;
    if (reading.contextTokens !== undefined) this.context = reading.contextTokens;
    if (reading.contextWindow !== undefined) this.window = reading.contextWindow;
    if (reading.limit) this.limits.set(this.account, reading.limit);
    return before !== JSON.stringify([this.run, this.context, this.window]);
  }

  /** The agent run ended: the next one counts its cost from zero again. */
  runEnded(): void {
    this.before += this.run ?? 0;
    this.run = null;
  }

  /** A new conversation: nothing used yet. */
  reset(): void {
    this.before = 0;
    this.run = null;
    this.context = null;
  }

  current(): ChatUsage {
    const limit = this.limits.get(this.account);
    const cost = this.before + (this.run ?? 0);
    return {
      costUsd: cost > 0 ? cost : null,
      contextTokens: this.context,
      contextWindow: this.window,
      limitUsed: limit?.used ?? null,
      limitResetsAt: limit?.resetsAt ?? null,
      limitLabel: limit?.label ?? null,
    };
  }
}
