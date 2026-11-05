import type { Session } from '@deck/shared';
import { useRef, type CSSProperties } from 'react';
import { PaneTabs } from './PaneTabs';
import { ChangesPanel } from './features/changes/ChangesPanel';
import { FilesPanel } from './features/files/FilesPanel';
import { useLayout } from './features/layout/layoutStore';
import { Splitter } from './features/layout/Splitter';
import { PreviewPanel } from './features/preview/PreviewPanel';
import { useSessions, type View } from './features/sessions/sessionsStore';
import { TerminalPane } from './features/terminal/TerminalPane';
import { useT } from './shared/i18n/store';
import { Gear } from './shared/ui/Gear';

interface Props {
  sessions: readonly Session[];
  activeId: string | null;
  wide: boolean;
  extraKeys: readonly string[] | null;
  showKeys: boolean;
  hasProfile: boolean;
  onNew(): void;
  onProfile(): void;
}

export function Workspace({
  sessions,
  activeId,
  wide,
  extraKeys,
  showKeys,
  hasProfile,
  onNew,
  onProfile,
}: Props) {
  const t = useT();
  const root = useRef<HTMLElement>(null);
  const view = useSessions((s) => s.view);
  const { layout, patch } = useLayout();
  const split = wide && layout.showRight && sessions.length > 0;

  const showing = (id: string, pane: View): boolean => {
    if (id !== activeId) return false;
    if (!wide) return view === pane;
    return pane === 'terminal' || (layout.showRight && layout.rightView === pane);
  };
  const columns: CSSProperties | undefined = split
    ? { gridTemplateColumns: `${layout.ratio}fr 10px ${1 - layout.ratio}fr` }
    : undefined;

  return (
    <main className={`workspace${split ? ' split' : ''}`} ref={root} style={columns}>
      <div className="col-left">
        {sessions.map((s) => (
          <TerminalPane
            key={s.id}
            sessionId={s.id}
            visible={showing(s.id, 'terminal')}
            extraKeys={extraKeys}
            showKeys={showKeys}
          />
        ))}
      </div>
      {split && (
        <Splitter
          container={root}
          ratio={layout.ratio}
          label={t('layout.resize')}
          onRatio={(ratio) => patch({ ratio })}
        />
      )}
      <div className="col-right">
        {split && (
          <div className="right-header">
            <PaneTabs
              views={['files', 'changes', 'preview']}
              active={layout.rightView}
              className="right-tabs"
              onSelect={(v) => patch({ rightView: v === 'terminal' ? 'files' : v })}
            />
            <button
              type="button"
              className="tool"
              aria-label={t('layout.closePanel')}
              title={t('layout.closePanel')}
              onClick={() => patch({ showRight: false })}
            >
              ✕
            </button>
          </div>
        )}
        {sessions.map((s) => (
          <FilesPanel key={`f${s.id}`} sessionId={s.id} visible={showing(s.id, 'files')} />
        ))}
        {sessions.map((s) => (
          <ChangesPanel key={`c${s.id}`} sessionId={s.id} visible={showing(s.id, 'changes')} />
        ))}
        {sessions.map((s) => (
          <PreviewPanel key={`p${s.id}`} sessionId={s.id} visible={showing(s.id, 'preview')} />
        ))}
      </div>
      {sessions.length === 0 && (
        <div className="welcome">
          <Gear size={96} teeth={14} className="spin" />
          <h1>Deck</h1>
          <p>{t('app.welcome')}</p>
          <button type="button" className="primary" onClick={hasProfile ? onNew : onProfile}>
            {hasProfile ? t('app.start') : t('switcher.newProfile')}
          </button>
        </div>
      )}
    </main>
  );
}
