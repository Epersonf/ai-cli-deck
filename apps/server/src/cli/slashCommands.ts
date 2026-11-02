export interface SlashFile {
  /** Path relative to the home directory. */
  path: string;
  content: string;
}

const CLAUDE = `---
description: Talk to ai-cli-deck (help, preview, sessions, worktree, status...)
argument-hint: help | preview <url|port> | sessions | worktree "<reason>" | status <id>
allowed-tools: Bash(clideck:*)
---
!\`clideck $ARGUMENTS\`

Report the output above to the user. If it was a worktree request, remind them to approve it in the deck.
`;

const CODEX = `Run the shell command \`clideck $ARGUMENTS\` (use \`clideck help\` when no arguments are given)
and show the user its output. clideck talks to the ai-cli-deck that hosts this terminal.
`;

/** Slash command definitions so \`/clideck help\` works inside Claude Code and Codex. */
export const SLASH_FILES: readonly SlashFile[] = [
  { path: '.claude/commands/clideck.md', content: CLAUDE },
  { path: '.codex/prompts/clideck.md', content: CODEX },
];
