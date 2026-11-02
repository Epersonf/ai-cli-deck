import { useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { clampRatio } from './layoutPreference';

interface Props {
  container: RefObject<HTMLElement | null>;
  ratio: number;
  label: string;
  onRatio(ratio: number): void;
}

const KEY_STEP = 0.03;

/** Draggable (and keyboard-adjustable) divider between the terminal and the side panel. */
export function Splitter({ container, ratio, label, onRatio }: Props) {
  const [dragging, setDragging] = useState(false);

  const move = (event: PointerEvent<HTMLDivElement>): void => {
    const rect = container.current?.getBoundingClientRect();
    if (!dragging || !rect || rect.width === 0) return;
    onRatio(clampRatio((event.clientX - rect.left) / rect.width));
  };
  const key = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowLeft') onRatio(clampRatio(ratio - KEY_STEP));
    if (event.key === 'ArrowRight') onRatio(clampRatio(ratio + KEY_STEP));
  };

  return (
    <div
      className={`splitter${dragging ? ' dragging' : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(ratio * 100)}
      tabIndex={0}
      title={label}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      }}
      onPointerMove={move}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onKeyDown={key}
    />
  );
}
