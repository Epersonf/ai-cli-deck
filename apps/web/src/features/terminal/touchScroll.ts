import type { Terminal } from '@xterm/xterm';

/** Finger travel that counts as a drag rather than a tap. */
const SLOP_PX = 8;
/** Finger travel for one wheel notch sent to a program, in text lines (programs scroll several per notch). */
const LINES_PER_NOTCH = 2;
/** After a flick the text keeps moving and keeps this share of its speed every 16 ms... */
const FRICTION = 0.95;
/** ...until it is slower than this, in pixels per millisecond. */
const STOP_SPEED = 0.03;
/** A finger that rested this long before lifting means "stop here", not a flick. */
const FLICK_WINDOW_MS = 80;

/** Whole steps in `travel`, and what is left over for the next move. */
export function takeSteps(travel: number, step: number): { steps: number; rest: number } {
  const steps = Math.trunc(travel / step);
  return { steps, rest: travel - steps * step };
}

/** Height of one text line on screen, in CSS pixels. */
function lineHeight(term: Terminal): number {
  const screen = term.element?.querySelector('.xterm-screen');
  const height = screen instanceof HTMLElement ? screen.clientHeight : 0;
  return height > 0 && term.rows > 0 ? height / term.rows : 18;
}

/**
 * Dragging a finger scrolls the terminal like a native list: the text follows the finger and a flick keeps
 * going, slowing down (xterm has no touch scrolling of its own). When the program asked for mouse events (a
 * full-screen app), the drag becomes the wheel events a mouse would send, so the program scrolls instead.
 * A tap (no drag) is left alone, so it still focuses the terminal and raises the keyboard.
 */
export function attachTouchScroll(term: Terminal, element: HTMLElement): () => void {
  let lastY = 0;
  let lastAt = 0;
  let travelled = 0;
  let rest = 0;
  let speed = 0; // pixels per millisecond, finger moving down = positive
  let dragging = false;
  let frame = 0;
  const point = { x: 0, y: 0 };

  const wantsMouse = (): boolean => term.modes.mouseTrackingMode !== 'none';
  const stopFlick = (): void => {
    cancelAnimationFrame(frame);
    frame = 0;
  };

  const sendWheel = (up: boolean): void => {
    const screen = term.element?.querySelector('.xterm-screen') ?? element;
    screen.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: up ? -1 : 1,
        deltaMode: 1, // lines
        clientX: point.x,
        clientY: point.y,
        bubbles: true,
        cancelable: true,
      }),
    );
  };

  /** Scrolls by `dy` pixels of finger travel (down = older text); false once it hits the top or bottom. */
  const scrollBy = (dy: number): boolean => {
    const wheel = wantsMouse();
    const moved = takeSteps(rest + dy, lineHeight(term) * (wheel ? LINES_PER_NOTCH : 1));
    rest = moved.rest;
    if (moved.steps === 0) return true;
    if (wheel) {
      for (let i = 0; i < Math.abs(moved.steps); i += 1) sendWheel(moved.steps > 0);
      return true;
    }
    const before = term.buffer.active.viewportY;
    term.scrollLines(-moved.steps);
    return term.buffer.active.viewportY !== before;
  };

  const flick = (): void => {
    let at = performance.now();
    const step = (now: number): void => {
      const dt = Math.min(now - at, 64);
      at = now;
      speed *= FRICTION ** (dt / 16);
      if (Math.abs(speed) < STOP_SPEED || !scrollBy(speed * dt)) return stopFlick();
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  };

  const onStart = (event: TouchEvent): void => {
    stopFlick();
    const touch = event.touches[0];
    if (event.touches.length !== 1 || !touch) return;
    lastY = touch.clientY;
    lastAt = event.timeStamp;
    travelled = 0;
    rest = 0;
    speed = 0;
    dragging = false;
  };

  const onMove = (event: TouchEvent): void => {
    const touch = event.touches[0];
    if (event.touches.length !== 1 || !touch) return;
    const dy = touch.clientY - lastY;
    const dt = event.timeStamp - lastAt;
    lastY = touch.clientY;
    lastAt = event.timeStamp;
    if (dt > 0) speed = 0.8 * (dy / dt) + 0.2 * speed;
    travelled += Math.abs(dy);
    if (!dragging && travelled < SLOP_PX) return;
    dragging = true;
    event.preventDefault();
    point.x = touch.clientX;
    point.y = touch.clientY;
    scrollBy(dy);
  };

  const onEnd = (event: TouchEvent): void => {
    const fresh = event.timeStamp - lastAt < FLICK_WINDOW_MS;
    if (dragging && fresh && !wantsMouse() && Math.abs(speed) > STOP_SPEED * 4) flick();
    dragging = false;
  };

  element.addEventListener('touchstart', onStart, { passive: true });
  element.addEventListener('touchmove', onMove, { passive: false });
  element.addEventListener('touchend', onEnd, { passive: true });
  element.addEventListener('touchcancel', stopFlick, { passive: true });
  return () => {
    stopFlick();
    element.removeEventListener('touchstart', onStart);
    element.removeEventListener('touchmove', onMove);
    element.removeEventListener('touchend', onEnd);
    element.removeEventListener('touchcancel', stopFlick);
  };
}
