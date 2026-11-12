import { appendFile, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ChatEvent } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import { FileChatLog } from './FileChatLog.js';

const user = (text: string): ChatEvent => ({ t: 'user', id: text, text, attachments: [], at: 'x' });

describe('the chat log on disk', () => {
  it('appends steps and reads them back, skipping a line cut by a crash', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'deck-chat-'));
    const log = new FileChatLog(dir);
    expect(await log.load('s1')).toEqual([]);
    await log.append('s1', [user('one'), { t: 'turn-start' }]);
    await appendFile(join(dir, 's1.jsonl'), '{"t":"text","id":"a","te');
    expect((await log.load('s1')).map((e) => e.t)).toEqual(['user', 'turn-start']);
  });

  it('replaces and removes a log, and refuses ids that are paths', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'deck-chat-'));
    const log = new FileChatLog(dir);
    await log.append('s1', [user('one')]);
    await log.replace('s1', [user('two')]);
    expect(await readFile(join(dir, 's1.jsonl'), 'utf8')).toContain('"two"');
    await log.remove('s1');
    expect(await log.load('s1')).toEqual([]);
    await expect(log.load('../evil')).rejects.toThrow();
  });
});
