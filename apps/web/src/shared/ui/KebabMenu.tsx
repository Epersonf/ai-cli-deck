import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from '../i18n/store';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  onSelect(): void;
}

interface Props {
  items: MenuItem[];
}

/** A "⋮" button that opens a small popover of actions. */
export function KebabMenu({ items }: Props) {
  const t = useT();
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const close = (): void => setPos(null);

  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pos]);

  const toggle = (): void => {
    if (pos || !button.current) return close();
    const rect = button.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        className="close kebab"
        title={t('menu.more')}
        aria-label={t('menu.more')}
        aria-haspopup="menu"
        aria-expanded={pos !== null}
        onClick={toggle}
      >
        <svg width="18" height="18" viewBox="0 0 100 100" aria-hidden fill="currentColor">
          <circle cx="50" cy="20" r="9" />
          <circle cx="50" cy="50" r="9" />
          <circle cx="50" cy="80" r="9" />
        </svg>
      </button>
      {pos && (
        <div className="menu-backdrop" onClick={close}>
          <div
            className="menu-pop"
            role="menu"
            style={{ top: pos.top, right: pos.right }}
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={item.danger ? 'danger' : undefined}
                onClick={() => (close(), item.onSelect())}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
