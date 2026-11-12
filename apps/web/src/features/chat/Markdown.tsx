import { memo, useMemo, type MouseEvent } from 'react';
import { useT } from '../../shared/i18n/store';
import { showSidePane } from '../layout/layoutStore';
import { previewable, usePreview } from '../preview/previewStore';
import { copyText } from '../settings/templateFile';
import { toast } from '../../shared/ui/toast';
import { renderMarkdown } from './renderMarkdown';

/** A localhost link opens in the session's preview; any other link opens in a new tab. */
export function openLink(sessionId: string, uri: string): void {
  if (previewable(uri, window.location.origin) !== null) {
    usePreview.getState().open(sessionId, uri);
    showSidePane('preview');
  } else {
    window.open(uri, '_blank', 'noopener,noreferrer');
  }
}

interface Props {
  text: string;
  sessionId: string;
}

/** An agent's markdown, sanitized; its links and code-copy buttons work through one click handler. */
export const Markdown = memo(function Markdown({ text, sessionId }: Props) {
  const t = useT();
  const copyLabel = t('chat.copyCode');
  const html = useMemo(() => renderMarkdown(text, copyLabel), [text, copyLabel]);

  const onClick = (event: MouseEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLElement>('[data-copy]');
    if (button) {
      const code = button.parentElement?.querySelector('code')?.textContent ?? '';
      void copyText(code)
        .then(() => toast(t('files.copied')))
        .catch(() => undefined);
      return;
    }
    const link = target.closest<HTMLAnchorElement>('a[href]');
    if (!link) return;
    event.preventDefault();
    openLink(sessionId, link.href);
  };

  return <div className="md" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />;
});
