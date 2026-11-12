import { useProfiles } from '../sessions/profilesStore';
import { sessionLabel } from '../sessions/sessionLabel';
import { useSessions } from '../sessions/sessionsStore';

const working = new Set<string>();

/** Asks for the browser's notification permission once, at the first message (a click, so browsers allow it). */
export function askNotifyPermission(): void {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  } catch {
    // no notifications here (an old browser, or a web view): the phone app notifies instead
  }
}

/**
 * The server always announces when a chat starts and stops working. When one stops while this page is hidden,
 * a notification shows the chat's name and the first line of its last words; clicking it opens that chat.
 */
export function onActivity(sessionId: string, busy: boolean, summary: string): void {
  if (busy) return void working.add(sessionId);
  if (!working.delete(sessionId)) return;
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (!document.hidden) return;
    const session = useSessions.getState().sessions.find((s) => s.id === sessionId);
    if (!session || session.parentId !== null) return;
    const title = sessionLabel(session, useProfiles.getState().providers);
    const note = new Notification(title, { body: summary.split('\n')[0] ?? '', tag: sessionId });
    note.onclick = () => {
      window.focus();
      useSessions.getState().select(sessionId);
      note.close();
    };
  } catch {
    // showing it failed: nothing else to do
  }
}
