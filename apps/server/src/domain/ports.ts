import type {
  FileContent,
  FileEntry,
  GitChange,
  GitDiff,
  GitReview,
  GitStatus,
  Profile,
  ProfileTemplate,
  Session,
} from '@deck/shared';

export interface LaunchSpec {
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd: string;
}

export interface PtyHandle {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  onData(listener: (data: Uint8Array) => void): void;
  onExit(listener: (code: number | null) => void): void;
  kill(): void;
  /**
   * The screen as it is (scrollback, cursor, modes), handed over at an exact point of the output: what
   * `onData` gave before `done` runs is part of it, what comes after is not. Null when it is not available.
   */
  snapshot?(done: (screen: Uint8Array | null) => void): void;
}

export interface PtyPort {
  spawn(spec: LaunchSpec, size: { cols: number; rows: number }): PtyHandle;
}

export interface MultiplexerPort {
  /** True when sessions outlive the server (tmux). */
  readonly available: boolean;
  /** Starts `spec` as the session `name`. */
  launch(name: string, spec: LaunchSpec, size: { cols: number; rows: number }): PtyHandle;
  /** Connects again to a session that outlived a server restart. */
  reattach(name: string, spec: LaunchSpec): PtyHandle;
  list(): Promise<string[]>;
  capture(name: string): Promise<Uint8Array | null>;
  kill(name: string): Promise<void>;
}

export interface SessionStorePort {
  load(): Promise<Session[]>;
  save(sessions: Session[]): Promise<void>;
}

/** Last screen contents of each terminal, so a dead session can still be read after a restart. */
export interface ScrollbackStorePort {
  load(id: string): Promise<Uint8Array | null>;
  save(id: string, data: Uint8Array): Promise<void>;
  remove(id: string): Promise<void>;
}

/** Profile templates imported by the user (the built-in ones are code). */
export interface TemplateStorePort {
  load(): Promise<ProfileTemplate[]>;
  save(template: ProfileTemplate): Promise<void>;
  remove(id: string): Promise<void>;
}

/** The phone the deck runs on (Android app bridge). Only exists when the user turned "Phone access" on. */
export interface PhonePort {
  /** `timeoutMs`: how long to wait for an answer (changes that need the person's tap wait longer). */
  request(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    timeoutMs?: number,
  ): Promise<unknown>;
}

export interface ProfileStorePort {
  load(): Promise<Profile[]>;
  save(profiles: Profile[]): Promise<void>;
}

export interface WorktreePort {
  add(input: { repoDir: string; branch: string; targetPath: string }): Promise<void>;
}

export type RawFileEntry = Omit<FileEntry, 'ignored'>;

export interface FilesPort {
  list(root: string, relative: string): Promise<RawFileEntry[]>;
  read(root: string, relative: string, maxBytes: number): Promise<FileContent>;
  resolveFile(root: string, relative: string): Promise<{ path: string; size: number }>;
  /** Deletes a file or a folder (recursively); a symlink is removed, never its target. The root is refused. */
  remove(root: string, relative: string): Promise<void>;
}

export interface GitPort {
  status(cwd: string): Promise<GitStatus>;
  /** Subset of `paths` (relative to cwd) that git ignores; empty outside a repository. */
  ignoredPaths(cwd: string, paths: readonly string[]): Promise<Set<string>>;
}

/** Reviewing a repository's changes. `root` is the repository's top folder. */
export interface GitReviewPort {
  root(cwd: string): Promise<string | null>;
  status(root: string): Promise<Pick<GitReview, 'branch' | 'ahead' | 'changes'>>;
  diff(root: string, change: GitChange): Promise<GitDiff>;
  discard(root: string, change: GitChange): Promise<void>;
  /** Commits exactly these changes; returns git's summary. */
  commit(root: string, message: string, changes: readonly GitChange[]): Promise<string>;
  push(root: string): Promise<string>;
}

export interface SystemPort {
  homeDir(): string;
  isDirectory(path: string): Promise<boolean>;
  isPortFree(port: number): Promise<boolean>;
  newId(): string;
  now(): Date;
}
