import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseArgs } from './parse.js';
import { memoryCommand } from './memoryCommand.js';

const deck = { url: 'http://deck', sessionId: 's1' };

describe('clideck memory', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is parsed as a command with its words', () => {
    expect(parseArgs(['memory', 'write', '--title', 'T'])).toEqual({
      ok: true,
      command: { name: 'memory', args: ['write', '--title', 'T'] },
    });
  });

  it('calls the agent memory routes with what the flags say', async () => {
    const calls: Array<[string, string, unknown]> = [];
    vi.stubGlobal('fetch', (url: string, init: { method: string; body?: string }) => {
      calls.push([
        init.method,
        url.replace('http://deck/agent/s1', ''),
        init.body && JSON.parse(init.body),
      ]);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: 1 }) });
    });
    await memoryCommand(deck, [
      'write',
      '--title',
      'T',
      '--body',
      'B',
      '--folder',
      'A/B',
      '--scope',
      'global',
    ]);
    await memoryCommand(deck, ['list', '--profile', 'codex']);
    await memoryCommand(deck, ['read', 'id1']);
    await memoryCommand(deck, ['import', '--from', 'claude', '--ids', 'a,b', '--folders', 'f']);
    await memoryCommand(deck, ['delete', 'id1']);
    expect(calls.map(([m, p]) => `${m} ${p}`)).toEqual([
      'POST /memory',
      'GET /memory?profile=codex',
      'GET /memory/id1',
      'POST /memory/import',
      'DELETE /memory/id1',
    ]);
    expect(calls[0]?.[2]).toMatchObject({ title: 'T', body: 'B', folder: 'A/B', scope: 'global' });
    expect(calls[3]?.[2]).toEqual({ fromProfile: 'claude', ids: ['a', 'b'], folderIds: ['f'] });
    await expect(memoryCommand(deck, ['write'])).rejects.toThrow(/usage/);
  });
});
