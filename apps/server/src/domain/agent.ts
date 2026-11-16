import type {
  AgentKind,
  AutoCompact,
  ChatEvent,
  Effort,
  ImageInput,
  PermissionMode,
  TurnUsage,
} from '@deck/shared';

/** What the person may change while a chat runs. */
export interface AgentConfig {
  model: string | null;
  mode: PermissionMode;
  effort: Effort | null;
  /** When the agent compacts by itself; null or left out: its own default. */
  autoCompact?: AutoCompact | null;
}

/** Everything an agent needs to run one conversation. */
export interface AgentSpec extends AgentConfig {
  kind: AgentKind;
  providerId?: string;
  cwd: string;
  /** The full environment of the agent process (deck variables, the profile's folder, endpoint, key...). */
  env: Record<string, string>;
  /** Continue this saved conversation. */
  resumeId: string | null;
  /** With `resumeId`: continue it as a copy, leaving the original alone. */
  fork: boolean;
  /** With `resumeId`: continue from this point of the saved chat only (what an edited message goes back to). */
  resumeAt: string | null;
  /** With `resumeAt`: the id of the user message being replaced, so the agent can check what it drops. */
  dropsTurn: string | null;
  /** The deck's MCP server for this session, and the briefing about the deck. */
  mcpUrl: string;
  guide: string;
}

/** What an agent knows about usage; any part may be missing. `limit` is one usage window of the account. */
export interface UsageReading {
  /** Cost of the agent run so far (it restarts at 0 with each new run). */
  costUsd?: number;
  contextTokens?: number | null;
  /** One completed turn, distinct from the current context / last model call. */
  turn?: TurnUsage;
  contextWindow?: number;
  limit?: { key: string; used: number; resetsAt: string | null; label: string | null };
  /** The prompt cache as of this answer (the deck stamps the time). */
  cache?: {
    scope?: 'request' | 'turn';
    read: number;
    write: number | null;
    uncached?: number;
    ttlMs: number | null;
  };
  /** The conversation was compacted: the context is `contextTokens` now (or unknown until the next answer). */
  compacted?: boolean;
}

/** One usage window of an account, as an agent or its provider reports it. */
export type AccountLimit = NonNullable<UsageReading['limit']>;

/** What an agent reports back; the chat runtime keeps, stores and forwards it. */
export interface AgentSink {
  /** A finished step of the conversation (including `turn-end` and permission requests). */
  event(event: ChatEvent): void;
  /** Text of an answer still being written. */
  delta(id: string, kind: 'text' | 'thinking', text: string): void;
  /** The id under which the agent saved this conversation (what "continue" resumes). */
  chatId(id: string): void;
  /** The model that is really answering (as the agent named it); said at the start of a run and with answers. */
  model(name: string): void;
  /** Tokens, cost or the account's limit changed. */
  usage(reading: UsageReading): void;
  /** The run is over (process exited or was closed): the next message starts a new one. */
  ended(): void;
}

export interface UserInput {
  /** The id of the `user` event; Claude keeps it as the message's uuid (what an edit goes back to). */
  id: string;
  text: string;
  images: readonly ImageInput[];
}

export interface PermissionAnswer {
  allow: boolean;
  always?: boolean;
  message?: string;
  /** Answers to an agent's question with options, by question text. */
  answers?: Record<string, string>;
}

/** One running conversation with an agent. Starting a turn is `send`; the turn ends with a `turn-end` event. */
export interface AgentRun {
  send(input: UserInput): void;
  /** Stops the answer in progress. */
  interrupt(): void;
  setConfig(patch: Partial<AgentConfig>): void;
  answer(permissionId: string, answer: PermissionAnswer): void;
  /** Stops a background task (a `task` event id). Agents without background tasks ignore it. */
  stopTask(taskId: string): void;
  close(): void;
}

/** Where an edited message takes the agent's own saved conversation back to. */
export interface RewindResult {
  /** The point to resume from, or null when the agent cannot go back (the chat starts over instead). */
  resumeAt: string | null;
  /** Set when the files could not be restored: nothing was changed and the edit must not go on. */
  error?: string;
}

export interface AgentCapabilities {
  fork: boolean;
  compact: boolean;
}

export interface AgentPort {
  capabilities?(spec: AgentSpec): Promise<AgentCapabilities>;
  /** Manual compaction; resolves only when the stored thread has actually been compacted. */
  compact?(spec: AgentSpec, sink: AgentSink, signal: AbortSignal): Promise<void>;
  start(spec: AgentSpec, sink: AgentSink): AgentRun;
  /** Works out where to go back to before the user message `userId`, and restores the files when asked. */
  rewind(spec: AgentSpec, userId: string, revertFiles: boolean): Promise<RewindResult>;
}
