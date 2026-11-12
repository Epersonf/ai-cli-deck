import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  /** The button's content (a gauge, an icon with a badge...). */
  label: ReactNode;
  title: string;
  className?: string;
  children: ReactNode;
}

/** A header button that drops a brass panel under it; any click outside or Escape closes it. */
export function HeaderPopover({ label, title, className = '', children }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
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
        onClick={() => setOpen(!open)}
      >
        {label}
      </button>
      {open && <div className="header-pop-panel">{children}</div>}
    </div>
  );
}
