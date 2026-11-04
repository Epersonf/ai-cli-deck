// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkTemplateText, downloadText } from './templateFile';

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
    const ok = '{ /* c */ "schema": 1, "id": "a", "label": "A", }';
    expect(checkTemplateText(ok)).toMatchObject({ id: 'a' });
    expect(checkTemplateText('{ nope')).toMatch(/Not valid JSON/);
    expect(checkTemplateText('{ "schema": 1 }')).toMatch(/Not a profile template/);
  });
});
