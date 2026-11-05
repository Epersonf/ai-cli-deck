import { useT } from '../../shared/i18n/store';
import { usePreview, type PreviewMode } from './previewStore';

const MODES: readonly PreviewMode[] = ['frame', 'browser'];

/** Iframe (fast, drawn by this device) or the deck's Chromium (the one the agent sees and drives). */
export function ModeSwitch({ sessionId, mode }: { sessionId: string; mode: PreviewMode }) {
  const t = useT();
  const labels = { frame: t('preview.modeFrame'), browser: t('preview.modeBrowser') } as const;
  return (
    <div className="mode-switch" role="group" title={t('preview.modeHint')}>
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          className={m === mode ? 'active' : ''}
          aria-pressed={m === mode}
          onClick={() => usePreview.getState().setMode(sessionId, m)}
        >
          {labels[m]}
        </button>
      ))}
    </div>
  );
}
