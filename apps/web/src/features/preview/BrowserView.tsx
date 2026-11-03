import { BROWSER_VIEWPORT } from '@deck/shared';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { api, type BrowserInput, type PageInfo } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';
import { useBrowserFrames } from './useBrowserFrames';

interface Props {
  sessionId: string;
  visible: boolean;
  /** Address the agent (or a terminal link) asked to show. */
  requested: string | null;
}

/** The session's real Chromium: a live picture you can click, scroll and type into. */
export function BrowserView({ sessionId, visible, requested }: Props) {
  const t = useT();
  const [page, setPage] = useState<PageInfo | null>(null);
  const [draft, setDraft] = useState('');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const editing = useRef(false);

  const track = useCallback(
    (job: Promise<PageInfo>): void => {
      job
        .then((info) => {
          setPage(info);
          setError(null);
          if (!editing.current) setDraft(info.url === 'about:blank' ? '' : info.url);
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : 'failed'));
    },
    [setPage],
  );
  const send = (input: BrowserInput): void => track(api.browserInput(sessionId, input));

  useEffect(() => {
    if (requested !== null) track(api.browserNavigate(sessionId, requested));
  }, [sessionId, requested, track]);

  const refresh = useCallback(() => track(api.browserState(sessionId)), [sessionId, track]);
  const frame = useBrowserFrames(sessionId, visible, refresh);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    editing.current = false;
    if (draft.trim() !== '') track(api.browserNavigate(sessionId, draft));
  };
  const sendText = (event: FormEvent): void => {
    event.preventDefault();
    if (typed !== '') send({ kind: 'type', text: typed });
    send({ kind: 'key', key: 'Enter' });
    setTyped('');
  };
  const onKey = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    if (event.key.length === 1) send({ kind: 'type', text: event.key });
    else send({ kind: 'key', key: event.key });
  };

  return (
    <>
      <form className="preview-bar" onSubmit={submit}>
        <button type="button" onClick={() => send({ kind: 'back' })} aria-label={t('common.back')}>
          ←
        </button>
        <button type="button" onClick={() => send({ kind: 'forward' })}>
          →
        </button>
        <button
          type="button"
          onClick={() => send({ kind: 'reload' })}
          title={t('common.refresh')}
          aria-label={t('common.refresh')}
        >
          ⟳
        </button>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => (editing.current = true)}
          onBlur={() => (editing.current = false)}
          placeholder="localhost:3000 · example.com"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </form>
      {error !== null && <p className="notice error">{error}</p>}
      <div
        className="browser-screen"
        tabIndex={0}
        onKeyDown={onKey}
        onWheel={(event) => send({ kind: 'scroll', dy: event.deltaY })}
      >
        {frame !== null && (
          <img
            src={frame}
            alt={page?.title ?? ''}
            draggable={false}
            onClick={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              send({
                kind: 'click',
                x: ((event.clientX - box.left) / box.width) * BROWSER_VIEWPORT.width,
                y: ((event.clientY - box.top) / box.height) * BROWSER_VIEWPORT.height,
              });
            }}
          />
        )}
      </div>
      <form className="browser-type" onSubmit={sendText}>
        <input
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={t('preview.typeHere')}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button type="submit">↵</button>
      </form>
    </>
  );
}
