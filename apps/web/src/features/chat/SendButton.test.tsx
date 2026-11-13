// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mainAction, SendButton } from './SendButton';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('what the main button does', () => {
  it('stops only while the agent works and nothing is typed', () => {
    expect(mainAction(true, true)).toBe('stop');
    expect(mainAction(true, false)).toBe('send');
    expect(mainAction(false, true)).toBe('send');
    expect(mainAction(false, false)).toBe('send');
  });
});

describe('the Send / Stop button', () => {
  const host = document.createElement('div');
  afterEach(() => host.replaceChildren());

  function show(busy: boolean, empty: boolean) {
    const onSend = vi.fn();
    const onStop = vi.fn();
    const root = createRoot(host);
    act(() =>
      root.render(<SendButton busy={busy} empty={empty} onSend={onSend} onStop={onStop} />),
    );
    const button = host.querySelector('button') as HTMLButtonElement;
    return { button, onSend, onStop, unmount: () => act(() => root.unmount()) };
  }

  it('is a disabled Send when idle with nothing typed', () => {
    const { button, unmount } = show(false, true);
    expect(button.disabled).toBe(true);
    expect(button.classList.contains('stop')).toBe(false);
    unmount();
  });

  it('is a Stop while busy with an empty box, and calls onStop', () => {
    const { button, onSend, onStop, unmount } = show(true, true);
    expect(button.classList.contains('stop')).toBe(true);
    expect(button.disabled).toBe(false);
    act(() => button.click());
    expect(onStop).toHaveBeenCalledOnce();
    expect(onSend).not.toHaveBeenCalled();
    unmount();
  });

  it('goes back to Send as soon as there is text, even while busy (it queues the message)', () => {
    const { button, onSend, onStop, unmount } = show(true, false);
    expect(button.classList.contains('stop')).toBe(false);
    act(() => button.click());
    expect(onSend).toHaveBeenCalledOnce();
    expect(onStop).not.toHaveBeenCalled();
    unmount();
  });
});
