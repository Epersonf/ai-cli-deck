import { BriefingBook } from './BriefingBook.js';
import type { BriefingStore } from './BriefingStore.js';
import { AGENT_EFFORTS, type PermissionMode, type Session } from '@deck/shared';
import type { AgentConfig, AgentSpec } from '../domain/agent.js';
import type { RunState } from './ChatSettings.js';
import { invalid } from '../domain/errors.js';
import type { ProviderContext, ProviderRegistry } from '../domain/provider.js';
import { prependToPath } from '../infrastructure/config/platform.js';
import { agentGuide } from '../infrastructure/providers/agentGuide.js';
import { parseAutoCompact } from './autoCompact.js';
import { utf8Locale } from './utf8Env.js';

export interface LauncherDeps {
  providers: ProviderRegistry;
  briefingStore?: BriefingStore;
  mcpBaseUrl: string;
  /** Base URL of this server as seen from an agent (loopback), exported as DECK_URL. */
  deckUrl: string;
  /** Folder holding the `clideck` command; prepended to every agent's PATH. */
  binDir: string | null;
  baseEnv: Record<string, string>;
  /** The model the person made the default of a provider; used while a chat has none of its own. */
  defaultModel?(providerId: string): string | null;
  /** The permission mode last chosen in a provider; new chats start with it. */
  defaultMode?(providerId: string): string | null;
  /** The Memory section of the briefing for a provider's chats (changes show in new conversations). */
  memoryBriefing?(providerId: string): string;
  /** True when the Android app lets agents use the phone: the briefing then tells them so. */
  phoneEnabled?(): boolean;
  /** Names of the decks paired with this one, so agents know they can act there. */
  pairedDevices?(): string[];
}

/** Turns a session record into what its agent needs to run: engine, folder and environment. */
export class AgentLauncher {
  private readonly briefings: BriefingBook;
  constructor(private readonly deps: LauncherDeps) {
    this.briefings = new BriefingBook(deps.briefingStore);
  }

  private provider(id: string) {
    const provider = this.deps.providers.get(id);
    if (!provider) throw invalid(`Unknown provider "${id}"`);
    return provider;
  }

  forget(sessionId: string): void {
    this.briefings.forget(sessionId);
  }

  inherit(source: Session, target: Session): void {
    this.briefings.keep(target, this.briefing(source, false));
  }

  private briefing(session: Session, fresh: boolean): string {
    return this.briefings.get(session, fresh, () =>
      [
        agentGuide({
          phone: this.deps.phoneEnabled?.() ?? false,
          devices: [...(this.deps.pairedDevices?.() ?? [])].sort(),
        }),
        this.deps.memoryBriefing?.(session.provider) ?? '',
      ]
        .filter((part) => part !== '')
        .join('\n\n'),
    );
  }

  private context(session: Session, fresh = false): ProviderContext {
    return {
      sessionId: session.id,
      cwd: session.cwd,
      port: session.port,
      mcpUrl: `${this.deps.mcpBaseUrl}/${session.id}`,
      guide: this.briefing(session, fresh),
    };
  }

  private pathEntry(): Record<string, string> {
    const { binDir, baseEnv } = this.deps;
    if (binDir === null) return {};
    const { key, value } = prependToPath(baseEnv, binDir);
    return { [key]: value };
  }

  private env(session: Session, ctx: ProviderContext, own: Record<string, string>) {
    return {
      ...this.deps.baseEnv,
      ...utf8Locale(this.deps.baseEnv),
      ...own,
      PORT: String(session.port),
      ...this.pathEntry(),
      DECK_URL: this.deps.deckUrl,
      DECK_SESSION_ID: session.id,
      DECK_MCP_URL: ctx.mcpUrl,
    };
  }

  /** The settings a session starts with: its saved ones, else the provider's. */
  initialConfig(session: Session): AgentConfig {
    const provider = this.provider(session.provider);
    const mode = session.meta['mode'];
    const effort =
      AGENT_EFFORTS[provider.agent].find((value) => value === session.meta['effort']) ?? null;
    return {
      model: session.meta['model'] || null,
      mode: (mode ?? this.deps.defaultMode?.(session.provider) ?? 'default') as PermissionMode,
      effort,
      autoCompact: parseAutoCompact(session.meta['autoCompact']),
    };
  }

  spec(session: Session, state: RunState): AgentSpec {
    const ctx = this.context(session, state.chatId === null);
    const setup = this.provider(session.provider).buildAgent(ctx);
    return {
      kind: setup.kind,
      cwd: session.cwd,
      env: this.env(session, ctx, setup.env),
      ...state.config,
      model: state.config.model ?? this.deps.defaultModel?.(session.provider) ?? setup.model,
      resumeId: state.chatId,
      fork: state.fork,
      resumeAt: state.resumeAt,
      dropsTurn: state.dropsTurn,
      mcpUrl: ctx.mcpUrl,
      guide: ctx.guide,
    };
  }

  /** The environment a plain command run for this session's profile gets. */
  envFor(session: Session): Record<string, string> {
    const ctx = this.context(session);
    const own = this.provider(session.provider).shellEnv?.(ctx) ?? {};
    return this.env(session, ctx, own);
  }
}
