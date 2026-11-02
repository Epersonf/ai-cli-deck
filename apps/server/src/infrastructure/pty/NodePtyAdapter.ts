import * as nodePty from 'node-pty';
import type { LaunchSpec, PtyHandle, PtyPort } from '../../domain/ports.js';

const toBytes = (chunk: unknown): Uint8Array =>
  typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : (chunk as Uint8Array);

export class NodePtyAdapter implements PtyPort {
  spawn(spec: LaunchSpec, size: { cols: number; rows: number }): PtyHandle {
    const proc = nodePty.spawn(spec.command, spec.args, {
      name: 'xterm-256color',
      cols: size.cols,
      rows: size.rows,
      cwd: spec.cwd,
      env: spec.env,
      encoding: null,
    });
    return {
      write: (data) => proc.write(data),
      resize: (cols, rows) => proc.resize(cols, rows),
      onData: (listener) => void proc.onData((chunk: unknown) => listener(toBytes(chunk))),
      onExit: (listener) => void proc.onExit(({ exitCode }) => listener(exitCode)),
      kill: () => proc.kill(),
    };
  }
}
