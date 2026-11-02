import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { openTerminalSocket } from '../../shared/ws/terminalSocket';
import { usePreview, previewable } from '../preview/previewStore';
import { useT } from '../../shared/i18n/store';
import { showSidePane } from '../layout/layoutStore';
import { dispatchMessage } from './dispatch';
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

function openLink(sessionId: string, uri: string): void {
  if (previewable(uri, window.location.origin) !== null) {
    usePreview.getState().open(sessionId, uri);
    showSidePane('preview');
  } else {
    window.open(uri, '_blank', 'noopener,noreferrer');
  }
}

export function TerminalView({ sessionId, visible, mods, apiRef }: Props) {
  const t = useT();
  const host = useRef<HTMLDivElement>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const modsRef = useRef(mods);
  modsRef.current = mods;
  const [online, setOnline] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const term = new Terminal({
      fontSize: 13,
      fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
      cursorBlink: true,
      scrollback: 3000,
      theme: TERMINAL_THEME,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon((_event, uri) => openLink(sessionId, uri)));
    term.open(element);
    termRef.current = term;
    fitRef.current = fit;

    const socket = openTerminalSocket(sessionId, {
      onOpen: () => {
        setOnline(true);
        term.reset();
        socket.send({ type: 'resize', cols: term.cols, rows: term.rows });
      },
      onClose: () => setOnline(false),
      onMessage: (message) =>
        dispatchMessage(sessionId, message, {
          write: (bytes) => term.write(bytes),
          reset: () => term.reset(),
          note: (text) => term.write(`\r\n\x1b[2m[${text}]\x1b[0m\r\n`),
        }),
    });
    const send = (data: string): void => socket.send({ type: 'input', data });
    apiRef.current = {
      send,
      applicationCursor: () => term.modes.applicationCursorKeysMode,
    };
    term.onData((data) =>
      send(applyModifiersToText(data, data.length === 1 ? modsRef.current.take() : NO_MODS)),
    );
    term.onResize(({ cols, rows }) => socket.send({ type: 'resize', cols, rows }));

    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => element.clientWidth > 0 && fit.fit());
    });
    observer.observe(element);

    return () => {
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
      {!online && <div className="terminal-offline">{t('terminal.reconnecting')}</div>}
    </div>
  );
}
