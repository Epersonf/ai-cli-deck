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
  it('shows the active session name in the top bar, with no tab strip', async () => {
    await mount();
    expect($('.tabs')).toBeNull();
    expect($('.current-name')?.textContent).toBe('Shell · alpha');
  });

  it('opens the drawer, jumps to a session and supports Alt+number', async () => {
    await mount();
    click($('button[aria-label="All terminals"]'));
    expect($('.drawer')).not.toBeNull();
    expect(document.querySelectorAll('.session-row')).toHaveLength(2);
    click(document.querySelectorAll('.session-row')[1] ?? null);
    expect($('.drawer')).toBeNull();
    expect($('.current-name')?.textContent).toBe('Shell · beta');
    act(
      () =>
        void window.dispatchEvent(
          new KeyboardEvent('keydown', { code: 'Digit1', altKey: true, bubbles: true }),
        ),
    );
    expect($('.current-name')?.textContent).toBe('Shell · alpha');
  });

  it('asks with the app dialog (not window.confirm) before ending a session', async () => {
    await mount();
    click($('button[aria-label="All terminals"]'));
    click($('.session-list button[aria-label="Close session"]'));
    expect($('[role="alertdialog"]')?.textContent).toContain('Shell · alpha');
    click($('[role="alertdialog"] .row button'));
    expect($('[role="alertdialog"]')).toBeNull();
  });

  it('offers clean profiles: a name and a base, never a key or login', async () => {
    await mount();
    click($('button[aria-label="All terminals"]'));
    const buttons = [...document.querySelectorAll('.drawer > button')];
    click(buttons.find((b) => b.textContent === 'New profile') ?? null);
    const fields = [...document.querySelectorAll('.modal input, .modal select')];
    expect(fields).toHaveLength(2);
    const options = [...document.querySelectorAll('.modal option')].map((o) => o.textContent);
    expect(options).toEqual(['Claude Code', 'Claude Code (DeepSeek)', 'Codex', 'Custom']);
    expect(document.querySelector('.modal')?.textContent).not.toMatch(/api key|password/i);
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
