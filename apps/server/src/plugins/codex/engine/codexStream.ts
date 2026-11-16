import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { AgentSink } from '../../../domain/agent.js';
import { mapCodexLine, type CodexState } from './codexMap.js';

/** Observe one exec process without letting output from a closed run update a newer conversation. */
export function watchCodexStream(
  child: ChildProcessWithoutNullStreams,
  state: CodexState,
  sink: AgentSink,
  active: () => boolean,
  finished: () => void,
  closed: (stderr: string) => void,
): void {
  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => {
    stderr = (stderr + String(chunk)).slice(-2000);
  });
  createInterface({ input: child.stdout }).on('line', (line) => {
    if (!active()) return;
    let json: unknown;
    try {
      json = JSON.parse(line);
    } catch {
      return;
    }
    if (typeof json === 'object' && json !== null)
      mapCodexLine(json as Record<string, unknown>, state, sink);
    if (state.finished) finished();
  });
  child.on('error', (error) => {
    state.lastError = `Could not start Codex: ${error.message}`;
  });
  child.on('close', () => closed(stderr));
  child.stdin.on('error', () => undefined);
}
