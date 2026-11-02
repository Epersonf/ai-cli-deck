import { useRef, type PointerEvent } from 'react';

interface Props {
  label: string;
  active?: boolean;
  locked?: boolean;
  repeat?: boolean;
  onPress(): void;
}

const REPEAT_DELAY_MS = 380;
const REPEAT_EVERY_MS = 70;

/** A key that never steals focus from the terminal and repeats while held. */
export function KeyButton({
  label,
  active = false,
  locked = false,
  repeat = false,
  onPress,
}: Props) {
  const timers = useRef<{ delay?: number; interval?: number }>({});

  const stop = (): void => {
    window.clearTimeout(timers.current.delay);
    window.clearInterval(timers.current.interval);
  };

  const start = (event: PointerEvent): void => {
    event.preventDefault();
    stop();
    onPress();
    if (!repeat) return;
    timers.current.delay = window.setTimeout(() => {
      timers.current.interval = window.setInterval(onPress, REPEAT_EVERY_MS);
    }, REPEAT_DELAY_MS);
  };

  const classes = ['key', active ? 'active' : '', locked ? 'locked' : ''].join(' ').trim();
  return (
    <button
      type="button"
      tabIndex={-1}
      className={classes}
      aria-pressed={active}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      onMouseDown={(event) => event.preventDefault()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {label}
    </button>
  );
}
