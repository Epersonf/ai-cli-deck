import type {
  FileContent,
  FileEntry,
  GitStatus,
  HandoffInfo,
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
}

export interface PtyPort {
  spawn(spec: LaunchSpec, size: { cols: number; rows: number }): PtyHandle;
}

export interface MultiplexerPort {
  readonly available: boolean;
  wrap(name: string, spec: LaunchSpec): LaunchSpec;
  attach(name: string, spec: LaunchSpec): LaunchSpec;
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

/** The handoff note an agent writes when its chat is about to be forked or moved (one file per session). */
export interface HandoffStorePort {
  pathOf(id: string): string;
  write(id: string, text: string): Promise<void>;
  info(id: string): Promise<HandoffInfo | null>;
  remove(id: string): Promise<void>;
}

/** Profile templates imported by the user (the built-in ones are code). */
export interface TemplateStorePort {
  load(): Promise<ProfileTemplate[]>;
  save(template: ProfileTemplate): Promise<void>;
  remove(id: string): Promise<void>;
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

export interface SystemPort {
  homeDir(): string;
  isDirectory(path: string): Promise<boolean>;
  isPortFree(port: number): Promise<boolean>;
  newId(): string;
  now(): Date;
}
