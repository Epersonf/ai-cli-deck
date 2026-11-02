export interface ProviderContext {
  sessionId: string;
  cwd: string;
  port: number;
  mcpUrl: string;
  command: string | null;
  args: readonly string[];
  /** The platform's default shell (bash, zsh, cmd.exe, ...). */
  defaultShell: string;
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
}

export interface ProviderRegistry {
  get(id: string): Provider | undefined;
  list(): Provider[];
  /** Adds or replaces a provider at runtime (used when a profile is created in the UI). */
  add(provider: Provider): void;
  remove(id: string): void;
}
