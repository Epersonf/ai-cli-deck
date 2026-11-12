import type { ChatEvent } from '@deck/shared';
import type { AgentPort, AgentSpec } from '../domain/agent.js';
import { HANDOVER_START } from '../domain/chat.js';
import { invalid, notFound } from '../domain/errors.js';
import { eventsToTurns } from './chatHistory.js';
import { closeDangling } from './chatRepair.js';
import { transcript } from './transcript.js';

interface Origin {
  /** The agent's name, for the note. */
  from: string;
  cwd: string;
  date: Date;
}

/**
 * The first message of a new thread that carries on a conversation the agent cannot go back in (Codex, or
 * a Claude chat whose saved file has no such point): the kept turns written out, then what the person says.
 */
export function replayPrompt(kept: readonly ChatEvent[], text: string, origin: Origin): string {
  const turns = eventsToTurns(kept);
  if (turns.length === 0) return text;
  return [
    `${HANDOVER_START}${origin.from} in this folder; it is written out below.`,
    'Treat it as what has been said and done so far, and answer the new message that follows it.',
    '',
    transcript(turns, origin),
    '---',
    '',
    text,
  ].join('\n');
}

export interface RewindRequest {
  events: readonly ChatEvent[];
  userId: string;
  text: string;
  revertFiles: boolean;
  chatId: string | null;
  spec: AgentSpec;
  label: string;
  now: Date;
}

export interface RewindPlan {
  /** What the chat keeps: everything before the edited message. */
  kept: ChatEvent[];
  /** Resume the saved chat here, replacing this message; null when a new thread starts instead. */
  back: { at: string; drops: string } | null;
  /** What the agent is told in place of the new text alone. */
  prompt: string;
}

/**
 * Works out how an edit of the user message `userId` goes: back inside the agent's saved chat (restoring
 * files when asked), or, where the agent cannot, as a new thread that replays what was kept.
 */
export async function planRewind(agent: AgentPort, r: RewindRequest): Promise<RewindPlan> {
  const at = r.events.findIndex((e) => e.t === 'user' && e.id === r.userId);
  if (at < 0) throw notFound('That message');
  const kept = r.events.slice(0, at);
  kept.push(...closeDangling(kept)); // jobs of the run being closed end with it
  const to = await agent.rewind(r.spec, r.userId, r.revertFiles);
  if (to.error) throw invalid(to.error);
  if (r.chatId !== null && to.resumeAt !== null && kept.some((e) => e.t === 'user')) {
    return { kept, back: { at: to.resumeAt, drops: r.userId }, prompt: r.text };
  }
  const origin = { from: r.label, cwd: r.spec.cwd, date: r.now };
  return { kept, back: null, prompt: replayPrompt(kept, r.text, origin) };
}
