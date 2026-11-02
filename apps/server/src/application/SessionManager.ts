import { parseLocalUrl, type CreateSessionBody, type Session } from '@deck/shared';
import { conflict, invalid } from '../domain/errors.js';
import type { EventBus } from '../domain/events.js';
import type {
  MultiplexerPort,
  PtyHandle,
  ScrollbackStorePort,
  SessionStorePort,
  SystemPort,
} from '../domain/ports.js';
import type { PortAllocator } from './PortAllocator.js';
import { resolveCwd } from './cwd.js';
import { ScreenSaver } from './ScreenSaver.js';
import { wirePty } from './ptyWiring.js';
import type { SessionLauncher } from './SessionLauncher.js';
import { tmuxNameFor } from './SessionLauncher.js';
import { newSession } from './newSession.js';
import { SessionRegistry, type Runtime } from './SessionRegistry.js';

export interface SessionManagerDeps {
  launcher: SessionLauncher;
  mux: MultiplexerPort;
  store: SessionStorePort;
  scrollback: ScrollbackStorePort;
  ports: PortAllocator;
  system: SystemPort;
  bus: EventBus;
  replayBytes: number;
}

export class SessionManager {
  private readonly reg: SessionRegistry;
  /** Saves terminal screens to disk; started once by the composition root. */
  readonly screens: ScreenSaver;

  constructor(private readonly deps: SessionManagerDeps) {
    this.reg = new SessionRegistry(deps.store, deps.bus, deps.replayBytes);
    this.screens = new ScreenSaver(deps.scrollback, deps.mux, this.reg.runtimes);
  }

  readonly list = (): Session[] => this.reg.list();
  readonly get = (id: string): Session | undefined => this.reg.get(id);

  async create(body: CreateSessionBody): Promise<Session> {
    const { system, ports, mux } = this.deps;
    const cwd = resolveCwd(body.cwd, system.homeDir());
    if (!(await system.isDirectory(cwd))) throw invalid(`Not a directory: ${cwd}`);
    const session = newSession(body, cwd, await ports.allocate(), {
      id: system.newId(),
      now: system.now(),
      persistent: mux.available,
    });
    try {
      this.start(session, () => this.deps.launcher.launch(session, body.command, body.args));
    } catch (error) {
      ports.release(session.port);
      throw error;
    }
    await this.reg.persist();
    return this.get(session.id) ?? session;
  }

  /** An ended session keeps showing the screen it had when it died. */
  private async restoreEnded(saved: Session): Promise<void> {
    const runtime = this.reg.runtimeOf({ ...saved, status: 'exited' });
    await this.screens.restoreInto(saved.id, runtime.ring);
    this.reg.runtimes.set(saved.id, runtime);
  }

  async restore(): Promise<void> {
    const stored = await this.deps.store.load();
    const live = new Set(await this.deps.mux.list());
    for (const saved of stored) {
      this.deps.ports.reserve(saved.port);
      const canAttach = this.deps.mux.available && live.has(tmuxNameFor(saved.id));
      if (canAttach) this.start(saved, () => this.deps.launcher.reattach(saved));
      else await this.restoreEnded(saved);
    }
  }

  async remove(id: string): Promise<void> {
    const runtime = this.reg.require(id);
    runtime.pty?.kill();
    await this.deps.mux.kill(tmuxNameFor(id));
    await this.screens.forget(id);
    this.deps.ports.release(runtime.session.port);
    this.reg.runtimes.delete(id);
    await this.reg.persist();
  }

  sendInput(id: string, data: string): void {
    this.reg.require(id).pty?.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    this.reg.require(id).pty?.resize(cols, rows);
  }

  async replay(id: string): Promise<Uint8Array> {
    const runtime = this.reg.require(id);
    const captured = await this.deps.mux.capture(tmuxNameFor(id));
    return captured ?? runtime.ring.snapshot();
  }

  async rename(id: string, name: string | null): Promise<Session> {
    this.reg.update(id, { name });
    await this.reg.persist();
    return this.get(id) ?? this.reg.require(id).session;
  }

  setPreview(id: string, url: string): string {
    const safe = parseLocalUrl(url);
    if (safe === null) throw invalid('Preview URL must be http(s) on localhost');
    this.reg.update(id, { previewUrl: safe });
    return safe;
  }

  applyWorktree(id: string, path: string, branch: string): void {
    const { worktree } = this.reg.require(id).session;
    if (worktree.path !== null) throw conflict('Session already has a worktree');
    this.reg.update(id, { cwd: path, worktree: { enabled: true, path, branch } });
    void this.reg.persist();
  }

  private start(session: Session, spawn: () => PtyHandle): void {
    const pty = spawn();
    const runtime: Runtime = { ...this.reg.runtimeOf(session), pty };
    this.reg.runtimes.set(session.id, runtime);
    wirePty(
      pty,
      runtime.ring,
      session.id,
      this.deps.bus,
      () => {
        runtime.pty = null;
        this.reg.update(session.id, { status: 'exited' });
      },
      () => this.screens.touch(session.id),
    );
    this.reg.update(session.id, { status: 'running' });
  }
}
