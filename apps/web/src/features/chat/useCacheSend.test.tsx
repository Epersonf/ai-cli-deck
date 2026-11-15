// @vitest-environment jsdom
import { ChatConfigSchema } from '@deck/shared';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useChats } from './chatStore';
import { useCacheSend } from './useCacheSend';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const host = document.createElement('div');
let dispose = (): void => {};
afterEach(() => {
  dispose();
  host.replaceChildren();
  useChats.getState().forget('test');
});

function show() {
  useChats.getState().setUsage('test', {
    costUsd: null,
    contextTokens: 42000,
    contextWindow: 200000,
    limits: [],
    cache: {
      read: 40000,
      write: null,
      ttlMs: 300000,
      at: new Date(Date.now() - 600000).toISOString(),
    },
  });
  useChats.getState().setOnline('test', true);
  const send = vi.fn();
  function Demo() {
    const guard = useCacheSend('test');
    return (
      <>
        <button onClick={() => guard.request(send)}>request</button>
        {guard.dialog}
      </>
    );
  }
  const root = createRoot(host);
  act(() => root.render(<Demo />));
  dispose = () => act(() => root.unmount());
  return send;
}

function button(index = 0, parent: ParentNode = host): HTMLButtonElement {
  const found = parent.querySelectorAll('button')[index];
  if (!found) throw new Error(`Missing button ${index}`);
  return found;
}
function dialog(): Element {
  const found = host.querySelector('[role="dialog"]');
  if (!found) throw new Error('Missing cache dialog');
  return found;
}

describe('cache warning confirmation', () => {
  it('does not send until confirmed; cancellation preserves the unsent action', () => {
    const send = show();
    act(() => button().click());
    expect(send).not.toHaveBeenCalled();
    expect(dialog().textContent).toContain('42.0k');
    act(() => button(2, dialog()).click());
    expect(send).not.toHaveBeenCalled();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    act(() => button().click());
    act(() => button(1, dialog()).click());
    expect(send).toHaveBeenCalledOnce();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });
  it('blocks confirmation offline and resumes after reconnect', () => {
    const send = show();
    act(() => button().click());
    act(() => useChats.getState().setOnline('test', false));
    expect(button(1, dialog()).disabled).toBe(true);
    act(() => button(1, dialog()).click());
    expect(send).not.toHaveBeenCalled();
    act(() => useChats.getState().setOnline('test', true));
    act(() => button(1, dialog()).click());
    expect(send).toHaveBeenCalledOnce();
  });
  it('does not confirm a message for a conversation that was replaced', () => {
    const send = show();
    act(() => button().click());
    act(() =>
      useChats.getState().setConfig(
        'test',
        ChatConfigSchema.parse({
          agent: 'codex',
          model: null,
          mode: 'default',
          effort: null,
          modelChoices: [],
          chatId: 'new-thread',
        }),
      ),
    );
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });
});
