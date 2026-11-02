import type { FileContent, FileEntry, GitStatus, Session } from '@deck/shared';
import { notFound } from '../domain/errors.js';
import type { FilesPort, GitPort, RawFileEntry } from '../domain/ports.js';

const IGNORED = new Set(['.git', 'node_modules']);
export const MAX_FILE_BYTES = 512 * 1024;

export function filterEntries(
  entries: readonly RawFileEntry[],
  showIgnored: boolean,
): RawFileEntry[] {
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
    const root = this.root(sessionId);
    const entries = filterEntries(await this.deps.files.list(root, relative), showIgnored);
    const ignored = await this.deps.git.ignoredPaths(
      root,
      entries.map((e) => e.path),
    );
    return entries.map((e) => ({ ...e, ignored: ignored.has(e.path) || IGNORED.has(e.name) }));
  }

  read(sessionId: string, relative: string): Promise<FileContent> {
    return this.deps.files.read(this.root(sessionId), relative, MAX_FILE_BYTES);
  }

  resolveFile(sessionId: string, relative: string): Promise<{ path: string; size: number }> {
    return this.deps.files.resolveFile(this.root(sessionId), relative);
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
