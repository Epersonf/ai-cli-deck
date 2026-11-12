// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkTemplateText, copyText, downloadText } from './templateFile';

afterEach(() => {
  delete (window as { DeckAndroid?: unknown }).DeckAndroid;
});

describe('downloadText', () => {
  it('hands the text to the Android app when it hosts the page (a WebView cannot download)', () => {
    const saveText = vi.fn();
    (window as { DeckAndroid?: unknown }).DeckAndroid = { saveText };
    downloadText('profile-template.jsonc', '{ }');
    expect(saveText).toHaveBeenCalledWith('profile-template.jsonc', '{ }');
  });
});

describe('checkTemplateText', () => {
  it('accepts a commented template and explains what is wrong otherwise', () => {
    const ok = '{ /* c */ "schema": 1, "id": "a", "label": "A", "agent": "claude" }';
    expect(checkTemplateText(ok)).toMatchObject({ id: 'a' });
    expect(checkTemplateText('{ nope')).toMatch(/Not valid JSON/);
    expect(checkTemplateText('{ "schema": 1 }')).toMatch(/Not a profile template/);
  });
});

describe('copyText', () => {
  it('falls back to the copy command where there is no clipboard API (plain http)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const exec = vi.fn(() => true);
    (document as unknown as { execCommand: unknown }).execCommand = exec;
    await copyText('hello');
    expect(exec).toHaveBeenCalledWith('copy');
    exec.mockReturnValue(false);
    await expect(copyText('x')).rejects.toThrow(/Download/);
  });
});
