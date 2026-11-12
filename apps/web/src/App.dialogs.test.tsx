// @vitest-environment jsdom
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { $, click, mount, setWide, useSmokeApp } from './testing/smokeHarness';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

useSmokeApp();

describe('App dialogs', () => {
  it('asks with the app dialog (not window.confirm) before ending a session', async () => {
    await mount();
    click($('button[aria-label="All chats"]'));
    click([...document.querySelectorAll('.profile-row')].pop() ?? null); // the Shell profile
    click($('.session-list button[aria-label="More actions"]'));
    click([...document.querySelectorAll('.menu-pop button')].pop() ?? null);
    expect($('[role="alertdialog"]')?.textContent).toContain('Claude Code · beta'); // the newest session is the first row
    click($('[role="alertdialog"] .dialog-actions button:last-child')); // Cancel
    expect($('[role="alertdialog"]')).toBeNull();
  });

  it('offers clean profiles: a name and a base, with no key until the base wants one', async () => {
    await mount();
    click($('button[aria-label="All chats"]'));
    click($('.drawer-back')); // the drawer opens on the active terminal's profile
    const buttons = [...document.querySelectorAll('.drawer > button')];
    click(buttons.find((b) => b.textContent === 'New profile') ?? null);
    await act(async () => undefined); // the templates arrive
    const fields = [...document.querySelectorAll('.modal input, .modal select')];
    expect(fields).toHaveLength(2);
    const options = [...document.querySelectorAll('.modal option')].map((o) => o.textContent);
    expect(options).toEqual([
      'Claude Code',
      'Claude Code (custom endpoint)',
      'Claude Code (DeepSeek)',
      'Codex',
    ]);
    expect($('.modal input[type="password"]')).toBeNull();
  });

  it('a base that needs an API key asks for it, hidden, and requires it', async () => {
    await mount();
    click($('button[aria-label="All chats"]'));
    click($('.drawer-back'));
    click(
      [...document.querySelectorAll('.drawer > button')].find(
        (b) => b.textContent === 'New profile',
      ) ?? null,
    );
    await act(async () => undefined);
    const select = $('.modal select') as HTMLSelectElement;
    await act(async () => {
      select.value = 'claude-endpoint';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const key = $('.modal input[type="password"]') as HTMLInputElement;
    expect(key).not.toBeNull();
    expect(key.required).toBe(true);
  });

  it('the custom endpoint base asks for the API base URL', async () => {
    await mount();
    click($('button[aria-label="All chats"]'));
    click($('.drawer-back')); // the drawer opens on the active terminal's profile
    const buttons = [...document.querySelectorAll('.drawer > button')];
    click(buttons.find((b) => b.textContent === 'New profile') ?? null);
    await act(async () => undefined); // the templates arrive
    expect($('.modal input[type="url"]')).toBeNull();
    const select = $('.modal select') as HTMLSelectElement;
    await act(async () => {
      select.value = 'claude-endpoint';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect($('.modal input[type="url"]')).not.toBeNull();
    // Create stays disabled until a name and a URL are given.
    expect(($('.modal button.primary') as HTMLButtonElement).disabled).toBe(true);
  });

  it('lists the profile templates in settings, with import disabled until something is pasted', async () => {
    await mount();
    click($('button[aria-label="Settings"]'));
    const open = [...document.querySelectorAll('.setting button')].find(
      (b) => b.textContent === 'Manage templates',
    );
    click(open ?? null);
    await act(async () => undefined); // the templates arrive
    const names = [...document.querySelectorAll('.template-list strong')].map((n) => n.textContent);
    expect(names).toEqual([
      'Claude Code',
      'Claude Code (custom endpoint)',
      'Claude Code (DeepSeek)',
      'Codex',
    ]);
    const open2 = [...document.querySelectorAll('.modal .button-pair button')].find(
      (b) => b.textContent === 'Import template…',
    );
    click(open2 ?? null);
    const importButton = [...document.querySelectorAll('.modal .button-pair button')].find(
      (b) => b.textContent === 'Import',
    ) as HTMLButtonElement;
    expect(importButton.disabled).toBe(true);
    expect($('.modal')?.textContent).toMatch(/Import only templates you trust/);
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
    expect($('button[aria-label="すべてのチャット"]')).not.toBeNull();
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
