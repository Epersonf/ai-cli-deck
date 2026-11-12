import type { GitReview } from '@deck/shared';
import { useCallback, useEffect, useState } from 'react';
import { gitApi } from '../../shared/api/reviewApi';
import { useFilesTick } from '../files/filesTick';

const message = (e: unknown): string => (e instanceof Error ? e.message : 'failed');

/** The git review of a session, refreshed whenever the pane is shown and after every action. */
export function useReview(sessionId: string, visible: boolean) {
  const [review, setReview] = useState<GitReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** What git said after the last commit or push. */
  const [output, setOutput] = useState<string | null>(null);

  const tick = useFilesTick((s) => s.byId[sessionId] ?? 0);
  const refresh = useCallback(
    () =>
      gitApi
        .review(sessionId)
        .then((next) => (setReview(next), setError(null)))
        .catch((e: unknown) => setError(message(e))),
    [sessionId],
  );
  useEffect(() => {
    if (visible) void refresh();
  }, [visible, refresh, tick]);

  /** Runs one action, then shows what changed; returns false when git refused it. */
  const act = async (run: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    setOutput(null);
    try {
      const said = await run();
      if (typeof said === 'string' && said !== '') setOutput(said);
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  return {
    review,
    busy,
    error,
    output,
    refresh,
    discard: (path: string) => act(() => gitApi.discard(sessionId, path)),
    commit: (text: string, paths: readonly string[]) =>
      act(() => gitApi.commit(sessionId, text, paths).then((r) => r.output)),
    push: () => act(() => gitApi.push(sessionId).then((r) => r.output)),
  };
}

/** One letter for a porcelain code: M, A, D, R, ? (new), U (conflict). */
export function codeLetter(code: string): string {
  if (code === '??') return '?';
  if (code.includes('U') || code === 'AA' || code === 'DD') return 'U';
  return (code[0] === ' ' ? code[1] : code[0]) ?? '?';
}
