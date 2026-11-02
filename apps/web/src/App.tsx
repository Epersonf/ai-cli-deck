import { useCallback, useEffect, useState } from 'react';
import type { PublicConfig } from '@deck/shared';
import { PaneTabs } from './PaneTabs';
import { Topbar } from './Topbar';
import { Workspace } from './Workspace';
import { ApprovalsPanel } from './features/approvals/ApprovalsPanel';
import { useApprovals } from './features/approvals/approvalsStore';
import { ConfirmHost } from './features/confirm/ConfirmHost';
import { ProfileDialog } from './features/sessions/ProfileDialog';
import { LoginScreen } from './features/auth/LoginScreen';
import { useLayout } from './features/layout/layoutStore';
import { useShortcuts } from './features/layout/useShortcuts';
import { NewSessionDialog } from './features/sessions/NewSessionDialog';
import { SessionSwitcher } from './features/sessions/SessionSwitcher';
import { useSessions } from './features/sessions/sessionsStore';
import { SettingsDialog } from './features/settings/SettingsDialog';
import { keysVisible, loadMode, saveMode, type KeysMode } from './features/terminal/keysPreference';
import { api } from './shared/api/endpoints';
import { onUnauthorized } from './shared/api/unauthorized';
import { useMediaQuery } from './shared/ui/useMediaQuery';
import { usePolling } from './shared/ui/usePolling';

type Dialog = 'new' | 'settings' | 'switcher' | 'profile' | null;

export function App() {
  const { sessions, activeId, view, select, setView } = useSessions();
  const { layout, patch } = useLayout();
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [locked, setLocked] = useState(false);
  const [keysMode, setKeysMode] = useState(loadMode);
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
  useShortcuts(
    sessions.map((s) => s.id),
    activeId,
    select,
  );
  usePolling(() => (locked ? Promise.resolve() : useSessions.getState().refresh()), 5000);
  usePolling(() => (locked ? Promise.resolve() : useApprovals.getState().refresh()), 3000);

  if (locked) return <LoginScreen onDone={reload} />;

  const changeKeys = (mode: KeysMode): void => {
    saveMode(mode);
    setKeysMode(mode);
  };

  return (
    <div className={`app${wide ? ' wide' : ''}`}>
      <Topbar
        wide={wide}
        splitOn={layout.showRight}
        onSwitcher={() => setDialog('switcher')}
        onSplit={() => patch({ showRight: !layout.showRight })}
        onSettings={() => setDialog('settings')}
      />
      <Workspace
        sessions={sessions}
        activeId={activeId}
        wide={wide}
        extraKeys={config?.extraKeys ?? null}
        showKeys={keysVisible(keysMode, touch)}
        onNew={() => setDialog('new')}
      />
      {!wide && sessions.length > 0 && (
        <PaneTabs
          views={['terminal', 'files', 'preview']}
          active={view}
          className="bottom-nav"
          onSelect={setView}
        />
      )}
      {dialog === 'new' && (
        <NewSessionDialog defaultCwd={config?.defaultCwd ?? null} onClose={() => setDialog(null)} />
      )}
      {dialog === 'switcher' && (
        <SessionSwitcher
          onNew={() => setDialog('new')}
          onProfile={() => setDialog('profile')}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'profile' && <ProfileDialog onClose={() => setDialog(null)} />}
      {dialog === 'settings' && (
        <SettingsDialog
          keysMode={keysMode}
          touchScreen={touch}
          onKeysChange={changeKeys}
          onClose={() => setDialog(null)}
        />
      )}
      <ApprovalsPanel />
      <ConfirmHost />
    </div>
  );
}
