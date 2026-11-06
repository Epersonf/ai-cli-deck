export const HELP = `clideck - talk to the ai-cli-deck that runs this terminal

Usage: clideck <command> [arguments]

Commands:
  help                     Show this help
  whoami                   This session: id, CLI, folder, preview port
  sessions                 Other sessions open in the deck
  title ["<name>"]         Name this terminal in the deck (no argument: print the current name)
  task run "<cmd>" | battery --below N | list | stop <id> | log <id>
                           Background jobs: a command that keeps running, or a watcher that notifies the phone
  phone battery|device|notify "<text>"
                           The phone running the deck (only when enabled in the Android app settings)
  devices                  The decks paired with this one (your PC, your phone...)
  device <name> run "<cmd>" [--cwd D] [--timeout S]
                           Run a command on that device and print its output
  device <name> terminals | open <profile> | send <id> "<text>" | read <id> | close <id>
                           Use its terminals, e.g. start an agent there and talk to it
  meta [get|set|del ...]   Notes kept with this terminal (no argument: list them)
  port                     Print this session's PORT (use it for dev servers)
  preview <url|port>       Open a localhost page in this session's preview panel
  newtab <url|port>        Offer the user a button to open a page in a new tab
  worktree "<reason>"      Ask the user to create a git worktree (needs approval)
  status <requestId>       Check an approval request: pending, approved or rejected
  profile add "<name>" <template> [--url <api-base-url>] [--command <program>]
                           Clean terminal profile from a template (claude, codex, claude-deepseek, ...)
  setup <provider>         Download a CLI (claude, codex...); it signs you in itself on first run
  install [--force]        Add /clideck slash commands for Claude Code and Codex
  ensure-key <ENV> "<label>" [--save <dir>] -- <cmd...>
                           Ask for an API key (hidden) if <ENV> is unset, then run <cmd>

Examples:
  clideck preview 3000
  clideck worktree "refactor the auth module in isolation"
  clideck status 4f2a9c1e

Nothing here runs git or edits files by itself: a worktree is only created after
the user presses Approve in the deck.`;
