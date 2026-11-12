import type { SignInFlow, SignInMethod } from '@deck/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { signinApi } from '../../shared/api/signinApi';

const POLL_MS = 1500;
const message = (e: unknown): string => (e instanceof Error ? e.message : 'failed');

/** Starts a login on the server and follows it (a poll every 1.5 s) until it is done, failed or cancelled. */
export function useLoginFlow(provider: string, onDone: () => void) {
  const [flow, setFlow] = useState<SignInFlow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const finished = useRef(onDone);
  finished.current = onDone;

  const stop = useCallback((): void => window.clearTimeout(timer.current), []);
  const poll = useCallback((): void => {
    signinApi
      .flow(provider)
      .then((next) => {
        setFlow(next);
        if (next?.state === 'running') timer.current = window.setTimeout(poll, POLL_MS);
        else if (next?.state === 'done') finished.current();
      })
      .catch((e: unknown) => setError(message(e)));
  }, [provider]);
  useEffect(() => stop, [stop]);

  /** Runs one request, then looks at the flow again at once. */
  const act = useCallback(
    async (run: () => Promise<unknown>): Promise<void> => {
      setBusy(true);
      setError(null);
      stop();
      try {
        await run();
        poll();
      } catch (e) {
        setError(message(e));
      } finally {
        setBusy(false);
      }
    },
    [poll, stop],
  );

  return {
    flow,
    error,
    busy,
    start: (method: SignInMethod) => act(() => signinApi.start(provider, method)),
    sendCode: (text: string) => act(() => signinApi.sendCode(provider, text)),
    cancel: () => act(() => signinApi.cancel(provider)),
    reset: () => (stop(), setFlow(null), setError(null)),
  };
}
