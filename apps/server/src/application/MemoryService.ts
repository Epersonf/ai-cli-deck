import type { ImportMemoryBody, MemoryEntry, MemoryScope, MemoryTree } from '@deck/shared';
import { invalid } from '../domain/errors.js';
import type { EventBus } from '../domain/events.js';
import { memoryBriefing } from './memoryBriefing.js';
import { emptyTree } from './memoryFolders.js';
import { MemoryFolderActions } from './MemoryFolderActions.js';
import { importInto } from './memoryImport.js';
import { MemoryNoteActions } from './MemoryNoteActions.js';

export interface MemoryStorePort {
  /** Every saved tree by key: `global` or `profile:<id>`. */
  loadAll(): Promise<Record<string, MemoryTree>>;
  save(key: string, tree: MemoryTree): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface MemoryDeps {
  store: MemoryStorePort;
  bus: EventBus;
  newId(): string;
  now(): Date;
}

const SAFE_PROFILE = /^[a-z0-9][a-z0-9-]*$/;

/** The deck's notes: global ones and one set per profile, each with folders. Kept in memory, saved on every change. */
export class MemoryService {
  private trees = new Map<string, MemoryTree>();
  private queue: Promise<unknown> = Promise.resolve();
  /** Making, renaming, moving and deleting folders. */
  readonly folders: MemoryFolderActions;
  /** Writing, editing and deleting notes. */
  readonly notes: MemoryNoteActions;

  constructor(private readonly deps: MemoryDeps) {
    this.folders = new MemoryFolderActions(this, deps.newId);
    this.notes = new MemoryNoteActions(this, deps.newId, deps.now);
  }

  async restore(): Promise<void> {
    this.trees = new Map(Object.entries(await this.deps.store.loadAll()));
  }

  private key(scope: MemoryScope, profileId: string | null): string {
    if (scope === 'global') return 'global';
    if (!profileId || !SAFE_PROFILE.test(profileId))
      throw invalid('A profile note needs a profile');
    return `profile:${profileId}`;
  }

  tree(scope: MemoryScope, profileId: string | null = null): MemoryTree {
    return this.trees.get(this.key(scope, profileId)) ?? emptyTree();
  }

  /** The note with this id, wherever it is. */
  entry(id: string): MemoryEntry | undefined {
    return [...this.trees.values()].flatMap((t) => t.entries).find((e) => e.id === id);
  }

  /** Which scope and profile a folder belongs to. */
  holderOfFolder(id: string): { scope: MemoryScope; profileId: string | null } | undefined {
    return [...this.trees.values()].flatMap((t) => t.folders).find((f) => f.id === id);
  }

  /** The profile ids that have memory of their own. */
  profileIds(): string[] {
    return [...this.trees.keys()].filter((k) => k.startsWith('profile:')).map((k) => k.slice(8));
  }

  briefing(profileId: string): string {
    return memoryBriefing(this.tree('global'), this.tree('profile', profileId));
  }

  /** Changes one tree: `edit` gets it and returns the new one (or throws); the result is saved and announced. */
  change<T>(
    scope: MemoryScope,
    profileId: string | null,
    edit: (tree: MemoryTree) => { tree: MemoryTree; result: T },
  ): Promise<T> {
    const key = this.key(scope, profileId);
    const owner = scope === 'global' ? null : profileId;
    const run = this.queue.then(async () => {
      const { tree, result } = edit(this.trees.get(key) ?? emptyTree());
      await this.deps.store.save(key, tree);
      this.trees.set(key, tree);
      this.deps.bus.publish({ kind: 'memory', scope, profileId: owner });
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Copies notes and whole folders of one profile into another; returns the destination's memory. */
  importNotes(body: ImportMemoryBody): Promise<MemoryTree> {
    if (body.fromProfile === body.toProfile)
      return Promise.reject(invalid('Pick another profile to import from'));
    const from = this.tree('profile', body.fromProfile);
    return this.change('profile', body.toProfile, (to) => {
      const next = importInto({ from, to, body, newId: this.deps.newId, now: this.deps.now() });
      return { tree: next, result: next };
    });
  }

  /** A deleted profile takes its memory with it. */
  async dropProfile(profileId: string): Promise<void> {
    const key = this.key('profile', profileId);
    if (!this.trees.has(key)) return;
    this.trees.delete(key);
    await this.deps.store.remove(key);
    this.deps.bus.publish({ kind: 'memory', scope: 'profile', profileId });
  }
}
