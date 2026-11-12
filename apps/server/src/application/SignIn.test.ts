import { describe, expect, it } from 'vitest';
import { service } from '../testing/signInKit.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe('signing in', () => {
  it('runs Claude login with the profile folder, shows the link, takes the pasted code, then confirms', async () => {
    const s = service();
    const flow = await s.svc.start('claude', 'claude-account');
    expect(flow).toMatchObject({ method: 'claude-account', state: 'running' });
    expect(s.children[0]).toMatchObject({
      kind: 'claude-account',
      env: { CLAUDE_CONFIG_DIR: '/home/p' },
    });
    s.children[0]?.child.say(
      "Opening browser\nIf the browser didn't open, visit: https://claude.com/x?y=1\nPaste code here if prompted > ",
    );
    expect(s.svc.current('claude')).toMatchObject({
      url: 'https://claude.com/x?y=1',
      needsCode: true,
    });
    s.svc.input('claude', 'the-code');
    expect(s.children[0]?.child.written).toEqual(['the-code\n']);
    s.login();
    s.children[0]?.child.end(0);
    await tick();
    expect(s.svc.current('claude')).toMatchObject({ state: 'done', needsCode: false, error: null });
    expect(s.own.on).toBe(true);
  });

  it('fails when the CLI ends badly or the account is not signed in after it, and can be cancelled', async () => {
    const s = service();
    await s.svc.start('claude', 'claude-console');
    s.children[0]?.child.say('Login failed: bad code\n');
    s.children[0]?.child.end(1);
    await tick();
    expect(s.svc.current('claude')).toMatchObject({
      state: 'failed',
      error: 'Login failed: bad code',
    });
    await s.svc.start('claude', 'claude-account');
    s.children[1]?.child.end(0); // exits well but is not signed in
    await tick();
    expect(s.svc.current('claude')?.state).toBe('failed');
    await s.svc.start('claude', 'claude-account');
    s.svc.cancel('claude');
    expect(s.children[2]?.child.killed).toBe(true);
    expect(s.svc.current('claude')?.state).toBe('cancelled');
  });

  it('keeps one login per provider: a new start ends the old one', async () => {
    const s = service();
    await s.svc.start('claude', 'claude-account');
    await s.svc.start('claude', 'claude-console');
    expect(s.children[0]?.child.killed).toBe(true);
    expect(s.svc.current('claude')?.method).toBe('claude-console');
  });

  it('refuses a method that does not fit, a key (it has its own route) and input with no login', async () => {
    const s = service();
    await expect(s.svc.start('claude', 'codex-chatgpt')).rejects.toThrow(/does not fit/);
    await expect(s.svc.start('claude', 'key')).rejects.toThrow(/secret/);
    await expect(s.svc.start('nope', 'machine')).rejects.toThrow(/not found/);
    expect(() => s.svc.input('claude', 'x')).toThrow(/No sign-in/);
  });

  it('machine forgets a saved key and the own login of a profile; logout touches only what is its own', async () => {
    const s = service();
    s.own.on = true;
    expect(await s.svc.start('claude', 'machine')).toMatchObject({
      method: 'machine',
      state: 'done',
    });
    expect(s.own.on).toBe(false);
    expect(s.secrets).toEqual([]); // 'claude' is a built-in: no key to clear
    await s.svc.logout('claude');
    expect(s.runs).toContainEqual(['claude', 'logout']);
  });

  it('answers who is signed in, and remembers it for a few seconds', async () => {
    const s = service();
    expect((await s.svc.auth('claude')).state).toBe('signed-out');
    s.login();
    expect((await s.svc.auth('claude')).state).toBe('signed-out'); // cached
    expect((await s.svc.auth('claude', true)).state).toBe('signed-in');
    expect(s.runs.filter(([, a]) => a === 'status')).toHaveLength(2);
  });
});
