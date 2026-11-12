/** What is remembered about models between server runs. */
export interface ModelState {
  /** The model the person made the default of each provider/profile. */
  defaults: Record<string, string>;
  /** The model that last really answered for each provider/profile. */
  effective: Record<string, string>;
  /** The permission mode the person last chose in each provider/profile: new chats start with it. */
  modes: Record<string, string>;
}

export interface ModelStore {
  load(): Promise<ModelState>;
  save(state: ModelState): Promise<void>;
}

/** The default model of each provider and the last model that answered, kept in one small file. */
export class ModelBook {
  private state: ModelState = { defaults: {}, effective: {}, modes: {} };
  private readonly listeners = new Set<(providerId: string) => void>();

  constructor(private readonly store: ModelStore | null = null) {}

  async restore(): Promise<void> {
    const saved = await this.store?.load().catch(() => null);
    if (saved)
      this.state = {
        defaults: saved.defaults ?? {},
        effective: saved.effective ?? {},
        modes: saved.modes ?? {},
      };
  }

  defaultOf(providerId: string): string | null {
    return this.state.defaults[providerId] ?? null;
  }

  effectiveOf(providerId: string): string | null {
    return this.state.effective[providerId] ?? null;
  }

  /** Makes `model` the default of the provider (null: back to the agent's own default). */
  setDefault(providerId: string, model: string | null): void {
    if (this.defaultOf(providerId) === model) return;
    this.put('defaults', providerId, model);
    for (const listener of this.listeners) listener(providerId);
  }

  modeOf(providerId: string): string | null {
    return this.state.modes[providerId] ?? null;
  }

  setMode(providerId: string, mode: string): void {
    if (this.modeOf(providerId) !== mode) this.put('modes', providerId, mode);
  }

  setEffective(providerId: string, model: string): void {
    if (this.effectiveOf(providerId) !== model) this.put('effective', providerId, model);
  }

  /** A deleted profile leaves nothing behind. */
  forget(providerId: string): void {
    this.put('defaults', providerId, null);
    this.put('effective', providerId, null);
    this.put('modes', providerId, null);
  }

  /** Tells `listener` the provider whose default changed. */
  onDefaultChange(listener: (providerId: string) => void): void {
    this.listeners.add(listener);
  }

  private put(part: keyof ModelState, providerId: string, model: string | null): void {
    const kept = Object.entries(this.state[part]).filter(([id]) => id !== providerId);
    const next = Object.fromEntries(model === null ? kept : [...kept, [providerId, model]]);
    this.state = { ...this.state, [part]: next };
    void this.store?.save(this.state).catch(() => undefined);
  }
}
