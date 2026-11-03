import { describe, expect, it } from 'vitest';
import { isPredictable } from './predictor';
import { setup, typeAndEcho } from './predictorFixture';

describe('isPredictable', () => {
  it('accepts printable single characters only', () => {
    expect(isPredictable('a')).toBe(true);
    expect(isPredictable('é')).toBe(true);
    expect(isPredictable(' ')).toBe(true);
    expect(isPredictable('\r')).toBe(false);
    expect(isPredictable('\x1b[A')).toBe(false);
    expect(isPredictable('ab')).toBe(false);
    expect(isPredictable('日')).toBe(false);
  });
});

describe('createPredictor', () => {
  it('shows the very first keystroke at once', () => {
    const t = setup();
    t.predictor.input('a');
    expect(t.predictor.view()?.chars.map((c) => c.ch)).toEqual(['a']);
    expect(t.predictor.view()?.cursor).toEqual({ x: 1, y: 0 });
  });

  it('predicts several keys ahead of the echo', () => {
    const t = setup();
    typeAndEcho(t, 'a');
    typeAndEcho(t, 'b');
    ['c', 'd', 'e'].forEach((ch) => t.predictor.input(ch));
    expect(t.predictor.view()?.chars.map((c) => [c.x, c.ch])).toEqual([
      [2, 'c'],
      [3, 'd'],
      [4, 'e'],
    ]);
  });

  it('confirms predictions in order as output arrives', () => {
    const t = setup();
    typeAndEcho(t, 'a');
    typeAndEcho(t, 'b');
    t.predictor.input('c');
    t.predictor.input('d');
    t.echo('c');
    expect(t.predictor.afterWrite()).toBe(true);
    expect(t.predictor.view()?.chars.map((c) => c.ch)).toEqual(['d']);
  });

  it('backs off after a wrong guess until echoes are confirmed again', () => {
    const t = setup();
    t.predictor.input('c');
    t.echo('X');
    t.predictor.afterWrite();
    t.predictor.input('d');
    expect(t.predictor.view()).toBeNull();
    t.echo('d');
    t.predictor.afterWrite();
    typeAndEcho(t, 'e');
    typeAndEcho(t, 'f');
    t.predictor.input('g');
    expect(t.predictor.view()?.chars.map((c) => c.ch)).toEqual(['g']);
  });

  it('never guesses at a password prompt', () => {
    const t = setup();
    for (const ch of 'Password: ') t.write(ch);
    t.predictor.input('s');
    expect(t.predictor.view()).toBeNull();
  });

  it('does not guess when typing in the middle of a line', () => {
    const t = setup();
    t.write('x');
    t.state.x = 0;
    t.predictor.input('a');
    expect(t.predictor.view()).toBeNull();
  });

  it('drops predictions that never got an echo', () => {
    const t = setup();
    typeAndEcho(t, 'a');
    typeAndEcho(t, 'b');
    t.predictor.input('c');
    t.advance(2000);
    expect(t.predictor.tick()).toBe(true);
    expect(t.predictor.view()).toBeNull();
  });

  it('drops pending guesses on cursor keys', () => {
    const t = setup();
    t.predictor.input('c');
    expect(t.predictor.input('\x1b[D')).toBe(true);
    expect(t.predictor.view()).toBeNull();
  });

  it('predicts backspace over text already typed, and confirms it', () => {
    const t = setup();
    typeAndEcho(t, 'a');
    typeAndEcho(t, 'b');
    t.predictor.input('\x7f');
    const view = t.predictor.view();
    expect(view?.chars[0]).toMatchObject({ x: 1, erase: true });
    expect(view?.cursor).toEqual({ x: 1, y: 0 });
    t.erase();
    expect(t.predictor.afterWrite()).toBe(true);
    expect(t.predictor.view()).toBeNull();
  });

  it('does not erase over the prompt', () => {
    const t = setup();
    t.write('$');
    t.predictor.input('\x7f');
    expect(t.predictor.view()).toBeNull();
  });

  it('removes an unechoed prediction on backspace', () => {
    const t = setup();
    t.predictor.input('c');
    t.predictor.input('d');
    t.predictor.input('\x7f');
    expect(t.predictor.view()?.chars.map((c) => c.ch)).toEqual(['c']);
  });
});
