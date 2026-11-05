import type { Session } from '@deck/shared';
import { conflict } from '../domain/errors.js';
import type { MultiplexerPort, PtyHandle, SessionStorePort } from '../domain/ports.js';
import type { PortAllocator } from './PortAllocator.js';
import type { ScreenSaver } from './ScreenSaver.js';
import type { SessionLauncher } from './SessionLauncher.js';
import { tmuxNameFor } from './SessionLauncher.js';
import type { SessionRegistry } from './SessionRegistry.js';
import type { StartOptions } from './startRuntime.js';

export interface LifecycleCtx {
  reg: SessionRegistry;
  launcher: SessionLauncher;
  mux: MultiplexerPort;
  store: SessionStorePort;
  ports: PortAllocator;
  screens: ScreenSaver;
  start(session: Session, spawn: () => PtyHandle, options?: StartOptions): void;
}

/** After a server restart: live tmux sessions are re-attached, the rest keep showing their last screen. */
export async function restoreSessions(ctx: LifecycleCtx): Promise<void> {
  const live = new Set(await ctx.mux.list());
  for (const saved of await ctx.store.load()) {
    ctx.ports.reserve(saved.port);
    if (ctx.mux.available && live.has(tmuxNameFor(saved.id))) {
      ctx.start(saved, () => ctx.launcher.reattach(saved), { fresh: false });
      continue;
    }
    const runtime = ctx.reg.runtimeOf({ ...saved, status: 'exited' });
    await ctx.screens.restoreInto(saved.id, runtime.ring);
    ctx.reg.runtimes.set(saved.id, runtime);
  }
}

/**
 * Starts an ended session again in the same folder, with `args` for its CLI. The profile may change (a
 * conversation moved to another AI); the terminal keeps its size.
 */
export async function restartSession(
  ctx: LifecycleCtx,
  id: string,
  plan: { provider: string; args: readonly string[] },
): Promise<void> {
  const { session, size } = ctx.reg.require(id);
  if (session.status !== 'exited') throw conflict('Only an ended session can be restarted');
  await ctx.mux.kill(tmuxNameFor(id));
  const from = ctx.reg.inheritFrom(session.parentId);
  const next: Session = { ...session, provider: plan.provider };
  const spawn = (): PtyHandle =>
    ctx.launcher.launch(next, null, plan.args, from, size ?? undefined);
  ctx.start(next, spawn, { size });
  await ctx.reg.persist();
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
