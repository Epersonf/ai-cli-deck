import { normalizeUrl } from '@deck/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { currentUrl, usePreview } from './previewStore';

const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals';

interface Props {
  sessionId: string;
  visible: boolean;
}

/** Per-session browser: only localhost pages, rendered in a sandboxed iframe. */
export function PreviewPanel({ sessionId, visible }: Props) {
  const state = usePreview((s) => s.byId[sessionId]);
  const suggested = usePreview((s) => s.newTab[sessionId] ?? null);
  const { open, back, forward, reload, suggestNewTab } = usePreview.getState();
  const url = currentUrl(state);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setDraft(url ?? ''), [url]);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const ok = open(sessionId, normalizeUrl(draft));
    setError(ok ? null : 'Only http(s)://localhost or 127.0.0.1 pages can be previewed');
  };

  return (
    <section className={`pane preview-pane${visible ? '' : ' hidden'}`}>
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
            Open in new tab ↗
          </a>
        )}
      </form>
      {error !== null && <p className="notice error">{error}</p>}
      {suggested !== null && (
        <p className="notice">
          An agent suggests opening{' '}
          <a
            href={suggested}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => suggestNewTab(sessionId, null)}
          >
            {suggested} ↗
          </a>
          <button type="button" className="link" onClick={() => suggestNewTab(sessionId, null)}>
            dismiss
          </button>
        </p>
      )}
      {url === null ? (
        <p className="empty">Tap a localhost link in the terminal, or type an address above.</p>
      ) : (
        <iframe
          key={`${url}#${state?.reloadKey ?? 0}`}
          title={`Preview of ${url}`}
          src={url}
          sandbox={SANDBOX}
          referrerPolicy="no-referrer"
        />
      )}
      {url !== null && (
        <p className="hint">Page blank? It may forbid embedding. Use “Open in new tab”.</p>
      )}
    </section>
  );
}
