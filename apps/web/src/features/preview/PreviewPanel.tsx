import { PEER_ID } from '../../shared/api/base';
import { BrowserInstall } from './BrowserInstall';
import { BrowserView } from './BrowserView';
import { FrameView } from './FrameView';
import { ModeSwitch } from './ModeSwitch';
import { currentUrl, modeOf, usePreview } from './previewStore';
import { useBrowserStatus } from './useBrowserStatus';

interface Props {
  sessionId: string;
  visible: boolean;
}

/** A session's preview: an iframe on this device, or the deck's Chromium that the agent also drives. */
export function PreviewPanel({ sessionId, visible }: Props) {
  const mode = usePreview((s) => modeOf(s.mode, sessionId));
  const url = usePreview((s) => currentUrl(s.byId[sessionId]));
  const [browser, setBrowser] = useBrowserStatus(mode === 'browser');
  // A paired deck's app always uses that deck's browser (its iframe would load this device's ports).
  const toggle = PEER_ID ? null : <ModeSwitch sessionId={sessionId} mode={mode} />;

  return (
    <section className={`pane preview-pane${visible ? '' : ' hidden'}`}>
      {mode === 'frame' ? (
        <FrameView sessionId={sessionId} toggle={toggle} />
      ) : browser?.installed ? (
        <BrowserView sessionId={sessionId} visible={visible} requested={url} toggle={toggle} />
      ) : (
        <BrowserInstall status={browser} onStatus={setBrowser} toggle={toggle} />
      )}
    </section>
  );
}
