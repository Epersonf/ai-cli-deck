import type { LaunchSpec, MultiplexerPort, PtyHandle, PtyPort } from '../../domain/ports.js';
import type { Runner } from './exec.js';
import { TmuxMultiplexer } from './TmuxMultiplexer.js';

/** Plain pty fallback: sessions do not survive a server restart. */
export class NoMultiplexer implements MultiplexerPort {
  readonly available = false;

  constructor(private readonly pty: PtyPort) {}

  launch(_name: string, spec: LaunchSpec, size: { cols: number; rows: number }): PtyHandle {
    return this.pty.spawn(spec, size);
  }
  reattach(): PtyHandle {
    throw new Error('Without tmux no session outlives the server');
  }
  list(): Promise<string[]> {
    return Promise.resolve([]);
  }
  capture(): Promise<Uint8Array | null> {
    return Promise.resolve(null);
  }
  kill(): Promise<void> {
    return Promise.resolve();
  }
}

export async function detectMultiplexer(run: Runner, pty: PtyPort): Promise<MultiplexerPort> {
  try {
    await run('tmux', ['-V']);
    return new TmuxMultiplexer(run);
  } catch {
    return new NoMultiplexer(pty);
  }
}
