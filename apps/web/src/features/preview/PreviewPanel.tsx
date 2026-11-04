import { normalizeUrl } from '@deck/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { api, type BrowserStatus } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';
import { BrowserView } from './BrowserView';
import { currentUrl, usePreview } from './previewStore';

const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals';

interface Props {
  sessionId: string;
  visible: boolean;
}

/** Per-session browser: only localhost pages, rendered in a sandboxed iframe. */
export function PreviewPanel({ sessionId, visible }: Props) {
  const t = useT();
  const state = usePreview((s) => s.byId[sessionId]);
  const suggested = usePreview((s) => s.newTab[sessionId] ?? null);
  const { open, back, forward, reload, suggestNewTab } = usePreview.getState();
  const url = currentUrl(state);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [browser, setBrowser] = useState<BrowserStatus | null>(null);

  useEffect(() => {
    if (browser?.installed) return;
    let live = true;
    const load = (): void =>
      void api
        .browserStatus()
        .then((status) => live && setBrowser(status))
        .catch(() => undefined);
    load();
    const timer = setInterval(load, browser?.installing ? 3000 : 30000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [browser?.installed, browser?.installing]);

  useEffect(() => setDraft(url ?? ''), [url]);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const ok = open(sessionId, normalizeUrl(draft));
    setError(ok ? null : t('preview.onlyLocal'));
  };

  if (browser?.installed) {
    return (
      <section className={`pane preview-pane${visible ? '' : ' hidden'}`}>
        <BrowserView sessionId={sessionId} visible={visible} requested={url} />
      </section>
    );
  }

  return (
    <section className={`pane preview-pane${visible ? '' : ' hidden'}`}>
      {browser !== null && (
        <p className="notice">
          {browser.installing ? t('preview.installing') : t('preview.noBrowser')}{' '}
          {!browser.installing && (
            <button
              type="button"
              onClick={() =>
                void api
                  .browserInstall()
                  .then(setBrowser)
                  // never fail silently: show why the request did not go through
                  .catch((e: unknown) =>
                    setBrowser({ ...browser, error: e instanceof Error ? e.message : String(e) }),
                  )
              }
            >
              {t('preview.install')}
            </button>
          )}
          {browser.error !== null && <span className="error"> {browser.error}</span>}
        </p>
      )}
      <form className="preview-bar" onSubmit={submit}>
        <button type="button" onClick={() => back(sessionId)} disabled={!state || state.index <= 0}>
          ←
        </button>
        <button
          type="button"
          onClick={() => forward(sessionId)}
          disabled={!state || state.index >= state.history.length - 1}
        >
          →
        </button>
        <button type="button" onClick={() => reload(sessionId)} disabled={url === null}>
          ⟳
        </button>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="localhost:3000"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {url !== null && (
          <a className="btn" href={url} target="_blank" rel="noopener noreferrer">
            {t('preview.openTab')} ↗
          </a>
        )}
      </form>
      {error !== null && <p className="notice error">{error}</p>}
      {suggested !== null && (
        <p className="notice">
          {t('preview.suggested')}{' '}
          <a
            href={suggested}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => suggestNewTab(sessionId, null)}
          >
            {suggested} ↗
          </a>
          <button type="button" className="link" onClick={() => suggestNewTab(sessionId, null)}>
            {t('preview.dismiss')}
          </button>
        </p>
      )}
      {url === null ? (
        <p className="empty">{t('preview.empty')}</p>
      ) : (
        <iframe
          key={`${url}#${state?.reloadKey ?? 0}`}
          title={url}
          src={url}
          sandbox={SANDBOX}
          referrerPolicy="no-referrer"
        />
      )}
      {url !== null && <p className="hint">{t('preview.blankHint')}</p>}
    </section>
  );
}
