import type { ReactNode } from 'react';
import { api, type BrowserStatus } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';

interface Props {
  status: BrowserStatus | null;
  onStatus(status: BrowserStatus): void;
  toggle: ReactNode;
}

/** Browser mode before Chromium is downloaded: what is missing, and the button that fetches it. */
export function BrowserInstall({ status, onStatus, toggle }: Props) {
  const t = useT();
  const install = (): void =>
    void api
      .browserInstall()
      .then(onStatus)
      // never fail silently: show why the request did not go through
      .catch(
        (e: unknown) =>
          status && onStatus({ ...status, error: e instanceof Error ? e.message : String(e) }),
      );
  return (
    <>
      <div className="preview-bar">{toggle}</div>
      {status !== null && (
        <p className="notice">
          {status.installing ? t('preview.installing') : t('preview.noBrowser')}{' '}
          {!status.installing && (
            <button type="button" onClick={install}>
              {t('preview.install')}
            </button>
          )}
          {status.error !== null && <span className="error"> {status.error}</span>}
        </p>
      )}
    </>
  );
}
