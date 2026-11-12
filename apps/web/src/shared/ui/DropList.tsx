import type { KeyboardEvent, RefObject } from 'react';
import { CheckIcon } from './ShapeIcons';

export interface DropOption {
  id: string;
  label: string;
  /** A second, smaller line under the label. */
  description?: string | null;
  /** A small tag at the right ("default"). */
  tag?: string;
  /** The full text, for a tooltip when the row is cut short. */
  title?: string;
}

interface Props {
  id: string;
  listRef: RefObject<HTMLUListElement | null>;
  caption: string;
  options: readonly DropOption[];
  value: string;
  active: number;
  onActive(index: number): void;
  onKeyDown(e: KeyboardEvent): void;
  onChoose(option: DropOption): void;
}

/** The rows of a dropdown: a check on the selected one, label over a quieter description, an optional tag. */
export function DropList({
  id,
  listRef,
  caption,
  options,
  value,
  active,
  onActive,
  onKeyDown,
  onChoose,
}: Props) {
  return (
    <ul
      id={id}
      ref={listRef}
      role="listbox"
      tabIndex={0}
      aria-label={caption}
      aria-activedescendant={`${id}-${active}`}
      className="drop-list"
      onKeyDown={onKeyDown}
    >
      {options.map((o, i) => (
        <li
          key={o.id}
          id={`${id}-${i}`}
          role="option"
          aria-selected={o.id === value}
          data-active={i === active}
          className={`drop-row${o.id === value ? ' on' : ''}${i === active ? ' active' : ''}`}
          title={o.title ?? o.label}
          onMouseEnter={() => onActive(i)}
          onClick={() => onChoose(o)}
        >
          <span className="drop-check">{o.id === value && <CheckIcon size={14} />}</span>
          <span className="drop-text">
            <span className="drop-label">{o.label}</span>
            {o.description ? <small>{o.description}</small> : null}
          </span>
          {o.tag !== undefined && <small className="drop-tag">{o.tag}</small>}
        </li>
      ))}
    </ul>
  );
}
