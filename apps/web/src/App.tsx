import { useCallback, useEffect, useState } from 'react';
import type { PublicConfig } from '@deck/shared';
import { PaneTabs } from './PaneTabs';
import { ApprovalsBadge } from './features/approvals/ApprovalsBadge';
import { ApprovalsPanel } from './features/approvals/ApprovalsPanel';
import { useApprovals } from './features/approvals/approvalsStore';
import { LoginScreen } from './features/auth/LoginScreen';
import { SettingsDialog } from './features/settings/SettingsDialog';
import { FilesPanel } from './features/files/FilesPanel';
import { PreviewPanel } from './features/preview/PreviewPanel';
import { NewSessionDialog } from './features/sessions/NewSessionDialog';
import { SessionTabs } from './features/sessions/SessionTabs';
import { useSessions } from './features/sessions/sessionsStore';
import { TerminalPane } from './features/terminal/TerminalPane';
import { keysVisible, loadMode, saveMode, type KeysMode } from './features/terminal/keysPreference';
import { api } from './shared/api/endpoints';
import { onUnauthorized } from './shared/api/unauthorized';
import { Gear } from './shared/ui/Gear';
import { useMediaQuery } from './shared/ui/useMediaQuery';
import { usePolling } from './shared/ui/usePolling';

type Dialog = 'new' | 'settings' | null;
type Pane = 'terminal' | 'files' | 'preview';

export function App() {
  const { sessions, activeId, view } = useSessions();
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [locked, setLocked] = useState(false);
  const [keysMode, setKeysMode] = useState(loadMode);
  const [rightView, setRightView] = useState<'files' | 'preview'>('files');
  const wide = useMediaQuery('(min-width: 1000px)');
  const touch = useMediaQuery('(pointer: coarse)');

  const reload = useCallback(() => {
    api
      .config()
      .then((c) => (setConfig(c), setLocked(false)))
      .catch(() => undefined);
    void useSessions
      .getState()
      .refresh()
      .catch(() => undefined);
  }, []);

  useEffect(() => onUnauthorized(() => setLocked(true)), []);
  useEffect(reload, [reload]);
  useEffect(() => {
    if (view !== 'terminal') setRightView(view);
  }, [view]);
  usePolling(() => (locked ? Promise.resolve() : useSessions.getState().refresh()), 5000);
  usePolling(() => (locked ? Promise.resolve() : useApprovals.getState().refresh()), 3000);

  if (locked) return <LoginScreen onDone={reload} />;

  const showing = (id: string, pane: Pane): boolean => {
    if (id !== activeId) return false;
    return wide ? pane === 'terminal' || rightView === pane : view === pane;
  };
  const changeKeys = (mode: KeysMode): void => {
    saveMode(mode);
    setKeysMode(mode);
  };

  return (
    <div className={`app${wide ? ' wide' : ''}`}>
      <header className="topbar">
        <span className="brand">
          <Gear size={24} className="spin" />
          <strong>Deck</strong>
        </span>
        <SessionTabs onNew={() => setDialog('new')} />
        <button
          type="button"
          className="tool"
          onClick={() => setDialog('settings')}
          title="Settings"
        >
          ⚙
        </button>
        <ApprovalsBadge />
      </header>
      {wide && <PaneTabs views={['files', 'preview']} className="right-tabs" />}
      <main className="workspace">
        <div className="col-left">
          {sessions.map((s) => (
            <TerminalPane
              key={s.id}
              sessionId={s.id}
              visible={showing(s.id, 'terminal')}
              extraKeys={config?.extraKeys ?? null}
              showKeys={keysVisible(keysMode, touch)}
            />
          ))}
        </div>
        <div className="col-right">
          {sessions.map((s) => (
            <FilesPanel key={`f${s.id}`} sessionId={s.id} visible={showing(s.id, 'files')} />
          ))}
          {sessions.map((s) => (
            <PreviewPanel key={`p${s.id}`} sessionId={s.id} visible={showing(s.id, 'preview')} />
          ))}
        </div>
        {sessions.length === 0 && (
          <div className="welcome">
            <Gear size={96} teeth={14} className="spin" />
            <h1>Deck</h1>
            <p>Run any AI CLI in a real terminal, with files and a live preview beside it.</p>
            <button type="button" className="primary" onClick={() => setDialog('new')}>
              Start a session
            </button>
          </div>
        )}
      </main>
      {!wide && sessions.length > 0 && (
        <PaneTabs views={['terminal', 'files', 'preview']} className="bottom-nav" />
      )}
      {dialog === 'new' && (
        <NewSessionDialog defaultCwd={config?.defaultCwd ?? null} onClose={() => setDialog(null)} />
      )}
      {dialog === 'settings' && (
        <SettingsDialog
          keysMode={keysMode}
          touchScreen={touch}
          onKeysChange={changeKeys}
          onClose={() => setDialog(null)}
        />
      )}
      <ApprovalsPanel />
    </div>
  );
}
