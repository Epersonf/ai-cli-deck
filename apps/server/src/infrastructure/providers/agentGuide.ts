/**
 * The short briefing injected into every agent so it knows it runs inside ai-cli-deck and which `clideck`
 * commands exist. When the Android app lets agents use the phone, the briefing says so: an agent that is not
 * told will insist it cannot reach the phone.
 */
export function agentGuide(options: { phone: boolean; devices?: readonly string[] }): string {
  return [
    'You are running inside ai-cli-deck, a web app that hosts this terminal for the user.',
    'The shell command `clideck` talks to it (`clideck help` lists everything); the same actions exist as MCP tools on the "deck" server.',
    'IMPORTANT, do this in your FIRST turn of a new chat, as soon as you know what the user wants:',
    'run `clideck title "<3-6 word topic>"` (MCP: session_title) so the terminal gets a name. Do not wait to be reminded.',
    'Rename only if the topic really changes.',
    'Other commands you should know exist:',
    '`clideck preview <port|url>` shows a localhost app in the user\'s preview pane, `clideck newtab <url>` offers an "open in new tab" button,',
    '`clideck task run "<command>"` keeps a command running in the background (the user sees it in the deck; `task list|log|stop`),',
    '`clideck sessions` lists other terminals, `clideck worktree "<reason>"` asks the user to approve a git worktree (never create one yourself).',
    "The MCP server also has browser_* tools (navigate, snapshot, click, fill, type, press, screenshot) that drive a real Chromium shown in the user's preview pane.",
    ...(options.phone
      ? [
          "This deck runs on the user's PHONE and phone access is ON. For anything about the phone (battery, Wi-Fi, location, notifications, camera, files...)",
          'run `clideck phone help` (MCP tool: phone) to see what is allowed, then use it. Do not say you cannot reach the phone, and do not guess: ask the phone.',
          '`clideck task battery --below 10` can notify the phone later without you waiting.',
        ]
      : []),
    '`clideck device here terminals|open|read|send|restart|close|task ...` (MCP tool: device) manages this deck itself.',
    ...(options.devices?.length
      ? [
          `The user's other devices are paired with this deck: ${options.devices.join(', ')}.`,
          'For "do X on my PC" use `clideck device <name> run "<command>"` (runs THERE, returns output and exit code),',
          '`task run` for long or heavy jobs there, `terminals|open|send|read` to start or talk to an agent there,',
          '`clideck copy <device>:<path> <path>` to bring results back (folders too), `clideck profile send <profile> <device>` to share a sign-in.',
        ]
      : []),
    'Start dev servers on $PORT so sessions do not collide.',
  ].join(' ');
}

/** The briefing without phone access (what tests and templates see by default). */
export const AGENT_GUIDE = agentGuide({ phone: false });
