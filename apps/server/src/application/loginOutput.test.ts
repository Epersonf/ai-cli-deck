import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readAuthStatus } from './authStatus.js';
import { cleanOutput, readLoginOutput } from './loginOutput.js';

const fixture = (name: string): string =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

describe('reading what the login commands print', () => {
  it('finds the device-auth link and code of Codex 0.167 through its colours', () => {
    const p = readLoginOutput(fixture('codex-0.167-device-auth.txt'));
    expect(p).toMatchObject({ url: 'https://auth.openai.com/codex/device', code: 'ABCD-EFGH1' });
    expect(cleanOutput(fixture('codex-0.167-device-auth.txt'))).not.toContain(
      String.fromCharCode(27),
    );
  });

  it('finds the page of Claude and that it waits for a pasted code', () => {
    const p = readLoginOutput(fixture('claude-auth-login.txt'));
    expect(p.url).toMatch(/^https:\/\/claude\.com\/cai\/oauth\/authorize\?code=true&client_id=/);
    expect(p.needsCode).toBe(true);
    expect(p.code).toBeNull();
  });

  it('joins a link the terminal wrapped, and waits for the code until the prompt appears', () => {
    const nl = String.fromCharCode(10);
    const first = readLoginOutput(`visit: https://example.com/a?x=1${nl}&y=2${nl}${nl}`);
    expect(first.url).toBe('https://example.com/a?x=1&y=2');
    expect(first.needsCode).toBe(false);
  });

  it('reads the status of each CLI', () => {
    const json = JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', email: 'a@b.c' });
    expect(readAuthStatus('claude', { code: 0, output: json }, false)).toEqual({
      state: 'signed-in',
      via: 'Claude subscription',
      account: 'a@b.c',
    });
    expect(readAuthStatus('claude', { code: 0, output: json }, true).via).toBe(
      "this machine's login",
    );
    expect(readAuthStatus('claude', { code: 1, output: '{"loggedIn":false}' }, false).state).toBe(
      'signed-out',
    );
    expect(readAuthStatus('codex', { code: 0, output: 'Logged in using ChatGPT' }, false).via).toBe(
      'ChatGPT',
    );
    expect(readAuthStatus('codex', { code: 1, output: 'Not logged in' }, false).state).toBe(
      'signed-out',
    );
    expect(readAuthStatus('codex', null, false).state).toBe('unknown');
    expect(readAuthStatus('claude', { code: 0, output: 'garbage' }, false).state).toBe('unknown');
  });
});
