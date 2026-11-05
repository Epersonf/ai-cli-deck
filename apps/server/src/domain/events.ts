import type { ApprovalRequest, Session } from '@deck/shared';

export type DeckEvent =
  | { kind: 'output'; sessionId: string; data: Uint8Array }
  | { kind: 'session'; session: Session }
  | { kind: 'exit'; sessionId: string; code: number | null }
  | { kind: 'approval'; request: ApprovalRequest }
  | { kind: 'preview'; sessionId: string; url: string }
  | { kind: 'new-tab'; sessionId: string; url: string }
  | { kind: 'agent-browser'; sessionId: string }
  | { kind: 'input'; sessionId: string }
  | { kind: 'size'; sessionId: string; cols: number; rows: number };

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
