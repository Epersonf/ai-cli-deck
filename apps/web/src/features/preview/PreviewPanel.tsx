import { previewKey } from '@deck/shared';
import { useEffect } from 'react';
import { api } from '../../shared/api/endpoints';
import { BrowserInstall } from './BrowserInstall';
import { BrowserView } from './BrowserView';
import { FrameView } from './FrameView';
import { currentUrl, firstMode, tabsOf, usePreview } from './previewStore';
import { shareBrowserTabs } from './tabSync';
import { PreviewTabsBar } from './PreviewTabsBar';
import { firstTabs } from './previewTabs';
import { useBrowserStatus } from './useBrowserStatus';

interface Props {
  sessionId: string;
  visible: boolean;
}

/** A session's preview: an iframe on this device, or the deck's Chromium that the agent also drives. */
export function PreviewPanel({ sessionId, visible }: Props) {
  const stored = usePreview((s) => s.tabs[sessionId]);
  const byId = usePreview((s) => s.byId);
  const tabs = stored ?? firstTabs(firstMode());
  // Another device may already have browser tabs open for this session: show the same ones.
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
  const [browser, setBrowser] = useBrowserStatus(tabs.list.some((tab) => tab.mode === 'browser'));
  return (
    <section className={`pane preview-pane${visible ? '' : ' hidden'}`}>
      <PreviewTabsBar sessionId={sessionId} tabs={tabs} />
      {tabs.list.map((tab) => {
        const key = previewKey(sessionId, tab.n);
        const shown = visible && tab.n === tabs.active;
        return (
          <div key={tab.n} className={`preview-tab${tab.n === tabs.active ? '' : ' hidden'}`}>
            {tab.mode === 'frame' ? (
              <FrameView sessionId={sessionId} tabKey={key} visible={shown} toggle={null} />
            ) : browser?.installed ? (
              <BrowserView
                sessionId={key}
                visible={shown}
                requested={currentUrl(byId[key])}
                toggle={null}
              />
            ) : (
              <BrowserInstall status={browser} onStatus={setBrowser} toggle={null} />
            )}
          </div>
        );
      })}
    </section>
  );
}
