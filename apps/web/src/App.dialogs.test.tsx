// @vitest-environment jsdom
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { $, click, mount, setWide, useSmokeApp } from './testing/smokeHarness';

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

useSmokeApp();

describe('App dialogs', () => {
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

  it('closes settings with the X button, Escape, or a click outside', async () => {
    await mount();
    const open = (): void => click($('button[aria-label="Settings"]'));
    open();
    click($('.modal-x'));
    expect($('.modal')).toBeNull();
    open();
    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect($('.modal')).toBeNull();
    open();
    click($('.modal-backdrop'));
    expect($('.modal')).toBeNull();
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
    setWide(true);
    await mount();
    expect($('.workspace.split')).not.toBeNull();
    expect($('.splitter')).not.toBeNull();
    click($('button[aria-label="Show or hide the side panel"]'));
    expect($('.workspace.split')).toBeNull();
    expect($('.splitter')).toBeNull();
  });
});
