import '@xterm/xterm/css/xterm.css';
import type { Terminal } from '@xterm/xterm';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { openTerminalSocket } from '../../shared/ws/terminalSocket';
import { FONT_SIZE, createTerminal } from './createTerminal';
import { dispatchMessage } from './dispatch';
import { createFitter, laidOut } from './fitter';
import { attachImagePaste } from './pasteImage';
import { createLatencyMeter, type Latency } from './latencyMeter';
import { attachLocalEcho } from './localEcho';
import { RestartBar } from './RestartBar';
import { TerminalBadges } from './TerminalBadges';
import { NO_MODS, applyModifiersToText } from './keymap';
import { createSizeSync, type SizeSync } from './sizeSync';
import { resyncWhenShown } from './scrollbarSync';
import { terminalApi, type TerminalApi } from './terminalApi';
import { attachTouchScroll } from './touchScroll';
import type { ModifiersApi } from './useModifiers';

export type { TerminalApi } from './terminalApi';

interface Props {
  sessionId: string;
  visible: boolean;
  mods: ModifiersApi;
  apiRef: MutableRefObject<TerminalApi | null>;
}

const hasFinePointer = (): boolean => window.matchMedia('(pointer: fine)').matches;

export function TerminalView({ sessionId, visible, mods, apiRef }: Props) {
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
    // True once the server says tmux sits in between: tmux then answers the program's queries itself.
    let upstream = false;
    const { term, fit, search } = createTerminal(element, sessionId, () => upstream);
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
      onOutput: (bytes, replay) => {
        if (!replay) meter.output();
        term.write(bytes, echo.written);
      },
      onMessage: (message) => {
        if (message.type === 'pong') meter.pong();
        if (message.type === 'size') sync.onServerSize(message.cols, message.rows);
        if (message.type === 'status') {
          upstream = message.session.persistent;
          // Restarted: the new process needs our size.
          if (message.session.status === 'running' && document.hasFocus()) sync.sendIfOwner();
        }
        dispatchMessage(sessionId, message, {
          note: (text) => term.write(`\r\n\x1b[2m[${text}]\x1b[0m\r\n`),
        });
      },
    });
    const sync = createSizeSync(
      term,
      createFitter(term, fit, element, FONT_SIZE),
      // Only a terminal that is really on screen has a size worth giving the program.
      (cols, rows) => laidOut(element) && socket.send({ type: 'resize', cols, rows }),
      setFollowing,
    );
    syncRef.current = sync;
    const send = (data: string): void => socket.send({ type: 'input', data });
    apiRef.current = terminalApi(term, search, send);
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
    const detachShown = resyncWhenShown(term, element);

    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => sync.fit());
    });
    observer.observe(element);

    return () => {
      detachPaste();
      detachTouch();
      detachShown();
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
      <TerminalBadges
        online={online}
        following={following}
        latency={latency}
        claim={() => syncRef.current?.claim()}
      />
    </div>
  );
}
