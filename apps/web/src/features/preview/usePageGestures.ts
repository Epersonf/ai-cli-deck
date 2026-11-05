import type { BrowserClientMessage } from '@deck/shared';
import { useRef, type PointerEvent, type WheelEvent } from 'react';

/** A finger that moves less than this is a tap. */
const TAP_SLOP = 8;

interface Box {
  /** Page pixels per screen pixel. */
  scale: number;
  left: number;
  top: number;
}

/**
 * Touch and mouse on the live picture: a tap clicks there, a drag scrolls the page like a phone does
 * (the content follows the finger), the wheel scrolls. Scroll steps are merged into one per frame.
 */
export function usePageGestures(
  box: () => Box | null,
  send: (message: BrowserClientMessage) => void,
) {
  const start = useRef<{
    x: number;
    y: number;
    lastX: number;
    lastY: number;
    moved: boolean;
  } | null>(null);
  const pending = useRef({ dx: 0, dy: 0, frame: 0 });

  const scroll = (dx: number, dy: number): void => {
    const step = pending.current;
    step.dx += dx;
    step.dy += dy;
    if (step.frame !== 0) return;
    step.frame = requestAnimationFrame(() => {
      send({ kind: 'scroll', dx: Math.round(step.dx), dy: Math.round(step.dy) });
      pending.current = { dx: 0, dy: 0, frame: 0 };
    });
  };

  return {
    onPointerDown(event: PointerEvent<HTMLElement>): void {
      event.currentTarget.setPointerCapture(event.pointerId);
      const { clientX: x, clientY: y } = event;
      start.current = { x, y, lastX: x, lastY: y, moved: false };
    },
    onPointerMove(event: PointerEvent<HTMLElement>): void {
      const touch = start.current;
      const b = box();
      if (!touch || !b) return;
      const { clientX: x, clientY: y } = event;
      if (!touch.moved && Math.hypot(x - touch.x, y - touch.y) < TAP_SLOP) return;
      touch.moved = true;
      scroll((touch.lastX - x) * b.scale, (touch.lastY - y) * b.scale);
      touch.lastX = x;
      touch.lastY = y;
    },
    onPointerUp(event: PointerEvent<HTMLElement>): void {
      const touch = start.current;
      start.current = null;
      const b = box();
      if (!touch || touch.moved || !b) return;
      send({
        kind: 'click',
        x: Math.max(0, (event.clientX - b.left) * b.scale),
        y: Math.max(0, (event.clientY - b.top) * b.scale),
      });
    },
    onPointerCancel(): void {
      start.current = null;
    },
    onWheel(event: WheelEvent<HTMLElement>): void {
      const b = box();
      if (b) scroll(event.deltaX * b.scale, event.deltaY * b.scale);
    },
  };
}
