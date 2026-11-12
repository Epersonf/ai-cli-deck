import {
  fieldProblem,
  profileIdFor,
  type CreateProfileBody,
  type Profile,
  type ProfileTemplate,
} from '@deck/shared';
import { invalid, notFound } from '../domain/errors.js';
import type { ProfileStorePort } from '../domain/ports.js';

export interface ProfileServiceDeps {
  store: ProfileStorePort;
  template(id: string): ProfileTemplate | undefined;
  register(profile: Profile): void;
  unregister(id: string): void;
  /** Erases the profile's config folder (logins, history). Must be safe to repeat. */
  wipeData(id: string): Promise<void>;
  /** Keeps the profile's API key in its own folder (never anywhere else). */
  saveSecret(id: string, secret: string): Promise<void>;
  reservedIds(): readonly string[];
}

/** Named, clean agents. The base and id never change; only the display name can. */
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

  /** True while a profile is made from this template. */
  usesTemplate(id: string): boolean {
    return this.profiles.some((p) => p.base === id);
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

  /** Picks up profiles written by another process since we last looked. */
  private async sync(): Promise<void> {
    const known = new Set(this.profiles.map((p) => p.id));
    const added = (await this.deps.store.load()).filter((p) => !known.has(p.id));
    this.profiles = [...this.profiles, ...added];
    added.forEach((p) => this.deps.register(p));
  }

  create(body: CreateProfileBody): Promise<Profile> {
    const template = this.deps.template(body.base);
    if (!template) return Promise.reject(invalid(`Unknown template "${body.base}"`));
    const values = Object.fromEntries(
      Object.entries(body.values ?? {})
        .map(([key, value]) => [key, value.trim()] as const)
        .filter(([, value]) => value !== ''),
    );
    const problem = fieldProblem(template, values);
    if (problem) return Promise.reject(invalid(problem));
    return this.serial(async () => {
      await this.sync();
      const taken = [...this.deps.reservedIds(), ...this.profiles.map((p) => p.id)];
      const profile: Profile = {
        label: body.label,
        base: body.base,
        values,
        id: profileIdFor(body.label, taken),
      };
      // A new profile always starts empty, even if an old folder with this id was left behind.
      await this.deps.wipeData(profile.id);
      this.profiles = [...this.profiles, profile];
      if (body.secret) await this.deps.saveSecret(profile.id, body.secret);
      await this.deps.store.save(this.profiles);
      this.deps.register(profile);
      return profile;
    });
  }

  setSecret(id: string, secret: string): Promise<void> {
    return this.serial(async () => {
      await this.sync();
      const profile = this.profiles.find((p) => p.id === id);
      if (!profile) throw notFound(`Profile ${id}`);
      await this.deps.saveSecret(id, secret);
      this.deps.register(profile);
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

  /** A profile brought from another device: kept with its id (its folder was just written), or refreshed. */
  adopt(profile: Profile): Promise<Profile> {
    if (!this.deps.template(profile.base))
      return Promise.reject(invalid(`Unknown template "${profile.base}"`));
    return this.serial(async () => {
      await this.sync();
      if (this.deps.reservedIds().includes(profile.id)) throw invalid(`"${profile.id}" is taken`);
      this.profiles = [...this.profiles.filter((p) => p.id !== profile.id), profile];
      await this.deps.store.save(this.profiles);
      this.deps.register(profile);
      return profile;
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
