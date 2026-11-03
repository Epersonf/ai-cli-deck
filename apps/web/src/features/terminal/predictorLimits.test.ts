import { describe, expect, it } from 'vitest';
import { setup, typeAndEcho } from './predictorFixture';

describe('createPredictor limits', () => {
  it('stays off on the alternate screen and while scrolled back', () => {
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
});
