import type { Session } from '@deck/shared';
import { useApprovals } from './features/approvals/approvalsStore';
import { useChatTitles } from './features/sessions/chatTitlesStore';
import { useSessions } from './features/sessions/sessionsStore';
import { useAutoNotifyWatch } from './features/tasks/useAutoNotifyWatch';
import { usePolling } from './shared/ui/usePolling';

/** What the app keeps fresh while it is open (nothing while the login screen is up). */
export function useBackgroundPolling(locked: boolean, sessions: readonly Session[]): void {
  const idle = Promise.resolve();
  usePolling(() => (locked ? idle : useSessions.getState().refresh()), 5000);
  usePolling(() => (locked ? idle : useApprovals.getState().refresh()), 3000);
  usePolling(() => (locked ? idle : useChatTitles.getState().refresh()), 20_000);
  useAutoNotifyWatch(locked, sessions);
}
