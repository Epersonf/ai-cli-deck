# Provider plugins

Every bundled provider is a complete package under `apps/server/src/plugins/`: Claude Code,
Claude with a custom endpoint, Claude with DeepSeek, Codex, Antigravity and Grok Build. Existing profile IDs,
keys, configuration folders and saved conversations continue to work. Legacy JSON templates remain
supported as configurations of an installed engine plugin.

A package contains:

```text
manifest.json        # version, profile fields, authentication choices and supported features
index.ts             # default factory returning the provider lifecycle and execution driver
engine/              # provider-specific execution, protocol mapping and optimizations
*.test.ts            # internal tests (engine tests may also live inside engine/)
engine/fixtures/     # test fixtures, included in exported packages
```

`manifest.json` uses `plugin: 1`, a semantic `version`, an `entry`, and the existing profile
`template` metadata. `features` declares permission modes, effort levels, compaction strategy,
custom automatic-compaction support and an optional cache-idle risk estimate. `authMethods`
declares account, device-code, API-key and machine-login choices, with optional translations.
Plugin identifiers and engine identifiers are extensible: a new provider does not need an enum edit.

The module exports a default factory receiving `PluginContext`. Its result implements:

- `installed()` and `install()` for checking and installing the official CLI;
- `login(method)`, `auth(forLogin?)` and `logout()` for account authentication;
- `driver` for chat execution, cancellation, capabilities, rewind and optional native compaction;
- `discoverModels()` and optional `discoverLimits()`;
- optional `guide`, `history` and `chat()` for the provider briefing and native saved conversations;
- optional `compactTools` for compact Deck MCP responses.

The context supplies the profile, its private folder, agent/login/status environments, executable
resolution and process helpers. Installer commands receive the server environment without the profile's
API key. Login commands receive only the account environment; model discovery may explicitly select the
profile environment. The Deck stores keys privately and supplies one common installation/sign-in UI.
Plugins own the actual commands and protocol behavior.

The Codex package retains its compact stable briefing, native fork and compaction, capability discovery,
output budgets, rollout-based usage/context separation and cache reporting. These implementations and
their regression tests live in `plugins/codex`, rather than being reimplemented by the package loader.

## Import, export and tests

Settings offers complete plugin packages as `.deck-plugin.zip`. Export includes the module dependency
graph, compiled JavaScript, internal tests and fixtures, plus a test configuration. The package uses the
Deck's installed runtime dependencies. A package can be inspected without executing it; executable
modules are imported only after the user confirms the import. Treat plugins as trusted local code.

ZIP imports reject traversal, absolute paths, symlinks, duplicate files, damaged checksums, encrypted
entries and excessive decompressed sizes. Bundled plugin IDs cannot be replaced. An imported plugin
cannot be replaced or removed while profiles use it. Each package is loaded from an immutable content
path, avoiding stale module caches after replacement. Profile keys and machine credentials are not part
of a plugin export.

The plugin menu has **Run plugin tests**. Tests are optional for third-party packages; all bundled
packages declare and include tests. The same Vitest runner can be used directly:

```bash
node node_modules/vitest/vitest.mjs run apps/server/src/plugins/codex --maxWorkers 2
node node_modules/vitest/vitest.mjs run apps/server/src/infrastructure/plugins --maxWorkers 2
```

The first command runs a provider's own regression tests. The second checks the common contract,
package inspection/import/export and the account-login flow. Imported packages execute their tests
inside the package directory with the Deck's Vitest runtime.

## Antigravity

Create an Antigravity profile. The sign-in dialog offers the official CLI installer when needed, then
**Google account**, **Gemini API key**, or the machine's existing login. Google account sign-in runs
`agy acp --login`: the Deck displays the authorization link and forwards the pasted code. Cached account
status is checked through ACP without sending a model prompt. Gemini keys use ACP authentication.

The official installer is `https://antigravity.google/cli/install.sh` on macOS/Linux, or
`https://antigravity.google/cli/install.ps1` on Windows. Default installation paths are recognized even
before a new shell has updated PATH. Antigravity uses the official machine keyring for Google accounts;
API keys remain per profile. The Deck does not invent an unsupported config-folder override or export
Google keyring credentials. ACP requires a compatible official CLI (1.5+).

## Grok Build

Create a Grok Build profile. The sign-in dialog offers `npm install -g @xai-official/grok` when the CLI is
missing, then **Grok account** (`grok login --device-auth`: the Deck shows the link and the device code),
an **xAI API key** (`XAI_API_KEY`, kept in the profile's private key file) or the machine's existing login.
Each profile gets its own `GROK_HOME`. Chats run over ACP (`grok agent stdio`): streaming text and thinking,
tool cards, permission prompts, session resume, images and the Deck MCP tools.

- **Models** are never hardcoded. The Deck opens and closes a session (no prompt, no usage) and reads the
  account's `models` (ids, names, descriptions, context windows); `grok models` is the fallback and works
  before signing in. The free tier offers fewer models than a subscription.
- **Effort** uses the session's own `reasoning_effort` option (`session/set_config_option`); an effort the
  model does not offer is skipped.
- **Permission modes**: Grok has no ACP permission modes (only the `/always-approve` command), so the Deck
  applies them to the `session/request_permission` requests Grok sends: _default_ asks the person,
  _acceptEdits_ approves file edits, _bypassPermissions_ approves everything. Grok itself decides when to
  ask; some commands run without a request. There is no plan mode.
- **Usage** is read from each answer's `_meta.usage` (tokens, cache, and `costUsdTicks`, 1e-10 USD): context
  in use, turn tokens, cache and the run's cost. The plan's usage limit is not exposed to other programs
  (`grok usage` says to use `/usage` inside Grok), so no limit gauge is shown.

Native forks and compaction are not offered.
