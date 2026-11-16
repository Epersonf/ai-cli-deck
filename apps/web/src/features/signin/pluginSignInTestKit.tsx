import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, vi } from 'vitest';
import { ProviderInfoSchema, ProviderPluginManifestSchema, type SignInFlow } from '@deck/shared';
import rawManifest from '../../../../server/src/plugins/antigravity/manifest.json';
import { SignInHost } from './SignInDialog';
import { useSignIn } from './signInStore';
import { useProfiles } from '../sessions/profilesStore';
import { useLocale } from '../../shared/i18n/store';

const manifest = ProviderPluginManifestSchema.parse(rawManifest);
let root: Root;
export let host: HTMLElement;
let installed: boolean;
let account: boolean;
let key: string;
let flow: SignInFlow | null;
export const calls: Array<{ url: string; body: Record<string, string> }> = [];
const info = () =>
  ProviderInfoSchema.parse({
    id: 'google',
    label: 'Google',
    agent: 'antigravity',
    profile: true,
    status: installed ? 'ready' : 'missing',
    hint: null,
    canInstall: true,
    authMethods: manifest.authMethods,
    keyState: key ? 'set' : 'none',
  });
export const click = async (selector: string): Promise<void> => {
  const element = host.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  await act(async () => element.click());
};
export const button = (text: string): string => {
  const buttons = [...host.querySelectorAll('button')];
  const index = buttons.findIndex((entry) => entry.textContent?.trim() === text);
  if (index < 0) throw new Error(`Missing button ${text}: ${host.textContent}`);
  buttons[index]?.setAttribute('data-click', 'target');
  return '[data-click="target"]';
};
beforeEach(() => {
  installed = false;
  account = false;
  key = '';
  flow = null;
  calls.length = 0;
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  useLocale.getState().setLocale('en');
  useProfiles.setState({ providers: [info()] });
  useSignIn.setState({ provider: 'google', onSuccess: null });
  vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, string>;
    calls.push({ url, body });
    let result: unknown = null;
    if (url === '/api/providers') result = [info()];
    else if (url.endsWith('/install')) {
      installed = true;
      result = { ok: true, output: 'Official CLI installed' };
    } else if (url.endsWith('/auth'))
      result = {
        state: account || key ? 'signed-in' : 'signed-out',
        via: key ? 'API key' : account ? 'Google account' : null,
        account: null,
      };
    else if (url.endsWith('/login/input')) {
      account = true;
      if (flow) flow = { ...flow, state: 'done' };
    } else if (url.endsWith('/login') && init?.method === 'POST')
      flow = {
        method: body.method ?? '',
        state: 'running',
        url: 'https://accounts.google.com/auth',
        code: null,
        needsCode: true,
        output: '',
        error: null,
      };
    else if (url.endsWith('/login')) result = flow;
    else if (url.endsWith('/secret')) {
      key = body.secret ?? '';
      return new Response(null, { status: 204 });
    }
    return new Response(JSON.stringify(result), { status: 200 });
  });
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  useSignIn.getState().close();
  vi.unstubAllGlobals();
});
export async function mount() {
  await act(async () => {
    root.render(<SignInHost />);
  });
}
export function type(selector: string, value: string): void {
  const field = host.querySelector<HTMLInputElement>(selector);
  if (!field) throw new Error('Missing input');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

export function ready() {
  installed = true;
  useProfiles.setState({ providers: [info()] });
}
