// @vitest-environment jsdom
import type { Terminal } from '@xterm/xterm';
import { describe, expect, it, vi } from 'vitest';
import { attachTouchScroll, takeSteps } from './touchScroll';

function setup(mouse: 'none' | 'any') {
  const element = document.createElement('div');
  const screen = document.createElement('div');
  screen.className = 'xterm-screen';
  element.append(screen);
  const wheels: number[] = [];
  screen.addEventListener('wheel', (e) => wheels.push((e as WheelEvent).deltaY));
  const scrollLines = vi.fn();
  const term = {
    element,
    modes: { mouseTrackingMode: mouse },
    scrollLines,
  } as unknown as Terminal;
  attachTouchScroll(term, element);
  const touch = (type: string, y: number): Event => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { touches: [{ clientX: 10, clientY: y }] });
    element.dispatchEvent(event);
    return event;
  };
  return { touch, wheels, scrollLines };
}

describe('takeSteps', () => {
  it('counts whole steps and keeps the remainder', () => {
    expect(takeSteps(50, 18)).toEqual({ steps: 2, rest: 14 });
    expect(takeSteps(-50, 18)).toEqual({ steps: -2, rest: -14 });
    expect(takeSteps(10, 18)).toEqual({ steps: 0, rest: 10 });
  });
});

describe('touch scrolling', () => {
  it('turns a drag into wheel events when a program or tmux wants the mouse', () => {
    const { touch, wheels, scrollLines } = setup('any');
    touch('touchstart', 100);
    const move = touch('touchmove', 100 + 80); // finger down: older text, wheel up
    expect(move.defaultPrevented).toBe(true);
    expect(wheels).toEqual([-1, -1]);
    touch('touchmove', 100 + 80 - 50); // back up: wheel down
    expect(wheels.at(-1)).toBe(1);
    expect(scrollLines).not.toHaveBeenCalled();
  });

  it('scrolls the screen itself when nothing asked for the mouse', () => {
    const { touch, wheels, scrollLines } = setup('none');
    touch('touchstart', 200);
    touch('touchmove', 200 - 40); // finger up: newer text
    expect(scrollLines).toHaveBeenCalledWith(2);
    expect(wheels).toEqual([]);
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
