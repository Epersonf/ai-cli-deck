# ai-cli-deck

A local web app that puts **any AI coding CLI** (claude, codex, gemini, aider, a plain shell...)
in a real terminal in your browser, with a file explorer, a per-session preview and a small
bridge back to the machine. It does not implement an agent: every session is the real CLI in a
pty, streamed with xterm.js and kept alive by tmux.

Built for an Android phone (Termux > Ubuntu via proot-distro) and a phone browser, but it works
on any Linux box and desktop browser.

> **Security:** the deck gives its users a real shell on your machine. Keep it on localhost or a
> trusted LAN with a password, and never expose it to the internet as is. See [SECURITY.md](SECURITY.md).

## Features

- Terminal per session (tabs), survives closing the browser and restarting the server (tmux)
- If the whole machine or Termux dies, the sessions come back as ended but still show their last
  screen (saved to disk every few seconds); deleting a session deletes that file
- Termux-style extra keys: ESC, TAB, sticky CTRL/ALT, HOME/END, PGUP/PGDN, arrows (hidden on desktop)
- File explorer: text, images, audio, video, PDF; upload (button, drag and drop, pasted images);
  download a file or a whole folder as `.zip`; an options dialog toggles hidden files,
  git-ignored files and file extensions
- Per-session preview iframe (localhost only); click a `localhost:PORT` link in the terminal
- `clideck` command and MCP tools so agents can talk back (preview, worktree request...)
- Password login, changeable in the app; open without password while localhost-only
- Desktop split view (terminal | files or preview, draggable divider, optional) and a terminal list
  (`☰`, or Alt+1…9 / Alt+[ ]) to switch terminals on phone and desktop
- Interface in 8 languages: English, Português (Brasil), Español, Italiano, Français, 中文, 日本語, Русский

## Setup (Termux > Ubuntu proot)

```bash
apt update && apt install -y git tmux build-essential python3 nodejs npm
node -v        # 20+ needed (22 recommended)
git clone https://github.com/Epersonf/ai-cli-deck.git && cd ai-cli-deck
npm install
```

If `npm install` fails with `ENOENT ... rename` or "Invalid response body" (flaky DNS plus the old
apt npm 9.x), fetch npm 10 from its tarball (it bundles its dependencies) and use it instead:

```bash
mkdir -p ~/.local/npm10 && cd ~/.local/npm10
curl -fsSL https://registry.npmjs.org/npm/-/npm-10.9.9.tgz | tar xz
alias npm10='node ~/.local/npm10/package/bin/npm-cli.js'   # then: npm10 install
```

## Run

```bash
npm run build      # builds the web app once
npm run start      # http://127.0.0.1:7842  (or: npm run serve to build + start)
```

Open `http://localhost:7842` in the phone browser.

To use it from a PC on the same Wi-Fi, listen on all interfaces. A password is then mandatory:

```bash
DECK_HOST=0.0.0.0 DECK_PASSWORD='your passphrase' npm run start
```

The startup log prints the LAN URLs. Without `DECK_PASSWORD` the built-in default password
`deck` is used and a warning is logged: change it in the app (gear icon) right away.

## Keeping it fast with the screen off (Android)

With the screen off, Android sleeps the CPU and Wi-Fi radio and every keystroke feels laggy. On
Termux the server asks for the Termux wake lock (CPU + Wi-Fi) at startup, which fixes it. It costs
battery while held: release it with `termux-wake-unlock`, or start the server with
`DECK_WAKE_LOCK=0` to skip it. Also set Termux to "Unrestricted" in Android's battery settings.

## Configuration

`~/.config/ai-cli-deck/config.json` (never committed, never sent to the browser):

```json
{
  "host": "127.0.0.1",
  "port": 7842,
  "password": null,
  "defaultCwd": null,
  "portRange": { "min": 4100, "max": 4199 },
  "providers": [
    {
      "id": "gemini",
      "label": "Gemini CLI",
      "command": "gemini",
      "args": [],
      "env": {},
      "mcpArgs": []
    },
    { "id": "aider", "label": "Aider", "command": "aider", "args": ["--no-auto-commits"] }
  ]
}
```

`defaultCwd` defaults to your home directory (`~` is accepted in the folder field). The deck never
stores or asks for API keys or logins: every CLI signs in by itself, inside its terminal.

Environment overrides: `DECK_HOST`, `DECK_PORT`, `DECK_PASSWORD`, `DECK_CONFIG_DIR`, `DECK_STATE_DIR`,
`DECK_STATIC_DIR`, `DECK_TMUX_SOCKET` (tmux server name, default `deck`), `DECK_WAKE_LOCK=0`. `mcpArgs` may contain `{mcpUrl}` to point a CLI at the deck MCP server.

## Installing and signing in to CLIs

The deck never handles logins. If a CLI is missing, the new-session dialog offers **Install in
terminal**, which runs `clideck setup <cli>` (an `npm install -g` after you confirm). From then on
the CLI shows its own sign-in the first time it starts, in the session terminal, whatever flow it
uses today or tomorrow. If `npm` is missing (Debian/Ubuntu ship it separately), the setup tells you
how to get it.

## Profiles (clean terminals)

A profile is a **named, clean terminal** built on a base: Claude Code, Claude Code (DeepSeek), Codex
or Custom (any program, or just a shell). It starts with its own empty config folder
(`CLAUDE_CONFIG_DIR` / `CODEX_HOME` under `~/.config/ai-cli-deck/profiles/<id>`), so **no login and no
key is linked**. You sign in or export a key yourself inside that terminal, exactly as the CLI
documents. The deck holds no credentials, so it keeps working if a CLI changes how it logs in.

Create profiles from the terminals menu (☰ > New profile) or with
`clideck profile add "Work" claude`. Profiles can be renamed; the base and the id never change, and
each session stays bound to the profile it was started with. They are stored in
`~/.config/ai-cli-deck/profiles.json`.

## Talking back to the deck

Inside any session, `clideck help` lists the commands (`preview`, `sessions`, `worktree`, `status`...).
Run `clideck install` once to get `/clideck help` as a slash command in Claude Code and Codex.
Claude sessions also get the MCP server automatically. See [docs/protocol.md](docs/protocol.md).

## Development

```bash
npm run ci      # typecheck + lint + tests
./dev.sh        # a second, isolated instance on :7843 (own config, state and tmux server)
```

Use `dev.sh` from a git worktree to hack on the deck while you keep working inside the stable one.

Docs: [architecture](docs/architecture.md), [protocol](docs/protocol.md), [security](docs/security.md).

## License

[MIT](LICENSE)
