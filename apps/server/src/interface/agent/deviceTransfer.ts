import type { Profile, ProfileBundle, ProviderInfo } from '@deck/shared';
import { notFound } from '../../domain/errors.js';
import { jsonOf } from '../../infrastructure/peers/deviceCall.js';
import type { DeviceRouter } from './deviceRoute.js';

const enc = encodeURIComponent;

const plain = (text: string): string =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** A file or folder on a device. */
export interface Spot {
  device: string;
  path: string;
}

/** Moving things between devices: files and folders (streamed, any size), and profiles with their sign-in. */
export function createDeviceTransfer(route: DeviceRouter) {
  return {
    /**
     * Copies a file or a folder from one device to another (`here` included): it streams from one to the
     * other through this deck. A folder lands inside the destination folder.
     */
    copy: async (from: Spot, to: Spot) => {
      const source = await route.request(from.device)({
        method: 'GET',
        path: `/api/files?path=${enc(from.path)}`,
        headers: {},
        body: null,
      });
      if (source.status >= 400) await jsonOf(source); // throws its error
      const kind = source.headers['x-deck-kind'] === 'dir' ? 'dir' : 'file';
      const name = decodeURIComponent(source.headers['x-deck-name'] ?? 'file');
      const query = `path=${enc(to.path)}&kind=${kind}&name=${enc(name)}`;
      const saved = (await jsonOf(
        await route.request(to.device)({
          method: 'PUT',
          path: `/api/files?${query}`,
          headers: { 'content-type': 'application/octet-stream' },
          body: source.body,
        }),
      )) as { path: string };
      const [src, dst] = [route.target(from.device).name, route.target(to.device).name];
      return { kind, from: `${src}:${from.path}`, to: `${dst}:${saved.path}` };
    },

    /** The profiles a device has (the user's own ones can be sent to another device). */
    profiles: async (device: string) => {
      const list = await route.call<ProviderInfo[]>(device, 'GET', '/api/providers');
      return list
        .filter((p) => p.profile)
        .map((p) => ({ id: p.id, label: p.label, status: p.status }));
    },

    /**
     * Sends a profile (its sign-in, API key and settings; its chats only when asked) from one device to
     * another, so it works there without signing in again. The same id on the other side is refreshed.
     */
    sendProfile: async (profile: string, to: string, from = 'here', withChats = false) => {
      const list = await route.call<ProviderInfo[]>(from, 'GET', '/api/providers');
      const wanted = plain(profile);
      const match = list.find((p) => p.profile && (p.id === profile || plain(p.label) === wanted));
      if (!match) throw notFound(`Profile "${profile}" on ${route.target(from).name}`);
      const path = `/api/profiles/${enc(match.id)}/bundle?chats=${withChats ? 1 : 0}`;
      const bundle = await route.call<ProfileBundle>(from, 'GET', path);
      const saved = await route.call<Profile>(to, 'POST', '/api/profiles/import', bundle);
      return {
        profile: saved.id,
        label: saved.label,
        files: bundle.files.length,
        on: route.target(to).name,
      };
    },
  };
}
