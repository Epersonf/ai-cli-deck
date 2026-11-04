export interface ProviderContext {
  sessionId: string;
  cwd: string;
  port: number;
  mcpUrl: string;
  command: string | null;
  args: readonly string[];
  /** The platform's default shell (bash, zsh, cmd.exe, ...). */
  defaultShell: string;
  /** The briefing about the deck for the agent (mentions the phone only when phone access is on). */
  guide: string;
}

export interface CommandParts {
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface McpInjection {
  args: string[];
  env: Record<string, string>;
}

export interface Provider {
  readonly id: string;
  readonly label: string;
  buildCommand(ctx: ProviderContext): CommandParts;
  buildMcpConfig(ctx: ProviderContext): McpInjection;
  /**
   * The environment of this profile's world (its config folder, endpoint...), without the CLI itself.
   * A plain terminal opened from one of its sessions gets exactly this, so tools run there (git, gcloud...)
   * see the same accounts as the profile's agent.
   */
  shellEnv?(ctx: ProviderContext): Record<string, string>;
}

export interface ProviderRegistry {
  get(id: string): Provider | undefined;
  list(): Provider[];
  /** Adds or replaces a provider at runtime (used when a profile is created in the UI). */
  add(provider: Provider): void;
  remove(id: string): void;
}
