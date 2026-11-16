# ai-cli-deck

A local web app that gives **AI coding agents** a real chat in your browser, with a file explorer,
changes review, a per-session preview and a small bridge back to the machine. There is no terminal:
every session is a conversation (history, tool cards, permission prompts) driven by a headless
agent, so typing is instant even over a slow link.

Agents: **Claude Code** (Claude Agent SDK), **Codex** (`codex exec --json`), **Antigravity** (official `agy acp` CLI), and Claude Code against
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
- Password login, or 6-digit codes from an authenticator app (OTP mode, with a progressive ban after wrong
  codes); open without password while localhost-only
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
- Antigravity: create a profile from its built-in plugin. The sign-in dialog installs the official
  `agy` CLI when needed, then offers Google account sign-in, a Gemini API key, or the existing machine login.

Antigravity uses [ACP v1](https://antigravity.google/docs/ide/extensions/acp), with streamed replies,
tool results, per-action permissions, images, model/thinking-level selection and saved-session resume.
Its modes are default, accept edits and plan. Each session connects to the Deck's MCP server without
modifying global Antigravity settings. API keys stay in the profile's private key file; profiles without
a key share this machine's Antigravity account and settings. Existing conversations created outside the
Deck are not imported. Native forks, file rollback, manual compaction, PDF attachments and account usage
gauges are not currently supported for this agent; edits and side chats use the Deck's transcript fallback.

Codex cannot ask for permission one action at a time when run headless, so the chat's permission mode
selects its sandbox instead: ask first / accept edits = workspace write, plan = read only, bypass = full access.

## Profiles

All bundled providers are complete, versioned plugins with their own installation, authentication,
execution and tests. Settings can import/export `.deck-plugin.zip` packages and run their internal tests.
See [Provider plugins](docs/provider-plugins.md). Legacy JSON templates remain supported.

A profile is a **named, clean agent** built on a base: Claude Code, Claude Code (custom endpoint),
Claude Code (DeepSeek), Codex or Antigravity. Claude and Codex have their own config folder (`CLAUDE_CONFIG_DIR` / `CODEX_HOME`
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
- **Header menu > Fork or move** starts a new session from this conversation: Claude Code and supported Codex
  versions fork natively in the same profile. Older Codex versions and moves to another profile use a
  transcript, written to `.deck/chats/` in the project folder (kept out of git) and read by the new agent.
- **Edit a sent message** (pencil on your message): the chat goes back to just before it and your new text is
  sent; optionally the files the dropped turns changed are restored (Claude Code checkpoints).
- **Side chat**: a fork of the conversation in a drawer beside it, for a quick question that must not touch the
  main thread. Discard it when you are done.

The **Usage** panel offers **Compact** after the first message, including for Codex versions with native
compaction support. It remains available when context measurements are unknown, shows progress, and can
be stopped with the chat's Stop button. Claude continues to use its SDK `/compact` command. Codex uses
`thread/compact/start`, without sending a summary request as a user message.

The panel separates current context from whole-turn token usage. Cache reads, reported writes and
uncached input are distinct; unknown write counts and cache lifetimes stay unknown. Codex turn totals,
cache reuse and elapsed time survive server restarts (the most recent twenty turns are retained).
Stable instruction snapshots are kept privately for each conversation; new conversations receive updated
notes. Memory briefings have a full-section UTF-8 byte budget, and long MCP listings/snapshots are paginated.

Codex starts new conversations with a shorter deck briefing and retains at most 6,000 tokens per tool
output. Its MCP defaults return smaller pages (20 sessions, 6,000 snapshot characters and 12,000 task-log
characters); offsets and explicit limits let the agent retrieve the rest. Claude and API profiles keep
their existing defaults. Existing instruction snapshots are preserved to avoid disrupting cache reuse.

Before sending into an idle chat, the composer asks for confirmation when a reported cache lifetime has
elapsed. For Codex, which does not report a lifetime, it warns of **possible** cache loss after one hour
of inactivity. This is a heuristic, not expiry detection. The dialog shows the last known context size,
not cumulative input or a billing estimate. Cancel preserves the draft and attachments. Cache reuse is
controlled by the provider; resuming a thread does not guarantee a cache hit, and compaction itself may
consume tokens and change the cache prefix.

Web activity cards update when Codex supplies details after the start event. Searches show the reported
query or queries; page opens and in-page finds are separate actions. When Codex omits the terms, the card
says they were not reported instead of displaying an invented empty query. This also clarifies old saved
cards; missing telemetry does not establish that an empty search was sent.

Inside the Android APK, Back opens the session drawer from the chat. Back from the sessions of a profile
shows the profile list; another Back returns to the native status/log screen, including when the chat
was opened from a notification. It does not stop
the server or the task. If the web UI is unavailable, Back returns directly to the logs.

## Wait for usage limits and continue

When a task is interrupted by a temporary provider limit, the chat offers **Wait and continue**,
**Try now**, and **Cancel continuation**. This works with Claude and Codex, including API-key profiles
such as DeepSeek. It is opt-in for that interrupted task; warnings and ordinary task failures do not
schedule work. The server waits without keeping an agent process running or sending model requests.

A provider reset timestamp, explicit time-zone clock, or `Retry-After` takes priority. Exhausted plan
windows are respected too. If none is known, the panel marks the schedule as estimated and uses
increasing delays, from one minute up to fifteen, with jitter. After five unsuccessful automatic attempts,
the chat asks again. Closing the page does not stop an authorized wait; the saved choice survives a
server restart. Stop, a new conversation, or a profile switch cancels it. Queued messages stay behind
the interrupted task until it finishes or the wait is cancelled.

Continuation resumes the same saved thread and asks the agent to check what already completed.
The original request is resent when no thread was established or no assistant/tool progress confirmed its acceptance. Attachments are never stored in
retry metadata: if a restart leaves no thread and requires missing attachments or an unrecoverable
original prompt, the app asks the person to resend instead of continuing with incomplete context.
Billing/insufficient-credit errors, bad keys, context-window errors and turn/budget caps are not retried.
DeepSeek documents temporary [429/503 errors separately from insufficient balance (402)](https://api-docs.deepseek.com/quick_start/error_codes/).

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
