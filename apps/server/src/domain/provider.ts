export interface ProviderSecrets {
  readonly deepseekApiKey: string | null;
}

export interface ProviderContext {
  sessionId: string;
  cwd: string;
  port: number;
  mcpUrl: string;
  command: string | null;
  args: readonly string[];
  secrets: ProviderSecrets;
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
}
