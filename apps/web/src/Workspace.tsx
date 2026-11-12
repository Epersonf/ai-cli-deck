import type { Session } from '@deck/shared';
import { useRef, type CSSProperties } from 'react';
import { PaneTabs } from './PaneTabs';
import { ChatPane } from './features/chat/ChatPane';
import { ChangesPanel } from './features/changes/ChangesPanel';
import { FilesPanel } from './features/files/FilesPanel';
import { useLayout } from './features/layout/layoutStore';
import { Splitter } from './features/layout/Splitter';
import { SidePane } from './features/side/SidePane';
import { PreviewPanel } from './features/preview/PreviewPanel';
import { useSessions, type View } from './features/sessions/sessionsStore';
import { useT } from './shared/i18n/store';
import { Gear } from './shared/ui/Gear';
import { CloseIcon } from './shared/ui/ToolIcons';

interface Props {
  sessions: readonly Session[];
  activeId: string | null;
  wide: boolean;
  hasProfile: boolean;
  onNew(): void;
  onProfile(): void;
}

export function Workspace({ sessions, activeId, wide, hasProfile, onNew, onProfile }: Props) {
  const t = useT();
  const root = useRef<HTMLElement>(null);
  const view = useSessions((s) => s.view);
  const { layout, patch } = useLayout();
  const split = wide && layout.showRight && sessions.length > 0;
  const children = sessions.filter((s) => s.parentId !== null);
  const mains = sessions.filter((s) => s.parentId === null);

  const showing = (id: string, pane: View): boolean => {
    if (id !== activeId) return false;
    if (!wide) return view === pane;
    return pane === 'chat' || (layout.showRight && layout.rightView === pane);
  };
  const columns: CSSProperties | undefined = split
    ? { gridTemplateColumns: `${layout.ratio}fr 10px ${1 - layout.ratio}fr` }
    : undefined;

  return (
    <main className={`workspace${split ? ' split' : ''}`} ref={root} style={columns}>
      <div className="col-left">
        {mains.map((s) => (
          <ChatPane key={s.id} sessionId={s.id} visible={showing(s.id, 'chat')} />
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
              onSelect={(v) => patch({ rightView: v === 'chat' ? 'files' : v })}
            />
            <button
              type="button"
              className="tool"
              aria-label={t('layout.closePanel')}
              title={t('layout.closePanel')}
              onClick={() => patch({ showRight: false })}
            >
              <CloseIcon size={16} />
            </button>
          </div>
        )}
        {mains.map((s) => (
          <FilesPanel key={`f${s.id}`} sessionId={s.id} visible={showing(s.id, 'files')} />
        ))}
        {mains.map((s) => (
          <ChangesPanel key={`c${s.id}`} sessionId={s.id} visible={showing(s.id, 'changes')} />
        ))}
        {mains.map((s) => (
          <PreviewPanel key={`p${s.id}`} sessionId={s.id} visible={showing(s.id, 'preview')} />
        ))}
      </div>
      {children.map((child) => (
        <SidePane key={child.id} child={child} parentActive={child.parentId === activeId} />
      ))}
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
