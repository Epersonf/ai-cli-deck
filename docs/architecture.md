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
  Options (`status off`, `escape-time`) are set before `new-session -A`, which blocks until detach.
- **Reattach without a provider.** After a server restart, live `deck-*` tmux sessions are
  re-attached with `tmux attach` (the provider is not needed again).
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
  config folder; the deck stores no credentials. The DeepSeek base only sets the endpoint and model env.
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
