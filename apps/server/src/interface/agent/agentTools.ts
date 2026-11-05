import { normalizeUrl } from '@deck/shared';
import { forbidden, invalid, notFound } from '../../domain/errors.js';
import type { BatteryRule } from '../../application/batteryRule.js';
import type { Container } from '../container.js';

const TITLE_MAX = 60;
/** How long a request that needs the person's tap on the phone may take. */
const ASK_MS = 45_000;

export type AgentDeps = Pick<
  Container,
  'sessions' | 'handoffs' | 'phone' | 'tasks' | 'approvals' | 'preview' | 'browser'
>;

/**
 * Everything an agent may do, scoped to ONE session. Shared by the MCP tools and the `clideck`
 * command so both behave identically. Nothing here runs git or touches the filesystem: the
 * worktree can only be PROPOSED; the user approves it in the UI.
 */
export function createAgentTools(deps: AgentDeps, sessionId: string) {
  const self = () => {
    const session = deps.sessions.get(sessionId);
    if (!session) throw notFound(`Session ${sessionId}`);
    return session;
  };

  const phone = () => {
    if (!deps.phone) throw forbidden('Phone access is off: turn it on in the Android app settings');
    return deps.phone;
  };
  /** The agent acts in the session's Chromium: the session's devices switch the preview to it. */
  const shown = <T>(job: () => Promise<T>): Promise<T> => {
    deps.preview.agentBrowsing(sessionId);
    return job();
  };

  return {
    whoami: () => {
      const { id, provider, cwd, port, previewUrl, worktree, status } = self();
      return { id, provider, cwd, port, previewUrl, worktree, status };
    },

    /**
     * Only terminals of the SAME profile: a profile is a separate world (its own CLI login, key and
     * endpoint), so an agent in one must not even see the sessions of another.
     */
    listSessions: () => {
      const me = self();
      return deps.sessions
        .list()
        .filter((s) => s.id !== me.id && s.provider === me.provider)
        .map((s) => ({
          id: s.id,
          provider: s.provider,
          cwd: s.cwd,
          status: s.status,
          sameFolderAsYou: s.cwd === me.cwd,
        }));
    },

    /** Reads (no argument) or sets the name shown for this terminal in the deck. Kept tiny on purpose. */
    title: async (name?: string) => {
      if (name === undefined) return { title: self().name };
      const clean = name.replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX);
      return { title: (await deps.sessions.rename(sessionId, clean === '' ? null : clean)).name };
    },

    /**
     * Notes kept with this session, e.g. the id of its chat so it can be resumed. No key: all of them;
     * a key alone: that value; key and value: save it (an empty value removes it).
     */
    meta: async (key?: string, value?: string) => {
      if (key === undefined) return self().meta;
      if (value === undefined) return { [key]: self().meta[key] ?? null };
      return deps.sessions.setMeta(sessionId, key, value);
    },

    /** Leaves notes for whoever continues this chat. The deck asks for them; agents never write them unprompted. */
    handoff: (text?: string) =>
      text === undefined ? deps.handoffs.info(sessionId) : deps.handoffs.save(sessionId, text),

    /** True when the Android app let agents use the phone (Settings > Phone access). */
    phoneEnabled: deps.phone !== null,
    phoneBattery: () => phone().request('GET', '/battery'),
    phoneDevice: () => phone().request('GET', '/device'),
    /** What the phone lets agents do right now (the user's checkboxes), for `clideck phone help`. */
    phoneCapabilities: () => phone().request('GET', '/capabilities'),
    /** Any enabled capability: `path` like /sms/send, `args` its options. The app enforces the checkboxes and taps. */
    phoneCall: (path: string, args: Record<string, unknown> = {}) => {
      if (!/^\/[a-z]+(\/[a-z]+)?$/.test(path)) throw invalid('Not a phone request');
      return phone().request('POST', path, args, ASK_MS);
    },
    phoneWifi: () => phone().request('GET', '/wifi'),
    phoneWifiScan: () => phone().request('GET', '/wifi/scan', undefined, 20_000),
    // These wait for the person to tap Allow on the phone.
    phoneWifiConnect: (ssid: string, password = '') =>
      phone().request('POST', '/wifi/connect', { ssid, password }, ASK_MS),
    phoneWifiEnable: (on: boolean) => phone().request('POST', '/wifi/enable', { on }, ASK_MS),
    phoneNotify: (text: string, title = '') => phone().request('POST', '/notify', { title, text }),

    /** Background jobs of this terminal's profile: a command that keeps running, or a watcher that notifies the phone. */
    taskList: () => deps.tasks.board.list(self().provider),
    taskRun: (command: string, name?: string) => deps.tasks.runProcess(self(), command, name),
    taskWatchBattery: (rule: BatteryRule, name?: string) =>
      deps.tasks.watchBattery(self(), rule, name),
    taskStop: (id: string) => deps.tasks.board.stop(id, self().provider),
    taskLog: (id: string) => ({ text: deps.tasks.log(id, self().provider) }),

    proposeWorktree: (reason: string) => {
      const request = deps.approvals.propose(self().id, reason);
      return { status: 'pending' as const, requestId: request.id };
    },

    openPreview: (url: string) => ({ url: deps.preview.open(self().id, normalizeUrl(url)) }),

    suggestNewTab: (url: string) => ({
      url: deps.preview.suggestNewTab(self().id, normalizeUrl(url)),
    }),

    browserNavigate: (url: string) => shown(() => deps.browser.navigate(sessionId, url)),
    browserOutline: () => deps.browser.outline(sessionId),
    browserScreenshot: () => deps.browser.screenshot(sessionId),
    browserClick: (target: string) => shown(() => deps.browser.click(sessionId, target)),
    browserFill: (target: string, text: string) =>
      shown(() => deps.browser.fill(sessionId, target, text)),
    browserType: (text: string) =>
      shown(() => deps.browser.input(sessionId, { kind: 'type', text })),
    browserPress: (key: string) => shown(() => deps.browser.input(sessionId, { kind: 'key', key })),
    browserScroll: (dy: number) =>
      shown(() => deps.browser.input(sessionId, { kind: 'scroll', dy })),

    requestStatus: (requestId: string) => {
      const request = deps.approvals.get(requestId);
      if (request.sessionId !== sessionId) throw notFound(`Request ${requestId}`);
      return { status: request.status, path: request.resultPath };
    },
  };
}

export type AgentTools = ReturnType<typeof createAgentTools>;
