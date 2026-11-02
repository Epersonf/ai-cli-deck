import { utf8Locale } from './utf8Env';
import { TMUX_PREFIX, type Session } from '@deck/shared';
import { invalid } from '../domain/errors.js';
import { prependToPath } from '../infrastructure/config/platform.js';
import type { LaunchSpec, MultiplexerPort, PtyHandle, PtyPort } from '../domain/ports.js';
import type { ProviderRegistry } from '../domain/provider.js';

export interface LauncherDeps {
  pty: PtyPort;
  mux: MultiplexerPort;
  providers: ProviderRegistry;
  mcpBaseUrl: string;
  /** Base URL of this server as seen from a session (loopback), exported as DECK_URL. */
  deckUrl: string;
  /** Folder holding the `clideck` command; prepended to every session's PATH. */
  binDir: string | null;
  baseEnv: Record<string, string>;
  defaultShell: string;
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
      defaultShell: this.deps.defaultShell,
    };
    const parts = provider.buildCommand(ctx);
    const mcp = provider.buildMcpConfig(ctx);
    const spec: LaunchSpec = {
      command: parts.command,
      args: [...parts.args, ...mcp.args],
      cwd: session.cwd,
      env: {
        ...this.deps.baseEnv,
        ...utf8Locale(this.deps.baseEnv),
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        ...parts.env,
        ...mcp.env,
        PORT: String(session.port),
        ...this.pathEntry(),
        DECK_URL: this.deps.deckUrl,
        DECK_SESSION_ID: session.id,
        DECK_MCP_URL: ctx.mcpUrl,
      },
    };
    return this.deps.mux.wrap(tmuxNameFor(session.id), spec);
  }

  private pathEntry(): Record<string, string> {
    const { binDir, baseEnv } = this.deps;
    if (binDir === null) return {};
    const { key, value } = prependToPath(baseEnv, binDir);
    return { [key]: value };
  }

  reattach(session: Session): PtyHandle {
    const env = {
      ...this.deps.baseEnv,
      ...utf8Locale(this.deps.baseEnv),
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    };
    const spec = { command: '', args: [], env, cwd: session.cwd };
    return this.deps.pty.spawn(this.deps.mux.attach(tmuxNameFor(session.id), spec), DEFAULT_SIZE);
  }

  launch(session: Session, command: string | null, args: readonly string[]): PtyHandle {
    return this.deps.pty.spawn(this.buildSpec(session, command, args), DEFAULT_SIZE);
  }
}
