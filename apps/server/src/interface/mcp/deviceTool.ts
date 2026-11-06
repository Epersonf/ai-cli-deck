import { EXEC_MAX_SECONDS } from '@deck/shared';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { DeviceTools } from '../agent/deviceTools.js';
import { runAsync } from './mcpResult.js';

/** The decks paired with this one (only offered when there is one, so it costs no tokens otherwise). */
export function registerDeviceTool(server: McpServer, devices: DeviceTools): void {
  server.registerTool(
    'device',
    {
      description:
        "The user's other devices paired with this deck (e.g. their PC from the phone). action: list; run (device, command, cwd?, timeoutSec?) runs a shell command THERE and returns its output and exit code; terminals (device) lists its terminals and profiles; open (device, profile, cwd?, command?) starts a terminal there (a profile's agent, or a shell running command); send (device, terminal, text, enter?) types into one, e.g. a message to the agent running there; read (device, terminal, lines?) shows its screen as text; close (device, terminal).",
      inputSchema: {
        action: z.enum(['list', 'run', 'terminals', 'open', 'send', 'read', 'close']),
        device: z.string().max(80).optional().describe('Name or id from action list'),
        command: z.string().max(8000).optional(),
        cwd: z.string().max(1000).optional(),
        timeoutSec: z.number().int().min(1).max(EXEC_MAX_SECONDS).optional(),
        profile: z.string().max(80).optional(),
        terminal: z.string().max(80).optional(),
        text: z.string().max(20_000).optional(),
        enter: z.boolean().optional(),
        lines: z.number().int().min(1).max(500).optional(),
      },
    },
    (input) =>
      runAsync(async () => {
        const device = input.device ?? '';
        const terminal = input.terminal ?? '';
        switch (input.action) {
          case 'list':
            return devices.devices();
          case 'run':
            return devices.run(device, input.command ?? '', input.cwd, input.timeoutSec);
          case 'terminals':
            return devices.terminals(device);
          case 'open':
            return devices.open(device, input.profile ?? '', input.cwd, input.command);
          case 'send':
            return devices.send(device, terminal, input.text ?? '', input.enter);
          case 'read':
            return devices.read(device, terminal, input.lines);
          default:
            return devices.close(device, terminal);
        }
      }),
  );
}
