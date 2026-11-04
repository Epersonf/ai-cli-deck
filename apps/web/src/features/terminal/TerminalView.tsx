import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { openTerminalSocket } from '../../shared/ws/terminalSocket';
import { useT } from '../../shared/i18n/store';
import { dispatchMessage } from './dispatch';
import { attachImagePaste } from './pasteImage';
import { isPasteShortcut } from './pasteShortcut';
import { attachWheelScroll } from './wheelScroll';
import { createLatencyMeter, type Latency } from './latencyMeter';
import { attachLocalEcho } from './localEcho';
import { openLink } from './openLink';
import { RestartBar } from './RestartBar';
import { tameMobileKeyboard } from './mobileKeyboard';
import { NO_MODS, applyModifiersToText } from './keymap';
import { TERMINAL_THEME } from './theme';
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
  const fitRef = useRef<FitAddon | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const modsRef = useRef(mods);
  modsRef.current = mods;
  const [online, setOnline] = useState(false);
  const [latency, setLatency] = useState<Latency>({ net: null, echo: null });

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const term = new Terminal({
      fontSize: 13,
      fontFamily:
        'ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", "Noto Sans Mono", monospace',
      cursorBlink: true,
      scrollback: 3000,
      theme: TERMINAL_THEME,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon((_event, uri) => openLink(sessionId, uri)));
    term.open(element);
    // Let the browser paste (text, or an image that is uploaded) instead of sending ^V to the CLI.
    term.attachCustomKeyEventHandler((event) => !isPasteShortcut(event));
    attachWheelScroll(term);
    tameMobileKeyboard(term);
    termRef.current = term;
    fitRef.current = fit;

    const meter = createLatencyMeter();
    const echo = attachLocalEcho(term, meter.get);
    const socket = openTerminalSocket(sessionId, {
      onOpen: () => {
        setOnline(true);
        term.reset();
        claimSize();
      },
      onClose: () => setOnline(false),
      onMessage: (message) => {
        if (message.type === 'pong') meter.pong();
        if (message.type === 'status' && message.session.status === 'running') claimSize(); // restarted
        if (message.type === 'output' && !message.replay) meter.output();
        dispatchMessage(sessionId, message, {
          write: (bytes) => term.write(bytes, echo.written),
          reset: () => term.reset(),
          note: (text) => term.write(`\r\n\x1b[2m[${text}]\x1b[0m\r\n`),
        });
      },
    });
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
      send(applyModifiersToText(data, data.length === 1 ? modsRef.current.take() : NO_MODS));
    });
    // Several devices on one session: only the focused one sets the size.
    const claimSize = (): void => {
      if (document.hasFocus()) socket.send({ type: 'resize', cols: term.cols, rows: term.rows });
    };
    term.onResize(claimSize);
    window.addEventListener('focus', claimSize);

    const detachPaste = attachImagePaste(element, term, sessionId);

    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => element.clientWidth > 0 && fit.fit());
    });
    observer.observe(element);

    return () => {
      detachPaste();
      window.clearInterval(probe);
      window.removeEventListener('focus', claimSize);
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
    fitRef.current?.fit();
    if (hasFinePointer()) termRef.current?.focus();
  }, [visible]);

  return (
    <div className="terminal-wrap">
      <div ref={host} className="terminal-host" />
      <RestartBar sessionId={sessionId} />
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
