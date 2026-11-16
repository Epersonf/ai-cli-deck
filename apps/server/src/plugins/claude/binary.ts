import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { locate } from '../../infrastructure/voice/locate.js';

/** Prefer the official binary bundled with the Agent SDK, then the installed CLI. */
export function claudeCommand(env: Record<string, string | undefined>): string {
  const base = `@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}`;
  for (const name of [base, `${base}-musl`]) {
    try {
      const pkg = createRequire(import.meta.url).resolve(`${name}/package.json`);
      return join(dirname(pkg), process.platform === 'win32' ? 'claude.exe' : 'claude');
    } catch {
      /* try the next supported SDK distribution */
    }
  }
  return locate(['claude'], env) ?? 'claude';
}
