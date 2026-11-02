# Protocol

All shapes live in `packages/shared` as zod schemas; types are inferred from them.

## WebSocket: `/ws/sessions/<id>` (one per open terminal)

Client to server (JSON text frames):

| type     | fields         | meaning                |
| -------- | -------------- | ---------------------- |
| `input`  | `data: string` | keystrokes for the pty |
| `resize` | `cols`, `rows` | terminal size          |
| `ping`   | -              | keep-alive             |

Server to client:

| type               | fields                    | meaning                                            |
| ------------------ | ------------------------- | -------------------------------------------------- |
| `output`           | `data` (base64), `replay` | raw pty bytes; `replay: true` is the screen replay |
| `status`           | `session`                 | session changed (status, cwd, preview, ...)        |
| `exit`             | `code`                    | the process ended                                  |
| `approval-request` | `request`                 | a pending approval for this session                |
| `preview-open`     | `url`                     | open this localhost URL in the preview             |
| `new-tab`          | `url`                     | offer an "open in new tab" button                  |
| `pong`             | -                         | answer to `ping`                                   |

On connect the server sends `status`, then a replay (tmux `capture-pane`, or an in-memory ring
buffer without tmux), then live output. The browser resets its terminal on every (re)connect.

## HTTP API (`/api`)

| method   | path                                    | purpose                                                    |
| -------- | --------------------------------------- | ---------------------------------------------------------- |
| GET      | `/auth`                                 | `{required, canDisable, isDefault}` (public)               |
| POST     | `/login`                                | `{password}` -> `{token}` (public, throttled)              |
| PUT      | `/password`                             | `{current, next}`; `next: null` removes it (loopback only) |
| GET      | `/config`, `/providers`                 | public config, available CLIs                              |
| GET/POST | `/sessions`                             | list / create                                              |
| DELETE   | `/sessions/:id`                         | stop and remove                                            |
| PUT      | `/sessions/:id/preview`                 | set the preview URL (localhost only)                       |
| GET      | `/sessions/:id/tree?path=&showIgnored=` | folder listing with `ignored` flags                        |
| GET      | `/sessions/:id/file?path=`              | text content (512 KiB cap)                                 |
| GET      | `/sessions/:id/raw?path=`               | file bytes with `Range` (media viewer)                     |
| GET      | `/sessions/:id/git`                     | git status                                                 |
| GET      | `/approvals?status=`                    | approval requests                                          |
| POST     | `/approvals/:id/decision`               | `{decision: approve                                        | reject}` |

The token goes in the `x-deck-token` header (or `?token=` for WebSockets and media elements).

## Agent endpoints (loopback only)

- MCP, Streamable HTTP, stateless: `POST /mcp/<sessionId>` with tools `list_sessions`,
  `propose_worktree({reason})`, `open_preview({url})`, `suggest_new_tab({url})`,
  `get_request_status({requestId})`.
- `clideck` uses `GET|POST /agent/<sessionId>/{whoami,sessions,preview,newtab,worktree,requests/:id}`.

Both are thin wrappers over the same `createAgentTools`, so they behave identically. No tool runs
git or writes files: `propose_worktree` only creates a pending request.
