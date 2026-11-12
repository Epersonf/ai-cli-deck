import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, vi } from 'vitest';
import { installDomStubs } from './domStubs';

let wide = false;
let root: Root;
let host: HTMLElement;

/** Per-test setup shared by the smoke test files; call once at the top level of each. */
export function useSmokeApp(): void {
  beforeEach(async () => {
    wide = false;
    installDomStubs(() => wide);
    const { useSessions } = await import('../features/sessions/sessionsStore');
    const { useLayout } = await import('../features/layout/layoutStore');
    const { useLocale } = await import('../shared/i18n/store');
    useSessions.setState({ sessions: [], activeId: null, view: 'chat' });
    useLayout.getState().patch({ showRight: true, rightView: 'files', ratio: 0.58 });
    useLocale.getState().setLocale('en');
    host = document.body.appendChild(document.createElement('div'));
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });
}

export const setWide = (value: boolean): void => {
  wide = value;
};

export async function mount(): Promise<void> {
  const { App } = await import('../App');
  root = createRoot(host);
  await act(async () => {
    root.render(<App />);
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
export const $ = (selector: string) => document.body.querySelector<HTMLElement>(selector);
export const click = (el: Element | null) =>
  act(() => void el?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
