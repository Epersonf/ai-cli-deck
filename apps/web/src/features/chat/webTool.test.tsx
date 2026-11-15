// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ToolCard } from './ToolCard';
import { summarize } from './toolInfo';
import { applyEvent } from './blocks';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let dispose = (): void => {};
afterEach(() => dispose());

describe('web activity cards', () => {
  it('shows the missing-details explanation for previously saved blank queries', () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    dispose = () => act(() => root.unmount());
    act(() =>
      root.render(
        <ToolCard
          block={{ kind: 'tool', id: 'w', name: 'web_search', input: { query: '' }, result: null }}
        />,
      ),
    );
    expect(host.textContent).toContain('Search terms not reported by Codex');
  });
  it('lists multiple queries and updates a card in place without losing its result', () => {
    const first = applyEvent([], { t: 'tool', id: 'w', name: 'web_search', input: {} });
    const done = applyEvent(first, { t: 'tool-result', id: 'w', output: '', isError: false });
    const updated = applyEvent(done, {
      t: 'tool',
      id: 'w',
      name: 'web_search',
      input: { queries: ['first', 'second'] },
    });
    expect(updated).toHaveLength(1);
    const block = updated[0];
    if (block?.kind !== 'tool') throw new Error('Missing tool block');
    expect(block.result?.isError).toBe(false);
    expect(summarize(block.name, block.input).title).toBe('first second');
  });
});
