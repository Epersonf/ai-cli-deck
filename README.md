# ai-cli-deck

A local web app that gives **AI coding agents** a real chat in your browser, with a file explorer,
changes review, a per-session preview and a small bridge back to the machine. There is no terminal:
every session is a conversation (history, tool cards, permission prompts) driven by a headless
agent, so typing is instant even over a slow link.

Agents: **Claude Code** (Claude Agent SDK), **Codex** (`codex exec --json`), and Claude Code against
a **custom Anthropic-compatible endpoint** or **DeepSeek**, as profiles with their own key.

Built for an Android phone (Termux > Ubuntu via proot-distro) and a phone browser, but it works
on any Linux box, Windows and desktop browser.

> **Security:** the agents can run commands on your machine. Keep the deck on localhost or a
> trusted LAN with a password, and never expose it to the internet as is. See [SECURITY.md](SECURITY.md).

## Features

- Real chats per session: markdown, streaming, thinking, tool cards (commands, edits, reads), permission
  prompts (allow / always / deny), permission mode, model and effort pickers, images and PDFs, stop
- Conversations are saved on disk and survive closing the browser and restarting the server; resume,
  fork, **edit a sent message** (optionally reverting the files) and open a **side chat**
- Background tasks panel (dev servers, builds the agent left running) with Stop
- Usage gauges: context window, cost, and the account limit with its reset time
- Voice: dictate with the microphone (local whisper) and have answers read aloud
- File explorer: text, images, audio, video, PDF; upload (button, drag and drop, pasted images);
  download a file or a whole folder as `.zip`; an options dialog toggles hidden files,
  git-ignored files and file extensions
- Changes review (git diff, commit, push), per-session preview with a server-side browser
- `clideck` command and MCP tools so agents can talk back (preview, worktree request...)
- Password login, changeable in the app; open without password while localhost-only
- Desktop split view (chat | files, changes or preview, draggable divider) and a session list
  (`☰`, or Alt+1…9 / Alt+[ ]) to switch sessions on phone and desktop
- Pair your devices and use a PC's deck from the phone (see below)
- Interface in 8 languages: English, Português (Brasil), Español, Italiano, Français, 中文, 日本語, Русский

## Setup (Termux > Ubuntu proot)

```bash
apt update && apt install -y git build-essential python3 nodejs npm
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

With the screen off, Android sleeps the CPU and Wi-Fi radio and replies feel laggy. On
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
  "portRange": { "min": 4100, "max": 4199 }
}
```

`defaultCwd` defaults to your home directory (`~` is accepted in the folder field).

Environment overrides: `DECK_HOST`, `DECK_PORT`, `DECK_PASSWORD`, `DECK_CONFIG_DIR`, `DECK_STATE_DIR`,
`DECK_STATIC_DIR`, `DECK_WAKE_LOCK=0`.

## Installing and signing in

The agent needs its CLI: Claude Code ships inside the Claude Agent SDK; Codex needs `codex` in PATH
(`npm install -g @openai/codex`, the new-session dialog offers it). There is no terminal to log in,
so a profile takes an **API key or token** (kept in its own folder, never sent back to the browser):

- Claude Code: a token from `claude setup-token` (`sk-ant-oat…`) or an Anthropic API key. Leave it empty to
  use the Claude Code login already on this machine.
- Custom endpoint and DeepSeek: the key of that API.
- Codex: an OpenAI API key, or empty to use `codex login` done on this machine.

Codex cannot ask for permission one action at a time when run headless, so the chat's permission mode
selects its sandbox instead: ask first / accept edits = workspace write, plan = read only, bypass = full access.

## Profiles

A profile is a **named, clean agent** built on a base: Claude Code, Claude Code (custom endpoint),
Claude Code (DeepSeek) or Codex. It has its own config folder (`CLAUDE_CONFIG_DIR` / `CODEX_HOME`
under `~/.config/ai-cli-deck/profiles/<id>`), its own key and endpoint, and its own chats.

**Custom endpoint and DeepSeek.** _Claude Code (custom endpoint)_ talks to an Anthropic-compatible API at
a base URL you choose (for example a company gateway) with its key; _Claude Code (DeepSeek)_ is the
same thing with the URL and models fixed, so only the key is yours.

**Profile templates.** A profile is made from a template: a small JSON file (comments allowed) with the
`agent` (`claude` or `codex`), environment, a model, the fields to ask for (an API address...) and an
optional API key. The built-in ones use the same format. Add another endpoint in Settings > Manage
templates: download the commented example, edit it, paste or choose the file and import it. Imported
templates live in `~/.config/ai-cli-deck/templates/`.

**Profiles are separate worlds.** Each has its own config folder, key and endpoint, and an agent in one
does not see the sessions of another in `clideck sessions`. They all run as the same operating-system user,
so this is separation of configuration, not a security sandbox.

Create profiles from the session list (☰ > New profile) or with `clideck profile add "Work" claude`.
They are stored in `~/.config/ai-cli-deck/profiles.json`.

## Talking back to the deck

Inside any session, `clideck help` lists the commands (`title`, `preview`, `sessions`, `worktree`, `status`...).
Agents can also name their session (`clideck title`); `clideck meta` keeps small notes.

## Conversations: continue, fork, edit, side chat

Every session keeps its conversation on disk (`<state>/chats/<id>.jsonl`) and the agent's own chat id,
so a restart, a reload or another device shows the same chat, and the next message resumes it.

- **New session > Load chat history** lists the chats Claude Code or Codex saved for the chosen profile and
  folder; any of them continues in a new session (its earlier turns are shown).
- **Header menu > Fork or move** starts a new session from this conversation: Claude Code forks the chat
  natively in the same profile; any other case (another profile, Codex) hands the conversation over as a
  transcript, written to `.deck/chats/` in the project folder (kept out of git) and read by the new agent.
- **Edit a sent message** (pencil on your message): the chat goes back to just before it and your new text is
  sent; optionally the files the dropped turns changed are restored (Claude Code checkpoints).
- **Side chat**: a fork of the conversation in a drawer beside it, for a quick question that must not touch the
  main thread. Discard it when you are done.

## Your other devices: use the PC from the phone

Settings > Devices pairs decks on the same network: on the PC turn on **Share this deck with my devices**
(it asks twice), and on the phone the PC shows up under **On this network**; tap **Pair**, type the code the
PC shows, and from then on the PC is in the sessions drawer (☰). Opening it shows the PC's whole deck
(chats, files, changes, preview) inside the phone's app, running on the PC.

- Pairing uses the code with a PAKE, and every link is end-to-end encrypted and tied to the keys pinned
  when pairing: nothing on the network can read it or pretend to be one of the devices.
- Either side can unpair; turning sharing off ends every link at once.
- Away from home it works through any route between the two devices, such as a VPN (Tailscale, ZeroTier):
  pair, or add the VPN address of a paired device. Without a VPN or a forwarded port, two devices behind
  different home routers cannot reach each other.
- Ports: TCP 7850 for pairing and links (`DECK_PEER_PORT`), UDP 7849 for finding decks.

**Agents use every device.** Agents act on a device by name: `here` (this deck) or a paired one, through
`clideck device <name> ...` or the MCP tool `device`. A phone agent is told which devices are paired, so
"use my PC's GPU for this" just works:

- `clideck device PC run "nvidia-smi"`: runs a command there and returns its output and exit code (up to 280 s).
- `clideck device PC task run "python render.py" --cwd ~/proj`: a long job there, shown in that deck's drawer;
  `task list|log <id>|stop <id>` follows it.
- `clideck copy PC:~/proj/out ./results`: copies a file or a whole folder between any two devices, streamed.
- `clideck device PC terminals|open|send|read|restart|close`: uses its chat sessions (still called "terminals" in the CLI), e.g. start an agent on the PC,
  send it a message and read its answer. `here` does the same for this deck's own sessions.
- `clideck profile send Work PC`: copies a profile with its sign-in, API key and settings (not its chats,
  unless `--chats`), so it works there without signing in again.

**Background tasks.** `clideck task run "<command>"` keeps a command running (its output is kept and shown in the drawer,
under the profile's sessions); `clideck task battery --below 10` watches the phone's battery and notifies it (needs
Phone access, see android/README.md); `clideck task list|stop|log`. The chat menu has "Notify me when it's
done": when an answer finishes, the
phone gets a notification, with no tokens spent and no agent involved. Tasks live in memory (they end when the deck
stops), belong to the profile of the session that started them.
Run `clideck install` once to get `/clideck help` as a slash command in Claude Code and Codex.
Claude sessions also get the MCP server automatically. See [docs/protocol.md](docs/protocol.md).

## Development

```bash
npm run ci      # typecheck + lint + tests
./dev.sh        # a second, isolated instance on :7843 (own config and state)
```

Use `dev.sh` from a git worktree to hack on the deck while you keep working inside the stable one.

Docs: [architecture](docs/architecture.md), [protocol](docs/protocol.md), [security](docs/security.md).

## License

[MIT](LICENSE)
