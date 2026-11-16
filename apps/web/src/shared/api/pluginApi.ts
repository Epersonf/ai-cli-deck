import { ProviderPluginManifestSchema, TemplateInfoSchema } from '@deck/shared';
import { z } from 'zod';
import { request, withToken } from './client';

const path = (id: string): string => `/api/plugins/${encodeURIComponent(id)}`;
export const pluginApi = {
  inspect: (data: string) =>
    request(ProviderPluginManifestSchema, 'POST', '/api/plugins/inspect', { data }),
  install: (data: string) => request(TemplateInfoSchema, 'POST', '/api/plugins', { data }),
  remove: (id: string) => request(z.void(), 'DELETE', path(id)),
  test: (id: string) =>
    request(z.object({ code: z.number(), output: z.string() }), 'POST', `${path(id)}/test`, {}),
};
export function downloadPlugin(id: string): void {
  const link = document.createElement('a');
  link.href = withToken(`${path(id)}/package`);
  link.download = `${id}.deck-plugin.zip`;
  link.click();
}
export async function pluginFileData(file: File): Promise<string> {
  if (file.size > 8 << 20) throw new Error('Plugin package exceeds 8 MB');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32768)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  return btoa(binary);
}
