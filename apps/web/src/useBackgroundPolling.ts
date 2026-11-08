import type { Session } from '@deck/shared';
import { useEffect } from 'react';
import { useApprovals } from './features/approvals/approvalsStore';
import { useChatTitles } from './features/sessions/chatTitlesStore';
import { useSessions } from './features/sessions/sessionsStore';
import { useAutoNotifyWatch } from './features/tasks/useAutoNotifyWatch';
import { watchBattery } from './shared/power/saverStore';
import { usePolling } from './shared/ui/usePolling';
import { useLive, useLiveEvents } from './useLiveEvents';

/** With the change feed connected, polling only double-checks (removed sessions, other decks), slowly. */
const LIVE_RECHECK_MS = 60_000;

/** What the app keeps fresh while it is open (nothing while the login screen is up). */
export function useBackgroundPolling(locked: boolean, sessions: readonly Session[]): void {
  useLiveEvents(locked);
  useEffect(() => watchBattery(), []);
  const live = useLive((s) => s.live);
  const idle = Promise.resolve();
  usePolling(
    () => (locked ? idle : useSessions.getState().refresh()),
    live ? LIVE_RECHECK_MS : 5000,
  );
  usePolling(
    () => (locked ? idle : useApprovals.getState().refresh()),
    live ? LIVE_RECHECK_MS : 3000,
  );
  usePolling(() => (locked ? idle : useChatTitles.getState().refresh()), 20_000);
  useAutoNotifyWatch(locked, sessions);
}
