import { CHAT_META, parseLocalUrl, type Session } from '@deck/shared';
import type { AgentConfig } from '../domain/agent.js';
import { conflict, invalid } from '../domain/errors.js';
import type { SystemPort } from '../domain/ports.js';
import { existingDir } from './cwd.js';
import type { SessionRegistry } from './SessionRegistry.js';
import { withMeta } from './sessionMeta.js';

/** The small edits a session takes after it exists: notes, name, preview, base folder, worktree. */
export class SessionEdits {
  constructor(
    private readonly reg: SessionRegistry,
    private readonly system: SystemPort,
  ) {}

  get(id: string): Session | undefined {
    return this.reg.get(id);
  }

  /** Sets a note kept with the session (an empty value removes it). */
  async setMeta(id: string, key: string, value: string): Promise<Record<string, string>> {
    const meta = withMeta(this.reg.require(id).session.meta, key, value);
    this.reg.update(id, { meta });
    await this.reg.persist();
    return meta;
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

  /** Bases the session in another folder: Files, git status and chats follow it. The running program stays where it is. */
  async setCwd(id: string, path: string): Promise<Session> {
    const cwd = await existingDir(this.system, path, true);
    this.reg.update(id, { cwd });
    await this.reg.persist();
    return this.get(id) ?? this.reg.require(id).session;
  }

  /** Keeps what the conversation needs to survive a restart: the agent's chat id and the chosen settings. */
  async remember(id: string, patch: { chatId?: string; config?: AgentConfig }): Promise<void> {
    const runtime = this.reg.runtimes.get(id);
    if (!runtime) return;
    let meta = runtime.session.meta;
    if (patch.chatId !== undefined) {
      meta = withMeta(meta, CHAT_META.chat, patch.chatId);
      meta = withMeta(meta, CHAT_META.fork, '');
    }
    if (patch.config) {
      meta = withMeta(meta, CHAT_META.model, patch.config.model ?? '');
      meta = withMeta(meta, CHAT_META.mode, patch.config.mode);
      meta = withMeta(meta, CHAT_META.effort, patch.config.effort ?? '');
      meta = withMeta(meta, CHAT_META.autoCompact, String(patch.config.autoCompact ?? ''));
    }
    this.reg.update(id, { meta });
    await this.reg.persist();
  }

  applyWorktree(id: string, path: string, branch: string): void {
    const { worktree } = this.reg.require(id).session;
    if (worktree.path !== null) throw conflict('Session already has a worktree');
    this.reg.update(id, { cwd: path, worktree: { enabled: true, path, branch } });
    void this.reg.persist();
  }
}
