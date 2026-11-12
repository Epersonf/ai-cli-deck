import { previewKey } from '@deck/shared';
import { useEffect } from 'react';
import { api } from '../../shared/api/endpoints';
import { BrowserInstall } from './BrowserInstall';
import { BrowserView } from './BrowserView';
import { currentUrl, tabsOf, usePreview } from './previewStore';
import { shareBrowserTabs } from './tabSync';
import { PreviewTabsBar } from './PreviewTabsBar';
import { firstTabs } from './previewTabs';
import { useBrowserStatus } from './useBrowserStatus';

interface Props {
  sessionId: string;
  visible: boolean;
}

/** A session's preview: tabs of the deck's own Chromium, the pages the agent also drives. */
export function PreviewPanel({ sessionId, visible }: Props) {
  const stored = usePreview((s) => s.tabs[sessionId]);
  const byId = usePreview((s) => s.byId);
  const tabs = stored ?? firstTabs();
  // Another device may already have tabs open for this session: show the same ones.
  useEffect(() => {
    void api
      .browserTabs(sessionId)
      .then(({ tabs: shared }) => {
        const store = usePreview.getState();
        if (shared) store.applyServerTabs(sessionId, shared);
        else shareBrowserTabs(sessionId, { list: [], active: 1 }, tabsOf(store.tabs, sessionId));
      })
      .catch(() => undefined);
  }, [sessionId]);
  const [browser, setBrowser] = useBrowserStatus(true);
  return (
    <section className={`pane preview-pane${visible ? '' : ' hidden'}`}>
      <PreviewTabsBar sessionId={sessionId} tabs={tabs} />
      {tabs.list.map((n) => {
        const key = previewKey(sessionId, n);
        return (
          <div key={n} className={`preview-tab${n === tabs.active ? '' : ' hidden'}`}>
            {browser?.installed ? (
              <BrowserView
                sessionId={key}
                visible={visible && n === tabs.active}
                requested={currentUrl(byId[key])}
              />
            ) : (
              <BrowserInstall status={browser} onStatus={setBrowser} />
            )}
          </div>
        );
      })}
    </section>
  );
}
