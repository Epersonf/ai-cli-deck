import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { codexCapabilities } from './codexCapabilities.js';

vi.mock('./codexBin.js', () => ({
  resolveCodex: (env: Record<string, string>) => ({
    command: process.execPath,
    prefix: [
      fileURLToPath(new URL('./fixtures/capabilities-server.mjs', import.meta.url)),
      env['CAPABILITIES_VARIANT'],
    ],
  }),
}));

describe('Codex executable capabilities', () => {
  it('detects supported commands without a model call and reuses the result', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'deck-capabilities-'));
    try {
      const log = join(dir, 'calls');
      const env = {
        ...(process.env as Record<string, string>),
        CAPABILITIES_LOG: log,
        CAPABILITIES_VARIANT: 'supported-1',
      };
      expect(await codexCapabilities(env)).toEqual({ fork: true, compact: true });
      expect(await codexCapabilities(env)).toEqual({ fork: true, compact: true });
      expect((await readFile(log, 'utf8')).trim().split('\n')).toHaveLength(2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('does not mistake legacy exec help for native fork support', async () => {
    expect(
      await codexCapabilities({
        ...(process.env as Record<string, string>),
        CAPABILITIES_VARIANT: 'legacy',
      }),
    ).toEqual({ fork: false, compact: false });
  });
});
