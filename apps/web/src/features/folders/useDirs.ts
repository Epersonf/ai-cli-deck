import type { FsDirs } from '@deck/shared';
import { useCallback, useEffect, useState } from 'react';
import { signinApi } from '../../shared/api/signinApi';

/** The folders of the machine the deck runs on: one level at a time, starting at `start` (or its home). */
export function useDirs(start: string) {
  const [listing, setListing] = useState<FsDirs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const go = useCallback((path: string | null): void => {
    setLoading(true);
    signinApi
      .dirs(path)
      .then((next) => (setListing(next), setError(null)))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'failed'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => go(start === '' ? null : start), [go, start]);
  return { listing, error, loading, go };
}
