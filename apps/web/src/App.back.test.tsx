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
  it('opens the drawer from a chat, then yields to native logs without ending the chat', async () => {
    await mount();
    const name = $('.current-name')?.textContent;
    expect($('.drawer')).toBeNull();
    expect(back()).toBe(true);
    expect($('.drawer')).not.toBeNull();
    expect(back()).toBe(false);
    expect($('.current-name')?.textContent).toBe(name);
  });
  it('yields immediately when the menu was opened with its button', async () => {
    await mount();
    click($('button[aria-label="All chats"]'));
    expect($('.drawer')).not.toBeNull();
    expect(back()).toBe(false);
  });
  it('returns to the two-step navigation after selecting a chat', async () => {
    await mount();
    expect(back()).toBe(true);
    click(document.querySelector('.session-row'));
    expect($('.drawer')).toBeNull();
    expect(back()).toBe(true);
    expect(back()).toBe(false);
  });
});
