import type { FileContent, FileEntry, GitStatus, Session } from '@deck/shared';
import { notFound } from '../domain/errors.js';
import type { FilesPort, GitPort } from '../domain/ports.js';

const IGNORED = new Set(['.git', 'node_modules']);
export const MAX_FILE_BYTES = 512 * 1024;

export function filterEntries(entries: readonly FileEntry[], showIgnored: boolean): FileEntry[] {
  const visible = showIgnored ? [...entries] : entries.filter((e) => !IGNORED.has(e.name));
  return visible.sort((a, b) =>
    a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1,
  );
}

export interface WorkspaceDeps {
  sessions: { get(id: string): Session | undefined };
  files: FilesPort;
  git: GitPort;
}

/** Read-only view of a session's working directory. */
export class WorkspaceService {
  constructor(private readonly deps: WorkspaceDeps) {}

  async tree(sessionId: string, relative: string, showIgnored: boolean): Promise<FileEntry[]> {
    const entries = await this.deps.files.list(this.root(sessionId), relative);
    return filterEntries(entries, showIgnored);
  }

  read(sessionId: string, relative: string): Promise<FileContent> {
    return this.deps.files.read(this.root(sessionId), relative, MAX_FILE_BYTES);
  }

  gitStatus(sessionId: string): Promise<GitStatus> {
    return this.deps.git.status(this.root(sessionId));
  }

  private root(sessionId: string): string {
    const session = this.deps.sessions.get(sessionId);
    if (!session) throw notFound(`Session ${sessionId}`);
    return session.cwd;
  }
}
