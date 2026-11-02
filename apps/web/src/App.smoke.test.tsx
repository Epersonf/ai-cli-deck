// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomStubs } from './testing/domStubs';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    cols = 80;
    rows = 24;
    modes = { applicationCursorKeysMode: false };
    loadAddon() {}
    open() {}
    write() {}
    reset() {}
    dispose() {}
    focus() {}
    onData() {}
    onResize() {}
  },
}));
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit() {}
  },
}));
vi.mock('@xterm/addon-web-links', () => ({ WebLinksAddon: vi.fn() }));

let wide = false;
let root: Root;
let host: HTMLElement;

beforeEach(async () => {
  wide = false;
  installDomStubs(() => wide);
  const { useSessions } = await import('./features/sessions/sessionsStore');
  const { useLayout } = await import('./features/layout/layoutStore');
  const { useLocale } = await import('./shared/i18n/store');
  useSessions.setState({ sessions: [], activeId: null, view: 'terminal' });
  useLayout.getState().patch({ showRight: true, rightView: 'files', ratio: 0.58 });
  useLocale.getState().setLocale('en');
  host = document.body.appendChild(document.createElement('div'));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function mount(): Promise<void> {
  const { App } = await import('./App');
  root = createRoot(host);
  await act(async () => {
    root.render(<App />);
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
const $ = (selector: string) => document.body.querySelector<HTMLElement>(selector);
const click = (el: Element | null) =>
  act(() => void el?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

describe('App smoke', () => {
  it('shows one tab per session and switches between them', async () => {
    await mount();
    const tabs = [...document.querySelectorAll('.tab > button[role="tab"]')];
    expect(tabs.map((t) => t.textContent)).toEqual(['shell · alpha', 'shell · beta']);
    click(tabs[1] ?? null);
    expect(document.querySelectorAll('.tab.active')[0]?.textContent).toContain('beta');
  });

  it('opens the terminal list, jumps to a session and supports Alt+number', async () => {
    await mount();
    click($('button[aria-label="All terminals"]'));
    expect(document.querySelectorAll('.session-row')).toHaveLength(2);
    expect(document.body.textContent).toContain('Alt+2');
    click(document.querySelectorAll('.session-row')[1] ?? null);
    expect($('.modal')).toBeNull();
    expect($('.tab.active')?.textContent).toContain('beta');
    act(
      () =>
        void window.dispatchEvent(
          new KeyboardEvent('keydown', { code: 'Digit1', altKey: true, bubbles: true }),
        ),
    );
    expect($('.tab.active')?.textContent).toContain('alpha');
  });

  it('switches the whole interface language', async () => {
    await mount();
    click($('button[aria-label="Settings"]'));
    const select = $('.modal select') as HTMLSelectElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    act(() => {
      setter?.call(select, 'ja');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(document.documentElement.lang).toBe('ja');
    expect($('.modal h2')?.textContent).toBe('設定');
    expect($('button[aria-label="すべてのターミナル"]')).not.toBeNull();
  });

  it('desktop: toggles the optional side panel next to the terminal', async () => {
    wide = true;
    await mount();
    expect($('.workspace.split')).not.toBeNull();
    expect($('.splitter')).not.toBeNull();
    click($('button[aria-label="Show or hide the side panel"]'));
    expect($('.workspace.split')).toBeNull();
    expect($('.splitter')).toBeNull();
  });
});
