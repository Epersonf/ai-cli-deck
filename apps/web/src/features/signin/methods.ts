import type { AgentKind, PluginAuthMethod, SignInMethod } from '@deck/shared';
import type { MessageKey } from '../../shared/i18n/en';

export interface MethodInfo {
  id: SignInMethod;
  label?: string;
  description?: string;
  helpText?: string;
  flow?: PluginAuthMethod['flow'];
  title: MessageKey;
  /** One short line shown under the title in the method list. */
  subtitle: MessageKey;
  /** The concrete steps to get a key, shown in a collapsed "Where do I find it?". */
  help?: MessageKey;
  /** The page where the key is made. */
  link?: { href: string; label: string };
}

const CLAUDE: MethodInfo[] = [
  { id: 'claude-account', title: 'signin.claudeAccount', subtitle: 'signin.claudeAccount.sub' },
  { id: 'claude-console', title: 'signin.claudeConsole', subtitle: 'signin.claudeConsole.sub' },
  {
    id: 'key',
    title: 'signin.claudeKey',
    subtitle: 'signin.claudeKey.sub',
    help: 'signin.claudeKey.steps',
    link: { href: 'https://console.anthropic.com/settings/keys', label: 'console.anthropic.com' },
  },
  { id: 'machine', title: 'signin.claudeMachine', subtitle: 'signin.claudeMachine.sub' },
];
const CODEX: MethodInfo[] = [
  { id: 'codex-chatgpt', title: 'signin.codexChatgpt', subtitle: 'signin.codexChatgpt.sub' },
  {
    id: 'key',
    title: 'signin.codexKey',
    subtitle: 'signin.codexKey.sub',
    help: 'signin.codexKey.steps',
    link: { href: 'https://platform.openai.com/api-keys', label: 'platform.openai.com' },
  },
  { id: 'machine', title: 'signin.codexMachine', subtitle: 'signin.codexMachine.sub' },
];
const KEY_ONLY: MethodInfo = {
  id: 'key',
  title: 'signin.endpointKey',
  subtitle: 'signin.endpointKey.sub',
  help: 'signin.endpointKey.steps',
};

/** The ways to sign in to a provider; a profile that is only a key (endpoint, DeepSeek) has just the key. */
export function methodsFor(
  agent: AgentKind,
  keyOnly: boolean,
  plugin?: readonly PluginAuthMethod[],
  locale = 'en',
): MethodInfo[] {
  if (plugin) {
    const legacy = methodsFor(agent, keyOnly);
    return plugin.map((method) => {
      const translated = method.translations?.[locale];
      const known = legacy.find((item) => item.id === method.id);
      return {
        ...(known ?? {
          id: method.id,
          title: 'signin.method' as const,
          subtitle: 'signin.method' as const,
          label: method.label,
          description: method.description,
        }),
        ...(translated
          ? { label: translated.label, description: translated.description ?? method.description }
          : {}),
        flow: method.flow,
        ...(translated?.help || method.help ? { helpText: translated?.help || method.help } : {}),
        ...(method.url ? { link: { href: method.url, label: new URL(method.url).host } } : {}),
      };
    });
  }
  if (agent === 'antigravity')
    return [
      {
        id: 'machine',
        title: 'signin.antigravityMachine',
        subtitle: 'signin.antigravityMachine.sub',
      },
      {
        id: 'key',
        title: 'signin.antigravityKey',
        subtitle: 'signin.antigravityKey.sub',
        link: { href: 'https://aistudio.google.com/api-keys', label: 'aistudio.google.com' },
      },
    ];
  if (keyOnly) return [KEY_ONLY];
  return agent === 'codex' ? CODEX : CLAUDE;
}
