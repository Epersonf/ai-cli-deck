import { describe, expect, it } from 'vitest';
import { providerCtx } from '../testing/providerContext.js';
import { assertSecureBind } from './config/bind.js';
import { mergeConfig } from './config/loadConfig.js';
import { parseGitStatus } from './git/GitCli.js';
import { claude } from './providers/claude.js';
import { codex } from './providers/codex.js';
import { createProviderRegistry } from './providers/registry.js';

const ctx = providerCtx;

describe('providers', () => {
  it('claude and codex are agents on the machine own sign-in, with no environment of their own', () => {
    expect(claude.agent).toBe('claude');
    expect(codex.agent).toBe('codex');
    expect(claude.buildAgent(ctx)).toEqual({ kind: 'claude', env: {}, model: null });
    expect(codex.buildAgent(ctx).kind).toBe('codex');
  });

  it('registry exposes the built-in providers', () => {
    const ids = createProviderRegistry()
      .list()
      .map((p) => p.id);
    expect(ids).toEqual(['claude', 'codex']);
  });
});

describe('git helpers', () => {
  it('parses porcelain status', () => {
    const out = '## main...origin/main\n M src/a.ts\n?? new.txt\n';
    expect(parseGitStatus(out)).toEqual({
      isRepo: true,
      branch: 'main',
      changes: [
        { code: 'M', path: 'src/a.ts' },
        { code: '??', path: 'new.txt' },
      ],
    });
  });
});

describe('config and bind safety', () => {
  it('merges env over the config file with defaults', () => {
    expect(mergeConfig({ port: 9000 }, {}).port).toBe(9000);
    expect(mergeConfig({ port: 9000 }, { DECK_PORT: 9100 }).port).toBe(9100);
    expect(mergeConfig(null, {})).toMatchObject({ host: '127.0.0.1' });
  });

  it('refuses to listen beyond loopback without a password', () => {
    expect(() => assertSecureBind('0.0.0.0', false)).toThrow('without a password');
    expect(() => assertSecureBind('0.0.0.0', true)).not.toThrow();
    expect(() => assertSecureBind('127.0.0.1', false)).not.toThrow();
  });
});
