# Architecture notes

## Decisions

- **npm 10 instead of apt npm 9.2.** On this device (PRoot, Node 22) `npm@9.2` fails with
  `ENOENT ... rename` / "Invalid response body" while filling its cache. npm 10.9.9 installs
  cleanly. Install it from the registry tarball (it bundles its dependencies) and call it through
  a tiny wrapper: see the README setup section.
- **No build step for the server.** The server runs with `tsx`; `@deck/shared` is consumed as
  TypeScript source (`exports` points at `src/index.ts`). Fewer moving parts on a phone.
- **node-pty works** on ARM64 PRoot (spawned `bash` in a pty successfully), so the non-interactive
  fallback is not needed.
- **Type-checked ESLint is off.** `typescript-eslint` strict (syntactic) only, to keep lint fast and
  light on RAM. `tsc --strict` already covers type errors.
- **Providers are data.** Built-ins (`shell`, `claude`, `codex`, `claude-deepseek`, `custom`) are one
  file each; any other CLI is declared in `config.json` (command, args, env, `mcpArgs`) with no code.
- **tmux on a private socket** (`-L deck`) so deck sessions never mix with the user's own tmux.
- **tmux keeps programs alive; the browser terminal is the terminal.** The server talks to tmux in
  control mode (`tmux -C`, `TmuxControlClient`): `%output` lines carry the program's own bytes, which go
  to xterm.js unchanged, so the browser keeps the only scrollback (one scroll, local, no round trip) and
  sees everything a native terminal would (clearing the scrollback, synchronized output, OSC 52, links).
  Keys go in with `send-keys -l`. tmux's mouse is off and its own history is only used to rebuild the
  screen for a device that connects later. tmux still answers the program's queries (cursor position,
  colours from `window-style`), so xterm keeps quiet on those (`upstreamReplies.ts`). Drawing through
  `tmux attach` instead meant two scrollbacks (tmux's and xterm's) and lost `ESC [3J`, so every redraw of
  an agent's chat piled up again in the browser's scrollback.
- **Programs are told they are not in tmux.** They start under `env -u TMUX -u TMUX_PANE`: their output
  reaches xterm.js as written, so they must not adapt to tmux (wrapped escape sequences, tmux tips).
- **Conversations belong to the CLIs; the deck only finds them.** `ChatService` knows each terminal's
  chat without asking the agent: Claude Code reports it through a `SessionStart` hook passed with
  `--settings` (it writes the hook's JSON to `$DECK_CHAT_FILE`); otherwise the deck reads the CLI's own chat
  files (`claudeChats`, `codexChats`) and takes the one this terminal's run touched (`meta.runAt`),
  skipping chats other terminals are on. On exit the id is kept in `meta.chat`. `ChatActions` restarts
  with the CLI's resume arguments, forks natively, or hands the chat to another profile as a Markdown
  transcript in `<cwd>/.deck/chats/` (listed in `.git/info/exclude`) plus a first message asking to read
  it. Templates describe this in their `chat` block, so a new CLI needs no code. Restarting keeps the
  terminal size and may change the profile.
- **Decks pair and use each other through this deck, not the browser.** `NetworkService` (sharing setting,
  paired decks in `network.json`) drives `PeerNode` (`infrastructure/peers`): UDP discovery, a peer port that
  only speaks `/pair` and `/link` WebSockets, the PAKE pairing, and one encrypted link per paired deck
  (`LinkPool`). A link is a `Mux` of streams: HTTP requests and WebSockets, both ways. `/peer/<id>/*` on a
  deck forwards everything to that deck, whose `loopbackTarget` replays it against its own server with a
  process-only token. So a paired deck's whole app (its own build, served by it) works through the phone's
  deck with no code per feature; the web app only prefixes its API and socket URLs (`shared/api/base.ts`)
  and is built with relative asset paths. Links carry no knowledge of the network path, so they also work
  over a VPN address added by hand; a public relay could carry them too, since they are end-to-end encrypted.
- **Reattach without a provider.** After a server restart, live `deck-*` tmux sessions are
  re-attached with a control-mode `attach-session` (the provider is not needed again).
- **Screens survive a dead machine.** `ScreenSaver` writes each live session's screen (tmux
  `capture-pane`, or the ring buffer without tmux) to `<state dir>/scrollback/<id>.bin` every 5 s
  when there was output. tmux dies with Termux, so on restart an ended session replays that file
  instead of an empty buffer. Deleting a session deletes its file. It restores the screen, not the process.
- **`SessionRegistry`** holds the runtimes (session, pty, replay buffer), publishes changes and
  persists `sessions.json`; `SessionManager` only orchestrates.
- **Second instance for self-hosting work.** `DECK_TMUX_SOCKET` gives an instance its own tmux server
  and `dev.sh` its own port, config and state, so the deck can be edited from inside a session.
- **Approvals poll, not push.** The badge polls every 3 s; per-session approval events also arrive
  on that session's socket.
- **Media goes through `/raw`**, not through JSON, so the browser can stream and seek audio/video.
- **One agent surface.** `createAgentTools` backs both the MCP tools and the `clideck` command.
- **`clideck` is on every session's PATH** (`apps/server/bin`) with `DECK_URL` and `DECK_SESSION_ID`
  exported; `clideck install` adds `/clideck` slash commands for Claude Code and Codex.
- **Profiles** (`ProfileService`, `profiles.json`) are clean terminals on a base. Each gets its own empty CLI
  config folder; the deck stores no credentials. The endpoint bases (custom endpoint, DeepSeek) set
  `ANTHROPIC_BASE_URL` and start `claude` through `clideck ensure-key`, which asks for the key in the terminal
  and saves it in that profile's own Claude `settings.json`. Agent tools only see terminals of the same profile.
- **Auth is a domain service** (`AuthService`) behind ports, so password rules are unit tested
  without touching disk or crypto.
- **Localization without a library.** `apps/web/src/shared/i18n` holds one typed dictionary per
  language; English is the source of truth and every other file must define the same keys (the
  type checker and a parity test, which also compares `{placeholders}`, enforce it). The language is
  saved in the browser, defaults to the browser language, and server error messages stay English.
- **Layout state is a store** (`layoutStore`) so code outside React (socket handlers, terminal links)
  can open the preview pane with `showSidePane`.
- **Desktop split** is optional: terminal | draggable splitter | files or preview, remembered in
  `localStorage`. On narrow screens the same panes become tabs.
