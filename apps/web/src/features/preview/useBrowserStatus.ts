import { useEffect, useState } from 'react';
import { api, type BrowserStatus } from '../../shared/api/endpoints';

/** Whether the deck's Chromium is installed (polled faster while it downloads); null until known. */
export function useBrowserStatus(active: boolean) {
  const [status, setStatus] = useState<BrowserStatus | null>(null);
  useEffect(() => {
    if (!active || status?.installed) return;
    let live = true;
    const load = (): void =>
      void api
        .browserStatus()
        .then((next) => live && setStatus(next))
        .catch(() => undefined);
    load();
    const timer = setInterval(load, status?.installing ? 3000 : 30000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [active, status?.installed, status?.installing]);
  return [status, setStatus] as const;
}
