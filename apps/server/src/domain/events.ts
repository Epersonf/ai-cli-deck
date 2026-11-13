import type { ApprovalRequest, ChatConfig, ChatEvent, ChatUsage, Session } from '@deck/shared';

export type DeckEvent =
  | { kind: 'session'; session: Session }
  | { kind: 'chat'; sessionId: string; event: ChatEvent }
  | { kind: 'delta'; sessionId: string; id: string; part: 'text' | 'thinking'; text: string }
  | { kind: 'busy'; sessionId: string; busy: boolean }
  /** The messages waiting for the answer to end changed. */
  | { kind: 'queue'; sessionId: string; items: { id: string; text: string; images: number }[] }
  | { kind: 'usage'; sessionId: string; usage: ChatUsage }
  /** The conversation was cut back (an edited message) or emptied: show exactly these steps. */
  | { kind: 'reset'; sessionId: string; events: ChatEvent[] }
  | { kind: 'config'; sessionId: string; config: ChatConfig }
  /** An answer ended on its own (not stopped by the person): `error` is why it failed, if it did. */
  | { kind: 'turn-done'; sessionId: string; error: string | null; answer: string }
  /** Something worth telling the person about, on every connected device. */
  | {
      kind: 'notify';
      sessionId: string;
      title: string;
      text: string;
      reason: 'done' | 'error' | 'permission';
    }
  /** The memory of a scope changed. */
  | { kind: 'memory'; scope: 'global' | 'profile'; profileId: string | null }
  | { kind: 'removed'; sessionId: string }
  | { kind: 'approval'; request: ApprovalRequest }
  | { kind: 'preview'; sessionId: string; url: string }
  | { kind: 'new-tab'; sessionId: string; url: string }
  | { kind: 'agent-browser'; sessionId: string };

export type EventListener = (event: DeckEvent) => void;

export class EventBus {
  private readonly listeners = new Set<EventListener>();

  publish(event: DeckEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
