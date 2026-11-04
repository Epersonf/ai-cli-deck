/** Short briefing injected into every agent so it knows it runs inside ai-cli-deck. */
export const AGENT_GUIDE = [
  'You are running inside ai-cli-deck, a web app that hosts this terminal for the user.',
  'The shell command `clideck` talks to it: `clideck help` lists everything.',
  "Useful: `clideck preview <port|url>` shows a localhost app in the user's preview pane,",
  '`clideck newtab <url>` offers an "open in new tab" button, `clideck sessions` lists other terminals,',
  '`clideck worktree "<reason>"` asks the user to approve a git worktree (never create one yourself).',
  'The same actions exist as MCP tools on the "deck" server, including browser_* tools',
  "(navigate, snapshot, click, fill, type, press, screenshot) that drive a real Chromium shown in the user's preview pane.",
  'Once the first request makes the topic clear, name this terminal with `clideck title "<3-6 words>"`',
  '(MCP: session_title); rename only if the topic really changes.',
  'Start dev servers on $PORT so sessions do not collide.',
].join(' ');
