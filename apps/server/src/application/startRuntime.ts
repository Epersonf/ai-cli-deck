import { CHAT_META, type Session } from '@deck/shared';
import type { EventBus } from '../domain/events.js';
import type { PtyHandle } from '../domain/ports.js';
import { wirePty } from './ptyWiring.js';
import type { ScreenSaver } from './ScreenSaver.js';
import type { Runtime, SessionRegistry } from './SessionRegistry.js';
import { withMeta } from './sessionMeta.js';

export interface StartOptions {
  /** The size the program is given (kept across a restart, so it does not come back at 80x24). */
  size?: Runtime['size'];
  /** False when re-attaching to a program that was already running: its run did not start now. */
  fresh?: boolean;
}

export interface StartDeps {
  reg: SessionRegistry;
  bus: EventBus;
  screens: ScreenSaver;
  now(): Date;
}

/** Runs a session's program and wires it up; a fresh run notes when it started (its chat is the one used since). */
export function startRuntime(
  deps: StartDeps,
  session: Session,
  spawn: () => PtyHandle,
  options: StartOptions = {},
): void {
  const pty = spawn();
  const runtime: Runtime = { ...deps.reg.runtimeOf(session), pty, size: options.size ?? null };
  deps.reg.runtimes.set(session.id, runtime);
  const touched = (): void => deps.screens.touch(session.id);
  wirePty(pty, runtime.ring, session.id, deps.bus, () => deps.reg.ended(runtime), touched);
  const meta =
    options.fresh === false
      ? session.meta
      : withMeta(session.meta, CHAT_META.runAt, deps.now().toISOString());
  deps.reg.update(session.id, { status: 'running', meta });
}
