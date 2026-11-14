import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

interface Props {
  /** The button's content (a gauge, an icon with a badge...). */
  label: ReactNode;
  title: string;
  className?: string;
  /** The panel was just opened. */
  onOpen?: () => void;
  children: ReactNode;
}

/** A header button that drops a brass panel under it; any click outside or Escape closes it. */
export function HeaderPopover({ label, title, className = '', onOpen, children }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<CSSProperties>();
  // Pin the panel under its button but keep it fully inside the viewport (the button can sit mid-header).
  useLayoutEffect(() => {
    if (!open) return;
    const place = (): void => {
      const btn = root.current?.getBoundingClientRect();
      const width = panel.current?.offsetWidth ?? 0;
      if (!btn) return;
      const margin = 8;
      const left = Math.max(
        margin,
        Math.min(btn.right - width, window.innerWidth - width - margin),
      );
      setPos({ position: 'fixed', top: btn.bottom + 6, left, right: 'auto' });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent): void => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', away);
    window.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', away);
      window.removeEventListener('keydown', key);
    };
  }, [open]);
  return (
    <div className={`header-pop ${className}`.trim()} ref={root}>
      <button
        type="button"
        className="header-pop-btn"
        title={title}
        aria-label={title}
        aria-expanded={open}
        onClick={() => {
          if (!open) onOpen?.();
          setOpen(!open);
        }}
      >
        {label}
      </button>
      {open && (
        <div className="header-pop-panel" ref={panel} style={pos}>
          {children}
        </div>
      )}
    </div>
  );
}
