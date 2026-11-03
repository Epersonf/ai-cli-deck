// @vitest-environment jsdom
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { $, click, mount, useSmokeApp } from './testing/smokeHarness';

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

  it('groups terminals by profile, with add, rename and delete on user profiles', async () => {
    await mount();
    click($('button[aria-label="All terminals"]'));
    const heads = [...document.querySelectorAll('.profile-head h3')].map((h) => h.textContent);
    expect(heads).toEqual(['Work', 'Shell']);
    const work = document.querySelectorAll('.profile-group')[0];
    expect(work?.textContent).toContain('No terminals yet.');
    const menuLabels = (group: Element | undefined): string[] => {
      click(group?.querySelector('.profile-head button[aria-label="More actions"]') ?? null);
      const labels = [...document.querySelectorAll('.menu-pop button')].map((b) => b.textContent);
      click($('.menu-backdrop'));
      return labels as string[];
    };
    expect(menuLabels(work)).toEqual(['New terminal in this profile', 'Rename', 'Delete profile']);
    const shell = document.querySelectorAll('.profile-group')[1];
    expect(shell?.querySelectorAll('.session-row')).toHaveLength(2);
    expect(menuLabels(shell)).toEqual(['New terminal in this profile']);
  });

  it('collapses a profile with its header', async () => {
    await mount();
    click($('button[aria-label="All terminals"]'));
    const shell = document.querySelectorAll('.profile-group')[1];
    click(shell?.querySelector('.profile-toggle') ?? null);
    expect(shell?.querySelectorAll('.session-row')).toHaveLength(0);
    click(shell?.querySelector('.profile-toggle') ?? null);
    expect(shell?.querySelectorAll('.session-row')).toHaveLength(2);
  });
});
