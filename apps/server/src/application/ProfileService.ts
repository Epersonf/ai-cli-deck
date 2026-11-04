import { isHttpUrl, profileIdFor, type CreateProfileBody, type Profile } from '@deck/shared';
import { invalid, notFound } from '../domain/errors.js';
import type { ProfileStorePort } from '../domain/ports.js';

export interface ProfileServiceDeps {
  store: ProfileStorePort;
  /** Makes a (new or renamed) profile available to the session launcher right away. */
  register(profile: Profile): void;
  /** Takes a deleted profile out of the launcher and the install-status checks. */
  unregister(id: string): void;
  /** Erases the profile's CLI config folder (logins, history). Must be safe to repeat. */
  wipeData(id: string): Promise<void>;
  /** Ids already taken by built-in or configured providers. */
  reservedIds(): readonly string[];
}

/** Named, clean terminals. The base and id never change; only the display name can. */
export class ProfileService {
  private profiles: Profile[] = [];
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly deps: ProfileServiceDeps) {}

  async load(): Promise<void> {
    this.profiles = await this.deps.store.load();
    this.profiles.forEach((profile) => this.deps.register(profile));
  }

  list(): readonly Profile[] {
    return this.profiles;
  }

  has(id: string): boolean {
    return this.profiles.some((p) => p.id === id);
  }

  /**
   * Changes go one at a time: two creates at once would both pick the same free id before either was
   * saved, and two profiles with one id would share a config folder (and so a login and a key).
   */
  private serial<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Picks up profiles written by another process (`clideck profile add`) since we last looked. */
  private async sync(): Promise<void> {
    const known = new Set(this.profiles.map((p) => p.id));
    const added = (await this.deps.store.load()).filter((p) => !known.has(p.id));
    this.profiles = [...this.profiles, ...added];
    added.forEach((p) => this.deps.register(p));
  }

  create(body: CreateProfileBody): Promise<Profile> {
    const { command = '', baseUrl = '' } = body;
    if (body.base !== 'custom' && command !== '')
      return Promise.reject(invalid('Only custom profiles take a command'));
    if (body.base === 'claude-endpoint' && !isHttpUrl(baseUrl))
      return Promise.reject(invalid('A custom endpoint needs an http(s) base URL'));
    return this.serial(async () => {
      await this.sync();
      const taken = [...this.deps.reservedIds(), ...this.profiles.map((p) => p.id)];
      const profile: Profile = { ...body, command, baseUrl, id: profileIdFor(body.label, taken) };
      // A new profile always starts empty, even if an old folder with this id was left behind.
      await this.deps.wipeData(profile.id);
      this.profiles = [...this.profiles, profile];
      await this.deps.store.save(this.profiles);
      this.deps.register(profile);
      return profile;
    });
  }

  remove(id: string): Promise<void> {
    return this.serial(async () => {
      await this.sync();
      if (!this.has(id)) throw notFound(`Profile ${id}`);
      this.profiles = this.profiles.filter((p) => p.id !== id);
      await this.deps.store.save(this.profiles);
      this.deps.unregister(id);
    });
  }

  /** Erases a deleted profile's logins; call once its terminals have ended. */
  purgeData(id: string): Promise<void> {
    return this.serial(async () => {
      await this.sync();
      if (this.has(id)) throw invalid('Profile still exists');
      await this.deps.wipeData(id);
    });
  }

  rename(id: string, label: string): Promise<Profile> {
    return this.serial(async () => {
      await this.sync();
      const current = this.profiles.find((p) => p.id === id);
      if (!current) throw notFound(`Profile ${id}`);
      const next: Profile = { ...current, label };
      this.profiles = this.profiles.map((p) => (p.id === id ? next : p));
      await this.deps.store.save(this.profiles);
      this.deps.register(next);
      return next;
    });
  }
}
