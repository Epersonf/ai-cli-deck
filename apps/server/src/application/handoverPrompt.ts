import type { Session } from '@deck/shared';
import { HANDOVER_START } from '../domain/chat.js';
import { invalid } from '../domain/errors.js';
import { eventsToTurns } from './chatHistory.js';
import { transcript } from './transcript.js';
import type { ChatActionsDeps } from './ChatActions.js';

/** Transfer across profiles or legacy engines without pretending it is a native fork. */
export async function handoverPrompt(source: Session, deps: ChatActionsDeps): Promise<string> {
  const { sessions, files, now } = deps;
  const turns = eventsToTurns(await sessions.snapshotEvents(source.id));
  if (turns.length === 0) throw invalid('There is no conversation to hand over yet');
  const from = deps.providers.get(source.provider)?.label;
  if (!from) throw invalid(`Unknown profile "${source.provider}"`);
  const text = transcript(turns, { from, cwd: source.cwd, date: now() });
  const stamp = now().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const file = await files.writeTranscript(source.cwd, `${stamp}-${source.id}.md`, text);
  return (
    `${HANDOVER_START}${from} in this folder. ` +
    `Read ${file} first: it is that conversation so far. Then say in one short line that you ` +
    'have the context, and wait for the user.'
  );
}
