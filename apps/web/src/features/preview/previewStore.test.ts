// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { currentUrl, usePreview } from './previewStore';

const state = () => usePreview.getState();

describe('preview store tabs', () => {
  beforeEach(() => usePreview.setState({ byId: {}, tabs: {} }));

  it('sends a link to the tab being shown, each tab keeping its own address', () => {
    state().addTab('s1'); // the second tab, shown
    expect(state().open('s1', 'http://localhost:5173')).toBe(true);
    state().selectTab('s1', 1);
    expect(state().open('s1', 'http://localhost:8080')).toBe(true);
    expect(currentUrl(state().byId['s1~2'])).toContain('5173');
    expect(currentUrl(state().byId['s1'])).toContain('8080');
  });

  it('refuses what is not a local address, in any tab', () => {
    expect(state().open('s1', 'https://example.com')).toBe(false);
    expect(state().byId).toEqual({});
  });

  it('opens a link in a tab of its own', () => {
    expect(state().openInNewTab('s1', 'http://localhost:4321')).toBe(true);
    expect(state().tabs['s1']?.list).toEqual([1, 2]);
    expect(currentUrl(state().byId['s1~2'])).toContain('4321');
    expect(state().openInNewTab('s1', 'https://example.com')).toBe(false);
  });

  it('forgets the address of a closed tab, so a tab opened later starts empty', () => {
    state().addTab('s1');
    state().open('s1', 'http://localhost:5173');
    state().closeTab('s1', 2);
    expect(state().byId['s1~2']).toBeUndefined();
    state().addTab('s1');
    expect(currentUrl(state().byId['s1~2'])).toBeNull();
  });
});
