import { useEffect, useMemo, useState } from 'react';
import { api } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';
import { matchCommands } from './chatCommands';
import { activeToken, mentionText, type Token } from './suggest';

export interface Suggestion {
  key: string;
  label: string;
  detail: string;
  /** What replaces the token in the text. */
  insert: string;
}

const DEBOUNCE_MS = 120;

/** The completions for the word under the caret: files after `@`, the deck's commands after a leading `/`. */
export function useSuggestions(sessionId: string, text: string, caret: number) {
  const t = useT();
  const token: Token | null = useMemo(() => activeToken(text, caret), [text, caret]);
  const [files, setFiles] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [closed, setClosed] = useState<string | null>(null);
  const signature = token ? `${token.kind}:${token.start}:${token.query}` : null;

  const kind = token?.kind;
  const query = token?.query ?? '';
  useEffect(() => {
    if (kind !== 'file') return setFiles([]);
    let live = true;
    const timer = setTimeout(() => {
      api
        .findFiles(sessionId, query)
        .then((found) => live && setFiles(found.files))
        .catch(() => live && setFiles([]));
    }, DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [sessionId, kind, query]);

  const items: Suggestion[] = useMemo(() => {
    if (kind === 'command') {
      return matchCommands(query).map((c) => ({
        key: c.name,
        label: `/${c.name}${c.arg ? ` ${c.arg}` : ''}`,
        detail: t(c.desc),
        insert: `/${c.name}`,
      }));
    }
    if (kind === 'file') {
      return files.map((f) => ({
        key: f,
        label: f.split('/').pop() ?? f,
        detail: f,
        insert: mentionText(f),
      }));
    }
    return [];
  }, [kind, query, files, t]);

  useEffect(() => setIndex(0), [signature, items.length]);
  const open = token !== null && signature !== closed && items.length > 0;
  return {
    token,
    items,
    index,
    open,
    move: (by: number) =>
      setIndex((i) => (items.length === 0 ? 0 : (i + by + items.length) % items.length)),
    close: () => setClosed(signature),
  };
}
