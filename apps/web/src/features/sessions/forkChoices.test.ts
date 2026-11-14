import type { ProviderInfo } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import { forkChoices } from './forkChoices';

const provider = (id: string, over: Partial<ProviderInfo> = {}): ProviderInfo => ({
  id,
  label: id,
  status: 'ready',
  hint: null,
  canInstall: false,
  setupId: null,
  profile: false,
  agent: 'claude',
  keyState: 'none',
  signIn: 'account',
  ...over,
});

const list = [
  provider('claude'),
  provider('codex-2', { profile: true, agent: 'codex' }),
  provider('deepseek', { profile: true, keyState: 'missing' }),
  provider('codex', { agent: 'codex', status: 'missing' }),
];

describe('where a chat can move to', () => {
  it('goes both ways between a built-in agent and a profile of another', () => {
    expect(forkChoices(list, 'claude').map((p) => p.id)).toContain('codex-2');
    expect(forkChoices(list, 'codex-2').map((p) => p.id)).toContain('claude');
  });

  it('leaves out what cannot answer, but keeps the current one', () => {
    expect(forkChoices(list, 'claude').map((p) => p.id)).toEqual(['claude', 'codex-2']);
    expect(forkChoices(list, 'deepseek').map((p) => p.id)).toEqual([
      'claude',
      'codex-2',
      'deepseek',
    ]);
  });
});
