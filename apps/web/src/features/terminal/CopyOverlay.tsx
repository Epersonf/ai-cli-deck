import { useEffect, useRef, useState } from 'react';
import { useT } from '../../shared/i18n/store';
import { copyText } from '../settings/templateFile';
import type { TextScope } from './bufferText';

interface Props {
  text(scope: TextScope): string;
  onClose(): void;
}

/**
 * A phone cannot select text inside the terminal canvas. This shows the same text as a plain page, where the
 * phone's own long-press selection works, with buttons to copy the selection or everything shown.
 */
export function CopyOverlay({ text, onClose }: Props) {
  const t = useT();
  const [scope, setScope] = useState<TextScope>('screen');
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState('');
  const body = useRef<HTMLPreElement>(null);
  // A snapshot: new output must not move the text (or drop the selection) while it is being read.
  const [shown, setShown] = useState(() => text('screen'));
  const show = (next: TextScope): void => (setScope(next), setShown(text(next)));

  useEffect(() => {
    body.current?.scrollTo({ top: body.current.scrollHeight });
  }, [shown]);

  useEffect(() => {
    const onChange = (): void => {
      const range = window.getSelection();
      const inside = range !== null && body.current?.contains(range.anchorNode) === true;
      setSelected(inside ? range.toString() : '');
    };
    document.addEventListener('selectionchange', onChange);
    return () => document.removeEventListener('selectionchange', onChange);
  }, []);

  const copy = (): void => {
    copyText(selected === '' ? shown : selected).then(
      () => setNote(t('terminal.copied')),
      () => setNote(t('terminal.copyFailed')),
    );
  };

  return (
    <div className="copy-overlay" role="dialog" aria-label={t('terminal.copy')}>
      <div className="copy-bar">
        <button type="button" className="primary" onClick={copy}>
          {selected === '' ? t('terminal.copyAll') : t('terminal.copySelection')}
        </button>
        <button
          type="button"
          onClick={() => show(scope === 'screen' ? 'all' : 'screen')}
          aria-pressed={scope === 'all'}
        >
          {scope === 'screen' ? t('terminal.copyHistory') : t('terminal.copyScreen')}
        </button>
        <button type="button" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
      <p className="copy-hint">{note === '' ? t('terminal.copyHint') : note}</p>
      <pre ref={body} className="copy-text">
        {shown}
      </pre>
    </div>
  );
}
