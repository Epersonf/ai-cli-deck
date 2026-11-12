import { PREVIEW_TABS_MAX } from '@deck/shared';
import { useT } from '../../shared/i18n/store';
import { usePreview } from './previewStore';
import type { PreviewTabs } from './previewTabs';
import { CloseIcon } from '../../shared/ui/ToolIcons';

interface Props {
  sessionId: string;
  tabs: PreviewTabs;
}

/** The tabs of a session's preview: each is a page of the deck's own browser, and all stay alive while another is shown. */
export function PreviewTabsBar({ sessionId, tabs }: Props) {
  const t = useT();
  const store = usePreview.getState();
  const full = tabs.list.length >= PREVIEW_TABS_MAX;
  return (
    <div className="preview-tabs" role="tablist">
      {tabs.list.map((n, index) => (
        <span key={n} className={`preview-tab-chip${n === tabs.active ? ' active' : ''}`}>
          <button
            type="button"
            role="tab"
            aria-selected={n === tabs.active}
            onClick={() => store.selectTab(sessionId, n)}
          >
            {t('preview.modeBrowser')}
            {tabs.list.length > 1 && ` ${index + 1}`}
          </button>
          <button
            type="button"
            className="preview-tab-close"
            title={t('preview.closeTab')}
            aria-label={t('preview.closeTab')}
            onClick={() => store.closeTab(sessionId, n)}
          >
            <CloseIcon size={12} />
          </button>
        </span>
      ))}
      <button
        type="button"
        className="preview-tab-add"
        disabled={full}
        title={t('preview.addTab')}
        aria-label={t('preview.addTab')}
        onClick={() => store.addTab(sessionId)}
      >
        +
      </button>
    </div>
  );
}
