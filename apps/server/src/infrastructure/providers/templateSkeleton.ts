/**
 * The file offered by "Download template" in the deck's settings: a working example whose comments
 * explain every part. It must stay valid (a test imports it).
 */
export const TEMPLATE_SKELETON = `{
  // Profile template for ai-cli-deck. JSON with comments: comments and trailing commas are allowed.
  // A template says how to start ONE kind of AI CLI as a clean terminal (its own login and key).
  // SECURITY: importing a template lets it run the program named below with your permissions.
  // Only import templates you trust.

  // Always 1 (the version of this format).
  "schema": 1,

  // Unique name of the template: lowercase letters, digits and dashes. Built-in ids cannot be reused.
  "id": "my-ai-cli",

  // Name shown in the lists.
  "label": "My AI CLI",

  // One line about it (optional).
  "description": "Example template: runs the 'myai' program against a gateway.",

  // The program to start. Empty means the default shell.
  // You can use {field.<key>} to run whatever the user types in a field below.
  "command": "myai",

  // Fixed arguments, placed before any the user adds. Each entry is one argument (no shell parsing).
  "args": ["--interactive"],

  // Environment variables for the program. Values may use the placeholders listed at the end.
  "env": {
    "MYAI_API_URL": "{field.apiUrl}"
  },

  // The variable your CLI reads its config/login folder from. The deck sets it to a folder that
  // belongs to this profile alone, which is what keeps one profile's login and keys apart from another's.
  // Use null if the CLI has no such variable.
  "home": { "env": "MYAI_HOME" },

  // Values asked when the profile is created. "type" is "text" or "url" (checked as http/https).
  "fields": [
    {
      "key": "apiUrl",              // used as {field.apiUrl}
      "label": "API address",
      "type": "url",
      "required": true,
      "hint": "Where the CLI sends its requests.",
      "placeholder": "https://llm.example.com"
    }
  ],

  // Ask for an API key (typed hidden) when the terminal starts without one, then pass it in the
  // variable "env". The deck never stores the key itself.
  // "remember": true keeps it in <home>/settings.json under "env" (Claude Code's own settings file);
  // leave false for CLIs that do not read that file, and the key is asked at every start.
  // Use null if the CLI signs in by itself.
  "apiKey": { "env": "MYAI_API_KEY", "label": "API key for {field.apiUrl.host}", "remember": false },

  // Arguments that give the CLI the deck's MCP server and the short briefing about the deck, so the agent can
  // use \`clideck\` and its tools. Leave empty if the CLI cannot take them. Examples:
  //   Claude Code: ["--mcp-config", "{mcpConfig}", "--append-system-prompt", "{guide}"]
  //   Codex:       ["-c", "mcp_servers.deck.url={mcpUrlJson}", "-c", "developer_instructions={guideJson}"]
  "mcpArgs": [],

  // "claude" or "codex" if "clideck setup" can download your CLI by installing one of those; otherwise null
  // (the profile then shows as missing until "command" is found in PATH).
  "install": null

  // Placeholders usable in command, args, env values, apiKey.label and mcpArgs:
  //   {home}            this profile's own folder
  //   {port}            the PORT assigned to the terminal (dev servers should listen on it)
  //   {cwd}             the folder the terminal opens in
  //   {field.<key>}     what was typed for a field; {field.<key>.host} the host of a url field
  //   {mcpUrl}          address of the deck's MCP server for this terminal ({mcpUrlJson} is JSON-quoted)
  //   {mcpConfig}       a ready-made MCP config as JSON (Claude Code's format)
  //   {guide}           the briefing text for agents ({guideJson} is JSON-quoted)
}
`;
