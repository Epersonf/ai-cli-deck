import type { ChatEvent, ChatPartial } from '@deck/shared';
import type { EventBus } from '../domain/events.js';
import type { ChatLogPort } from '../domain/ports.js';
import { KEEP_EVENTS, closeDangling, lastAnswer, trimLog } from './chatRepair.js';

/** One conversation's steps: kept in memory, appended to the log on disk, and announced on the bus. */
export class ChatBook {
  private events: ChatEvent[] = [];
  private readonly partials = new Map<string, ChatPartial>();
  private loaded: Promise<void> | null = null;

  constructor(
    private readonly id: string,
    private readonly log: ChatLogPort,
    private readonly bus: EventBus,
  ) {}

  /** Reads the log once; what a restart left half done is closed first. */
  ready(): Promise<void> {
    this.loaded ??= this.load();
    return this.loaded;
  }

  private async load(): Promise<void> {
    const { events, trimmed } = trimLog(await this.log.load(this.id));
    const fixes = closeDangling(events);
    this.events = [...events, ...fixes];
    if (trimmed) await this.log.replace(this.id, this.events);
    else await this.log.append(this.id, fixes);
  }

  add(event: ChatEvent): void {
    if (event.t === 'text' || event.t === 'thinking') this.partials.delete(event.id);
    this.events.push(event);
    if (this.events.length > KEEP_EVENTS * 2) this.events = this.events.slice(-KEEP_EVENTS);
    void this.log.append(this.id, [event]).catch(() => undefined);
    this.bus.publish({ kind: 'chat', sessionId: this.id, event });
  }

  delta(id: string, part: 'text' | 'thinking', text: string): void {
    const have = this.partials.get(id);
    this.partials.set(id, { id, kind: part, text: (have?.text ?? '') + text });
    this.bus.publish({ kind: 'delta', sessionId: this.id, id, part, text });
  }

  dropPartials(): void {
    this.partials.clear();
  }

  /** Shows these steps as the whole conversation (a saved chat opened here, or nothing). */
  async replace(events: readonly ChatEvent[]): Promise<void> {
    await this.ready();
    this.events = [...events].slice(-KEEP_EVENTS);
    await this.log.replace(this.id, this.events);
  }

  all(): readonly ChatEvent[] {
    return this.events;
  }

  pending(): ChatPartial[] {
    return [...this.partials.values()];
  }

  lastAnswer(): string {
    return lastAnswer(this.events);
  }
}
