import { describe, expect, it } from 'vitest';
import type { AccountLimit } from '../domain/agent.js';
import type { Provider, ProviderRegistry } from '../domain/provider.js';
import { LimitBook } from './LimitBook.js';
import { LimitProbe } from './LimitProbe.js';

const limit: AccountLimit = { key: 'five_hour', label: null, used: 0.3, resetsAt: null };

function setup(discover?: () => Promise<AccountLimit[]>) {
  const asked: number[] = [];
  const provider = {
    id: 'claude',
    discoverLimits: discover
      ? () => {
          asked.push(1);
          return discover();
        }
      : undefined,
  } as unknown as Provider;
  const providers = { get: (id: string) => (id === 'claude' ? provider : undefined) };
  const book = new LimitBook();
  let clock = 0;
  const probe = new LimitProbe(providers as unknown as ProviderRegistry, book, () => clock);
  return { probe, book, asked, tick: (ms: number) => (clock += ms) };
}

describe('asking for the account limits', () => {
  it('puts what the provider says in the book', async () => {
    const { probe, book } = setup(() => Promise.resolve([limit]));
    await probe.refresh('claude');
    expect(book.get('claude')).toEqual([limit]);
  });

  it('asks once at a time, and not again within a minute', async () => {
    const { probe, asked, tick } = setup(() => Promise.resolve([limit]));
    await Promise.all([probe.refresh('claude'), probe.refresh('claude')]);
    await probe.refresh('claude');
    expect(asked).toHaveLength(1);
    tick(61_000);
    await probe.refresh('claude');
    expect(asked).toHaveLength(2);
  });

  it('keeps what it had when asking fails, and ignores a provider that cannot', async () => {
    const { probe, book } = setup(() => Promise.reject(new Error('offline')));
    book.set('claude', limit);
    await expect(probe.refresh('claude')).resolves.toBeUndefined();
    expect(book.get('claude')).toEqual([limit]);
    await expect(setup().probe.refresh('claude')).resolves.toBeUndefined();
    await expect(setup().probe.refresh('nobody')).resolves.toBeUndefined();
  });
});
