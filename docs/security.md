# Security

## Network exposure

- Default bind is `127.0.0.1`. Listening on anything else (`DECK_HOST=0.0.0.0`) requires
  authentication: the server refuses to start otherwise.
- Without an explicit password, a non-loopback bind falls back to the default password `deck` and
  logs a warning. Set `DECK_PASSWORD`, `"password"` in config.json, or change it in the app.
- "No password" is honoured only while the server listens on loopback. A stored "no password" is
  ignored as soon as the server is exposed, and the app refuses to remove the password then.

## Authentication

- Passwords are hashed with scrypt (random salt) in `~/.config/ai-cli-deck/auth.json` (mode 0600).
- A correct login returns a random access token sent as `x-deck-token` (or `?token=`).
  Changing or removing the password rotates the token, which logs everyone else out.
- Comparisons are constant time. Login and password changes are limited to 5 failures per minute
  per client (HTTP 429 afterwards).
- The deck stores no provider credentials at all (no API keys, no logins). Profiles start as
  clean terminals and the user signs in inside them.

## Request checks

- `Origin` must match `Host` (or be listed in `allowedOrigins`) for `/api` and `/ws`.
- On a loopback bind, only loopback `Host` headers are served (blocks DNS rebinding).
- `/mcp` and `/agent` accept loopback peers only, whatever the bind address.

## Files and the browser

- Every file operation goes through `resolveInside(root, relative)`: it rejects `..`, absolute
  paths, null bytes and symlinks that resolve outside the session folder.
- `/raw` answers with `X-Content-Type-Options: nosniff` and a `sandbox` CSP, so a served HTML or
  SVG file cannot run script in the deck's origin.
- The preview iframe accepts `http(s)` on `localhost`/`127.0.0.1`/`::1` only, never the deck's own
  origin, uses a restrictive `sandbox` and nothing is proxied.

- Upload names are reduced to a base name without separators or control characters, never overwrite
  an existing file, and go through `resolveInside`. The `.zip` export skips symlinks, `.git` and
  `node_modules`, and downloads are served as attachments with `nosniff` and the sandbox CSP.
- Saved terminal screens (`<state dir>/scrollback/*.bin`) may contain secrets printed in a terminal.
  They are mode 0600, only written for ids that are plain tokens, and deleted with the session.
  Deleting a profile also erases its CLI config folder (logins, history).

## Agents

- Agents can only propose a worktree. `ApprovalService.decide` with `approve` is the single code
  path that runs `git worktree add`, and tests cover that rejecting, failing or never approving
  creates nothing.
- Anything an agent could do in the terminal it could already do; the MCP and `clideck` tools add
  no filesystem or git capability.
