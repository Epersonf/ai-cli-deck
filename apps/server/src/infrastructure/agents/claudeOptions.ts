import type { AutoCompact } from '@deck/shared';
import type { AgentSpec } from '../../domain/agent.js';
import type { QueryLike } from './claudeDriver.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Go back to `at` when resuming, dropping the turn of the user message `drops`. */
const resumePoint = (at: string, drops: string | null): Record<string, string> => ({
  resumeSessionAt: at,
  ...(drops ? { resumeDropsTurn: drops } : {}),
});

/** Claude Code refuses to skip permissions as root (the phone app's Ubuntu runs as root): fall back to accepting edits. */
export const isRoot = (): boolean => typeof process.getuid === 'function' && process.getuid() === 0;
export const claudeMode = <T extends string>(mode: T): T | 'acceptEdits' =>
  isRoot() && mode === 'bypassPermissions' ? 'acceptEdits' : mode;

/** Claude Code's own settings for when it compacts by itself (see `autoCompactEnabled`/`autoCompactWindow`). */
export function claudeAutoCompact(
  value: AutoCompact | null | undefined,
): Record<string, boolean | number | null> {
  if (value === 'off') return { autoCompactEnabled: false, autoCompactWindow: null };
  if (typeof value === 'number') return { autoCompactEnabled: true, autoCompactWindow: value };
  return { autoCompactEnabled: null, autoCompactWindow: null };
}

/** Changes the setting on a running query (an empty one, before the first message, has nothing to change). */
export function applyAutoCompact(q: QueryLike | null, value: AutoCompact | null): void {
  void q?.applyFlagSettings(claudeAutoCompact(value)).catch(() => undefined);
}

/**
 * Claude Code puts a line of its own at the very start of the system prompt (version, entry point, and for
 * other endpoints a hash and the kind of request). Anthropic reads it; any other endpoint only sees the
 * start of its prefix change between requests and reads the whole chat again, so it is turned off there.
 */
export function cacheSafeEnv(env: Record<string, string>): Record<string, string> {
  const url = env['ANTHROPIC_BASE_URL'];
  if (!url || 'CLAUDE_CODE_ATTRIBUTION_HEADER' in env) return env;
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    // not a URL: treated as another endpoint
  }
  return host === 'anthropic.com' || host.endsWith('.anthropic.com')
    ? env
    : { ...env, CLAUDE_CODE_ATTRIBUTION_HEADER: '0' };
}

/**
 * Claude Code settings that go with one run. A profile that signs in with a long-lived OAuth token is not
 * recognised as a subscription, so Claude Code would keep the cache for 5 minutes only: ask for an hour.
 */
function settingsOf(spec: AgentSpec): { settings?: Record<string, unknown> } {
  const own = spec.env['CLAUDE_CODE_OAUTH_TOKEN'] && !spec.env['ANTHROPIC_BASE_URL'];
  const settings = {
    ...(own ? { promptCacheTtl: '1h' } : {}),
    ...Object.fromEntries(
      Object.entries(claudeAutoCompact(spec.autoCompact)).filter(([, v]) => v !== null),
    ),
  };
  return Object.keys(settings).length > 0 ? { settings } : {};
}

/** The SDK options for one run: the deck's briefing, MCP server and the profile's environment. */
export function claudeOptions(
  spec: AgentSpec,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  return {
    cwd: spec.cwd,
    env: cacheSafeEnv(spec.env),
    includePartialMessages: true,
    systemPrompt: {
      type: 'preset',
      preset: 'claude_code',
      // Recorded with the conversation and sent as it was on every request and resume: the prompt is the
      // start of what the provider caches, so it must not change under a running chat.
      snapshot: true,
      // Working folder, git status and memory paths go in the first message instead of the system prompt, so
      // the prompt is the same in every chat (shared cache) and where `snapshot` does not apply (other endpoints).
      excludeDynamicSections: true,
      ...(spec.guide ? { append: spec.guide } : {}),
    },
    mcpServers: { deck: { type: 'http', url: spec.mcpUrl } },
    settingSources: ['user', 'project', 'local'],
    permissionMode: claudeMode(spec.mode),
    ...(isRoot() ? {} : { allowDangerouslySkipPermissions: true }),
    ...(spec.model ? { model: spec.model } : {}),
    ...(spec.effort ? { effort: spec.effort } : {}),
    ...(spec.resumeId ? { resume: spec.resumeId, forkSession: spec.fork } : {}),
    ...(spec.resumeId && spec.resumeAt ? resumePoint(spec.resumeAt, spec.dropsTurn) : {}),
    // Keeps each file as it was at every message, so an edited message can put them back.
    enableFileCheckpointing: true,
    ...settingsOf(spec),
    ...extra,
  };
}

/** A user message with its attachments as content blocks. */
export function claudeUserMessage(
  id: string,
  text: string,
  images: readonly { mediaType: string; data: string }[],
): Record<string, unknown> {
  return {
    type: 'user',
    ...(UUID.test(id) ? { uuid: id } : {}),
    message: {
      role: 'user',
      content: [
        ...images.map((img) => ({
          type: img.mediaType === 'application/pdf' ? 'document' : 'image',
          source: { type: 'base64', media_type: img.mediaType, data: img.data },
        })),
        { type: 'text', text },
      ],
    },
    parent_tool_use_id: null,
  };
}
