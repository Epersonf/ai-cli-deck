import { useEffect } from 'react';
import { create } from 'zustand';
import { useApprovals } from './features/approvals/approvalsStore';
import { useActivity } from './features/sessions/activityStore';
import { useSessions } from './features/sessions/sessionsStore';
import { openEventsSocket } from './shared/ws/eventsSocket';

/** Whether the change feed is connected: while it is, the background polling only double-checks, slowly. */
export const useLive = create<{ live: boolean }>(() => ({ live: false }));

/** Keeps sessions and approvals current from pushed events, and fetches the full state on every (re)connect. */
export function useLiveEvents(locked: boolean): void {
  useEffect(() => {
    if (locked) return;
    const stop = openEventsSocket({
      onLive: (live) => {
        useLive.setState({ live });
        if (live) {
          void useSessions.getState().refresh();
          void useApprovals.getState().refresh();
        }
      },
      onMessage: (message) => {
        if (message.type === 'session') useSessions.getState().upsert(message.session);
        else if (message.type === 'approval') useApprovals.getState().receive(message.request);
        else if (message.type === 'activity')
          useActivity
            .getState()
            .set(message.sessionId, { busy: message.busy, summary: message.summary });
        else void useSessions.getState().refresh();
      },
    });
    return () => {
      stop();
      useLive.setState({ live: false });
    };
  }, [locked]);
}
