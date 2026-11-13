import { toast } from '../../shared/ui/toast';
import { useDraft } from '../chat/draftStore';
import { mentionText } from '../chat/suggest';
import { useSessions } from '../sessions/sessionsStore';
import { toAbsolute } from './explorerPath';

/** What to write after `@` for an explorer path: relative to the chat's folder, absolute once it climbs above it. */
export const mentionPath = (cwd: string, path: string): string =>
  path === '..' || path.startsWith('../') ? toAbsolute(cwd, path) : path;

/** "Mention in chat": puts `@file` in that chat's message box and shows the chat. */
export function mentionInChat(sessionId: string, path: string, done: string): void {
  const sessions = useSessions.getState();
  const cwd = sessions.sessions.find((s) => s.id === sessionId)?.cwd ?? '';
  useDraft.getState().insert(sessionId, mentionText(mentionPath(cwd, path)));
  sessions.setView('chat');
  toast(done);
}
