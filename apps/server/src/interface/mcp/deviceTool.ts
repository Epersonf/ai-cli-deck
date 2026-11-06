import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DeviceActionShape, runDeviceAction } from '../agent/deviceActions.js';
import type { DeviceTools } from '../agent/deviceTools.js';
import { runAsync } from './mcpResult.js';

/** This deck and the decks paired with it, as one tool (offered only when a deck is paired). */
export function registerDeviceTool(server: McpServer, devices: DeviceTools, cwd: string): void {
  server.registerTool(
    'device',
    {
      description:
        'Act on a device: "here" (this deck) or one of the user\'s paired devices (e.g. their PC with a GPU, from the phone). ' +
        'list; run (command, cwd?, timeoutSec? <=280) runs a shell command there and returns output + exit code; ' +
        'terminals (its terminals and profiles); open (profile, cwd?, command?) starts a terminal there, e.g. an agent; ' +
        'send (terminal, text, enter?) types into one (a message to the agent there); read (terminal, lines?) shows its screen; ' +
        'restart (terminal, fresh?) / close (terminal); task_run (command, cwd?, name?) keeps a long job running there, task_list, task_log (id), task_stop (id); ' +
        'copy (from, to as "device:path", a bare path is here) streams a file or folder between devices; ' +
        'profiles; send_profile (profile, to, from?, chats?) copies a profile with its sign-in/API key to another device.',
      inputSchema: DeviceActionShape,
    },
    (input) => runAsync(async () => runDeviceAction(devices, input, cwd)),
  );
}
