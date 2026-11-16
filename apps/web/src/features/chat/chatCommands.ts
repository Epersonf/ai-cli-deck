import {
  AGENT_EFFORTS,
  AGENT_MODES,
  type ChatConfig,
  type Effort,
  type PermissionMode,
} from '@deck/shared';
import type { MessageKey } from '../../shared/i18n/en';
import type { View } from '../sessions/sessionsStore';

/** What a command may do: only things the deck itself offers, so it works the same for every agent. */
export interface CommandContext {
  config: ChatConfig | null;
  /** The last thing the agent said, and the whole conversation, as text. */
  lastAnswer(): string;
  transcript(): string;
  /** Sends text to the agent as a message. */
  say(text: string): void;
  interrupt(): void;
  setConfig(patch: { model?: string | null; mode?: PermissionMode; effort?: Effort | null }): void;
  show(view: View): void;
  copy(text: string): void;
  openFork(): void;
  /** One short line of feedback ("Mode set to plan"). */
  toast(text: string): void;
}

export interface Command {
  name: string;
  /** Shown after the name in the menu: `[model]`. */
  arg?: string;
  /** i18n key of the one-line description. */
  desc: MessageKey;
  run(ctx: CommandContext, arg: string): void;
}

const SUMMARIZE =
  'Summarize our conversation so far: what we are doing, what is decided, what is done and what is left. ' +
  'Keep it short enough to continue from.';

/** The deck's own commands. Anything else starting with `/` goes to the agent untouched (it may know it). */
export const COMMANDS: readonly Command[] = [
  { name: 'stop', desc: 'cmd.stop', run: (c) => c.interrupt() },
  {
    name: 'model',
    arg: '[model]',
    desc: 'cmd.model',
    run: (c, arg) => {
      if (arg === '') {
        const names = c.config?.modelChoices.map((m) => m.id).join(', ') ?? '';
        return c.toast(names === '' ? '—' : names);
      }
      const choice = c.config?.modelChoices.find(
        (m) => m.id === arg || m.label.toLowerCase() === arg.toLowerCase(),
      );
      c.setConfig({ model: arg === 'default' ? null : (choice?.id ?? arg) });
      c.toast(arg);
    },
  },
  {
    name: 'mode',
    arg: '[mode]',
    desc: 'cmd.mode',
    run: (c, arg) => {
      const modes: readonly string[] = c.config
        ? (c.config.features?.modes ?? AGENT_MODES[c.config.agent] ?? [])
        : [];
      if (arg === '' || !modes.includes(arg)) return c.toast(modes.join(', ') || '—');
      c.setConfig({ mode: arg as PermissionMode });
      c.toast(arg);
    },
  },
  {
    name: 'effort',
    arg: '[level]',
    desc: 'cmd.effort',
    run: (c, arg) => {
      const levels: readonly string[] = c.config
        ? (c.config.features?.efforts ?? AGENT_EFFORTS[c.config.agent] ?? [])
        : [];
      if (arg === '' || !levels.includes(arg)) return c.toast(levels.join(', ') || '—');
      c.setConfig({ effort: arg as Effort });
      c.toast(arg);
    },
  },
  { name: 'files', desc: 'cmd.files', run: (c) => c.show('files') },
  { name: 'changes', desc: 'cmd.changes', run: (c) => c.show('changes') },
  { name: 'preview', desc: 'cmd.preview', run: (c) => c.show('preview') },
  {
    name: 'copy',
    arg: '[all]',
    desc: 'cmd.copy',
    run: (c, arg) => c.copy(arg === 'all' ? c.transcript() : c.lastAnswer()),
  },
  { name: 'fork', desc: 'cmd.fork', run: (c) => c.openFork() },
  { name: 'summarize', desc: 'cmd.summarize', run: (c) => c.say(SUMMARIZE) },
];

/** `/name rest` as written in the box; null when it is not a command (or has no name). */
export function parseCommand(text: string): { name: string; arg: string } | null {
  const match = /^\/(\S+)(?:\s+([\s\S]*))?$/.exec(text.trim());
  return match ? { name: (match[1] ?? '').toLowerCase(), arg: (match[2] ?? '').trim() } : null;
}

/** The deck command a message is, or null when it should go to the agent as written. */
export function commandOf(text: string): { command: Command; arg: string } | null {
  const parsed = parseCommand(text);
  const command = parsed && COMMANDS.find((c) => c.name === parsed.name);
  return parsed && command ? { command, arg: parsed.arg } : null;
}

/** Commands for the menu while typing `/xx`: names that start with it first, then ones that contain it. */
export function matchCommands(query: string): Command[] {
  const q = query.toLowerCase();
  const starts = COMMANDS.filter((c) => c.name.startsWith(q));
  const has = COMMANDS.filter((c) => !c.name.startsWith(q) && c.name.includes(q));
  return [...starts, ...has];
}
