import { useT } from '../../shared/i18n/store';
import { toast } from '../../shared/ui/toast';
import { useFork } from '../sessions/forkStore';
import { useSessions } from '../sessions/sessionsStore';
import { copyText } from '../settings/templateFile';
import { commandOf, type CommandContext } from './chatCommands';
import { useChats } from './chatStore';
import { sendChat } from './connection';
import { transcript } from './transcript';

/** Runs the message as one of the deck's `/commands` when it is one; false means it goes to the agent as written. */
export function useRunCommand(sessionId: string): (text: string) => boolean {
  const t = useT();
  return (text) => {
    const found = commandOf(text);
    if (!found) return false;
    const chat = useChats.getState().byId[sessionId];
    const blocks = chat?.blocks ?? [];
    const session = useSessions.getState().sessions.find((x) => x.id === sessionId);
    const ctx: CommandContext = {
      config: chat?.config ?? null,
      lastAnswer: () => {
        const last = [...blocks].reverse().find((b) => b.kind === 'text');
        return last?.kind === 'text' ? last.text : '';
      },
      transcript: () => transcript(blocks),
      say: (said) => sendChat(sessionId, { type: 'send', text: said, images: [], queue: true }),
      interrupt: () => sendChat(sessionId, { type: 'interrupt' }),
      setConfig: (patch) => sendChat(sessionId, { type: 'config', ...patch }),
      show: (view) => useSessions.getState().setView(view),
      copy: (copied) =>
        void copyText(copied)
          .then(() => toast(t('files.copied')))
          .catch(() => undefined),
      openFork: () => session && useFork.getState().open(session),
      toast,
    };
    found.command.run(ctx, found.arg);
    return true;
  };
}
