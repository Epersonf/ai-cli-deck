# Project: ai-cli-deck

Build a local web app that acts as a unified interface for native AI coding CLIs (claude, codex, and others). It does NOT implement its own agent harness. Each session is a real CLI process running inside a pty, streamed to the browser with xterm.js. Around the terminal, the app adds a file explorer, a per-session preview browser (iframe), and an MCP server that lets the agents talk back to the app.

## Environment (important)

- Runs on an Android phone (Samsung A15, ARM64, limited RAM) inside Termux > Ubuntu (proot-distro). Expect 2 to 3 concurrent sessions at most.
- Node comes from apt and may be old. Check `node -v` first and adapt (target Node 20+, tell me if the version is too old).
- DNS can be flaky in PRoot. npm may need `--cache /root/.npm-cache`.
- Use npm workspaces (not pnpm) to reduce friction.
- node-pty needs build-essential and python3 to compile on ARM64. Validate it FIRST (milestone 0). If it fails, tell me and implement the fallback: a non-interactive mode spawning the CLI with JSON output (for example `claude -p --output-format stream-json`) behind the same `SessionProcess` interface.
- The browser is the phone browser at http://localhost:<port>. Default bind is 127.0.0.1. If bound to 0.0.0.0, a token is mandatory (see Security).

## Git and repo

- Create a PRIVATE GitHub repo named `ai-cli-deck` (SSH is already configured; use `gh` if available, otherwise create it via the API or tell me what is missing).
- Commit early and often, Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`). One logical change per commit. Push to `main` after each milestone.

## Code standards (strict, apply everywhere)

- All code, comments, identifiers, commit messages and docs in English.
- Maximum 150 lines per file. If a file grows, split it into cohesive modules. No exceptions (config files included when possible).
- DRY: extract shared logic and shared types. Shared contracts live in `packages/shared`.
- TypeScript strict: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`. No `any`, no non-null assertions, no unchecked casts. Use `unknown` plus validation.
- Validate every boundary (HTTP bodies, WebSocket messages, MCP tool inputs, env vars) with zod. Infer types from schemas, one source of truth.
- ESLint (typescript-eslint strict) plus Prettier. Add a `max-lines` rule set to 150 and `no-explicit-any` as error.
- Small pure functions, dependency injection through constructor or factory params, no hidden globals. Separate domain logic from I/O (Clean Architecture style: domain, application, infrastructure, interface).
- Tests with Vitest for domain and application layers (session lifecycle, approval flow, path guard, protocol parsing). Keep tests under the 150 line limit too.
- Before each commit run: typecheck, lint, test. Never commit failing code.

## Monorepo layout

```
ai-cli-deck/
  package.json            (npm workspaces, root scripts)
  tsconfig.base.json
  eslint.config.js
  apps/
    server/               Fastify + ws + node-pty + MCP
      src/
        domain/           entities, value objects, errors, ports (interfaces)
        application/      use cases (createSession, sendInput, approveRequest...)
        infrastructure/   pty, tmux, git, fs, providers, mcp, config
        interface/        http routes, ws handlers, mcp tool handlers
        main.ts           composition root only
    web/                  React + Vite + xterm.js
      src/
        features/         sessions, terminal, files, preview, approvals
        shared/           api client, ws client, hooks, ui primitives
  packages/
    shared/               zod schemas, protocol types, constants
  docs/                   architecture.md, protocol.md, security.md
```

## Stack

Server: Fastify, @fastify/websocket (or ws), node-pty, zod, @modelcontextprotocol/sdk, pino.
Web: React, Vite, xterm.js with addons fit and web-links, a small state lib (zustand).
Tooling: TypeScript, Vitest, ESLint, Prettier, tsx for dev.

## Core concepts

### Session

A session = one CLI process in a pty, bound to a working directory, a provider, and its own preview state. Fields: id, provider, cwd, status (starting, running, exited), createdAt, previewUrl, port, worktree (optional). Sessions are managed by a `SessionManager` in the application layer behind ports (`PtyPort`, `ProcessMultiplexerPort`).

### Persistence

Each session runs inside a tmux session (`tmux new-session -A -s deck-<id> <command>`), so it survives closing the browser or restarting the server. On server start, rediscover existing `deck-*` tmux sessions and reattach. If tmux is not installed, fall back to a plain pty and warn that persistence is disabled.

### Providers (adapters, no custom harness)

One `Provider` interface: `id`, `label`, `buildCommand(ctx)` returning command, args and env, plus `buildMcpConfig(ctx)` to inject the MCP endpoint. Adapters:

- `claude` (Claude Code CLI; pass MCP config via `--mcp-config`)
- `codex` (OpenAI Codex CLI; MCP via its config)
- `claude-deepseek`: claude with env `ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic` and `ANTHROPIC_AUTH_TOKEN` read from the app config
- `custom`: any user-defined command
  Providers are registered in one registry file. Adding a provider must be a single new file plus one registry line. Secrets live in a config file outside the repo (`~/.config/ai-cli-deck/config.json`), never committed, never sent to the browser.

### WebSocket protocol (packages/shared)

One WebSocket per open session terminal. Messages are zod-validated discriminated unions: client to server (`input`, `resize`, `ping`), server to client (`output`, `status`, `exit`, `approval-request`, `preview-open`, `pong`). Output is raw pty bytes (base64 or binary frames). Support reconnect with a short scrollback replay from tmux.

### HTTP API

REST for: list/create/delete sessions, list providers, file tree and file read (read-only, plus optional write later), git status, approvals (list, approve, reject). All responses typed from shared schemas.

### Per-session preview browser

- Each session tab owns its own preview panel (URL plus back/forward history), so two sessions can show different apps.
- xterm web-links addon: clicking a `http://localhost:<port>` or `127.0.0.1` URL in the terminal opens it in THAT session's iframe.
- The iframe accepts only localhost and 127.0.0.1 URLs, uses a restrictive `sandbox` attribute, and the app does not proxy anything.
- If the page cannot be embedded (X-Frame-Options or CSP frame-ancestors), show a fallback button "Open in new tab".
- Each session gets its own `PORT` env var (allocator that picks free ports from a configurable range) so dev servers do not collide.

### MCP server (agents talk back to the app)

Expose an HTTP MCP endpoint per session: `http://127.0.0.1:<serverPort>/mcp/<sessionId>`, so every tool call knows which session it came from. Tools:

- `list_sessions()`: other sessions with provider and cwd (so an agent can notice another session in the same folder).
- `propose_worktree({ reason })`: creates a PENDING approval request. It must NOT run git. Returns `{ status: "pending", requestId }`; the agent can poll `get_request_status(requestId)`.
- `open_preview({ url })`: opens a localhost URL in the session iframe (validate with the same localhost guard).
- `suggest_new_tab({ url })`: shows an "Open in new tab" button in the UI (browsers block `window.open` without a user gesture, so the click must be the user's).
- `get_request_status({ requestId })`: pending, approved (with new path) or rejected.
  No MCP tool may call git or modify the filesystem directly.

### Worktree flow

- Worktrees are OFF by default, enabled per session when creating it.
- When two sessions share the same cwd, show a visible warning badge in the UI.
- An agent may only PROPOSE a worktree via `propose_worktree`. The UI shows the request with the reason and Approve and Reject buttons. Only after the user approves does the backend run `git worktree add` (new branch `deck/<sessionId>`, new sibling directory). Then the session cwd is updated and the agent is told the new path through the request status.
- The approval rule is enforced server side in the application layer (`ApprovalService`), covered by tests: no code path creates a worktree without an approved request.

### File explorer

Tree view of the session cwd with lazy loading, file viewer (read-only first, syntax highlighting optional), ignore `.git`, `node_modules` by default (toggle). All paths go through a single `resolveInside(root, relative)` guard that rejects traversal and symlink escapes.

### UI

Mobile first (narrow viewport, touch friendly), but works on desktop. Layout: top bar with session tabs and a "new session" button; main area switchable between Terminal, Files and Preview (on wide screens show them side by side). An approvals badge opens the pending requests list. Extra keys bar for the terminal (Esc, Tab, Ctrl, arrows) because mobile keyboards lack them.

#### Extra keys bar (Termux style, required)

- Same idea as the Termux extra keys row, always visible under the terminal on touch devices: `ESC`, `TAB`, `CTRL`, `ALT`, `HOME`, `END`, `PGUP`, `PGDN`, arrows (`←` `↑` `↓` `→`), plus `-`, `/`, `|`, `~`.
- `CTRL` and `ALT` are sticky modifiers: tap once to arm for the next key (highlighted), double tap to lock, tap again to release. Ctrl+letter must work with the phone keyboard too (for example arm `CTRL`, then type `c` to send `^C`).
- Holding an arrow, `PGUP` or `PGDN` repeats the key.
- Keys send the proper escape sequences (for example `\x1b[A` for up, `\x1b[H` for home) through the normal `input` WebSocket message; no special protocol.
- The bar must not steal focus from xterm (so the soft keyboard stays open) and must be configurable (key list and order) from the app config.
- Pure functions map `(key, modifiers)` to the byte sequence, covered by Vitest tests.

## Security

- Default bind 127.0.0.1. If the user sets host 0.0.0.0, require a random access token (generated on first run, printed in the console, sent as header or query for WS, constant-time compare) and refuse to start without it.
- Strict origin check on WebSocket and HTTP.
- Never expose provider secrets to the browser. Never log them.
- MCP endpoint reachable only from localhost.
- Path traversal guard for every file operation. Iframe sandbox and localhost-only URL guard.

## Milestones (finish, commit and push each one before the next)

0. Repo bootstrap: workspaces, tsconfig strict, ESLint (with max-lines 150), Prettier, Vitest, CI script. Spike: confirm node-pty builds and spawns `bash` on this device. Report the result. If it fails, switch to the documented fallback.
1. Server core: session domain, SessionManager, pty plus tmux adapters, provider registry with `claude` and `custom`, HTTP routes, WS protocol, tests.
2. Web core: session tabs, xterm.js terminal with resize and reconnect, extra keys bar, new session dialog.
3. Preview: per-session iframe, web-links addon, localhost guard, new-tab fallback, per-session PORT allocator.
4. File explorer: tree, viewer, path guard, tests.
5. MCP server: per-session endpoint and the five tools, wiring into the claude provider config.
6. Approvals and worktree flow with UI and tests, same-folder warning.
7. Remaining providers (codex, claude-deepseek), config file handling, token auth for 0.0.0.0.
8. Docs: README (setup on Termux/PRoot, run, config), docs/architecture.md, docs/protocol.md, docs/security.md.

## Working rules

- Ask me before making decisions that are not covered here and are hard to undo. Otherwise decide, and note the decision in docs/architecture.md.
- After each milestone, give me a short summary: what works, what was tested, what is next.
- Keep dependencies minimal and justify any new one in the commit message.

## Addenda (decided after the first brief)

- Works with any AI CLI: extra providers come from `config.json`; a plain `shell` provider exists.
- The file explorer plays/shows images, audio, video and PDFs and greys out git-ignored entries.
- Password login: default fallback password when exposed beyond loopback, changeable in the app,
  removable only while localhost-only. The extra keys bar is hidden on non-touch devices.
- `clideck` command (and `/clideck help` slash commands) lets agents and users operate the deck.
- Visual style: retro-futuristic steampunk (brass, copper, leather, glowing lamps).
