import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { AgentSink, AgentSpec } from '../../../domain/agent.js';
import { killTree } from '../../../infrastructure/process/killTree.js';
import { codexConfigArgs } from './codexArgs.js';
import { resolveCodex } from './codexBin.js';
import { obj, str, type Json } from './codexJson.js';
import { friendlyError } from './codexMap.js';

/** Manual compaction uses Codex's protocol, never a user prompt asking the model to summarize. */
export function compactCodex(spec: AgentSpec, sink: AgentSink, signal: AbortSignal): Promise<void> {
  if (!spec.resumeId || spec.fork)
    return Promise.reject(new Error('Send a message in this chat before compacting it'));
  if (signal.aborted) return Promise.reject(new Error('Compaction cancelled'));
  const bin = resolveCodex(spec.env);
  const child = spawn(bin.command, [...bin.prefix, 'app-server', ...codexConfigArgs(spec)], {
    cwd: spec.cwd,
    env: spec.env,
    stdio: 'pipe',
  });
  return new Promise((resolve, reject) => {
    let settled = false;
    let compactRequested = false;
    let stderr = '';
    const lines = createInterface({ input: child.stdout });
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', aborted);
      lines.close();
      child.stdin.end();
      killTree(child);
      if (error) reject(error);
      else {
        sink.usage({ compacted: true });
        resolve();
      }
    };
    const aborted = (): void => finish(new Error('Compaction cancelled'));
    const timer = setTimeout(() => finish(new Error('Codex compaction timed out')), 300_000);
    timer.unref();
    signal.addEventListener('abort', aborted, { once: true });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + String(chunk)).slice(-2000);
    });
    child.on('error', (error) => finish(new Error(`Could not start Codex: ${error.message}`)));
    child.on('close', () =>
      finish(new Error(friendlyError(stderr.trim() || 'Codex stopped before compaction finished'))),
    );
    child.stdin.on('error', (error) => finish(error));
    const send = (message: Json): void => {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    };
    lines.on('line', (line) => {
      let message: Json | null;
      try {
        message = obj(JSON.parse(line));
      } catch {
        return;
      }
      if (!message || settled) return;
      if (message['error']) {
        finish(
          new Error(
            friendlyError(str(obj(message['error'])?.['message']) || 'Codex compaction failed'),
          ),
        );
        return;
      }
      if (message['id'] === 1) {
        send({ method: 'initialized' });
        send({
          id: 2,
          method: 'thread/resume',
          params: {
            threadId: spec.resumeId,
            excludeTurns: true,
            cwd: spec.cwd,
            ...(spec.model ? { model: spec.model } : {}),
            developerInstructions: spec.guide,
          },
        });
      } else if (message['id'] === 2) {
        compactRequested = true;
        send({ id: 3, method: 'thread/compact/start', params: { threadId: spec.resumeId } });
      } else if (message['method'] === 'turn/completed' && compactRequested) {
        const params = obj(message['params']);
        if (params?.['threadId'] !== spec.resumeId) return;
        const turn = obj(params['turn']);
        const status = str(turn?.['status']);
        if (status === 'completed') finish();
        else
          finish(
            new Error(str(obj(turn?.['error'])?.['message']) || `Compaction ${status || 'failed'}`),
          );
      } else if (message['method'] === 'error' && compactRequested) {
        const params = obj(message['params']);
        if (params?.['threadId'] !== spec.resumeId || params['willRetry'] === true) return;
        finish(
          new Error(
            friendlyError(str(obj(params['error'])?.['message']) || 'Codex compaction failed'),
          ),
        );
      } else if ('id' in message && typeof message['method'] === 'string') {
        // Compaction needs no tools or interactive approvals. Fail explicitly on unexpected requests.
        send({
          id: message['id'],
          error: { code: -32601, message: 'Not supported during compaction' },
        });
      }
    });
    send({
      id: 1,
      method: 'initialize',
      params: {
        clientInfo: { name: 'ai-cli-deck', title: 'AI CLI Deck', version: '1' },
      },
    });
  });
}
