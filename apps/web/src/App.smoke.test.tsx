// @vitest-environment jsdom
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { $, click, mount, useSmokeApp } from './testing/smokeHarness';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

vi.mock('@xterm/xterm', () => import('./testing/fakeXterm'));
vi.mock('@xterm/addon-fit', () => import('./testing/fakeXterm'));
vi.mock('@xterm/addon-web-links', () => import('./testing/fakeXterm'));
vi.mock('@xterm/addon-unicode11', () => import('./testing/fakeXterm'));
vi.mock('@xterm/addon-webgl', () => import('./testing/fakeXterm'));

useSmokeApp();

/** Opens a profile from the drawer's first level by its name. */
const openProfile = (name: string): void =>
  click(
    [...document.querySelectorAll('.profile-row')].find(
      (row) => row.querySelector('h3')?.textContent === name,
    ) ?? null,
  );

/** Types into a (React-controlled) input the way a user would. */
function typeInto(input: Element | null, text: string): void {
  const field = input as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(field, text);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('App smoke', () => {
  it('shows the active session name in the top bar, with no tab strip', async () => {
    await mount();
    expect($('.tabs')).toBeNull();
    // The newest session comes first (beta was created after alpha) and is the one that opens.
    expect($('.current-name')?.textContent).toBe('Shell · beta');
  });

  it('opens the drawer, jumps to a session and supports Alt+number', async () => {
    await mount();
    click($('button[aria-label="All terminals"]'));
    expect($('.drawer')).not.toBeNull();
    openProfile('Shell');
    expect(document.querySelectorAll('.session-row')).toHaveLength(2);
    click(document.querySelectorAll('.session-row')[1] ?? null);
    expect($('.drawer')).toBeNull();
    expect($('.current-name')?.textContent).toBe('Shell · alpha');
    act(
      () =>
        void window.dispatchEvent(
          new KeyboardEvent('keydown', { code: 'Digit1', altKey: true, bubbles: true }),
        ),
    );
    expect($('.current-name')?.textContent).toBe('Shell · beta');
  });

  it("opens on the profile of the terminal you are in, and 'back' lists all profiles", async () => {
    await mount();
    click($('button[aria-label="All terminals"]'));
    expect($('.profile-head h3')?.textContent).toBe('Shell');
    expect(document.querySelectorAll('.session-row')).toHaveLength(2);
    click($('.drawer-back'));
    expect(document.querySelectorAll('.profile-row')).toHaveLength(2);
  });

  it('shows profiles first, with add, rename and delete on the ones you made', async () => {
    await mount();
    click($('button[aria-label="All terminals"]'));
    click($('.drawer-back')); // the drawer opens on the active terminal's profile
    expect([...document.querySelectorAll('.profile-row h3')].map((h) => h.textContent)).toEqual([
      'Work',
      'Shell',
    ]);
    expect(document.querySelectorAll('.session-row')).toHaveLength(0);
    const rowMenu = (index: number): string[] => {
      const kebabs = document.querySelectorAll('.session-list button[aria-label="More actions"]');
      click(kebabs[index] ?? null);
      const labels = [...document.querySelectorAll('.menu-pop button')].map((b) => b.textContent);
      click($('.menu-backdrop'));
      return labels as string[];
    };
    expect(rowMenu(0)).toEqual(['New terminal in this profile', 'Rename', 'Delete profile']);
    expect(rowMenu(1)).toEqual(['New terminal in this profile']);
    openProfile('Work');
    expect($('.drawer')?.textContent).toContain('No terminals yet.');
    click($('.drawer-back'));
    expect(document.querySelectorAll('.profile-row')).toHaveLength(2);
  });

  it('searches profiles, and finds terminals by name from the profile list', async () => {
    await mount();
    click($('button[aria-label="All terminals"]'));
    click($('.drawer-back')); // the drawer opens on the active terminal's profile
    typeInto($('.drawer-search'), 'wor');
    expect([...document.querySelectorAll('.profile-row h3')].map((h) => h.textContent)).toEqual([
      'Work',
    ]);
    expect(document.querySelectorAll('.session-row')).toHaveLength(0);
    typeInto($('.drawer-search'), 'beta');
    expect(document.querySelectorAll('.profile-row')).toHaveLength(0);
    expect(document.querySelectorAll('.session-row')).toHaveLength(1);
    typeInto($('.drawer-search'), 'zzz');
    expect($('.drawer')?.textContent).toContain('Nothing found.');
  });

  it('searches the terminals of one profile by name', async () => {
    await mount();
    click($('button[aria-label="All terminals"]'));
    openProfile('Shell');
    typeInto($('.drawer-search'), 'alpha');
    expect(document.querySelectorAll('.session-row')).toHaveLength(1);
    expect($('.session-row')?.textContent).toContain('alpha');
    typeInto($('.drawer-search'), '');
    expect(document.querySelectorAll('.session-row')).toHaveLength(2);
  });
});
