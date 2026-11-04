import { RESUME_KEY, type Session } from '@deck/shared';
import { conflict } from '../domain/errors.js';
import type { MultiplexerPort, PtyHandle, SessionStorePort } from '../domain/ports.js';
import type { PortAllocator } from './PortAllocator.js';
import type { ScreenSaver } from './ScreenSaver.js';
import type { SessionLauncher } from './SessionLauncher.js';
import { tmuxNameFor } from './SessionLauncher.js';
import type { SessionRegistry } from './SessionRegistry.js';
import { splitArgs } from './sessionMeta.js';

export interface LifecycleCtx {
  reg: SessionRegistry;
  launcher: SessionLauncher;
  mux: MultiplexerPort;
  store: SessionStorePort;
  ports: PortAllocator;
  screens: ScreenSaver;
  start(session: Session, spawn: () => PtyHandle): void;
}

/** After a server restart: live tmux sessions are re-attached, the rest keep showing their last screen. */
export async function restoreSessions(ctx: LifecycleCtx): Promise<void> {
  const live = new Set(await ctx.mux.list());
  for (const saved of await ctx.store.load()) {
    ctx.ports.reserve(saved.port);
    if (ctx.mux.available && live.has(tmuxNameFor(saved.id))) {
      ctx.start(saved, () => ctx.launcher.reattach(saved));
      continue;
    }
    const runtime = ctx.reg.runtimeOf({ ...saved, status: 'exited' });
    await ctx.screens.restoreInto(saved.id, runtime.ring);
    ctx.reg.runtimes.set(saved.id, runtime);
  }
}

/**
 * Starts an ended session again, in the same folder with the same profile. With `resume` and a saved
 * "resume" note, the note's arguments are handed to the session's own CLI, which then continues its chat.
 */
export async function restartSession(
  ctx: LifecycleCtx,
  id: string,
  resume: boolean,
): Promise<void> {
  const { session } = ctx.reg.require(id);
  if (session.status !== 'exited') throw conflict('Only an ended session can be restarted');
  const note = session.meta[RESUME_KEY];
  const args = resume && note ? splitArgs(note) : [];
  await ctx.mux.kill(tmuxNameFor(id));
  const from = ctx.reg.inheritFrom(session.parentId);
  ctx.start(session, () => ctx.launcher.launch(session, null, args, from));
}

/** Ends a session and, with it, the sub-terminals opened from it. */
export async function removeSession(ctx: LifecycleCtx, id: string): Promise<void> {
  const runtime = ctx.reg.require(id);
  for (const child of ctx.reg.childrenOf(id)) await removeSession(ctx, child.id);
  try {
    runtime.pty?.kill();
  } catch {
    // already exited: nothing left to kill
  }
  await ctx.mux.kill(tmuxNameFor(id));
  await ctx.screens.forget(id).catch(() => undefined);
  ctx.ports.release(runtime.session.port);
  ctx.reg.runtimes.delete(id);
  await ctx.reg.persist();
}
