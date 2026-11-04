import '@xterm/xterm/css/xterm.css';
import type { Terminal } from '@xterm/xterm';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { openTerminalSocket } from '../../shared/ws/terminalSocket';
import { useT } from '../../shared/i18n/store';
import { createTerminal } from './createTerminal';
import { dispatchMessage } from './dispatch';
import { attachImagePaste } from './pasteImage';
import { createLatencyMeter, type Latency } from './latencyMeter';
import { attachLocalEcho } from './localEcho';
import { RestartBar } from './RestartBar';
import { NO_MODS, applyModifiersToText } from './keymap';
import { createSizeSync, type SizeSync } from './sizeSync';
import { attachTouchScroll } from './touchScroll';
import type { ModifiersApi } from './useModifiers';

export interface TerminalApi {
  send(data: string): void;
  applicationCursor(): boolean;
}

interface Props {
  sessionId: string;
  visible: boolean;
  mods: ModifiersApi;
  apiRef: MutableRefObject<TerminalApi | null>;
}

const hasFinePointer = (): boolean => window.matchMedia('(pointer: fine)').matches;

export function TerminalView({ sessionId, visible, mods, apiRef }: Props) {
  const t = useT();
  const host = useRef<HTMLDivElement>(null);
  const syncRef = useRef<SizeSync | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const modsRef = useRef(mods);
  modsRef.current = mods;
  const [online, setOnline] = useState(false);
  const [following, setFollowing] = useState(false);
  const [latency, setLatency] = useState<Latency>({ net: null, echo: null });

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const { term, fit } = createTerminal(element, sessionId);
    termRef.current = term;

    const meter = createLatencyMeter();
    const echo = attachLocalEcho(term, meter.get);
    const claimIfActive = (): void => {
      if (document.hasFocus()) sync.claim();
    };
    const socket = openTerminalSocket(sessionId, {
      onOpen: () => {
        setOnline(true);
        term.reset();
        claimIfActive();
      },
      onClose: () => setOnline(false),
      onMessage: (message) => {
        if (message.type === 'pong') meter.pong();
        if (message.type === 'size') sync.onServerSize(message.cols, message.rows);
        if (message.type === 'status' && message.session.status === 'running') {
          if (document.hasFocus()) sync.sendIfOwner(); // restarted: the new process needs our size
        }
        if (message.type === 'output' && !message.replay) meter.output();
        dispatchMessage(sessionId, message, {
          write: (bytes) => term.write(bytes, echo.written),
          reset: () => term.reset(),
          note: (text) => term.write(`\r\n\x1b[2m[${text}]\x1b[0m\r\n`),
        });
      },
    });
    const sync = createSizeSync(
      term,
      fit,
      (cols, rows) => socket.send({ type: 'resize', cols, rows }),
      setFollowing,
    );
    syncRef.current = sync;
    const send = (data: string): void => socket.send({ type: 'input', data });
    apiRef.current = {
      send,
      applicationCursor: () => term.modes.applicationCursorKeysMode,
    };
    const probe = window.setInterval(() => {
      meter.ping();
      socket.send({ type: 'ping' });
      setLatency(meter.get());
    }, 3000);
    term.onData((data) => {
      meter.key();
      echo.input(data);
      if (sync.following) sync.claim(); // typing here means this is the device in use
      send(applyModifiersToText(data, data.length === 1 ? modsRef.current.take() : NO_MODS));
    });
    term.onResize(() => sync.sendIfOwner());
    window.addEventListener('focus', claimIfActive);

    const detachPaste = attachImagePaste(element, term, sessionId);
    const detachTouch = attachTouchScroll(term, element);

    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => element.clientWidth > 0 && sync.fit());
    });
    observer.observe(element);

    return () => {
      detachPaste();
      detachTouch();
      window.clearInterval(probe);
      window.removeEventListener('focus', claimIfActive);
      echo.dispose();
      observer.disconnect();
      cancelAnimationFrame(frame);
      socket.close();
      term.dispose();
      apiRef.current = null;
    };
  }, [sessionId, apiRef]);

  useEffect(() => {
    if (!visible) return;
    syncRef.current?.fit();
    if (hasFinePointer()) termRef.current?.focus();
  }, [visible]);

  return (
    <div className="terminal-wrap">
      <div ref={host} className={`terminal-host${following ? ' following' : ''}`} />
      <RestartBar sessionId={sessionId} />
      {following && (
        <button type="button" className="terminal-follow" onClick={() => syncRef.current?.claim()}>
          {t('terminal.following')}
        </button>
      )}
      {online && latency.net !== null && (
        <div className="terminal-latency" title={t('terminal.latencyTip')}>
          {`${Math.round(latency.net)} ms`}
          {latency.echo !== null && ` · ${Math.round(latency.echo)} ms`}
        </div>
      )}
      {!online && <div className="terminal-offline">{t('terminal.reconnecting')}</div>}
    </div>
  );
}
