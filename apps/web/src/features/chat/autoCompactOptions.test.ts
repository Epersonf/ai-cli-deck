import type { ChatConfig } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import { autoCompactId, autoCompactOptions } from './autoCompactOptions';

const config = (
  agent: ChatConfig['agent'],
  autoCompact: ChatConfig['autoCompact'],
): ChatConfig => ({
  agent,
  model: null,
  effectiveModel: null,
  defaultModel: null,
  mode: 'default',
  effort: null,
  autoCompact,
  modelChoices: [],
  chatId: null,
});

describe('auto-compact choices', () => {
  it('offers never only for Claude, and always the default first', () => {
    const ids = (agent: ChatConfig['agent']) =>
      autoCompactOptions(config(agent, null), 'Default', 'Off').map((o) => o.id);
    expect(ids('claude')).toEqual(['', '100000', '150000', '200000', '300000', '500000', 'off']);
    expect(ids('codex')).not.toContain('off');
  });

  it('keeps a threshold that is not on the list', () => {
    const labels = autoCompactOptions(config('codex', 250_000), 'Default', 'Off').map(
      (o) => o.label,
    );
    expect(labels).toEqual(['Default', '100k', '150k', '200k', '250k', '300k', '500k']);
    expect(autoCompactId(250_000)).toBe('250000');
    expect(autoCompactId(null)).toBe('');
    expect(autoCompactId('off')).toBe('off');
  });
});
