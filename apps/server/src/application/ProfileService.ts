import { profileIdFor, type CreateProfileBody, type Profile } from '@deck/shared';
import { invalid, notFound } from '../domain/errors.js';
import type { ProfileStorePort } from '../domain/ports.js';

export interface ProfileServiceDeps {
  store: ProfileStorePort;
  /** Makes a (new or renamed) profile available to the session launcher right away. */
  register(profile: Profile): void;
  /** Ids already taken by built-in or configured providers. */
  reservedIds(): readonly string[];
}

/** Named, clean terminals. The base and id never change; only the display name can. */
export class ProfileService {
  private profiles: Profile[] = [];

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

  async create(body: CreateProfileBody): Promise<Profile> {
    if (body.base !== 'custom' && body.command !== '')
      throw invalid('Only custom profiles take a command');
    const taken = [...this.deps.reservedIds(), ...this.profiles.map((p) => p.id)];
    const profile: Profile = { ...body, id: profileIdFor(body.label, taken) };
    this.profiles = [...this.profiles, profile];
    await this.deps.store.save(this.profiles);
    this.deps.register(profile);
    return profile;
  }

  async rename(id: string, label: string): Promise<Profile> {
    const current = this.profiles.find((p) => p.id === id);
    if (!current) throw notFound(`Profile ${id}`);
    const next: Profile = { ...current, label };
    this.profiles = this.profiles.map((p) => (p.id === id ? next : p));
    await this.deps.store.save(this.profiles);
    this.deps.register(next);
    return next;
  }
}
