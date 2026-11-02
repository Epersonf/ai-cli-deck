import type { MultiplexerPort, ScrollbackStorePort } from '../domain/ports.js';
import type { RingBuffer } from './RingBuffer.js';
import { tmuxNameFor } from './SessionLauncher.js';

/** The part of a session runtime whose screen gets saved; `pty` is null once it has ended. */
export interface ScreenSource {
  pty: unknown;
  ring: RingBuffer;
}

const ENDED_NOTE = '\r\n\x1b[2m[session ended — last saved screen shown above]\x1b[0m\r\n';

/** Persists each terminal's screen so it can still be read after the server or phone restarts. */
export class ScreenSaver {
  private readonly dirty = new Set<string>();
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly store: ScrollbackStorePort,
    private readonly mux: MultiplexerPort,
    private readonly sources: ReadonlyMap<string, ScreenSource>,
  ) {}

  /** New output arrived for this session. */
  touch(id: string): void {
    this.dirty.add(id);
  }

  /** Loads the saved screen of a session that died into its replay buffer. */
  async restoreInto(id: string, ring: RingBuffer): Promise<void> {
    const screen = await this.store.load(id);
    if (!screen || screen.byteLength === 0) return;
    ring.push(screen);
    ring.push(Buffer.from(ENDED_NOTE));
  }

  forget(id: string): Promise<void> {
    this.dirty.delete(id);
    return this.store.remove(id);
  }

  /** Saves the screen of every live session that printed something since the last save. */
  async flush(): Promise<void> {
    for (const [id, { pty, ring }] of [...this.sources]) {
      // Only live sessions are saved: an ended one keeps the screen it already has.
      if (!pty || !this.dirty.delete(id)) continue;
      try {
        const screen = (await this.mux.capture(tmuxNameFor(id))) ?? ring.snapshot();
        if (screen.byteLength > 0) await this.store.save(id, screen);
      } catch {
        this.dirty.add(id);
      }
    }
  }

  /** Saves periodically; the timer never keeps the process alive. */
  start(everyMs: number): void {
    this.timer ??= setInterval(() => void this.flush(), everyMs);
    this.timer.unref();
  }
}
