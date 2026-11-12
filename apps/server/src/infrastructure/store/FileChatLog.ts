import { appendFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ChatEventSchema, type ChatEvent } from '@deck/shared';
import type { ChatLogPort } from '../../domain/ports.js';

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;

/** Each session's conversation as JSON lines: appended as it happens, tolerant of a half-written last line. */
export class FileChatLog implements ChatLogPort {
  constructor(private readonly dir: string) {}

  private path(id: string): string {
    if (!SAFE_ID.test(id)) throw new Error('Unsafe session id');
    return join(this.dir, `${id}.jsonl`);
  }

  async load(id: string): Promise<ChatEvent[]> {
    const text = await readFile(this.path(id), 'utf8').catch(() => '');
    const events: ChatEvent[] = [];
    for (const line of text.split('\n')) {
      if (line.trim() === '') continue;
      try {
        const parsed = ChatEventSchema.safeParse(JSON.parse(line));
        if (parsed.success) events.push(parsed.data);
      } catch {
        // a line cut by a crash: skip it
      }
    }
    return events;
  }

  async append(id: string, events: readonly ChatEvent[]): Promise<void> {
    if (events.length === 0) return;
    await mkdir(this.dir, { recursive: true });
    await appendFile(this.path(id), events.map((e) => `${JSON.stringify(e)}\n`).join(''));
  }

  async replace(id: string, events: readonly ChatEvent[]): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.path(id), events.map((e) => `${JSON.stringify(e)}\n`).join(''));
  }

  remove(id: string): Promise<void> {
    return rm(this.path(id), { force: true });
  }
}
