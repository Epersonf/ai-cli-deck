import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AgentTools } from '../agent/agentTools.js';
import { pageText } from './pagination.js';
import { runAsync } from './mcpResult.js';

/** The tools for the phone (only when the user enabled phone access) and for background tasks. */
export function registerPhoneAndTaskTools(
  server: McpServer,
  tools: AgentTools,
  compact = false,
): void {
  if (tools.phoneEnabled) {
    server.registerTool(
      'phone',
      {
        description:
          'The phone the deck runs on (enabled by the user). Start with action help to see what is allowed. Others: battery, device, notify (text, title?), wifi_status/scan/connect/on/off, and call (path like /sms/send, /location or /camera/photo, args {name: value}) for any capability that help lists. Risky actions wait for the person to tap Allow on the phone.',
        inputSchema: {
          action: z.enum([
            'battery',
            'device',
            'notify',
            'wifi_status',
            'wifi_scan',
            'wifi_connect',
            'wifi_on',
            'wifi_off',
            'help',
            'call',
          ]),
          path: z.string().max(40).optional(),
          args: z.record(z.string(), z.string()).optional(),
          ssid: z.string().max(64).optional(),
          password: z.string().max(100).optional(),
          text: z.string().max(400).optional(),
          title: z.string().max(80).optional(),
        },
      },
      ({ action, text, title, ssid, password, path, args }) =>
        runAsync(async () => {
          switch (action) {
            case 'battery':
              return tools.phoneBattery();
            case 'device':
              return tools.phoneDevice();
            case 'wifi_status':
              return tools.phoneWifi();
            case 'wifi_scan':
              return tools.phoneWifiScan();
            case 'wifi_connect':
              return tools.phoneWifiConnect(ssid ?? '', password);
            case 'wifi_on':
              return tools.phoneWifiEnable(true);
            case 'wifi_off':
              return tools.phoneWifiEnable(false);
            case 'help':
              return tools.phoneCapabilities();
            case 'call':
              return tools.phoneCall(path ?? '', args);
            default:
              return tools.phoneNotify(text ?? '', title);
          }
        }),
    );
  }
  server.registerTool(
    'task',
    {
      description:
        'Background jobs of this terminal. action: run (a command that keeps running: command, name?), watch_battery (notify the phone: below and/or above a percent, text?; needs phone access), list, stop (id), log (id, offset?, limit?; continue with nextOffset).',
      inputSchema: {
        action: z.enum(['run', 'watch_battery', 'list', 'stop', 'log']),
        command: z.string().max(2000).optional(),
        name: z.string().max(60).optional(),
        below: z.number().int().min(1).max(99).optional(),
        above: z.number().int().min(1).max(99).optional(),
        text: z.string().max(300).optional(),
        id: z.string().optional(),
        offset: z.number().int().nonnegative().optional(),
        limit: z.number().int().min(2).max(40000).optional(),
      },
    },
    ({ action, command, name, below, above, text, id, offset, limit }) =>
      runAsync(async () => {
        if (action === 'list') return tools.taskList();
        if (action === 'run') return tools.taskRun(command ?? '', name);
        if (action === 'watch_battery') return tools.taskWatchBattery({ below, above, text }, name);
        if (action === 'stop') return tools.taskStop(id ?? '');
        const log = tools.taskLog(id ?? '');
        if (!compact && offset === undefined && limit === undefined) return log;
        return pageText(log.text, offset ?? 0, limit ?? 12000);
      }),
  );
}
