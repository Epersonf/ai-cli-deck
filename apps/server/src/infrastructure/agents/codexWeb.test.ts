import { describe, expect, it } from 'vitest';
import { run } from './codexTestKit.js';

const line = (type: string, item: Record<string, unknown> = {}) =>
  JSON.stringify({ type: `item.${type}`, item: { id: 'web-1', type: 'web_search', ...item } });

describe('Codex web activity details', () => {
  it('updates the same card when queries only arrive at completion', () => {
    const { events } = run([
      line('started'),
      line('completed', { action: { type: 'search', queries: ['Codex caching', 'Codex tokens'] } }),
    ]);
    expect(events).toEqual([
      { t: 'tool', id: 'web-1', name: 'web_search', input: { details: 'not_reported' } },
      {
        t: 'tool',
        id: 'web-1',
        name: 'web_search',
        input: { queries: ['Codex caching', 'Codex tokens'] },
      },
      { t: 'tool-result', id: 'web-1', output: '', isError: false },
    ]);
  });
  it('preserves known queries through partial notifications and does not duplicate unchanged cards', () => {
    const { events } = run([
      line('started', { query: 'vitest' }),
      line('updated'),
      line('completed', { query: '' }),
    ]);
    expect(events.map((e) => e.t)).toEqual(['tool', 'tool-result']);
    expect(events[0]).toMatchObject({ input: { query: 'vitest' } });
  });
  it('supports legacy and structured single queries without inventing empty terms', () => {
    expect(
      run([line('completed', { action: { type: 'search', query: 'native query' } })]).events[0],
    ).toMatchObject({ input: { query: 'native query' } });
    expect(run([line('completed', { query: '' })]).events[0]).toMatchObject({
      input: { details: 'not_reported' },
    });
  });
  it.each(['open_page', 'openPage'])('shows %s as opening a page, not an empty search', (type) => {
    const { events } = run([
      line('completed', { query: '', action: { type, url: 'https://example.com' } }),
    ]);
    expect(events[0]).toMatchObject({ name: 'web_open', input: { url: 'https://example.com' } });
  });
  it.each(['find_in_page', 'findInPage'])('shows %s with its URL and text pattern', (type) => {
    const { events } = run([
      line('completed', { action: { type, url: 'https://example.com', pattern: 'cache' } }),
    ]);
    expect(events[0]).toMatchObject({
      name: 'web_find',
      input: { url: 'https://example.com', pattern: 'cache' },
    });
  });
  it('does not hide a provider-reported failure', () => {
    expect(run([line('completed', { status: 'failed' })]).events.at(-1)).toMatchObject({
      t: 'tool-result',
      isError: true,
    });
  });
  it('retains the action when the completion omits its details', () => {
    const { events } = run([
      line('started', { action: { type: 'open_page', url: 'https://example.com' } }),
      line('completed'),
    ]);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ name: 'web_open', input: { url: 'https://example.com' } });
  });
});
