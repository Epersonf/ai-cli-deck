import type { OtpSetup } from '@deck/shared';
import { useCallback, useEffect, useState } from 'react';
import { authApi } from '../../shared/api/authApi';

const SLACK_MS = 400;

/**
 * The secret and the live code of this deck: fetched once, then again just after each code runs out
 * (`expiresIn` tells when), so the code on screen is always the server's.
 */
export function useOtpSetup() {
  const [setup, setSetup] = useState<OtpSetup | null>(null);
  const [deadline, setDeadline] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const adopt = useCallback((next: OtpSetup): void => {
    setSetup(next);
    setDeadline(Date.now() + next.expiresIn * 1000);
    setError(null);
  }, []);
  const load = useCallback(
    () =>
      void authApi
        .otp()
        .then(adopt)
        .catch((e: unknown) => setError(e instanceof Error ? e.message : 'failed')),
    [adopt],
  );

  useEffect(load, [load]);
  useEffect(() => {
    if (setup === null) return;
    const id = setTimeout(load, Math.max(0, deadline - Date.now()) + SLACK_MS);
    return () => clearTimeout(id);
  }, [setup, deadline, load]);

  return { setup, deadline, error, adopt };
}
