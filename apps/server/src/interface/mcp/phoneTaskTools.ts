import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AgentTools } from '../agent/agentTools.js';
import { runAsync } from './mcpResult.js';

/** The tools for the phone (only when the user enabled phone access) and for background tasks. */
export function registerPhoneAndTaskTools(server: McpServer, tools: AgentTools): void {
  if (tools.phoneEnabled) {
    server.registerTool(
      'phone',
      {
        description:
          'The phone the deck runs on (enabled by the user). action: battery (percent, charging), device (model, Android version) or notify (shows a notification: text, optional title).',
        inputSchema: {
          action: z.enum(['battery', 'device', 'notify']),
          text: z.string().max(400).optional(),
          title: z.string().max(80).optional(),
        },
      },
      ({ action, text, title }) =>
        runAsync(() =>
          action === 'battery'
            ? tools.phoneBattery()
            : action === 'device'
              ? tools.phoneDevice()
              : tools.phoneNotify(text ?? '', title),
        ),
    );
  }
  server.registerTool(
    'task',
    {
      description:
        'Background jobs of this terminal. action: run (a command that keeps running: command, name?), watch_battery (notify the phone: below and/or above a percent, text?; needs phone access), list, stop (id), log (id).',
      inputSchema: {
        action: z.enum(['run', 'watch_battery', 'list', 'stop', 'log']),
        command: z.string().max(2000).optional(),
        name: z.string().max(60).optional(),
        below: z.number().int().min(1).max(99).optional(),
        above: z.number().int().min(1).max(99).optional(),
        text: z.string().max(300).optional(),
        id: z.string().optional(),
      },
    },
    ({ action, command, name, below, above, text, id }) =>
      runAsync(async () => {
        if (action === 'list') return tools.taskList();
        if (action === 'run') return tools.taskRun(command ?? '', name);
        if (action === 'watch_battery') return tools.taskWatchBattery({ below, above, text }, name);
        return action === 'stop' ? tools.taskStop(id ?? '') : tools.taskLog(id ?? '');
      }),
  );
}
