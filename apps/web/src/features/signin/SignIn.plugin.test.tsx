// @vitest-environment jsdom
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { host, calls, click, button, mount, type, ready } from './pluginSignInTestKit';

describe('complete plugin sign-in UI', () => {
  it('installs Antigravity, opens Google authorization, sends the code and shows success', async () => {
    await mount();
    expect(host.textContent).toContain('Install the CLI for Google');
    await click(button('Install provider CLI'));
    expect(host.textContent).toContain('Google account');
    await click(button('Start sign-in'));
    const link = host.querySelector<HTMLAnchorElement>(
      'a[href="https://accounts.google.com/auth"]',
    );
    expect(link).not.toBeNull();
    link?.addEventListener('click', (event) => event.preventDefault());
    await click('a[href="https://accounts.google.com/auth"]');
    type('input', 'google-code');
    await act(async () => {
      host
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(calls.find((call) => call.url.endsWith('/login'))?.body.method).toBe(
      'antigravity-google',
    );
    expect(calls.find((call) => call.url.endsWith('/login/input'))?.body.text).toBe('google-code');
    expect(host.textContent).toContain('Signed in.');
  });
  it('offers the profile API key as an alternative and saves it through the private secret endpoint', async () => {
    ready();
    await mount();
    await click('.choice-btn');
    const option = [...host.querySelectorAll<HTMLElement>('[role="option"]')].find((entry) =>
      entry.textContent?.includes('Gemini API key'),
    );
    if (!option) throw new Error('Missing key option');
    option.setAttribute('data-key', 'true');
    await click('[data-key]');
    type('input[type="password"]', 'gemini-private-key');
    await act(async () => {
      host
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(calls.find((call) => call.url.endsWith('/secret'))?.body.secret).toBe(
      'gemini-private-key',
    );
    expect(host.textContent).toContain('Signed in.');
    expect(host.textContent).not.toContain('gemini-private-key');
  });
});
