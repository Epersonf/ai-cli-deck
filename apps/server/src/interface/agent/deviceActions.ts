import { isAbsolute, resolve } from 'node:path';
import { EXEC_MAX_SECONDS } from '@deck/shared';
import { z } from 'zod';
import { invalid } from '../../domain/errors.js';
import type { DeviceTools } from './deviceTools.js';

export const DEVICE_ACTIONS = [
  'list',
  'run',
  'terminals',
  'open',
  'send',
  'read',
  'restart',
  'close',
  'task_run',
  'task_list',
  'task_log',
  'task_stop',
  'copy',
  'profiles',
  'send_profile',
] as const;

/** One action on a device: what the MCP tool `device` and `clideck device` both send. */
export const DeviceActionShape = {
  action: z.enum(DEVICE_ACTIONS),
  device: z.string().max(80).optional().describe('"here" (this deck) or a paired device; see list'),
  command: z.string().max(8000).optional(),
  cwd: z.string().max(1000).optional(),
  timeoutSec: z.number().int().min(1).max(EXEC_MAX_SECONDS).optional(),
  profile: z.string().max(80).optional(),
  terminal: z.string().max(80).optional(),
  text: z.string().max(20_000).optional(),
  enter: z.boolean().optional().describe('ignored: a message is always sent whole'),
  lines: z.number().int().min(1).max(500).optional(),
  fresh: z.boolean().optional().describe('restart: a new conversation instead of continuing'),
  id: z.string().max(80).optional().describe('a task id'),
  name: z.string().max(60).optional().describe('a task name'),
  from: z.string().max(4000).optional().describe('copy: "device:path"; send_profile: a device'),
  to: z.string().max(4000).optional().describe('copy: "device:path"; send_profile: a device'),
  chats: z.boolean().optional().describe('send_profile: include its conversations'),
};
export const DeviceActionSchema = z.object(DeviceActionShape);
export type DeviceAction = z.infer<typeof DeviceActionSchema>;

/**
 * `device:path` (a path on that device) or a bare path (on this deck). A one-letter prefix is a Windows
 * drive (`C:\out`), not a device. A relative path on this deck is taken from the agent's folder.
 */
export function parseSpot(text: string, here: string): { device: string; path: string } {
  const match = /^([^:\\/]{2,80}):(.+)$/.exec(text.trim());
  const spot =
    match?.[1] && match[2]
      ? { device: match[1], path: match[2] }
      : { device: 'here', path: text.trim() };
  const local = spot.device.toLowerCase() === 'here';
  if (local && !isAbsolute(spot.path) && !spot.path.startsWith('~'))
    spot.path = resolve(here, spot.path);
  return spot;
}

const need = (value: string | undefined, what: string): string => {
  if (!value) throw invalid(`This action needs ${what}`);
  return value;
};

/** Runs one action; `cwd` is the asking agent's folder (for relative paths on this deck). */
export function runDeviceAction(
  tools: DeviceTools,
  input: DeviceAction,
  cwd: string,
): Promise<unknown> | unknown {
  const device = input.device ?? 'here';
  const terminal = (): string => need(input.terminal, 'terminal');
  switch (input.action) {
    case 'list':
      return tools.devices();
    case 'run':
      return tools.run(device, need(input.command, 'command'), input.cwd, input.timeoutSec);
    case 'terminals':
      return tools.terminals(device);
    case 'open':
      return tools.open(device, need(input.profile, 'profile'), input.cwd);
    case 'send':
      return tools.send(device, terminal(), input.text ?? '');
    case 'read':
      return tools.read(device, terminal(), input.lines);
    case 'restart':
      return tools.restart(device, terminal(), input.fresh);
    case 'close':
      return tools.close(device, terminal());
    case 'task_run':
      return tools.taskRun(device, need(input.command, 'command'), input.cwd, input.name);
    case 'task_list':
      return tools.taskList(device);
    case 'task_log':
      return tools.taskLog(device, need(input.id, 'id'));
    case 'task_stop':
      return tools.taskStop(device, need(input.id, 'id'));
    case 'copy':
      return tools.copy(
        parseSpot(need(input.from, 'from'), cwd),
        parseSpot(need(input.to, 'to'), cwd),
      );
    case 'profiles':
      return tools.profiles(device);
    case 'send_profile':
      return tools.sendProfile(
        need(input.profile, 'profile'),
        need(input.to, 'to'),
        input.from,
        input.chats,
      );
  }
}
