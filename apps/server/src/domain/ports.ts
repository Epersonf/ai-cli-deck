import type {
  ChatEvent,
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

export interface ProcessSpec {
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd: string;
}

/** A background command (a task): output chunks, one exit, and a way to stop it. */
export interface ProcessHandle {
  onData(listener: (data: Uint8Array) => void): void;
  onExit(listener: (code: number | null) => void): void;
  kill(): void;
}

export interface ProcessPort {
  spawn(spec: ProcessSpec): ProcessHandle;
}

export interface SessionStorePort {
  load(): Promise<Session[]>;
  save(sessions: Session[]): Promise<void>;
}

/** The steps of each session's conversation, kept on disk so a chat survives restarts and reloads. */
export interface ChatLogPort {
  load(id: string): Promise<ChatEvent[]>;
  append(id: string, events: readonly ChatEvent[]): Promise<void>;
  /** Rewrites the log with exactly these events. */
  replace(id: string, events: readonly ChatEvent[]): Promise<void>;
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
  /** Files of the folder (and below) that match what was typed, best first; for `@` mentions. */
  find(root: string, query: string, limit: number): Promise<string[]>;
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
