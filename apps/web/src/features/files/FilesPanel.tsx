import { useState } from 'react';
import { useT } from '../../shared/i18n/store';
import { useSessions } from '../sessions/sessionsStore';
import { FileTree } from './FileTree';
import { FileViewer } from './FileViewer';

interface Props {
  sessionId: string;
  visible: boolean;
}

interface Explorer {
  id: number;
  dir: string;
  selected: string | null;
}

/** Several explorer tabs per session, each with its own folder and open file. */
export function FilesPanel({ sessionId, visible }: Props) {
  const t = useT();
  const cwd = useSessions((s) => s.sessions.find((x) => x.id === sessionId)?.cwd ?? '');
  const [tabs, setTabs] = useState<Explorer[]>([{ id: 1, dir: '', selected: null }]);
  const [activeId, setActiveId] = useState(1);
  const active = tabs.find((x) => x.id === activeId) ?? tabs[0];
  if (!active) return null;

  const patch = (change: Partial<Explorer>): void =>
    setTabs(tabs.map((x) => (x.id === active.id ? { ...x, ...change } : x)));
  const add = (): void => {
    const id = Math.max(...tabs.map((x) => x.id)) + 1;
    setTabs([...tabs, { id, dir: active.dir, selected: null }]);
    setActiveId(id);
  };
  const close = (id: number): void => {
    const rest = tabs.filter((x) => x.id !== id);
    setTabs(rest);
    if (id === activeId) setActiveId(rest[0]?.id ?? 1);
  };

  return (
    <section
      className={`pane files-pane${visible ? '' : ' hidden'}${active.selected ? ' has-selection' : ''}`}
    >
      <div className="explorer-tabs">
        {tabs.map((tab, index) => (
          <span key={tab.id} className={`explorer-tab${tab.id === active.id ? ' active' : ''}`}>
            <button type="button" onClick={() => setActiveId(tab.id)}>
              {tab.dir.split('/').pop() || `${index + 1}`}
            </button>
            {tabs.length > 1 && (
              <button
                type="button"
                aria-label={t('files.closeExplorer')}
                onClick={() => close(tab.id)}
              >
                ×
              </button>
            )}
          </span>
        ))}
        <button
          type="button"
          title={t('files.newExplorer')}
          aria-label={t('files.newExplorer')}
          onClick={add}
        >
          +
        </button>
      </div>
      <FileTree
        key={active.id}
        sessionId={sessionId}
        cwd={cwd}
        dir={active.dir}
        selected={active.selected}
        onDir={(dir) => patch({ dir })}
        onOpen={(selected) => patch({ selected })}
      />
      {active.selected !== null ? (
        <FileViewer
          sessionId={sessionId}
          path={active.selected}
          onClose={() => patch({ selected: null })}
        />
      ) : (
        <p className="empty viewer-placeholder">{t('files.pick')}</p>
      )}
    </section>
  );
}
