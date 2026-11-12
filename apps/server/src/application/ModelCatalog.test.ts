import { describe, expect, it } from 'vitest';
import type { ModelListing, Provider } from '../domain/provider.js';
import { createHarness } from '../testing/harness.js';
import { ModelBook } from './ModelBook.js';
import { ModelCatalog } from './ModelCatalog.js';

function setup(discover: () => Promise<ModelListing>) {
  const { providers } = createHarness();
  const base = providers.get('claude') as Provider;
  providers.add({ ...base, discoverModels: discover });
  let clock = 0;
  const catalog = new ModelCatalog(providers, () => clock);
  const changed: string[] = [];
  catalog.onChange((id) => changed.push(id));
  return { catalog, changed, advance: (ms: number) => (clock += ms) };
}
const one = (id: string): ModelListing => ({
  choices: [{ id, label: id, description: null }],
  current: id,
});

describe('the model catalog', () => {
  it('is empty until asked, asks once at a time, remembers, then asks again when old', async () => {
    let asked = 0;
    const { catalog, changed, advance } = setup(() => Promise.resolve(one(`m${++asked}`)));
    expect(catalog.choices('claude')).toEqual([]);
    await Promise.all([catalog.refresh('claude'), catalog.refresh('claude')]);
    expect(asked).toBe(1);
    expect(catalog.choices('claude')[0]?.id).toBe('m1');
    expect(catalog.current('claude')).toBe('m1');
    await catalog.refresh('claude');
    expect(asked).toBe(1);
    advance(11 * 60_000);
    await catalog.refresh('claude');
    expect(catalog.choices('claude')[0]?.id).toBe('m2');
    expect(changed).toEqual(['claude', 'claude']);
  });

  it('keeps the last list when asking fails, and tries again soon', async () => {
    let fail = false;
    const { catalog, advance } = setup(() =>
      fail ? Promise.reject(new Error('x')) : Promise.resolve(one('a')),
    );
    await catalog.refresh('claude');
    fail = true;
    advance(11 * 60_000);
    await catalog.refresh('claude');
    expect(catalog.choices('claude')[0]?.id).toBe('a');
    fail = false;
    advance(61_000);
    await catalog.refresh('claude');
    expect(catalog.choices('claude')).toHaveLength(1);
  });

  it('does nothing for a provider that cannot say, and invalidate forces a new question', async () => {
    let asked = 0;
    const { catalog } = setup(() => Promise.resolve(one(`m${++asked}`)));
    await catalog.refresh('nobody');
    await catalog.refresh('claude');
    catalog.invalidate('claude');
    await catalog.refresh('claude');
    expect(asked).toBe(2);
  });
});

describe('the model book', () => {
  it('keeps defaults, modes and last models, tells of default changes, forgets a provider', async () => {
    const saved: unknown[] = [];
    const book = new ModelBook({
      load: () => Promise.resolve({ defaults: { p: 'm' }, effective: {}, modes: {} }),
      save: (s) => (saved.push(s), Promise.resolve()),
    });
    await book.restore();
    expect(book.defaultOf('p')).toBe('m');
    const told: string[] = [];
    book.onDefaultChange((id) => told.push(id));
    book.setDefault('p', 'm');
    book.setDefault('p', 'n');
    book.setMode('p', 'plan');
    book.setEffective('p', 'real');
    expect(told).toEqual(['p']);
    expect([book.defaultOf('p'), book.modeOf('p'), book.effectiveOf('p')]).toEqual([
      'n',
      'plan',
      'real',
    ]);
    book.forget('p');
    expect([book.defaultOf('p'), book.modeOf('p'), book.effectiveOf('p')]).toEqual([
      null,
      null,
      null,
    ]);
    expect(saved.at(-1)).toEqual({ defaults: {}, effective: {}, modes: {} });
  });
});
