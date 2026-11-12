import type { SignInMethod } from '@deck/shared';
import type { MessageKey } from '../../shared/i18n/en';

export interface MethodInfo {
  id: SignInMethod;
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
export function methodsFor(agent: 'claude' | 'codex', keyOnly: boolean): MethodInfo[] {
  if (keyOnly) return [KEY_ONLY];
  return agent === 'codex' ? CODEX : CLAUDE;
}
