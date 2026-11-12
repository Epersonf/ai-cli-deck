import type { ExecResult, ProviderInfo, ScreenText, Session, Task } from '@deck/shared';
import { createDeviceTransfer } from './deviceTransfer.js';
import { deviceRouter, type DeviceDeps } from './deviceRoute.js';

export type { DeviceDeps };

const enc = encodeURIComponent;

/**
 * What an agent can do on any device: this deck (`here`) or one paired with it (the user's PC from the
 * phone, and back). Run a command and wait, use its terminals (start, message and read an agent there,
 * restart or close one), its background tasks, and move files and profiles between devices.
 */
export function createDeviceTools(deps: DeviceDeps) {
  const route = deviceRouter(deps);
  const { call } = route;
  const terminal = (id: string): string => `/api/sessions/${enc(id)}`;

  return {
    ...createDeviceTransfer(route),

    devices: () => {
      const self = deps.network.status();
      const peers = deps.network
        .peers()
        .map(({ name, id, online, lastSeen }) => ({ name, id, online, lastSeen }));
      return [{ name: self.name, id: 'here', online: true, lastSeen: null }, ...peers];
    },

    run: (name: string, command: string, cwd?: string, timeoutSec?: number) =>
      call<ExecResult>(name, 'POST', '/api/exec', { command, cwd, timeoutSec }),

    /** Its terminals, and the profiles a new one can start with. */
    terminals: async (name: string) => {
      const [sessions, providers] = await Promise.all([
        call<Session[]>(name, 'GET', '/api/sessions'),
        call<ProviderInfo[]>(name, 'GET', '/api/providers'),
      ]);
      return {
        terminals: sessions.map((s) => ({
          id: s.id,
          title: s.name,
          profile: s.provider,
          cwd: s.cwd,
          status: s.status,
        })),
        profiles: providers
          .filter((p) => p.status !== 'missing')
          .map((p) => ({ id: p.id, label: p.label, ownProfile: p.profile })),
      };
    },

    /** Starts a chat session there with a profile's agent. */
    open: async (name: string, profile: string, cwd?: string) => {
      const body = { provider: profile, cwd: cwd ?? '~', useWorktree: false };
      const session = await call<Session>(name, 'POST', '/api/sessions', body);
      return { terminal: session.id, profile: session.provider, cwd: session.cwd };
    },

    /** Sends a message to one of its sessions' agents. */
    send: async (name: string, id: string, text: string) => {
      await call(name, 'POST', `${terminal(id)}/input`, { text });
      return { sent: true };
    },

    /** One of its sessions' recent conversation as text. */
    read: (name: string, id: string, lines = 60) =>
      call<ScreenText>(name, 'GET', `${terminal(id)}/screen?lines=${lines}`),

    /** Starts a session's conversation over (`fresh`); otherwise nothing to do: a chat just continues. */
    restart: async (name: string, id: string, fresh = false) => {
      await call(name, 'POST', `${terminal(id)}/restart`, { mode: fresh ? 'new' : 'continue' });
      return { restarted: true };
    },

    close: async (name: string, id: string) => {
      await call(name, 'DELETE', terminal(id));
      return { closed: true };
    },

    /** Background tasks there: a command that keeps running (the user sees it in that deck's drawer). */
    taskRun: (name: string, command: string, cwd?: string, label?: string) =>
      call<Task>(name, 'POST', '/api/tasks', { command, cwd, name: label }),
    taskList: (name: string) => call<Task[]>(name, 'GET', '/api/tasks'),
    taskLog: (name: string, id: string) =>
      call<{ text: string }>(name, 'GET', `/api/tasks/${enc(id)}/log`),
    taskStop: async (name: string, id: string) => {
      await call(name, 'DELETE', `/api/tasks/${enc(id)}`);
      return { stopped: true };
    },
  };
}

export type DeviceTools = ReturnType<typeof createDeviceTools>;
