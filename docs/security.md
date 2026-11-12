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

## Paired decks

- Sharing (Settings > Devices) is off until the user turns it on and confirms twice. While on, the deck
  listens on its peer port (`DECK_PEER_PORT`, default 7850) and answers discovery on UDP 7849. That port
  only speaks pairing and links; the app and its API stay on the normal bind, behind the login.
- Each deck has an Ed25519 key (`identity.pem`, mode 0600); its id is a hash of the public key.
- Pairing: the deck being asked shows a random 6-digit code and the asking deck sends what the user
  typed through a PAKE (CPace on ristretto255, `@noble/curves`). Both keys go into the PAKE transcript, so
  a successful pairing pins the right keys on both sides. A listener learns nothing; someone in the middle
  gets one online guess per attempt (3 attempts per request), and every request that ended on a wrong
  code doubles the wait before the next one is accepted (10 s, 20 s, … up to an hour).
- Links: each connection does an X25519 exchange signed by both pinned Ed25519 keys, then every message
  is sealed with ChaCha20-Poly1305 (one key per direction, counter nonces). A forged, replayed or
  reordered message closes the link. An unknown key is refused before anything else is sent.
- A paired deck is trusted like the user: its requests reach this deck's server on loopback signed in
  with a token only this process holds. It may not use pairing, login or password endpoints, `/mcp`,
  `/agent`, or chain to a third deck (`/peer`). Unpairing (either side) or turning sharing off ends
  every link at once.
- On the asking deck, `/peer/<id>/api` and `/peer/<id>/ws` need that deck's own token like `/api`.
- Agents act on devices through `/agent/<session>/devices` (loopback only): on a paired deck through its
  link, on this deck (`here`) through the same loopback door and token, so the same paths stay off-limits.
  `/api/files`, `/api/exec` and profile bundles give the same power as a terminal: a profile bundle carries
  its sign-in and API key, and only ever travels inside the encrypted link or loopback.

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
- Saved conversations (`<state dir>/chats/*.jsonl`) hold everything said and every tool output, so they may contain secrets the agent read.
- API keys of profiles are plain files (`<config dir>/profiles/<id>/.deck-key`, mode 0600) and travel inside a profile bundle.
  They are mode 0600, only written for ids that are plain tokens, and deleted with the session.
  Deleting a profile also erases its CLI config folder (logins, history).

## Agents

- Agents can only propose a worktree. `ApprovalService.decide` with `approve` is the single code
  path that runs `git worktree add`, and tests cover that rejecting, failing or never approving
  creates nothing.
- Anything an agent could do in the terminal it could already do; the MCP and `clideck` tools add
  no filesystem or git capability.
