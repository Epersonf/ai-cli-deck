import type { AgentKind, ModelChoice } from '@deck/shared';
import type { ChatSupport } from './chat.js';
import type { LoginSupport } from './signin.js';

export interface ProviderContext {
  sessionId: string;
  cwd: string;
  port: number;
  mcpUrl: string;
  /** The briefing about the deck for the agent (mentions the phone only when phone access is on). */
  guide: string;
}

/** How to run this provider's agent: its engine, environment and starting model. */
export interface AgentSetup {
  kind: AgentKind;
  /** The profile's world: its config folder, endpoint, key (without the deck's own variables). */
  env: Record<string, string>;
  model: string | null;
}

/** What an agent or endpoint says about its models. */
export interface ModelListing {
  choices: ModelChoice[];
  /** The model that answers when none is picked, as far as it can be told without a run. */
  current: string | null;
}

export interface Provider {
  readonly id: string;
  readonly label: string;
  readonly agent: AgentKind;
  buildAgent(ctx: ProviderContext): AgentSetup;
  /**
   * The same environment for plain commands run for this profile (background tasks), so tools see
   * the same accounts as the agent.
   */
  shellEnv?(ctx: ProviderContext): Record<string, string>;
  /** Asks the agent (or its endpoint) which models it offers right now; absent: none are known. */
  discoverModels?(): Promise<ModelListing>;
  /** Where its saved chats are read from, for the chat list; absent: the deck cannot list them. */
  readonly chat?: ChatSupport | null;
  /** Signing in with the agent's own login; absent: the provider cannot. */
  readonly login?: LoginSupport;
  /** How the person signs in: with the vendor's account (default) or with a key for another endpoint. */
  readonly signIn?: 'account' | 'key';
  /** The API key state: `none` = this profile uses no key. */
  keyState?(): 'none' | 'set' | 'missing';
}

export interface ProviderRegistry {
  get(id: string): Provider | undefined;
  list(): Provider[];
  /** Adds or replaces a provider at runtime (used when a profile is created in the UI). */
  add(provider: Provider): void;
  remove(id: string): void;
}
