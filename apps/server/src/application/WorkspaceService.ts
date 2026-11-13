import type { FileContent, FileEntry, GitStatus, Session } from '@deck/shared';
import { notFound } from '../domain/errors.js';
import { resolveBrowse } from '../infrastructure/fs/pathGuard.js';
import type { FilesPort, GitPort, RawFileEntry } from '../domain/ports.js';

const IGNORED = new Set(['.git', 'node_modules']);
export const MAX_FILE_BYTES = 512 * 1024;

/** Sorts folders first; dotfiles/dotfolders are dropped unless `showHidden`. */
export function filterEntries(
  entries: readonly RawFileEntry[],
  showHidden: boolean,
): RawFileEntry[] {
  const visible = showHidden ? [...entries] : entries.filter((e) => !e.name.startsWith('.'));
  return visible.sort((a, b) =>
    a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1,
  );
}

export interface TreeOptions {
  /** Include dotfiles and dotfolders. */
  hidden: boolean;
  /** Include what git ignores (and node_modules, .git). */
  ignored: boolean;
}

export interface WorkspaceDeps {
  sessions: { get(id: string): Session | undefined };
  files: FilesPort;
  git: GitPort;
}

/** A session's working directory: browsing, reading and deleting files. */
export class WorkspaceService {
  constructor(private readonly deps: WorkspaceDeps) {}

  async tree(sessionId: string, relative: string, options: TreeOptions): Promise<FileEntry[]> {
    const root = this.root(sessionId);
    const entries = filterEntries(await this.deps.files.list(root, relative), options.hidden);
    const ignored = await this.deps.git.ignoredPaths(
      root,
      entries.map((e) => e.path),
    );
    const marked = entries.map((e) => ({
      ...e,
      ignored: ignored.has(e.path) || IGNORED.has(e.name),
    }));
    return options.ignored ? marked : marked.filter((e) => !e.ignored);
  }

  read(sessionId: string, relative: string): Promise<FileContent> {
    return this.deps.files.read(this.root(sessionId), relative, MAX_FILE_BYTES);
  }

  /** Absolute path of a folder inside the session folder, for zipping. */
  async resolveDir(sessionId: string, relative: string): Promise<string> {
    return resolveBrowse(this.root(sessionId), relative);
  }

  resolveFile(sessionId: string, relative: string): Promise<{ path: string; size: number }> {
    return this.deps.files.resolveFile(this.root(sessionId), relative);
  }

  remove(sessionId: string, relative: string): Promise<void> {
    return this.deps.files.remove(this.root(sessionId), relative);
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
