import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useT } from '../../shared/i18n/store';
import { textChange } from './mobileKeyboard';
import { useBrowserStream } from './useBrowserStream';
import { usePageGestures } from './usePageGestures';
import { EnterIcon } from '../../shared/ui/GlyphIcons';
import { RefreshIcon } from '../../shared/ui/Icons';

interface Props {
  sessionId: string;
  visible: boolean;
  /** Address the agent (or a terminal link) asked to show. */
  requested: string | null;
}

/**
 * The session's real Chromium, live: the page is sized to this pane, frames stream as it changes, a tap
 * clicks, a drag scrolls, and the text box types as you write. The agent drives this same page.
 */
export function BrowserView({ sessionId, visible, requested }: Props) {
  const t = useT();
  const { frame, page, error, send, resize } = useBrowserStream(sessionId, visible);
  const screen = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const [draft, setDraft] = useState('');
  const [typed, setTyped] = useState('');
  const editing = useRef(false);

  useEffect(() => {
    if (requested !== null) send({ kind: 'navigate', url: requested });
  }, [requested, send]);
  useEffect(() => {
    if (page && !editing.current) setDraft(page.url === 'about:blank' ? '' : page.url);
  }, [page]);
  useEffect(() => {
    const element = screen.current;
    if (!element || !visible) return;
    const fit = (): void => resize(element.clientWidth, element.clientHeight);
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    fit();
    return () => observer.disconnect();
  }, [visible, resize]);

  const gestures = usePageGestures(() => {
    const rect = image.current?.getBoundingClientRect();
    if (!rect || !page || rect.width === 0) return null;
    return { scale: page.width / rect.width, left: rect.left, top: rect.top };
  }, send);

  const navigate = (event: FormEvent): void => {
    event.preventDefault();
    editing.current = false;
    if (draft.trim() !== '') send({ kind: 'navigate', url: draft });
  };
  /** Types into the page as the box changes, so the phone keyboard's suggestions work too. */
  const typeLive = (value: string): void => {
    for (const part of textChange(typed, value).split(/(\x7f)/)) {
      if (part === '\x7f') send({ kind: 'key', key: 'Backspace' });
      else if (part !== '') send({ kind: 'type', text: part });
    }
    setTyped(value);
  };
  const enter = (event: FormEvent): void => {
    event.preventDefault();
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
      <form className="preview-bar" onSubmit={navigate}>
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
          <RefreshIcon size={16} />
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
      <div ref={screen} className="browser-screen" tabIndex={0} onKeyDown={onKey}>
        {frame !== null && (
          <img ref={image} src={frame} alt={page?.title ?? ''} draggable={false} {...gestures} />
        )}
      </div>
      <form className="browser-type" onSubmit={enter}>
        <input
          value={typed}
          onChange={(event) => typeLive(event.target.value)}
          placeholder={t('preview.typeHere')}
          autoCapitalize="off"
          spellCheck={false}
        />
        <button type="submit" aria-label={t('preview.typeHere')}>
          <EnterIcon size={16} />
        </button>
      </form>
    </>
  );
}
