import { setupSpecFor } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import { npmHelp, setupProvider, type SetupIo } from './setup.js';

function fakeIo(
  answer: string,
  opts: { installed: boolean; installWorks?: boolean; npm?: boolean; platform?: NodeJS.Platform },
) {
  const log: string[] = [];
  const ran: string[][] = [];
  const state = { installed: opts.installed };
  const io: SetupIo = {
    platform: opts.platform ?? 'linux',
    say: (text) => void log.push(text),
    ask: () => Promise.resolve(answer),
    run: (argv) => {
      ran.push([...argv]);
      if (opts.installWorks !== false) state.installed = true;
      return Promise.resolve(opts.installWorks === false ? 1 : 0);
    },
    has: (binary) => Promise.resolve(binary === 'npm' ? opts.npm !== false : state.installed),
  };
  return { io, log, ran };
}

const claude = setupSpecFor('claude');
if (!claude) throw new Error('spec missing');

describe('setupProvider', () => {
  it('does nothing but explain when the CLI is already installed', async () => {
    const t = fakeIo('', { installed: true });
    expect(await setupProvider(claude, t.io)).toBe(true);
    expect(t.ran).toEqual([]);
    expect(t.log.join('\n')).toContain('sign in itself');
  });

  it('downloads a missing CLI after confirmation and leaves the sign-in to the CLI', async () => {
    const t = fakeIo('y', { installed: false });
    expect(await setupProvider(claude, t.io)).toBe(true);
    expect(t.ran).toEqual([['npm', 'install', '-g', '@anthropic-ai/claude-code']]);
    expect(t.log.join('\n')).toContain('walk you through signing in');
  });

  it('treats an empty answer as yes and "n" as no', async () => {
    expect(await setupProvider(claude, fakeIo('', { installed: false }).io)).toBe(true);
    const declined = fakeIo('n', { installed: false });
    expect(await setupProvider(claude, declined.io)).toBe(false);
    expect(declined.ran).toEqual([]);
  });

  it('reports a failed install', async () => {
    const t = fakeIo('y', { installed: false, installWorks: false });
    expect(await setupProvider(claude, t.io)).toBe(false);
    expect(t.log.join('\n')).toContain('did not finish');
  });

  it('explains how to get npm instead of failing when it is missing', async () => {
    const t = fakeIo('y', { installed: false, npm: false });
    expect(await setupProvider(claude, t.io)).toBe(false);
    expect(t.ran).toEqual([]);
    expect(t.log.join('\n')).toContain('npm was not found');
  });
});

describe('npmHelp', () => {
  it('gives a platform specific hint', () => {
    expect(npmHelp('win32')).toContain('winget');
    expect(npmHelp('darwin')).toContain('brew');
    expect(npmHelp('linux')).toContain('apt install npm');
    expect(npmHelp('linux')).toContain('Termux');
  });
});
