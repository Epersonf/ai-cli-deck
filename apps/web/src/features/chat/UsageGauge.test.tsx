// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UsageGauge } from './UsageGauge';
import { sendChat } from './connection';

vi.mock('./connection', () => ({ sendChat: vi.fn() }));
vi.mock('../../shared/i18n/store', () => ({ useT: () => (key: string) => key }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const host = document.createElement('div');
afterEach(() => {
  host.replaceChildren();
  vi.clearAllMocks();
});

function show(canCompact: boolean, busy = false, compacting = false, nativeCompact = true) {
  const root = createRoot(host);
  act(() =>
    root.render(
      <UsageGauge
        usage={null}
        sessionId="codex-chat"
        canCompact={canCompact}
        nativeCompact={nativeCompact}
        busy={busy}
        compacting={compacting}
      />,
    ),
  );
  act(() => (host.querySelector('.header-pop-btn') as HTMLButtonElement).click());
  return {
    compact: host.querySelector('.usage-chip') as HTMLButtonElement | null,
    unmount: () => act(() => root.unmount()),
  };
}

describe('the manual compact control', () => {
  it('is available without context metrics and sends a native operation', () => {
    const { compact, unmount } = show(true);
    expect(compact).not.toBeNull();
    act(() => compact?.click());
    expect(sendChat).toHaveBeenCalledWith('codex-chat', { type: 'compact' });
    expect(sendChat).not.toHaveBeenCalledWith(
      'codex-chat',
      expect.objectContaining({ type: 'send' }),
    );
    unmount();
  });

  it('shows progress while busy and hides unsupported controls', () => {
    const first = show(true, true, true);
    expect(first.compact?.disabled).toBe(true);
    expect(first.compact?.textContent).toBe('chat.usage.compacting');
    first.unmount();
    const second = show(false);
    expect(second.compact).toBeNull();
    second.unmount();
  });
  it('keeps the existing Claude command transport, including compatibility with an older server', () => {
    const { compact, unmount } = show(true, false, false, false);
    act(() => compact?.click());
    expect(sendChat).toHaveBeenCalledWith('codex-chat', {
      type: 'send',
      text: '/compact',
      images: [],
      queue: true,
    });
    unmount();
  });
});
