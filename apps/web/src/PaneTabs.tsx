import type { View } from './features/sessions/sessionsStore';
import { useT } from './shared/i18n/store';

interface Props {
  views: readonly View[];
  active: View;
  className: string;
  onSelect(view: View): void;
}

export function PaneTabs({ views, active, className, onSelect }: Props) {
  const t = useT();
  return (
    <nav className={className}>
      {views.map((view) => (
        <button
          key={view}
          type="button"
          className={view === active ? 'active' : ''}
          onClick={() => onSelect(view)}
        >
          {t(`nav.${view}`)}
        </button>
      ))}
    </nav>
  );
}
