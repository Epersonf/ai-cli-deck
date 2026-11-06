import { describe, expect, it } from 'vitest';
import { setup, typeAndEcho } from './predictorFixture';

describe('createPredictor limits', () => {
  it('stays off while scrolled back, and on a new full-screen program until it echoes', () => {
    const t = setup();
    typeAndEcho(t, 'a');
    typeAndEcho(t, 'b');
    t.state.alt = true;
    t.predictor.input('c');
    expect(t.predictor.view()).toBeNull();
    t.state.alt = false;
    t.state.bottom = false;
    t.predictor.input('d');
    expect(t.predictor.view()).toBeNull();
  });

  it('stops before the line wraps', () => {
    const t = setup();
    typeAndEcho(t, 'a');
    typeAndEcho(t, 'b');
    t.state.x = 17;
    t.predictor.input('x');
    t.predictor.input('y');
    t.predictor.input('z');
    expect((t.predictor.view()?.chars ?? []).every((c) => c.x < 19)).toBe(true);
  });

  it('keeps trusting the echo when it lands on another row (a wrapped line)', () => {
    const t = setup();
    t.predictor.input('a');
    t.state.y = 1; // the program wrapped the line and echoed there
    t.state.x = 0;
    t.echo('a');
    expect(t.predictor.afterWrite()).toBe(true);
    t.predictor.input('b');
    expect(t.predictor.view()?.chars.map((c) => c.ch)).toEqual(['b']);
  });
});
