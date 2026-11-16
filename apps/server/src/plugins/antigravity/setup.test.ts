import { describe, expect, it, vi } from 'vitest';
import type { PluginContext } from '../../domain/providerPlugin.js';
import { FakeChild } from '../../testing/fakeLoginChild.js';
import create from './index.js';

function setup() {
  let installed = false;
  const calls: readonly string[][] = [];
  const commands: string[][] = [];
  const child = new FakeChild();
  const ctx: PluginContext = {
    profile: { id: 'google', label: 'Google', base: 'antigravity', values: {} },
    home: '/tmp/google',
    env: () => ({}),
    loginEnv: () => ({}),
    statusEnv: () => ({}),
    resolve: (binary) => (installed && binary === 'agy' ? '/usr/bin/agy' : null),
    run: vi.fn(async (argv) => {
      commands.push([...argv]);
      installed = true;
      return { code: 0, output: 'installed' };
    }),
    startLogin: (argv) => {
      commands.push([...argv]);
      return child;
    },
  };
  return { hooks: create(ctx), ctx, commands, child, calls };
}
describe('Antigravity installation and Google sign-in', () => {
  it('invokes the official installer and checks the resulting executable', async () => {
    const test = setup();
    expect(await test.hooks.installed()).toBe(false);
    expect(await test.hooks.install()).toEqual({ ok: true, output: 'installed' });
    expect(test.commands[0]?.join(' ')).toContain('https://antigravity.google/cli/install');
    expect(test.commands[0]?.join(' ')).not.toContain('npm');
    expect(await test.hooks.installed()).toBe(true);
  });
  it('runs the official code-based login through the same web login process', () => {
    const test = setup();
    expect(test.hooks.login('antigravity-google')).toBe(test.child);
    expect(test.commands[0]?.slice(-2)).toEqual(['acp', '--login']);
  });
  it('does not report a successful install when no binary appears', async () => {
    const test = setup();
    test.ctx.resolve = () => null;
    expect((await test.hooks.install()).ok).toBe(false);
  });
});
