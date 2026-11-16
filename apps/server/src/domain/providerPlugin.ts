import type { AuthInfo, PluginAuthMethod, Profile, ProviderPluginManifest } from '@deck/shared';
import type { AccountLimit, AgentPort } from './agent.js';
import type { ChatReader, ChatSupport } from './chat.js';
import type { LoginChild } from './signin.js';
import type { ModelListing } from './provider.js';

export interface PluginInstallResult {
  ok: boolean;
  output: string;
}
export interface PluginHooks {
  installed(): Promise<boolean>;
  install(): Promise<PluginInstallResult>;
  login(method: string): LoginChild;
  auth(forLogin?: boolean): Promise<AuthInfo>;
  logout(): Promise<void>;
  discoverModels?(): Promise<ModelListing>;
  driver: AgentPort;
  history?: ChatReader;
  chat?(): ChatSupport | null;
  compactTools?: boolean;
  guide?(options: { phone: boolean; devices: readonly string[] }): string;
  discoverLimits?(): Promise<AccountLimit[]>;
}
export interface PluginRuntime {
  manifest: ProviderPluginManifest;
  builtin: boolean;
  root: string;
  create(context: PluginContext): PluginHooks;
}
export interface PluginContext {
  profile: Profile;
  home: string;
  env(): Record<string, string>;
  loginEnv(): Record<string, string>;
  statusEnv(): Record<string, string>;
  resolve(binary: string): string | null;
  run(
    argv: readonly string[],
    timeoutMs?: number,
    environment?: 'profile' | 'login' | 'status' | 'system',
  ): Promise<{ code: number; output: string }>;
  startLogin(argv: readonly string[]): LoginChild;
}
export interface PluginAuthentication {
  methods: readonly PluginAuthMethod[];
  login(method: string): LoginChild;
  status(forLogin?: boolean): Promise<AuthInfo>;
  logout(): Promise<void>;
}
