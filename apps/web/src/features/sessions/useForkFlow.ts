import { FORK_KEY, type Session } from '@deck/shared';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../shared/api/endpoints';
import { useSessions } from './sessionsStore';

const POLL_MS = 1500;
const GIVE_UP_MS = 90_000;
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export type ForkPhase = 'form' | 'waiting';

/**
 * Fork or move a chat. In the same profile, when the agent told the deck how its CLI forks, that is all it
 * takes. Otherwise a running agent is first asked for its handoff notes, and we wait for the file (or "skip").
 */
export function useForkFlow(source: Session, onDone: () => void) {
  const [phase, setPhase] = useState<ForkPhase>('form');
  const [error, setError] = useState<string | null>(null);
  const skipped = useRef(false);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  const waitForNotes = async (): Promise<void> => {
    const before = (await api.handoff(source.id)).info?.updatedAt ?? null;
    await api.requestHandoff(source.id);
    const until = Date.now() + GIVE_UP_MS;
    while (alive.current && !skipped.current && Date.now() < until) {
      await wait(POLL_MS);
      const now = (await api.handoff(source.id)).info?.updatedAt ?? null;
      if (now !== null && now !== before) return;
    }
  };

  const run = async (provider: string, endAfter: boolean): Promise<void> => {
    setError(null);
    skipped.current = false;
    try {
      const native = provider === source.provider && Boolean(source.meta[FORK_KEY]);
      if (!native && source.status === 'running') {
        setPhase('waiting');
        await waitForNotes();
      }
      const copy = await api.fork(source.id, { provider, useHandoff: !skipped.current });
      const sessions = useSessions.getState();
      sessions.upsert(copy);
      sessions.select(copy.id);
      if (endAfter) await sessions.remove(source.id);
      if (alive.current) onDone();
    } catch (e) {
      setPhase('form');
      setError(e instanceof Error ? e.message : 'failed');
    }
  };

  return { phase, error, run, skip: () => void (skipped.current = true) };
}
