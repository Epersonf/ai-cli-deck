import { PREVIEW_TABS_MAX } from '@deck/shared';
import { useState } from 'react';
import { useT } from '../../shared/i18n/store';
import { AddTabDialog } from './AddTabDialog';
import { usePreview } from './previewStore';
import type { PreviewMode, PreviewTabs } from './previewTabs';

interface Props {
  sessionId: string;
  tabs: PreviewTabs;
}

/**
 * The tabs of a session's preview. Each one is an iframe (fast, on this device) or a page of the deck's own
 * browser; all of them stay alive while another is shown.
 */
export function PreviewTabsBar({ sessionId, tabs }: Props) {
  const t = useT();
  const labels: Record<PreviewMode, string> = {
    frame: t('preview.modeFrame'),
    browser: t('preview.modeBrowser'),
  };
  const [picking, setPicking] = useState(false);
  const store = usePreview.getState();
  const full = tabs.list.length >= PREVIEW_TABS_MAX;
  return (
    <div className="preview-tabs" role="tablist" title={t('preview.modeHint')}>
      {tabs.list.map((tab, index) => (
        <span key={tab.n} className={`preview-tab-chip${tab.n === tabs.active ? ' active' : ''}`}>
          <button
            type="button"
            role="tab"
            aria-selected={tab.n === tabs.active}
            onClick={() => store.selectTab(sessionId, tab.n)}
          >
            {labels[tab.mode]}
            {tabs.list.filter((other) => other.mode === tab.mode).length > 1 && ` ${index + 1}`}
          </button>
          {(tabs.list.length > 1 || tab.mode === 'browser') && (
            <button
              type="button"
              className="preview-tab-close"
              title={t('preview.closeTab')}
              aria-label={t('preview.closeTab')}
              onClick={() => store.closeTab(sessionId, tab.n)}
            >
              ✕
            </button>
          )}
        </span>
      ))}
      <button
        type="button"
        className="preview-tab-add"
        disabled={full}
        title={t('preview.addTab')}
        aria-label={t('preview.addTab')}
        onClick={() => setPicking(true)}
      >
        +
      </button>
      {picking && (
        <AddTabDialog
          onClose={() => setPicking(false)}
          onPick={(mode) => (setPicking(false), store.addTab(sessionId, mode))}
        />
      )}
    </div>
  );
}
