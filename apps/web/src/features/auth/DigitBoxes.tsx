import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import {
  backspace,
  DIGITS,
  isComplete,
  joinBoxes,
  moveFocus,
  pasteDigits,
  toBoxes,
  typeDigit,
  type BoxEdit,
} from './boxEdits';

interface Props {
  /** The code typed so far; set it to '' to clear the boxes. */
  value: string;
  onChange(value: string): void;
  /** Called as soon as the sixth digit is in (typed or pasted). */
  onComplete?(code: string): void;
  disabled?: boolean | undefined;
  /** A wrong code: red boxes and a small shake. */
  invalid?: boolean | undefined;
  autoFocus?: boolean | undefined;
  label: string;
}

/** Six separate digit boxes: paste fills them all, backspace and arrows move, digits only. */
export function DigitBoxes({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  autoFocus,
  label,
}: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [boxes, setBoxes] = useState(() => toBoxes(value));
  useEffect(() => {
    if (value === '') setBoxes(toBoxes(''));
  }, [value]);
  useEffect(() => {
    if (autoFocus && !disabled) refs.current[0]?.focus();
  }, [autoFocus, disabled]);

  const apply = (edit: BoxEdit): void => {
    setBoxes(edit.boxes);
    const code = joinBoxes(edit.boxes);
    onChange(code);
    refs.current[edit.focus]?.focus();
    if (isComplete(edit.boxes)) onComplete?.(code);
  };
  const onKey = (event: KeyboardEvent, at: number): void => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      return apply(backspace(boxes, at));
    }
    const to = moveFocus(at, event.key);
    if (to !== at) {
      event.preventDefault();
      refs.current[to]?.focus();
    }
  };
  const onPaste = (event: ClipboardEvent, at: number): void => {
    event.preventDefault();
    apply(pasteDigits(boxes, at, event.clipboardData.getData('text')));
  };

  return (
    <div className={`code-boxes${invalid ? ' invalid' : ''}`} role="group" aria-label={label}>
      {Array.from({ length: DIGITS }, (_, at) => (
        <input
          key={at}
          ref={(el) => void (refs.current[at] = el)}
          value={boxes[at] ?? ''}
          className={boxes[at] ? 'filled' : undefined}
          disabled={disabled}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label={`${label} ${at + 1}`}
          onChange={(e) =>
            apply(
              e.target.value.replace(/\D/g, '').length > 1
                ? pasteDigits(boxes, at, e.target.value)
                : typeDigit(boxes, at, e.target.value),
            )
          }
          onKeyDown={(e) => onKey(e, at)}
          onPaste={(e) => onPaste(e, at)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
