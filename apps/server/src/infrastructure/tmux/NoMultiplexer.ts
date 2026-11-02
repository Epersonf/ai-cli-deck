import type { LaunchSpec, MultiplexerPort } from '../../domain/ports.js';
import type { Runner } from './exec.js';
import { TmuxMultiplexer } from './TmuxMultiplexer.js';

/** Plain pty fallback: sessions do not survive a server restart. */
export class NoMultiplexer implements MultiplexerPort {
  readonly available = false;

  wrap(_name: string, spec: LaunchSpec): LaunchSpec {
    return spec;
  }
  attach(_name: string, spec: LaunchSpec): LaunchSpec {
    return spec;
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

export async function detectMultiplexer(run: Runner): Promise<MultiplexerPort> {
  try {
    await run('tmux', ['-V']);
    return new TmuxMultiplexer(run);
  } catch {
    return new NoMultiplexer();
  }
}
