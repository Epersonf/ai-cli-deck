import { describe, expect, it } from 'vitest';
import { setup } from './predictorFixture';

describe('local echo on a full-screen program', () => {
  it('shows keys at once over a chat box placeholder, even while the program is still busy', () => {
    const t = setup();
    t.state.alt = true;
    t.state.x = 2;
    t.placeholder('Try "fix lint"');
    for (const ch of 'hi') t.predictor.input(ch);
    const view = t.predictor.view();
    expect(view?.chars.map((c) => [c.x, c.ch])).toEqual([
      [2, 'h'],
      [3, 'i'],
    ]);
    expect(view?.mask).toEqual({ x: 2, y: 0, width: 18 }); // the placeholder is hidden meanwhile
    t.advance(4000); // a program still starting up: no echo yet, and the guesses stay
    expect(t.predictor.tick()).toBe(false);
    expect(t.predictor.view()?.chars).toHaveLength(2);
    t.echo('h');
    t.echo('i');
    expect(t.predictor.afterWrite()).toBe(true);
    expect(t.predictor.view()).toBeNull();
  });

  it("trusts an agent's chat box at once, even without a placeholder", () => {
    const t = setup();
    t.state.alt = true;
    for (const ch of '❯ ') t.write(ch); // Claude Code's prompt
    t.predictor.input('h');
    expect(t.predictor.view()?.chars.map((c) => [c.x, c.ch])).toEqual([[2, 'h']]);
  });

  it('without a placeholder, waits for one confirmed echo first (vim, less)', () => {
    const t = setup();
    t.state.alt = true;
    t.predictor.input('a');
    expect(t.predictor.view()).toBeNull();
    t.echo('a');
    t.predictor.afterWrite();
    t.predictor.input('b');
    expect(t.predictor.view()?.chars.map((c) => c.ch)).toEqual(['b']);
  });

  it('keeps guessing in a chat box that already has text, once an echo was confirmed', () => {
    const t = setup();
    t.state.alt = true;
    for (const ch of '> hi') t.write(ch); // text typed before: no placeholder
    t.predictor.input('!');
    expect(t.predictor.view()).toBeNull();
    t.echo('!');
    t.predictor.afterWrite();
    for (const ch of 'ok') t.predictor.input(ch);
    expect(t.predictor.view()?.chars.map((c) => c.ch)).toEqual(['o', 'k']);
  });

  it('drops the guesses when the program redraws their row without them', () => {
    const t = setup();
    t.state.alt = true;
    t.placeholder('type here');
    t.predictor.input('j');
    expect(t.predictor.view()).not.toBeNull();
    t.draw(15, 0, '%'); // like less: the row changed, but not with the key
    expect(t.predictor.afterWrite()).toBe(true);
    expect(t.predictor.view()).toBeNull();
  });
});
