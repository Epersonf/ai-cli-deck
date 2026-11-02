export const HELP = `clideck - talk to the ai-cli-deck that runs this terminal

Usage: clideck <command> [arguments]

Commands:
  help                     Show this help
  whoami                   This session: id, CLI, folder, preview port
  sessions                 Other sessions open in the deck
  port                     Print this session's PORT (use it for dev servers)
  preview <url|port>       Open a localhost page in this session's preview panel
  newtab <url|port>        Offer the user a button to open a page in a new tab
  worktree "<reason>"      Ask the user to create a git worktree (needs approval)
  status <requestId>       Check an approval request: pending, approved or rejected
  setup <provider>         Install a CLI and sign in or save its API key (interactive)
  install [--force]        Add /clideck slash commands for Claude Code and Codex

Examples:
  clideck preview 3000
  clideck worktree "refactor the auth module in isolation"
  clideck status 4f2a9c1e

Nothing here runs git or edits files by itself: a worktree is only created after
the user presses Approve in the deck.`;
