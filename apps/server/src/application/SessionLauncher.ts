import { TMUX_PREFIX, type Session } from '@deck/shared';
import { invalid } from '../domain/errors.js';
import type { LaunchSpec, MultiplexerPort, PtyHandle, PtyPort } from '../domain/ports.js';
import type { ProviderRegistry, ProviderSecrets } from '../domain/provider.js';

export interface LauncherDeps {
  pty: PtyPort;
  mux: MultiplexerPort;
  providers: ProviderRegistry;
  mcpBaseUrl: string;
  baseEnv: Record<string, string>;
  secrets: ProviderSecrets;
}

export const tmuxNameFor = (sessionId: string): string => `${TMUX_PREFIX}${sessionId}`;

const DEFAULT_SIZE = { cols: 80, rows: 24 };

/** Turns a session record into a running pty (wrapped in tmux when available). */
export class SessionLauncher {
  constructor(private readonly deps: LauncherDeps) {}

  buildSpec(session: Session, command: string | null, args: readonly string[]): LaunchSpec {
    const provider = this.deps.providers.get(session.provider);
    if (!provider) throw invalid(`Unknown provider "${session.provider}"`);
    const ctx = {
      sessionId: session.id,
      cwd: session.cwd,
      port: session.port,
      mcpUrl: `${this.deps.mcpBaseUrl}/${session.id}`,
      command,
      args,
      secrets: this.deps.secrets,
    };
    const parts = provider.buildCommand(ctx);
    const mcp = provider.buildMcpConfig(ctx);
    const spec: LaunchSpec = {
      command: parts.command,
      args: [...parts.args, ...mcp.args],
      cwd: session.cwd,
      env: {
        ...this.deps.baseEnv,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        ...parts.env,
        ...mcp.env,
        PORT: String(session.port),
        DECK_SESSION_ID: session.id,
        DECK_MCP_URL: ctx.mcpUrl,
      },
    };
    return this.deps.mux.wrap(tmuxNameFor(session.id), spec);
  }

  reattach(session: Session): PtyHandle {
    const env = { ...this.deps.baseEnv, TERM: 'xterm-256color', COLORTERM: 'truecolor' };
    const spec = { command: '', args: [], env, cwd: session.cwd };
    return this.deps.pty.spawn(this.deps.mux.attach(tmuxNameFor(session.id), spec), DEFAULT_SIZE);
  }

  launch(session: Session, command: string | null, args: readonly string[]): PtyHandle {
    return this.deps.pty.spawn(this.buildSpec(session, command, args), DEFAULT_SIZE);
  }
}
