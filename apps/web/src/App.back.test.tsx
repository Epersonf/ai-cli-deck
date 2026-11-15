// @vitest-environment jsdom
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { $, click, mount, useSmokeApp } from './testing/smokeHarness';

vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });
useSmokeApp();

function back(): boolean | undefined {
  let handled: boolean | undefined;
  act(() => {
    handled = (window as { deckBack?: () => boolean }).deckBack?.();
  });
  return handled;
}

describe('APK Back navigation', () => {
  it('opens the drawer from a chat, then shows profiles before yielding to native logs without ending the chat', async () => {
    await mount();
    const name = $('.current-name')?.textContent;
    expect($('.drawer')).toBeNull();
    expect(back()).toBe(true);
    expect($('.drawer')).not.toBeNull();
    expect($('.profile-head')).not.toBeNull();
    expect(back()).toBe(true);
    expect($('.profile-head')).toBeNull();
    expect($('.profile-row')).not.toBeNull();
    expect(back()).toBe(false);
    expect($('.current-name')?.textContent).toBe(name);
  });
  it('also shows profiles when the menu was opened with its button', async () => {
    await mount();
    click($('button[aria-label="All chats"]'));
    expect($('.drawer')).not.toBeNull();
    expect($('.profile-head')).not.toBeNull();
    expect(back()).toBe(true);
    expect($('.profile-head')).toBeNull();
    expect($('.profile-row')).not.toBeNull();
    expect(back()).toBe(false);
  });
  it('returns to the three-step navigation after selecting a chat', async () => {
    await mount();
    expect(back()).toBe(true);
    click(document.querySelector('.session-row'));
    expect($('.drawer')).toBeNull();
    expect(back()).toBe(true);
    expect(back()).toBe(true);
    expect(back()).toBe(false);
  });
  it('yields to logs when the profile list was already opened with its arrow', async () => {
    await mount();
    click($('button[aria-label="All chats"]'));
    click($('.drawer-back'));
    expect($('.profile-head')).toBeNull();
    expect(back()).toBe(false);
  });
});
