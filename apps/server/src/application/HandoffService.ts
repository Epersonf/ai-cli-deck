import { FORK_KEY, type HandoffInfo, type Session } from '@deck/shared';
import { conflict, invalid, notFound } from '../domain/errors.js';
import type { HandoffStorePort } from '../domain/ports.js';
import type { SessionManager } from './SessionManager.js';
import { splitArgs } from './sessionMeta.js';

const MAX_HANDOFF = 8000;
const SUBMIT_DELAY_MS = 250;

/** The one line typed into a running agent when the user forks or moves its chat. */
export const HANDOFF_REQUEST =
  '[deck] The user is about to fork or move this chat. Write a short handoff for whoever continues it ' +
  '(done, what is left, decisions, key files) with `clideck handoff "<text>"` or the session_handoff tool, ' +
  'then carry on. Do this only when the deck asks, never on your own.';

export interface ForkRequest {
  /** Profile for the new terminal; the same one when omitted. */
  provider?: string | undefined;
  /** When it cannot be forked natively, start the new chat from the handoff note (if there is one). */
  useHandoff: boolean;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Forking and moving chats: the agents write the notes; the deck only passes them on. */
export class HandoffService {
  constructor(
    private readonly sessions: SessionManager,
    private readonly store: HandoffStorePort,
    private readonly wait: (ms: number) => Promise<void> = sleep,
  ) {}

  async save(id: string, text: string): Promise<HandoffInfo> {
    if (text.trim() === '') throw invalid('Handoff is empty');
    if (text.length > MAX_HANDOFF)
      throw invalid(`Handoff too long (max ${MAX_HANDOFF} characters)`);
    await this.store.write(id, text);
    return this.require(id);
  }

  info(id: string): Promise<HandoffInfo | null> {
    return this.store.info(id);
  }

  private async require(id: string): Promise<HandoffInfo> {
    const info = await this.store.info(id);
    if (!info) throw notFound(`Handoff for ${id}`);
    return info;
  }

  forget(id: string): Promise<void> {
    return this.store.remove(id);
  }

  /** Types the request into the agent's terminal. Typed text first, Enter a moment later (it is not a paste). */
  async request(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) throw notFound(`Session ${id}`);
    if (session.status !== 'running') throw conflict('The terminal has ended: nothing to ask');
    this.sessions.sendInput(id, HANDOFF_REQUEST);
    await this.wait(SUBMIT_DELAY_MS);
    this.sessions.sendInput(id, '\r');
  }

  /** A new terminal in the same folder, continuing this chat as well as the CLIs allow. */
  async fork(id: string, request: ForkRequest): Promise<Session> {
    const source = this.sessions.get(id);
    if (!source) throw notFound(`Session ${id}`);
    if (source.parentId !== null) throw invalid('A sub-terminal cannot be forked');
    const provider = request.provider ?? source.provider;
    return this.sessions.create({
      provider,
      cwd: source.cwd,
      useWorktree: false,
      command: null,
      args: await this.argsFor(source, provider, request.useHandoff),
      parentId: null,
    });
  }

  private async argsFor(source: Session, provider: string, useHandoff: boolean): Promise<string[]> {
    const native = source.meta[FORK_KEY];
    // Same profile and the agent knows how its CLI forks: the CLI copies the chat itself.
    if (provider === source.provider && native) return splitArgs(native);
    if (!useHandoff || provider === 'shell' || !(await this.store.info(source.id))) return [];
    return [
      `Another chat was working in this folder. Read ${this.store.pathOf(source.id)} for its handoff, then continue the work.`,
    ];
  }
}
