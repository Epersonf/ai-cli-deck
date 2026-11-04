// @vitest-environment jsdom
import type { Terminal } from '@xterm/xterm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachTouchScroll, takeSteps } from './touchScroll';

function setup(mouse: 'none' | 'any', top = 100) {
  const element = document.createElement('div');
  const screen = document.createElement('div');
  screen.className = 'xterm-screen';
  element.append(screen);
  const wheels: number[] = [];
  screen.addEventListener('wheel', (e) => wheels.push((e as WheelEvent).deltaY));
  const buffer = { active: { viewportY: top } };
  const scrollLines = vi.fn((lines: number) => {
    buffer.active.viewportY = Math.max(0, buffer.active.viewportY + lines);
  });
  const term = {
    element,
    rows: 24,
    buffer,
    modes: { mouseTrackingMode: mouse },
    scrollLines,
  } as unknown as Terminal;
  attachTouchScroll(term, element);
  const touch = (type: string, y: number, at = 0): Event => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { touches: type === 'touchend' ? [] : [{ clientX: 10, clientY: y }] });
    Object.defineProperty(event, 'timeStamp', { value: at });
    element.dispatchEvent(event);
    return event;
  };
  return { touch, wheels, scrollLines, buffer };
}

/** Animation frames run by hand. */
function frames(): { run(max: number): number } {
  const queue: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => queue.push(callback));
  vi.stubGlobal('cancelAnimationFrame', () => queue.splice(0));
  return {
    run(max) {
      let now = performance.now();
      let ran = 0;
      while (queue.length > 0 && ran < max) {
        now += 16;
        queue.shift()?.(now);
        ran += 1;
      }
      return ran;
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('takeSteps', () => {
  it('counts whole steps and keeps the remainder', () => {
    expect(takeSteps(50, 18)).toEqual({ steps: 2, rest: 14 });
    expect(takeSteps(-50, 18)).toEqual({ steps: -2, rest: -14 });
    expect(takeSteps(10, 18)).toEqual({ steps: 0, rest: 10 });
  });
});

describe('touch scrolling', () => {
  it('turns a drag into wheel events when the program wants the mouse', () => {
    const { touch, wheels, scrollLines } = setup('any');
    touch('touchstart', 100);
    const move = touch('touchmove', 100 + 80); // finger down: older text, wheel up
    expect(move.defaultPrevented).toBe(true);
    expect(wheels).toEqual([-1, -1]);
    touch('touchmove', 100 + 80 - 50); // back up: wheel down
    expect(wheels.at(-1)).toBe(1);
    expect(scrollLines).not.toHaveBeenCalled();
  });

  it('scrolls the terminal itself when nothing asked for the mouse', () => {
    const { touch, wheels, scrollLines } = setup('none');
    touch('touchstart', 200);
    touch('touchmove', 200 - 40); // finger up: newer text
    expect(scrollLines).toHaveBeenCalledWith(2);
    expect(wheels).toEqual([]);
  });

  it('keeps going after a flick, slowing down until it stops', () => {
    const animation = frames();
    const { touch, scrollLines } = setup('none');
    touch('touchstart', 300, 0);
    touch('touchmove', 280, 10);
    touch('touchmove', 260, 20);
    touch('touchend', 260, 25);
    const dragged = scrollLines.mock.calls.length;
    expect(animation.run(500)).toBeLessThan(500); // it stops by itself
    expect(scrollLines.mock.calls.length).toBeGreaterThan(dragged + 5);
  });

  it('stops a flick at the top, and a finger that rested before lifting does not flick', () => {
    const animation = frames();
    const { touch, scrollLines, buffer } = setup('none', 3);
    touch('touchstart', 100, 0);
    touch('touchmove', 140, 10);
    touch('touchend', 140, 15);
    animation.run(500);
    expect(buffer.active.viewportY).toBe(0);
    const calls = scrollLines.mock.calls.length;
    touch('touchstart', 100, 1000);
    touch('touchmove', 140, 1010);
    touch('touchend', 140, 1300);
    expect(animation.run(500)).toBe(0);
    expect(scrollLines.mock.calls.length).toBe(calls + 1);
  });

  it('leaves a tap alone so it still focuses the terminal', () => {
    const { touch, wheels, scrollLines } = setup('any');
    touch('touchstart', 100);
    const move = touch('touchmove', 103);
    expect(move.defaultPrevented).toBe(false);
    expect(wheels).toEqual([]);
    expect(scrollLines).not.toHaveBeenCalled();
  });
});
