import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HELP } from './help.js';
import { installSlashCommands } from './install.js';
import { parseArgs } from './parse.js';
import { SLASH_FILES } from './slashCommands.js';

const command = (...argv: string[]) => {
  const parsed = parseArgs(argv);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.command;
};

describe('parseArgs', () => {
  it('defaults to help and tolerates a leading /clideck', () => {
    expect(command()).toEqual({ name: 'help' });
    expect(command('/clideck', 'help')).toEqual({ name: 'help' });
    expect(command('--help')).toEqual({ name: 'help' });
  });

  it('expands ports and joins the free text of a reason', () => {
    expect(command('preview', '3000')).toEqual({ name: 'preview', url: 'http://localhost:3000' });
    expect(command('newtab', 'localhost:8080/x')).toEqual({
      name: 'newtab',
      url: 'http://localhost:8080/x',
    });
    expect(command('worktree', 'refactor', 'auth', 'module')).toEqual({
      name: 'worktree',
      reason: 'refactor auth module',
    });
    expect(command('status', 'abc123')).toEqual({ name: 'status', requestId: 'abc123' });
    expect(command('install', '--force')).toEqual({ name: 'install', force: true });
  });

  it('reports usage errors', () => {
    expect(parseArgs(['preview'])).toEqual({
      ok: false,
      error: 'usage: clideck preview <url|port>',
    });
    expect(parseArgs(['worktree'])).toMatchObject({ ok: false });
    expect(parseArgs(['status'])).toMatchObject({ ok: false });
    expect(parseArgs(['dance'])).toMatchObject({ ok: false });
  });
});

describe('help and slash commands', () => {
  it('documents every command', () => {
    for (const name of [
      'help',
      'whoami',
      'sessions',
      'port',
      'preview',
      'newtab',
      'worktree',
      'status',
      'install',
    ]) {
      expect(HELP).toContain(`  ${name}`);
    }
  });

  it('writes slash command files and keeps existing ones unless forced', async () => {
    const home = await mkdtemp(join(tmpdir(), 'deck-home-'));
    const first = await installSlashCommands(home, false);
    expect(first.every((line) => line.startsWith('wrote'))).toBe(true);
    const claude = await readFile(join(home, '.claude/commands/clideck.md'), 'utf8');
    expect(claude).toContain('!`clideck $ARGUMENTS`');
    expect(claude).toContain('allowed-tools: Bash(clideck:*)');
    expect((await installSlashCommands(home, false)).every((l) => l.startsWith('kept'))).toBe(true);
    expect((await installSlashCommands(home, true)).every((l) => l.startsWith('wrote'))).toBe(true);
    expect(SLASH_FILES).toHaveLength(2);
  });
});
