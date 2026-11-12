import type { ChatEvent } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import { closeDangling, lastAnswer, recentText, trimLog } from './chatRepair.js';
import { eventsToTurns } from './chatHistory.js';

const user = (text: string): ChatEvent => ({ t: 'user', id: text, text, attachments: [], at: 'x' });
const end: ChatEvent = { t: 'turn-end', error: null, costUsd: null, durationMs: null };

describe('repairing a log after a restart', () => {
  it('denies open permissions and ends an unfinished turn, and leaves a clean log alone', () => {
    const open: ChatEvent[] = [
      user('hi'),
      { t: 'turn-start' },
      { t: 'permission', id: 'p1', tool: 'Bash', input: {}, canAlways: false, reason: null },
      { t: 'permission', id: 'p2', tool: 'Edit', input: {}, canAlways: false, reason: null },
      { t: 'permission-done', id: 'p2', allowed: true },
    ];
    expect(closeDangling(open).map((e) => e.t)).toEqual(['permission-done', 'turn-end']);
    expect(closeDangling([user('hi'), { t: 'turn-start' }, end])).toEqual([]);
  });

  it('keeps the newest part of a very long log', () => {
    const many = Array.from({ length: 5000 }, (_, i) => user(String(i)));
    const { events, trimmed } = trimLog(many);
    expect(trimmed).toBe(true);
    expect(events.at(-1)).toMatchObject({ text: '4999' });
    expect(trimLog([user('a')]).trimmed).toBe(false);
  });
});

describe('reading a conversation as text', () => {
  const events: ChatEvent[] = [
    user('fix it'),
    { t: 'text', id: 'a', text: 'Looking' },
    { t: 'tool', id: 't', name: 'Bash', input: { command: 'npm test' } },
    { t: 'text', id: 'b', text: 'Done' },
  ];

  it('gives the last answer and the recent lines', () => {
    expect(lastAnswer(events)).toBe('Done');
    expect(recentText(events, 2)).toBe('→ Bash\nAssistant: Done');
  });

  it('turns steps into the turns a transcript is made of, with the command of each tool', () => {
    expect(eventsToTurns(events)).toEqual([
      { role: 'user', text: 'fix it' },
      { role: 'assistant', text: 'Looking' },
      { role: 'tool', text: 'Bash: npm test' },
      { role: 'assistant', text: 'Done' },
    ]);
  });
});
