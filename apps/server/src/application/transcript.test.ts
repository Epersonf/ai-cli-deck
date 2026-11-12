import { describe, expect, it } from 'vitest';
import { transcript } from './transcript.js';

const origin = { from: 'Claude Code', cwd: '/work', date: new Date('2026-01-01T12:34:56Z') };

describe('the transcript handed to another AI', () => {
  it('has each request, each answer with its actions on one line each', () => {
    const text = transcript(
      [
        { role: 'user', text: 'fix the bug' },
        { role: 'assistant', text: 'Looking.' },
        { role: 'tool', text: 'Read: src/a.ts' },
        { role: 'tool', text: 'Edit: src/a.ts' },
        { role: 'assistant', text: 'Fixed.' },
        { role: 'user', text: 'thanks' },
      ],
      origin,
    );
    expect(text).toContain('With Claude Code, in /work, saved 2026-01-01 12:34 UTC.');
    expect(text).toContain(
      '## User\n\nfix the bug\n\n## Assistant\n\nLooking.\n\n→ Read: src/a.ts\n→ Edit: src/a.ts\nFixed.\n',
    );
    expect(text.trimEnd().endsWith('## User\n\nthanks')).toBe(true);
  });

  it('keeps the latest part of a very long chat and says how much was left out', () => {
    const turns = Array.from({ length: 60 }, (_, i) => ({
      role: i % 2 ? ('assistant' as const) : ('user' as const),
      text: `${i} ${'x'.repeat(5000)}`,
    }));
    const text = transcript(turns, origin);
    expect(text.length).toBeLessThan(130_000);
    expect(text).toMatch(/_\(\d+ earlier messages left out to keep this short\.\)_/);
    expect(text).toContain('59 xxx');
    expect(text).not.toContain('## User\n\n0 xxx');
  });
});
