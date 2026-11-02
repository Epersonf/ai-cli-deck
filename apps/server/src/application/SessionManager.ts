import { parseLocalUrl, type CreateSessionBody, type Session } from '@deck/shared';
import { conflict, invalid, notFound } from '../domain/errors.js';
import type { EventBus } from '../domain/events.js';
import type { MultiplexerPort, PtyHandle, SessionStorePort, SystemPort } from '../domain/ports.js';
import type { PortAllocator } from './PortAllocator.js';
import { resolveCwd } from './cwd.js';
import { wirePty } from './ptyWiring.js';
import { RingBuffer } from './RingBuffer.js';
import type { SessionLauncher } from './SessionLauncher.js';
import { tmuxNameFor } from './SessionLauncher.js';
import { newSession } from './newSession.js';
import { withSharedCwd } from './sharedCwd.js';

export interface SessionManagerDeps {
  launcher: SessionLauncher;
  mux: MultiplexerPort;
  store: SessionStorePort;
  ports: PortAllocator;
  system: SystemPort;
  bus: EventBus;
  replayBytes: number;
}

interface Runtime {
  session: Session;
  pty: PtyHandle | null;
  ring: RingBuffer;
}

export class SessionManager {
  private readonly runtimes = new Map<string, Runtime>();

  constructor(private readonly deps: SessionManagerDeps) {}

  list(): Session[] {
    return withSharedCwd([...this.runtimes.values()].map((r) => r.session));
  }

  get(id: string): Session | undefined {
    return this.list().find((s) => s.id === id);
  }

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
    await this.persist();
    return this.get(session.id) ?? session;
  }

  async restore(): Promise<void> {
    const stored = await this.deps.store.load();
    const live = new Set(await this.deps.mux.list());
    for (const saved of stored) {
      this.deps.ports.reserve(saved.port);
      const canAttach = this.deps.mux.available && live.has(tmuxNameFor(saved.id));
      if (canAttach) this.start(saved, () => this.deps.launcher.reattach(saved));
      else this.runtimes.set(saved.id, this.runtimeOf({ ...saved, status: 'exited' }));
    }
  }

  async remove(id: string): Promise<void> {
    const runtime = this.require(id);
    runtime.pty?.kill();
    await this.deps.mux.kill(tmuxNameFor(id));
    this.deps.ports.release(runtime.session.port);
    this.runtimes.delete(id);
    await this.persist();
  }

  sendInput(id: string, data: string): void {
    this.require(id).pty?.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    this.require(id).pty?.resize(cols, rows);
  }

  async replay(id: string): Promise<Uint8Array> {
    const runtime = this.require(id);
    const captured = await this.deps.mux.capture(tmuxNameFor(id));
    return captured ?? runtime.ring.snapshot();
  }

  async rename(id: string, name: string | null): Promise<Session> {
    this.update(id, { name });
    await this.persist();
    return this.get(id) ?? this.require(id).session;
  }

  setPreview(id: string, url: string): string {
    const safe = parseLocalUrl(url);
    if (safe === null) throw invalid('Preview URL must be http(s) on localhost');
    this.update(id, { previewUrl: safe });
    return safe;
  }

  applyWorktree(id: string, path: string, branch: string): void {
    const { worktree } = this.require(id).session;
    if (worktree.path !== null) throw conflict('Session already has a worktree');
    this.update(id, { cwd: path, worktree: { enabled: true, path, branch } });
    void this.persist();
  }

  private start(session: Session, spawn: () => PtyHandle): void {
    const pty = spawn();
    const runtime: Runtime = { ...this.runtimeOf(session), pty };
    this.runtimes.set(session.id, runtime);
    wirePty(pty, runtime.ring, session.id, this.deps.bus, () => {
      runtime.pty = null;
      this.update(session.id, { status: 'exited' });
    });
    this.update(session.id, { status: 'running' });
  }

  private runtimeOf(session: Session): Runtime {
    return { session, pty: null, ring: new RingBuffer(this.deps.replayBytes) };
  }

  private update(id: string, patch: Partial<Session>): void {
    const runtime = this.require(id);
    runtime.session = { ...runtime.session, ...patch };
    const fresh = this.get(id);
    if (fresh) this.deps.bus.publish({ kind: 'session', session: fresh });
  }

  private require(id: string): Runtime {
    const runtime = this.runtimes.get(id);
    if (!runtime) throw notFound(`Session ${id}`);
    return runtime;
  }

  private persist(): Promise<void> {
    return this.deps.store.save([...this.runtimes.values()].map((r) => r.session));
  }
}
