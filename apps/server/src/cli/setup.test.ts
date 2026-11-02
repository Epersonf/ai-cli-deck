import { setupSpecFor, type ApiKeyName } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import { loginChoices, pickChoice, setupProvider, type SetupIo } from './setup.js';

function fakeIo(answers: string[], opts: { installed?: boolean; secret?: string | null } = {}) {
  const log: string[] = [];
  const ran: string[][] = [];
  const state = { installed: opts.installed ?? true };
  const io: SetupIo = {
    say: (t) => void log.push(t),
    ask: () => Promise.resolve(answers.shift() ?? ''),
    secret: () => Promise.resolve(opts.secret === undefined ? 'sk-secret' : opts.secret),
    run: (argv) => {
      ran.push([...argv]);
      if (argv[0] === 'npm') state.installed = true;
      return Promise.resolve(0);
    },
    has: () => Promise.resolve(state.installed),
  };
  const saved: Array<[ApiKeyName, string]> = [];
  const saveKey = (name: ApiKeyName, key: string) => (
    saved.push([name, key]),
    Promise.resolve('/cfg/config.json')
  );
  return { deps: { io, saveKey }, log, ran, saved };
}

const claude = setupSpecFor('claude');
const deepseek = setupSpecFor('claude-deepseek');
if (!claude || !deepseek) throw new Error('specs missing');

describe('choices', () => {
  it('offers account login only when the CLI has one', () => {
    expect(loginChoices(claude).map((c) => c.choice)).toEqual(['account', 'apikey', 'skip']);
    expect(loginChoices(deepseek).map((c) => c.choice)).toEqual(['apikey', 'skip']);
  });

  it('accepts a number or the start of a label', () => {
    const choices = loginChoices(claude);
    expect(pickChoice('2', choices)).toBe('apikey');
    expect(pickChoice('sign', choices)).toBe('account');
    expect(pickChoice('9', choices)).toBeNull();
    expect(pickChoice('', choices)).toBeNull();
  });
});

describe('setupProvider', () => {
  it('runs the account login for an installed CLI', async () => {
    const t = fakeIo(['1']);
    expect(await setupProvider(claude, t.deps)).toBe(true);
    expect(t.ran).toEqual([['claude']]);
  });

  it('saves a typed API key and never prints it', async () => {
    const t = fakeIo(['2']);
    await setupProvider(claude, t.deps);
    expect(t.saved).toEqual([['anthropic', 'sk-secret']]);
    expect(t.log.join('\n')).not.toContain('sk-secret');
    expect(t.log.join('\n')).toContain('/cfg/config.json');
  });

  it('installs a missing CLI after confirmation, then continues', async () => {
    const t = fakeIo(['y', '2'], { installed: false });
    expect(await setupProvider(claude, t.deps)).toBe(true);
    expect(t.ran[0]).toEqual(['npm', 'install', '-g', '@anthropic-ai/claude-code']);
    expect(t.saved).toHaveLength(1);
  });

  it('stops when the install is declined', async () => {
    const t = fakeIo(['n'], { installed: false });
    expect(await setupProvider(claude, t.deps)).toBe(false);
    expect(t.ran).toEqual([]);
  });

  it('keeps nothing when the key prompt is cancelled or empty, or the user skips', async () => {
    for (const secret of [null, '   ']) {
      const t = fakeIo(['2'], { secret });
      await setupProvider(claude, t.deps);
      expect(t.saved).toEqual([]);
    }
    const skipped = fakeIo(['3']);
    await setupProvider(claude, skipped.deps);
    expect(skipped.ran).toEqual([]);
    expect(skipped.saved).toEqual([]);
  });

  it('stores the DeepSeek key under its own name', async () => {
    const t = fakeIo(['1']);
    await setupProvider(deepseek, t.deps);
    expect(t.saved).toEqual([['deepseek', 'sk-secret']]);
  });
});
