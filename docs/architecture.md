# Architecture notes

## Decisions

- **npm 10 instead of apt npm 9.2.** On this device (PRoot, Node 22) `npm@9.2` fails with
  `ENOENT ... rename` / "Invalid response body" while filling its cache. npm 10.9.9 installs
  cleanly. Install it from the registry tarball (it bundles its dependencies) and call it through
  a tiny wrapper: see the README setup section.
- **No build step for the server.** The server runs with `tsx`; `@deck/shared` is consumed as
  TypeScript source (`exports` points at `src/index.ts`). Fewer moving parts on a phone.
- **Type-checked ESLint is off.** `typescript-eslint` strict (syntactic) only, to keep lint fast and
  light on RAM. `tsc --strict` already covers type errors.
- **Providers are data.** The built-ins are `claude` and `codex` (one file each, on the machine's own sign-in);
  everything else is a profile made from a template: JSON that names the engine (`agent`), environment,
  fields to ask, and an optional API key. The built-in templates are Claude Code, Claude Code (custom
  provider), Claude Code (DeepSeek) and Codex.
- **No terminal: every session is a chat driven by a headless agent.** The server runs the agent itself and
  shows its conversation in the browser, so there is no pty, no tmux and no terminal emulation (their latency
  made typing into an agent unpleasant). Two engines, behind `AgentPort`: `claudeDriver` uses the Claude Agent
  SDK (`query()` with a streaming input channel, `canUseTool` for permissions, `resume`/`forkSession`), which
  also covers any Anthropic-compatible endpoint (custom provider, DeepSeek) through environment variables;
  `codexDriver` runs `codex exec --json` once per message (`exec resume <thread>` afterwards) and maps its
  sandbox to the permission mode (it cannot ask in this mode). Both turn their events into the same
  `ChatEvent`s (`claudeMap`, `codexMap` are pure and unit tested).
- **The conversation is ours to show, the agent's to continue.** `ChatRuntime` keeps a session's steps
  (`ChatBook`: memory + `<state>/chats/<id>.jsonl`, repaired after a restart), the answer being written
  (`partials`), a queue of messages sent while it answers, and the settings (model, mode, effort) which are
  also saved in `session.meta`. The agent's own conversation id is kept in `meta.chat`: after the agent
  process ends (idle for 15 minutes, a crash, a restart of the deck) the next message resumes it. Saved
  chats of Claude and Codex (`claudeChats`, `codexChats`) are still read to list and open old conversations,
  and a conversation moves to another AI as a Markdown transcript in `<cwd>/.deck/chats/` plus a first message
  asking to read it (`ChatActions`).
- **Editing, side chats and background tasks.** Each `user` step has a uuid that Claude keeps as its message
  uuid, so an edit (`rewind`) can resume the saved chat at the entry just before it (`resumeSessionAt`,
  found in Claude's own JSONL; the files come back through the SDK's file checkpoints). Codex cannot go back
  in a thread, and neither can a chat saved without those uuids: the edit starts a new thread whose first
  message replays what was kept (`chatRewind`). A side chat is a fork (`forkSession` for Claude, `exec fork` for capable Codex versions,
  a transcript handover for older versions) with `parentId` set to the main session. Background jobs of Claude are `task` steps from the SDK's
  task messages; the run stays open while one runs. `UsageMeter` adds a chat's cost and context, and
  `LimitBook` keeps the account's last usage window per profile (`<state>/limits.json`), shared by its chats.
- **Prompt stability and native compaction.** `AgentLauncher` snapshots the exact deck briefing and a SHA-256
  hash privately under `<state>/briefings/`. The snapshot survives restarts, is inherited by native forks,
  and is replaced for new conversations or profile changes. Pending fork state is persisted in `meta.fork`
  until the agent reports its new thread id. `codexCapabilities` detects executable capabilities locally,
  caching the result for five minutes without a model request. Codex manual compaction uses a short-lived
  app-server connection: initialize, resume with the same profile/config/instructions, `thread/compact/start`,
  then wait for `turn/completed`. RPC acknowledgement alone never counts as completion. Errors/cancellation
  leave prior context measurements intact; successful compaction invalidates them until measured again.
- **Usage and output budgets.** Codex exec completion reports whole-turn tokens, never context occupancy.
  The final rollout `token_count` provides last-request context/cache; stale closed runs cannot overwrite
  newer readings. Cache writes are nullable and separate from uncached input for both Codex and
  Anthropic-compatible profiles. Whole-turn Codex totals and the last twenty samples live privately under
  `<state>/usage/`; they survive restart and reset with the conversation. MCP returns compact JSON and
  continuation offsets for memory titles, sessions and browser outlines. CLI response shapes are retained.
  The memory section's entire UTF-8 representation fits `MEMORY_LIMITS.briefing` bytes, including headers
  and the overflow index; this is a conservative size bound, not a model-specific token estimate.
  Codex's native `tool_output_token_limit` / per-MCP-tool budgets remain profile-controlled; the display-only
  `codexMap` clip does not reduce model input. Cache lifetime, billing and cache breakpoint policy remain
  the CLI/provider's responsibility, rather than being inferred by the deck.
- **Usage-limit continuation.** `providerRetry` classifies only temporary quota/rate/overload failures;
  billing/auth/context/budget failures are excluded. Claude's rejected rate-limit events and synthetic
  assistant errors and Codex's structured error events retain reset timing. `ChatRetry` offers a durable,
  per-task opt-in through `ChatConfig.retry` and the `retry` WebSocket command. `RetryTimer` waits on the
  server, scheduling only after the choice is saved in bounded `session.meta.retry` (references/timing,
  no prompt/attachments). It cancels in-flight scheduling writes by generation, uses provider reset times
  or bounded backoff, and asks again after five attempts. `RetryTask` resumes the existing thread and
  checks restoration safety. `TurnRunner.release` and `guardedSink` invalidate old provider callbacks
  so late completion events cannot end a resumed turn. Queue draining stays blocked during the choice
  and wait; successful completion/cancellation releases it. Restoring a saved offer never authorizes work.
- **Voice** (`WhisperEngine`): whisper.cpp, downloaded on Windows (pinned sha256, resumed after a stall), an
  installed `whisper-cli` elsewhere; the model is `<state>/voice/ggml-small.bin`.
- **Keys are files, not terminals.** A profile's API key is typed in the profile dialog and kept in
  `<profile folder>/.deck-key` (mode 0600); the launcher adds it to the agent's environment. A Claude Code
  token (`sk-ant-oat...`) goes in `CLAUDE_CODE_OAUTH_TOKEN`, other Claude keys in `ANTHROPIC_API_KEY`. A
  profile whose key is optional and empty uses the machine's own sign-in instead of a folder of its own.
- **Decks pair and use each other through this deck, not the browser.** `NetworkService` (sharing setting,
  paired decks in `network.json`) drives `PeerNode` (`infrastructure/peers`): UDP discovery, a peer port that
  only speaks `/pair` and `/link` WebSockets, the PAKE pairing, and one encrypted link per paired deck
  (`LinkPool`). A link is a `Mux` of streams: HTTP requests and WebSockets, both ways. `/peer/<id>/*` on a
  deck forwards everything to that deck, whose `loopbackTarget` replays it against its own server with a
  process-only token. So a paired deck's whole app (its own build, served by it) works through the phone's
  deck with no code per feature; the web app only prefixes its API and socket URLs (`shared/api/base.ts`)
  and is built with relative asset paths. Links carry no knowledge of the network path, so they also work
  over a VPN address added by hand; a public relay could carry them too, since they are end-to-end encrypted.
- **`SessionRegistry`** holds the runtimes (session + chat), publishes changes and persists `sessions.json`;
  `SessionManager` creates, restores and removes them and `SessionChats` is everything done with a conversation.
- **Second instance for self-hosting work.** `dev.sh` gives an instance its own port, config and state, so the
  deck can be edited from inside a session.
- **Approvals poll, not push.** The badge polls every 3 s; per-session approval events also arrive
  on that session's socket.
- **Media goes through `/raw`**, not through JSON, so the browser can stream and seek audio/video.
- **One agent surface.** `createAgentTools` backs both the MCP tools and the `clideck` command.
- **`clideck` is on every session's PATH** (`apps/server/bin`) with `DECK_URL` and `DECK_SESSION_ID`
  exported; `clideck install` adds `/clideck` slash commands for Claude Code and Codex.
- **Profiles** (`ProfileService`, `profiles.json`) are clean agents on a template. Each gets its own empty config
  folder and, when the template asks for one, its own API key (`.deck-key`); a deck never stores credentials
  anywhere else. Agent tools only see sessions of the same profile.
- **Models are asked for, never listed in code.** `ModelCatalog` asks each provider's `discoverModels()` (Claude
  through the SDK's `supportedModels()`, Codex through `codex debug models` with `models_cache.json` as backup,
  endpoint profiles through `GET {baseUrl}/v1/models`, else the profile's `ANTHROPIC_MODEL`) and keeps the answer
  for ten minutes. `ModelBook` (`models.json`) keeps each provider's default model, default permission mode and the
  last model that really answered. Chats are told when any of them changes.
- **Finished answers always notify.** `TurnNotifier` turns a `turn-done` (answer ended, not stopped by the person) or
  a permission request into a `notify` push and a phone notification; there is no per-chat opt-in.
- **Memory is notes in files, applied per run.** `MemoryService` keeps the global and per-profile trees in memory and
  writes `memory/global.json` / `memory/profiles/<id>.json` atomically on each change (`JsonMemoryStore`); pure
  folder rules (depth, count, no cycles, cascade delete) live in `memoryFolders`. `AgentLauncher` appends
  `memoryBriefing` to the guide whenever a run starts, so edits apply to the next run without a restart. Agents reach
  it through `agentMemory` (MCP tool and `clideck memory`); their global writes and imports go through the approval
  service (`kind: 'memory'`) and only `applyMemoryRequest` performs them after the person approves.
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
