import type { AgentSpec } from '../../domain/agent.js';

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

/** The SDK options for one run: the deck's briefing, MCP server and the profile's environment. */
export function claudeOptions(
  spec: AgentSpec,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  return {
    cwd: spec.cwd,
    env: spec.env,
    includePartialMessages: true,
    systemPrompt: {
      type: 'preset',
      preset: 'claude_code',
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
