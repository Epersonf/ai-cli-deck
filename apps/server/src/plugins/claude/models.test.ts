import { describe, expect, it } from 'vitest';
import { fakeQuery } from '../../infrastructure/agents/fakeClaude.js';
import { claudeModels } from './claudeModels.js';

describe('Claude models', () => {
  it('are what Claude Code says the account supports', async () => {
    const fake = fakeQuery();
    fake.api.supported = [
      { value: 'opus', displayName: 'Opus 5.5', description: 'Best' },
      { value: 'haiku' },
    ];
    const listing = await claudeModels(fake.queryFn, { ANTHROPIC_MODEL: 'opus' });
    expect(listing.choices).toEqual([
      { id: 'opus', label: 'Opus 5.5', description: 'Best' },
      { id: 'haiku', label: 'haiku', description: null },
    ]);
    expect(listing.current).toBe('opus');
  });
});
