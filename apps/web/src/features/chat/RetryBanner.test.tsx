// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { ChatRetry } from '@deck/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RetryBanner } from './RetryBanner';
import { sendChat } from './connection';
vi.mock('./connection', () => ({ sendChat: vi.fn() }));
vi.mock('../../shared/i18n/store', () => ({ useT: () => (key: string) => key }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const host = document.createElement('div');
const state: ChatRetry = {
  id: 'choice',
  sourceId: 'message',
  threadId: 'thread',
  kind: 'usage',
  status: 'offered',
  retryAt: '2027-01-01T00:00:00Z',
  estimated: false,
  attempt: 0,
};
afterEach(() => {
  host.replaceChildren();
  vi.clearAllMocks();
});
function show(retry: ChatRetry = state, online = true) {
  const root = createRoot(host);
  act(() => root.render(<RetryBanner retry={retry} sessionId="chat" online={online} />));
  const click = (label: string) =>
    act(() =>
      Array.from(host.querySelectorAll('button'))
        .find((button) => button.textContent === label)
        ?.click(),
    );
  return { click, unmount: () => act(() => root.unmount()) };
}
describe('waiting for a provider limit', () => {
  it('offers explicit opt-in and sends the choice id without optimistic authorization', () => {
    const { click, unmount } = show();
    expect(sendChat).not.toHaveBeenCalled();
    click('retry.wait');
    expect(sendChat).toHaveBeenCalledWith('chat', { type: 'retry', id: 'choice', action: 'wait' });
    expect(host.textContent).toContain('retry.offer');
    unmount();
  });
  it('shows the persisted waiting state and offers cancellation / an earlier attempt', () => {
    const { click, unmount } = show({ ...state, status: 'waiting', estimated: true });
    expect(host.textContent).toContain('retry.waiting');
    expect(host.textContent).toContain('retry.estimated');
    click('retry.now');
    click('retry.cancel');
    expect(sendChat).toHaveBeenCalledWith('chat', { type: 'retry', id: 'choice', action: 'now' });
    expect(sendChat).toHaveBeenCalledWith('chat', {
      type: 'retry',
      id: 'choice',
      action: 'cancel',
    });
    unmount();
  });
  it('disables actions while offline', () => {
    const { click, unmount } = show(state, false);
    click('retry.wait');
    expect(sendChat).not.toHaveBeenCalled();
    expect(Array.from(host.querySelectorAll('button')).every((button) => button.disabled)).toBe(
      true,
    );
    unmount();
  });
});
