import { useCallback, useEffect, useState } from 'react';
import type { PublicConfig } from '@deck/shared';
import { PaneTabs } from './PaneTabs';
import { Topbar } from './Topbar';
import { Workspace } from './Workspace';
import { ApprovalsPanel } from './features/approvals/ApprovalsPanel';
import { ConfirmHost } from './features/confirm/ConfirmHost';
import { PairingRequestHost } from './features/devices/PairingRequestHost';
import { SendProfileHost } from './features/devices/SendProfileHost';
import { useNetwork } from './features/devices/networkStore';
import { PEER_ID } from './shared/api/base';
import { ForkHost } from './features/sessions/ForkDialog';
import { MemoryHost } from './features/memory/MemoryDialog';
import { ToastHost } from './shared/ui/toast';
import { SignInHost } from './features/signin/SignInDialog';
import { ProfileDialog } from './features/sessions/ProfileDialog';
import { LoginScreen } from './features/auth/LoginScreen';
import { useLayout } from './features/layout/layoutStore';
import { useShortcuts } from './features/layout/useShortcuts';
import { sessionLabel } from './features/sessions/sessionLabel';
import { NewSessionDialog } from './features/sessions/NewSessionDialog';
import { SessionSwitcher } from './features/sessions/SessionSwitcher';
import { useProfiles } from './features/sessions/profilesStore';
import { useSessions } from './features/sessions/sessionsStore';
import { SettingsDialog } from './features/settings/SettingsDialog';
import { api } from './shared/api/endpoints';
import { onUnauthorized } from './shared/api/unauthorized';
import { useMediaQuery } from './shared/ui/useMediaQuery';
import { useBackgroundPolling } from './useBackgroundPolling';

import { useChatNotifications } from './features/chat/useChatNotifications';

type Dialog = 'new' | 'settings' | 'switcher' | 'profile' | null;

export function App() {
  const { sessions, activeId, view, select, setView } = useSessions();
  const { layout, patch } = useLayout();
  const profiles = useProfiles((s) => s.providers);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [newFor, setNewFor] = useState<string | null>(null);
  const openNew = (profileId: string | null): void => (setNewFor(profileId), setDialog('new'));
  const [locked, setLocked] = useState(false);
  const wide = useMediaQuery('(min-width: 1000px)');

  const reload = useCallback(() => {
    api
      .config()
      .then((c) => (setConfig(c), setLocked(false)))
      .catch(() => undefined);
    for (const store of [useSessions, useProfiles, useNetwork]) {
      void store
        .getState()
        .refresh()
        .catch(() => undefined);
    }
  }, []);

  useChatNotifications(sessions, activeId, view, select);
  const active = sessions.find((s) => s.id === activeId);
  const activeLabel = active ? sessionLabel(active, profiles) : null;
  useEffect(() => {
    document.title = activeLabel ? `${activeLabel} · Deck` : 'Deck · AI CLI workspace';
  }, [activeLabel]);

  // A paired deck's app is signed in through this deck: a refusal means this deck wants its login.
  useEffect(
    () => onUnauthorized(() => (PEER_ID ? window.location.assign('/') : setLocked(true))),
    [],
  );
  useEffect(reload, [reload]);
  useShortcuts(
    sessions.filter((s) => s.parentId === null).map((s) => s.id),
    activeId,
    select,
  );
  useBackgroundPolling(locked);

  if (locked) return <LoginScreen onDone={reload} />;

  return (
    <div className={`app${wide ? ' wide' : ''}`}>
      <Topbar
        wide={wide}
        splitOn={layout.showRight}
        hasSession={sessions.length > 0}
        onSwitcher={() => setDialog('switcher')}
        onSplit={() => patch({ showRight: !layout.showRight })}
        onSettings={() => setDialog('settings')}
      />
      <Workspace
        sessions={sessions}
        activeId={activeId}
        wide={wide}
        hasProfile={profiles.length > 0}
        onNew={() => openNew(null)}
        onProfile={() => setDialog('profile')}
      />
      {!wide && sessions.length > 0 && (
        <PaneTabs
          views={['chat', 'files', 'changes', 'preview']}
          active={view}
          className="bottom-nav"
          onSelect={setView}
        />
      )}
      {dialog === 'new' && (
        <NewSessionDialog
          defaultCwd={config?.defaultCwd ?? null}
          profileId={newFor}
          onProfile={() => setDialog('profile')}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'switcher' && (
        <SessionSwitcher
          onNew={openNew}
          onProfile={() => setDialog('profile')}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'profile' && (
        <ProfileDialog onDone={() => setDialog('switcher')} onClose={() => setDialog(null)} />
      )}
      {dialog === 'settings' && <SettingsDialog onClose={() => setDialog(null)} />}
      <ApprovalsPanel />
      <ForkHost />
      <SignInHost />
      <ToastHost />
      <MemoryHost onSettings={() => setDialog('settings')} />
      <PairingRequestHost />
      <SendProfileHost />
      <ConfirmHost />
    </div>
  );
}
