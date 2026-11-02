import { useSessions, type View } from './features/sessions/sessionsStore';

const LABELS: Record<View, string> = { terminal: 'Console', files: 'Archive', preview: 'Viewport' };

export function PaneTabs({ views, className }: { views: readonly View[]; className: string }) {
  const { view, setView } = useSessions();
  return (
    <nav className={className}>
      {views.map((v) => (
        <button
          key={v}
          type="button"
          className={v === view ? 'active' : ''}
          onClick={() => setView(v)}
        >
          {LABELS[v]}
        </button>
      ))}
    </nav>
  );
}
