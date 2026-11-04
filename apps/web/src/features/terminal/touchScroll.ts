import type { Terminal } from '@xterm/xterm';

/** Finger travel that counts as a drag rather than a tap. */
const SLOP_PX = 8;
/** Finger travel for one text line when the screen scrolls by itself. */
const LINE_PX = 18;
/** Finger travel for one wheel notch sent to a program or tmux (they scroll several lines per notch). */
const NOTCH_PX = 36;

/** Whole steps in `travel`, and what is left over for the next move. */
export function takeSteps(travel: number, step: number): { steps: number; rest: number } {
  const steps = Math.trunc(travel / step);
  return { steps, rest: travel - steps * step };
}

/**
 * Dragging a finger on the terminal scrolls it. A phone has no wheel, so a program (or tmux) that asked for
 * mouse events never sees a scroll: here a drag is turned into the same wheel events a mouse would make, and
 * xterm encodes them for whatever mouse protocol is in use. Without mouse events the screen's own scrollback
 * moves. A tap (no drag) is left alone, so it still focuses the terminal and raises the keyboard.
 */
export function attachTouchScroll(term: Terminal, element: HTMLElement): () => void {
  let lastY = 0;
  let travelled = 0;
  let rest = 0;
  let dragging = false;

  const onStart = (event: TouchEvent): void => {
    const touch = event.touches[0];
    if (event.touches.length !== 1 || !touch) return;
    lastY = touch.clientY;
    travelled = 0;
    rest = 0;
    dragging = false;
  };

  const sendWheel = (up: boolean, touch: Touch): void => {
    const screen = term.element?.querySelector('.xterm-screen') ?? element;
    screen.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: up ? -1 : 1,
        deltaMode: 1, // lines
        clientX: touch.clientX,
        clientY: touch.clientY,
        bubbles: true,
        cancelable: true,
      }),
    );
  };

  const onMove = (event: TouchEvent): void => {
    const touch = event.touches[0];
    if (event.touches.length !== 1 || !touch) return;
    const dy = touch.clientY - lastY;
    lastY = touch.clientY;
    travelled += Math.abs(dy);
    if (!dragging && travelled < SLOP_PX) return;
    dragging = true;
    event.preventDefault();
    const mouse = term.modes.mouseTrackingMode !== 'none';
    const moved = takeSteps(rest + dy, mouse ? NOTCH_PX : LINE_PX);
    rest = moved.rest;
    if (moved.steps === 0) return;
    // Finger down = older text = wheel up.
    if (mouse) for (let i = 0; i < Math.abs(moved.steps); i += 1) sendWheel(moved.steps > 0, touch);
    else term.scrollLines(-moved.steps);
  };

  element.addEventListener('touchstart', onStart, { passive: true });
  element.addEventListener('touchmove', onMove, { passive: false });
  return () => {
    element.removeEventListener('touchstart', onStart);
    element.removeEventListener('touchmove', onMove);
  };
}
