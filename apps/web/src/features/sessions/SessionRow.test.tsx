// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeSession } from '../../testing/fixtures';
import { useChatTitles } from './chatTitlesStore';
import { SessionRow } from './SessionRow';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('SessionRow card', () => {
  const host = document.createElement('div');
  afterEach(() => host.replaceChildren());

  function show(status: 'idle' | 'working') {
    const session = {
      ...makeSession('s1', '/work/alpha'),
      status,
      lastMessageAt: '2026-01-05T10:30:00Z',
    };
    useChatTitles.setState({ titles: { s1: 'Fix the login bug' } });
    const root = createRoot(host);
    act(() =>
      root.render(<SessionRow session={session} index={0} active={false} onPick={vi.fn()} />),
    );
    return root;
  }

  it('shows the title, the base folder and the time of the last message', () => {
    show('idle');
    const row = host.querySelector('.session-row');
    expect(row?.textContent).toContain('Fix the login bug');
    expect(row?.textContent).toContain('/work/alpha');
    expect(row?.querySelector('time')?.getAttribute('datetime')).toBe('2026-01-05T10:30:00Z');
  });

  it('has no status dot and no activity line; the kebab menu stays', () => {
    show('working');
    expect(host.querySelector('.dot')).toBeNull();
    expect(host.querySelector('.session-activity')).toBeNull();
    expect(host.querySelector('[aria-haspopup]')).not.toBeNull();
  });

  it('flags a working chat on the card so its border can glow', () => {
    show('working');
    const row = host.querySelector('.session-row');
    expect(row?.getAttribute('data-status')).toBe('working');
    expect(row?.getAttribute('aria-busy')).toBe('true');
  });

  it('does not flag an idle chat', () => {
    show('idle');
    expect(host.querySelector('.session-row')?.getAttribute('aria-busy')).toBe('false');
  });
});
