import type { Terminal } from '@xterm/xterm';

const LINE_PX = 18;

/** Wheel movement in text lines, whatever unit the browser reports it in. */
export function wheelLines(event: Pick<WheelEvent, 'deltaY' | 'deltaMode'>, rows: number): number {
  if (event.deltaMode === 1) return event.deltaY; // lines
  if (event.deltaMode === 2) return event.deltaY * rows; // pages
  return event.deltaY / LINE_PX; // pixels
}

/**
 * Many CLIs ask the terminal for mouse events. xterm then forwards every wheel turn to them and the
 * scrollback stops scrolling, so the wheel looks dead. On the normal screen the wheel is for reading
 * back, so scroll the history ourselves; full-screen (alternate screen) programs keep getting it.
 */
export function attachWheelScroll(term: Terminal): void {
  let rest = 0;
  term.attachCustomWheelEventHandler((event) => {
    if (term.buffer.active.type === 'alternate') return true;
    if (term.modes.mouseTrackingMode === 'none') return true; // xterm already scrolls
    event.preventDefault();
    rest += wheelLines(event, term.rows);
    const whole = Math.trunc(rest);
    rest -= whole;
    if (whole !== 0) term.scrollLines(whole);
    return false;
  });
}
