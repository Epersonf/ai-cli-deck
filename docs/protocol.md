# Protocol

All shapes live in `packages/shared` as zod schemas; types are inferred from them.

## WebSocket: `/ws/sessions/<id>` (one per open terminal)

Client to server (JSON text frames):

| type     | fields         | meaning                         |
| -------- | -------------- | ------------------------------- |
| `input`  | `data: string` | keystrokes for the pty          |
| `resize` | `cols`, `rows` | terminal size (at least 10 x 2) |
| `ping`   | -              | keep-alive                      |

Server to client, terminal output: **binary frames**, no JSON and no base64. The first byte is `0`
(`OUTPUT_FRAME`, live output) or `1` (`REPLAY_FRAME`, the screen sent once on connect); the rest are
the program's bytes, written to xterm as they are.

Server to client, everything else (JSON text frames):

| type               | fields    | meaning                                     |
| ------------------ | --------- | ------------------------------------------- |
| `status`           | `session` | session changed (status, cwd, preview, ...) |
| `exit`             | `code`    | the process ended                           |
| `approval-request` | `request` | a pending approval for this session         |
| `preview-open`     | `url`     | open this localhost URL in the preview      |
| `new-tab`          | `url`     | offer an "open in new tab" button           |
| `pong`             | -         | answer to `ping`                            |

On connect the server sends `status`, `size`, then the replay, then live output. With tmux the replay is
a snapshot taken through the session's control-mode client at an exact point of its output stream: the
history (into the browser's scrollback), the screen, the cursor and the modes (bracketed paste, cursor
keys, mouse...). Output before that point is part of it, output after it is sent live, so nothing is
lost or applied twice. Without tmux it is an in-memory ring buffer of raw output. A session that ended
while the server was down replays the last screen saved under `<state dir>/scrollback/<id>.bin`. The
browser resets its terminal on every (re)connect.

## HTTP API (`/api`)

| method   | path                                        | purpose                                                                    |
| -------- | ------------------------------------------- | -------------------------------------------------------------------------- |
| GET      | `/auth`                                     | `{required, canDisable, isDefault}` (public)                               |
| POST     | `/login`                                    | `{password}` -> `{token}` (public, throttled)                              |
| PUT      | `/password`                                 | `{current, next}`; `next: null` removes it (loopback only)                 |
| GET      | `/config`, `/providers`                     | public config, available CLIs                                              |
| GET/POST | `/sessions`                                 | list / create                                                              |
| DELETE   | `/sessions/:id`                             | stop and remove                                                            |
| PUT      | `/sessions/:id/preview`                     | set the preview URL (localhost only)                                       |
| GET      | `/sessions/:id/tree?path=&hidden=&ignored=` | folder listing; `hidden` adds dotfiles, `ignored` adds git-ignored entries |
| GET      | `/sessions/:id/file?path=`                  | text content (512 KiB cap)                                                 |
| GET      | `/sessions/:id/raw?path=[&download=1]`      | file bytes with `Range` (media viewer); `download=1` sends an attachment   |
| GET      | `/sessions/:id/zip?path=`                   | a folder as a streamed `.zip` (no `.git`, `node_modules`, symlinks)        |
| POST     | `/sessions/:id/upload?dir=&name=`           | raw body saved into the folder (512 MiB cap, name sanitized)               |
| POST     | `/sessions/:id/paste?ext=`                  | pasted image saved to a temp file; returns its path                        |
| GET      | `/sessions/:id/git`                         | git status                                                                 |
| GET      | `/approvals?status=`                        | approval requests                                                          |
| POST     | `/approvals/:id/decision`                   | `{decision}` where decision is `approve` or `reject`                       |

The token goes in the `x-deck-token` header (or `?token=` for WebSockets and media elements).

## Agent endpoints (loopback only)

- MCP, Streamable HTTP, stateless: `POST /mcp/<sessionId>` with tools `list_sessions`,
  `session_title({title?})`, `session_meta({key?,value?})`, `session_handoff({text?})`, `task({action,...})`, `phone({action,...})`, `propose_worktree({reason})`, `open_preview({url})`, `suggest_new_tab({url})`,
  `get_request_status({requestId})`.
- `clideck` uses `GET|POST /agent/<sessionId>/{whoami,sessions,preview,newtab,worktree,requests/:id}`.

Both are thin wrappers over the same `createAgentTools`, so they behave identically. No tool runs
git or writes files: `propose_worktree` only creates a pending request.

## Live browser (`/ws/browser/:sessionId`)

The preview's Browser mode shows the session's Chromium (the one the agent drives with the `browser_*`
MCP tools) over its own socket, same token rule as the terminal socket.

- **Server to device:** a binary message is one JPEG frame, sent only when the page changed (Chromium's
  screencast; a frame is skipped while the socket is backed up). JSON messages are
  `{type:"page", url, title, width, height}` (re-read about once a second while frames flow) and
  `{type:"error", message}`.
- **Device to server:** JSON input in page (CSS) pixels: `click {x,y}`, `scroll {dy, dx?}`,
  `type {text}`, `key {key}`, `back` / `forward` / `reload`, `navigate {url}`, and `resize {width,height}`
  so the page is laid out at the size of the pane showing it.
- When the agent acts in the browser, the terminal socket sends `preview-browser`, and the session's
  devices switch the preview to Browser mode to show it.
