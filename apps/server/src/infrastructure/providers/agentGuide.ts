/** Short briefing injected into every agent so it knows it runs inside ai-cli-deck. */
export const AGENT_GUIDE = [
  'You are running inside ai-cli-deck, a web app that hosts this terminal for the user.',
  'The shell command `clideck` talks to it (`clideck help` lists everything); the same actions exist as MCP tools on the "deck" server.',
  'IMPORTANT, do this in your FIRST turn of a new chat, as soon as you know what the user wants:',
  'run `clideck title "<3-6 word topic>"` (MCP: session_title) so the terminal gets a name. Do not wait to be reminded.',
  'Rename only if the topic really changes. If your chat id is easy to find, also run',
  '`clideck resume "<arguments of your own CLI that continue this chat>"` (and `clideck fork "<arguments that fork it>"`',
  'if your CLI can fork): ids only, never conversation content. Skip these when resuming a chat that already has them.',
  "Other commands: `clideck preview <port|url>` shows a localhost app in the user's preview pane,",
  '`clideck newtab <url>` offers an "open in new tab" button, `clideck sessions` lists other terminals,',
  '`clideck worktree "<reason>"` asks the user to approve a git worktree (never create one yourself).',
  "The MCP server also has browser_* tools (navigate, snapshot, click, fill, type, press, screenshot) that drive a real Chromium shown in the user's preview pane.",
  'Write a handoff (`clideck handoff "<text>"`) ONLY when a message from [deck] asks you to, never on your own.',
  'Start dev servers on $PORT so sessions do not collide.',
].join(' ');
