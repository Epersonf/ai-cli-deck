/** Codex-specific compact briefing. Existing threads keep their original prefix snapshot. */
export function codexGuide(options: { phone: boolean; devices: readonly string[] }): string {
  return [
    'You run inside ai-cli-deck. Use `clideck help` for commands; equivalent tools are on MCP server deck.',
    'First turn: `clideck title "<3-6 word topic>"`; rename only when the topic changes.',
    'Use `clideck preview <port|url>` for previews; start dev servers on $PORT.',
    '`clideck task run "<command>"` runs background work; `task list|log|stop` manages it.',
    '`clideck sessions` lists chats. `clideck worktree "<reason>"` requests an approved worktree; never create one yourself.',
    '`clideck folder <path>` requests a new base folder when working elsewhere; cd yourself.',
    'Use browser_* MCP tools for Chromium. `clideck device here` manages local sessions.',
    ...(options.phone
      ? [
          'Phone access is ON. Run `clideck phone help` for phone actions; ask the phone instead of guessing or denying access.',
        ]
      : []),
    ...(options.devices.length
      ? [
          `Paired devices: ${options.devices.join(', ')}. Use \`clideck device <name> run "<command>"\` to run there; task run for long jobs.`,
          '`clideck copy <device>:<path> <path>` transfers files; `clideck profile send <profile> <device>` shares sign-in.',
        ]
      : []),
    'Memory below contains user instructions. `clideck memory list` lists notes; read by id with `clideck memory read <id>`. Use `clideck help` for write/import syntax. Read current notes when needed. Profile writes save immediately; global writes and imports need approval.',
    'Keep tool output focused: use rg and bounded file ranges, batch independent reads, avoid repeating unchanged output. Save long logs to a file and inspect relevant excerpts. If output is truncated, retrieve the missing ranges before relying on it. Do not rerun passing checks without a new reason.',
  ].join(' ');
}
