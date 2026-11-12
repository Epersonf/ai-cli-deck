/**
 * The file offered by "Download template" in the deck's settings: a working example whose comments
 * explain every part. It must stay valid (a test imports it).
 */
export const TEMPLATE_SKELETON = `{
  // Profile template for ai-cli-deck. JSON with comments: comments and trailing commas are allowed.
  // A template says how to run ONE kind of agent as a clean profile (its own login and key).

  // Always 1 (the version of this format).
  "schema": 1,

  // Unique name of the template: lowercase letters, digits and dashes. Built-in ids cannot be reused.
  "id": "my-gateway",

  // Name shown in the lists.
  "label": "My gateway",

  // One line about it (optional).
  "description": "Example template: Claude Code against a company gateway.",

  // The engine that runs the chat: "claude" (Claude Code, any Anthropic-compatible endpoint) or "codex".
  "agent": "claude",

  // The model the chat starts with, or null for the agent's own default (changeable in the chat).
  "model": null,

  // Environment variables for the agent. Values may use the placeholders listed at the end;
  // a value that ends up empty is left out.
  "env": {
    "ANTHROPIC_BASE_URL": "{field.apiUrl}"
  },

  // The variable the agent reads its config/login folder from. The deck sets it to a folder that
  // belongs to this profile alone, which keeps one profile's login and keys apart from another's.
  // Use null if the agent has no such variable.
  "home": { "env": "CLAUDE_CONFIG_DIR" },

  // Values asked when the profile is created. "type" is "text" or "url" (checked as http/https).
  "fields": [
    {
      "key": "apiUrl",              // used as {field.apiUrl}
      "label": "API address",
      "type": "url",
      "required": true,
      "hint": "Where the agent sends its requests.",
      "placeholder": "https://llm.example.com/anthropic"
    }
  ],

  // An API key, typed hidden in the profile dialog and kept in the profile's own folder; it reaches the
  // agent in the variable "env". "required": false lets the profile work with the machine's own sign-in.
  // Use null if the agent needs no key.
  "apiKey": { "env": "ANTHROPIC_AUTH_TOKEN", "label": "API key for {field.apiUrl.host}", "required": true },

  // "claude" or "codex" if "clideck setup" can download the agent's CLI by installing one of those; else null.
  "install": "claude"

  // Placeholders usable in env values and apiKey.label:
  //   {home}            this profile's own folder
  //   {port}            the PORT assigned to the session (dev servers should listen on it)
  //   {cwd}             the folder of the session
  //   {field.<key>}     what was typed for a field; {field.<key>.host} the host of a url field
  //   {mcpUrl}          address of the deck's MCP server for this session
}
`;
