import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { killTree } from '../../../infrastructure/process/killTree.js';
import { locate } from '../../../infrastructure/voice/locate.js';
import { obj, str, type Json } from '../../codex/engine/codexJson.js';

/** Grok Build is a native binary (`npm i -g @xai-official/grok` or the official installer). No shell is involved. */
export function grokCommand(env: Record<string, string>): string {
  const installed = locate(['grok'], env);
  const fallback = join(
    homedir(),
    '.grok',
    'bin',
    process.platform === 'win32' ? 'grok.exe' : 'grok',
  );
  return env['DECK_GROK_BIN'] || installed || (existsSync(fallback) ? fallback : 'grok');
}

interface Pending {
  resolve(value: Json): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout> | null;
}

/** `grok agent stdio` speaks ACP v1: newline-delimited JSON-RPC on stdio. */
export class GrokRpc {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<number, Pending>();
  private sequence = 0;
  private closed = false;
  private stderr = '';

  constructor(
    cwd: string,
    env: Record<string, string>,
    private readonly receive: (message: Json) => void,
    private readonly ended: (error: Error) => void,
  ) {
    this.child = spawn(grokCommand(env), ['agent', 'stdio'], {
      cwd,
      env,
      stdio: 'pipe',
      windowsHide: true,
    });
    const lines = createInterface({ input: this.child.stdout });
    lines.on('line', (line) => {
      if (this.closed) return;
      let message: Json | null;
      try {
        message = obj(JSON.parse(line));
      } catch {
        return;
      }
      if (!message) return;
      const id = message['id'];
      if (!message['method'] && typeof id === 'number') {
        const pending = this.pending.get(id);
        if (!pending) return;
        this.pending.delete(id);
        if (pending.timer) clearTimeout(pending.timer);
        const error = obj(message['error']);
        if (error) pending.reject(new Error(str(error['message']) || 'Grok request failed'));
        else pending.resolve(obj(message['result']) ?? {});
      } else this.receive(message);
    });
    this.child.stderr.on('data', (chunk: Buffer) => {
      this.stderr = (this.stderr + String(chunk)).slice(-4000);
    });
    this.child.on('error', (error) =>
      this.fail(
        new Error(
          `Could not start Grok Build: ${error.message}. Install it with npm i -g @xai-official/grok and sign in.`,
        ),
      ),
    );
    this.child.on('close', () => this.fail(new Error(this.stderr.trim() || 'Grok Build stopped')));
    this.child.stdin.on('error', (error) => this.fail(error));
  }

  request(method: string, params: Json, timeoutMs = 30_000): Promise<Json> {
    if (this.closed) return Promise.reject(new Error('Grok connection is closed'));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer =
        timeoutMs > 0
          ? setTimeout(() => {
              this.pending.delete(id);
              reject(new Error(`Grok ${method} timed out`));
            }, timeoutMs)
          : null;
      timer?.unref();
      this.pending.set(id, { resolve, reject, timer });
      this.write({ id, method, params });
    });
  }

  notify(method: string, params: Json): void {
    this.write({ method, params });
  }
  respond(id: unknown, result: Json): void {
    this.write({ id, result });
  }
  unsupported(id: unknown): void {
    this.write({ id, error: { code: -32601, message: 'Method not supported by this client' } });
  }
  private write(message: Json): void {
    if (!this.closed) this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
  }
  private fail(error: Error): void {
    if (this.closed) return;
    this.close();
    this.ended(error);
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const pending of this.pending.values()) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(new Error('Grok connection closed'));
    }
    this.pending.clear();
    this.child.stdin.end();
    killTree(this.child);
    const child = this.child;
    setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
    }, 2000).unref();
  }
}
