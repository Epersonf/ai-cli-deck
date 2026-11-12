import { describe, expect, it } from 'vitest';
import { transcript } from './transcript';

describe('transcript', () => {
  it('writes requests, answers and one line per tool', () => {
    const text = transcript([
      { kind: 'user', id: 'u', text: 'list files', attachments: [] },
      { kind: 'tool', id: 't', name: 'Bash', input: { command: 'ls' }, result: null },
      { kind: 'thinking', id: 'k', text: 'hidden', streaming: false },
      { kind: 'text', id: 'a', text: 'Two files.', streaming: false },
    ]);
    expect(text).toBe('**You:** list files\n\n> Bash: ls\n\nTwo files.');
  });
});
