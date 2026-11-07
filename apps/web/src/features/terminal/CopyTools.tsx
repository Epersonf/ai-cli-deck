import { useState } from 'react';
import { useT } from '../../shared/i18n/store';
import type { TextScope } from './bufferText';
import { CopyOverlay } from './CopyOverlay';

/** The "Copy text" button of a terminal (touch screens only, see terminalTools.css) and the page it opens. */
export function CopyTools({ text }: { text(scope: TextScope): string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="terminal-copy"
        title={t('terminal.copy')}
        aria-label={t('terminal.copy')}
        onClick={() => setOpen(true)}
      >
        {t('terminal.copy')}
      </button>
      {open && <CopyOverlay text={text} onClose={() => setOpen(false)} />}
    </>
  );
}
