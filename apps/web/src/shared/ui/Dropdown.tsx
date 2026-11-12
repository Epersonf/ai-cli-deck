import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { NARROW, nextActive, placePopover, type TypeAhead } from './dropdownLogic';
import { DropList, type DropOption } from './DropList';
import { ChevronIcon } from './ShapeIcons';

interface Props {
  /** The small-caps caption on the plate. */
  caption: string;
  value: string;
  options: readonly DropOption[];
  /** What the plate shows (defaults to the selected option's label). */
  valueText?: string;
  onChange(id: string): void;
  /** Extra content under the list, inside the same popover. */
  footer?: (close: () => void) => ReactNode;
}

/** A brass plate that opens a listbox under (or over) it; on a phone the same list is a bottom sheet. */
export function Dropdown({ caption, value, options, valueText, onChange, footer }: Props) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef<TypeAhead>({ text: '', at: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<CSSProperties>({});
  const [sheet, setSheet] = useState(false);
  const current = options.find((o) => o.id === value);
  const close = (): void => {
    setOpen(false);
    trigger.current?.focus();
  };
  const choose = (option: DropOption | undefined): void => {
    if (option) onChange(option.id);
    close();
  };

  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const narrow = window.innerWidth <= NARROW;
    setSheet(narrow);
    setPlace(narrow ? {} : placePopover(trigger.current));
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.id === value),
      ),
    );
    list.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  useEffect(() => {
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const onListKey = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      return choose(options[active]);
    }
    const next = nextActive(
      e,
      options.map((o) => o.label),
      active,
      typed,
    );
    if (next === null) return;
    if (e.key.length > 1) e.preventDefault();
    setActive(next);
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="plate"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        title={valueText ?? current?.title ?? current?.label}
        onClick={() => setOpen(!open)}
      >
        <span className="plate-text">
          <small>{caption}</small>
          <span>{valueText ?? current?.label ?? ''}</span>
        </span>
        <ChevronIcon size={14} open />
      </button>
      {open &&
        createPortal(
          <div className={`drop-backdrop${sheet ? ' sheet' : ''}`} onClick={close}>
            <div
              className={`drop-pop${sheet ? ' sheet' : ''}`}
              style={place}
              onClick={(e) => e.stopPropagation()}
            >
              <DropList
                id={id}
                listRef={list}
                caption={caption}
                options={options}
                value={value}
                active={active}
                onActive={setActive}
                onKeyDown={onListKey}
                onChoose={choose}
              />
              {footer?.(close)}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
