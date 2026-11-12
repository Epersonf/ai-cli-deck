# Protocol

All shapes live in `packages/shared` as zod schemas; types are inferred from them.

## WebSocket: `/ws/sessions/<id>` (one per open chat)

Client to server (JSON text frames):

| type         | fields                                  | meaning                                                                                                                        |
| ------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `send`       | `text`, `images?`, `cid?`, `seq?`       | a message for the agent (`cid`+`seq` make a resend safe)                                                                       |
| `interrupt`  | -                                       | stop the answer in progress and drop queued messages                                                                           |
| `permission` | `id`, `allow`, `always?`, `message?`    | answer a `permission` step                                                                                                     |
| `config`     | `model?`, `mode?`, `effort?`            | change the chat's settings from the next message on                                                                            |
| `rewind`     | `id`, `text`, `images?`, `revertFiles?` | edit the `user` step `id`: the chat goes back to before it and `text` is sent instead (refused while an answer is in progress) |
| `stop-task`  | `id`                                    | stop a background `task`                                                                                                       |
| `ping`       | -                                       | keep-alive                                                                                                                     |

Server to client (JSON text frames):

| type               | fields                                 | meaning                                                                 |
| ------------------ | -------------------------------------- | ----------------------------------------------------------------------- |
| `status`           | `session`                              | session changed (status, cwd, preview, ...)                             |
| `replay`           | `events`, `busy`, `partials`, `config` | the whole chat, sent once on connect                                    |
| `event`            | `event`                                | one new step (see `ChatEvent` in `packages/shared`)                     |
| `delta`            | `id`, `kind`, `text`                   | more text of an answer being written                                    |
| `busy`             | `busy`                                 | an answer started or ended                                              |
| `usage`            | `usage`                                | cost, context and the account's limit; on connect and after each answer |
| `reset`            | `events`                               | the chat was cut back (an edit) or emptied: show exactly these steps    |
| `config`           | `config`                               | the chat's settings changed (on any device)                             |
| `approval-request` | `request`                              | a pending approval for this session                                     |
| `preview-open`     | `url`                                  | open this localhost URL in the preview                                  |
| `new-tab`          | `url`                                  | offer an "open in new tab" button                                       |
| `pong`             | `lag?`                                 | answer to `ping`                                                        |
| `ack`              | `seq`                                  | the `send` numbered `seq` was taken                                     |

The `config` object is `{agent, model, effectiveModel, defaultModel, mode, effort, modelChoices, chatId}`. `model` is
the chat's own pick (null: the provider's default is used); `defaultModel` is the default the person set for the
provider/profile; `effectiveModel` is the model really answering, as Claude named it (`system init` and each
answer) or, before a run, the default or the last one that answered for that provider (kept in `models.json`);
`modelChoices` is `{id, label, description}[]` found at run time (never a fixed list; may be empty, any text is
still accepted). `config` is pushed again when the list, the default or the effective model changes, and `mode`
of a brand-new chat is the mode last chosen in that provider.

A `ChatEvent` (`t`) is one of `user`, `text`, `thinking`, `tool`, `tool-result`, `permission`,
`permission-done`, `turn-start`, `turn-end`, `notice` and `task`, the same for every agent. `delta` text is not
kept: the finished `text`/`thinking` step with the same `id` replaces it. On connect the server sends
`status`, `replay`, pending deck approvals, then live steps (the ones that happened while the replay was
being built are sent right after it), and `usage`. A `rewind` that cannot go ahead (an answer in progress, a
message that is not there, files that cannot be restored) answers with a live `notice` step of level `error`. The log of each session lives in `<state dir>/chats/<id>.jsonl`.

## Push: `/ws/events`

Besides `session`, `approval`, `activity` and `browser-tabs`, the server pushes
`{type:'notify', sessionId, title, text, reason}` (`reason`: `done` | `error` | `permission`) whenever an answer
ends by itself (not when the person stopped it) or the agent waits for a decision: `title` is the chat's name and
`text` the first line of the answer or the error. The phone also gets a system notification when phone access is on.

## Memory

The deck keeps notes the agents are told about: `global` (every chat) and `profile` (every chat of one provider
id, built-ins `claude`/`codex` included); a chat's own memory is its conversation. Notes live in nestable folders
(limits in `MEMORY_LIMITS`). Files are plain JSON under the config folder: `memory/global.json` and
`memory/profiles/<id>.json`; deleting a profile deletes its file.

| method         | path                  | purpose                                                                                                                                                                                      |
| -------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET            | `/memory?scope=global | profile&profileId=`                                                                                                                                                                          | `MemoryTree` `{folders, entries}` |
| POST           | `/memory`             | `CreateMemoryBody` -> entry (201)                                                                                                                                                            |
| PATCH / DELETE | `/memory/:id`         | edit (title, body, enabled, folderId) / delete; ids are unique across scopes                                                                                                                 |
| POST           | `/memory/folders`     | `CreateMemoryFolderBody` -> folder (201)                                                                                                                                                     |
| PATCH / DELETE | `/memory/folders/:id` | rename and/or move (never into itself) / delete with everything inside                                                                                                                       |
| POST           | `/memory/import`      | `{fromProfile, toProfile, ids, folderIds}` -> the destination's `MemoryTree`; notes are copied with their folder structure, marked `source: 'import'`, exact duplicates (title+body) skipped |

Every change is pushed on `/ws/events` as `{type:'memory', scope, profileId}`. A run's briefing (the "Memory" section:
enabled global notes, then the profile's, as `folder/title: body` up to `MEMORY_LIMITS.briefing` characters, the
rest by title and id) is built when a run starts: a change shows from the next run, while an open run keeps the
briefing it started with.

Agents use the MCP tool `memory` or `clideck memory list|read <id>|write --title --body [--folder] [--scope]|delete <id>|profiles|import --from <profile> [--ids] [--folders]`
(agent API `/agent/<session>/memory...`). Writes to the agent's own profile are saved at once (`source: 'agent'`, a
notice in the chat). A global write and an import (always into the agent's own profile) create an approval request of
kind `memory` carrying a readable payload (`action: 'write-global'` with title and body, or `action: 'import'` with the
notes and folders by title); the person is notified (`notify`, reason `permission`) and nothing happens until approved.
An agent sees only the titles of another profile's notes, never their bodies.

## HTTP API (`/api`)

| method          | path                                            | purpose                                                                                                |
| --------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| GET             | `/auth`                                         | `{required, canDisable, isDefault}` (public)                                                           |
| POST            | `/login`                                        | `{password}` -> `{token}` (public, throttled)                                                          |
| PUT             | `/password`                                     | `{current, next}`; `next: null` removes it (loopback only)                                             |
| GET             | `/config`, `/providers`                         | public config, available CLIs                                                                          |
| PUT             | `/providers/:id/default-model`                  | `{model: string                                                                                        | null}` -> 204: the model chats without their own pick use (null: the agent's default) |
| POST            | `/sessions/:id/notify-idle`                     | kept for old clients: answers 204 and does nothing (every finished answer notifies)                    |
| GET/POST        | `/sessions`                                     | list / create (`{provider, cwd, useWorktree, chatId?}`)                                                |
| DELETE          | `/sessions/:id`                                 | stop and remove                                                                                        |
| PUT             | `/sessions/:id/preview`                         | set the preview URL (localhost only)                                                                   |
| GET             | `/sessions/:id/tree?path=&hidden=&ignored=`     | folder listing; `hidden` adds dotfiles, `ignored` adds git-ignored entries                             |
| GET             | `/sessions/:id/file?path=`                      | text content (512 KiB cap)                                                                             |
| GET             | `/sessions/:id/raw?path=[&download=1]`          | file bytes with `Range` (media viewer); `download=1` sends an attachment                               |
| GET             | `/sessions/:id/zip?path=`                       | a folder as a streamed `.zip` (no `.git`, `node_modules`, symlinks)                                    |
| POST            | `/sessions/:id/upload?dir=&name=`               | raw body saved into the folder (512 MiB cap, name sanitized)                                           |
| POST            | `/sessions/:id/paste?ext=`                      | pasted image saved to a temp file; returns its path                                                    |
| GET             | `/sessions/:id/git`                             | git status                                                                                             |
| GET             | `/approvals?status=`                            | approval requests                                                                                      |
| POST            | `/approvals/:id/decision`                       | `{decision}` where decision is `approve` or `reject`                                                   |
| POST            | `/exec`                                         | `{command, cwd?, timeoutSec?}`: run in the shell, wait, output + exit code                             |
| POST            | `/sessions/:id/input`                           | `{text}`: send a message to the session's agent (`enter` is ignored)                                   |
| GET             | `/sessions/:id/screen?lines=`                   | the recent conversation as plain text (`cols`/`rows` are 0)                                            |
| PUT             | `/profiles/:id/secret`                          | `{secret}`: replace the profile's API key (never read back)                                            |
| POST            | `/sessions/:id/side`                            | a side chat: a copy of this conversation under the same main session (`parentId`), `201` + the session |
| GET             | `/voice/status`                                 | `{supported, ready, downloading, progress, error, hint}`                                               |
| POST            | `/voice/prepare`                                | start downloading the speech engine (Windows) and model; poll the status                               |
| POST            | `/voice/transcribe?lang=`                       | raw `audio/wav` body (16 kHz mono PCM16, 8 MiB cap) -> `{text}`                                        |
| POST/GET/DELETE | `/providers/:id/login`                          | start `{method}` / poll (JSON `null` when none) / cancel a sign-in (`SignInFlow`)                      |
| POST            | `/providers/:id/login/input`                    | `{text}`: the code the page showed, written to the CLI's stdin                                         |
| POST            | `/providers/:id/logout`                         | sign out (the CLI's own, for the provider's own login) and forget its key                              |
| GET             | `/providers/:id/auth`                           | `AuthInfo` from the CLI's status (a saved key = signed in via API key)                                 |
| GET             | `/fs/dirs?path=`                                | `FsDirs`: sub-folders for the folder picker (empty path = home)                                        |
| POST            | `/providers/:id/install`                        | download the agent's CLI (`npm install -g`); `{ok, output, status}`                                    |
| GET             | `/network`, `/network/peers`, `/network/nearby` | sharing state, paired decks, decks found on the network                                                |
| POST            | `/network/pair`, `/network/pair/:id`            | ask a deck to pair, then send the code shown there                                                     |

A turn that fails because of credentials has a `turn-end.error` starting with `AUTH: `.

`/peer/<id>/...` carries any of these to a paired deck through the encrypted link (not `/network`, login,
password, `/mcp`, `/agent`).

The token goes in the `x-deck-token` header (or `?token=` for WebSockets and media elements).

## Agent endpoints (loopback only)

- MCP, Streamable HTTP, stateless: `POST /mcp/<sessionId>` with tools `list_sessions`,
  `session_title({title?})`, `session_meta({key?,value?})`, `task({action,...})`, `phone({action,...})`, `propose_worktree({reason})`, `open_preview({url})`, `suggest_new_tab({url})`,
  `get_request_status({requestId})`.
- `clideck` uses `GET|POST /agent/<sessionId>/{whoami,sessions,preview,newtab,worktree,requests/:id}`.
- Devices: MCP tool `device({action, ...})` and `clideck devices|device|copy|profile send`, both through
  `POST /agent/<sessionId>/devices` with the same body. Actions: list, run, terminals, open, send, read,
  restart, close, task_run|list|log|stop, copy, profiles, send_profile. The device is `here` (this deck, through
  the same loopback door paired decks use) or a paired deck (through its link); they call the API below.

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
