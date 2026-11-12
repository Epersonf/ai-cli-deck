import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { createHarness } from '../../../testing/harness.js';
import type { Container } from '../../container.js';
import { registerErrorHandler } from '../errors.js';
import { memoryRoutes } from './memory.js';

async function app() {
  const h = createHarness();
  const server = Fastify();
  registerErrorHandler(server);
  memoryRoutes(server, { memory: h.memory } as unknown as Container);
  await server.ready();
  const send = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
    server.inject({ method, url, ...(payload ? { payload } : {}) });
  return { send, h };
}

describe('memory routes', () => {
  it('create, list, edit and delete notes and folders', async () => {
    const { send } = await app();
    const folder = (
      await send('POST', '/api/memory/folders', { scope: 'global', name: 'Work' })
    ).json();
    const made = await send('POST', '/api/memory', {
      scope: 'global',
      title: 'T',
      body: 'B',
      folderId: folder.id,
    });
    expect(made.statusCode).toBe(201);
    const note = made.json();
    const tree = (await send('GET', '/api/memory?scope=global')).json();
    expect(tree.folders).toHaveLength(1);
    expect(tree.entries[0].id).toBe(note.id);
    const patched = await send('PATCH', `/api/memory/${note.id}`, { enabled: false });
    expect(patched.json()).toMatchObject({ enabled: false, title: 'T' });
    const renamed = await send('PATCH', `/api/memory/folders/${folder.id}`, { name: 'Jobs' });
    expect(renamed.json().name).toBe('Jobs');
    expect(
      (await send('PATCH', `/api/memory/folders/${folder.id}`, { parentId: folder.id })).statusCode,
    ).toBe(400);
    expect((await send('DELETE', `/api/memory/folders/${folder.id}`)).statusCode).toBe(204);
    expect((await send('GET', '/api/memory?scope=global')).json().entries).toEqual([]);
    expect((await send('DELETE', `/api/memory/${note.id}`)).statusCode).toBe(404);
  });

  it('keep a profile apart, and refuse a body that breaks the limits', async () => {
    const { send } = await app();
    await send('POST', '/api/memory', { scope: 'profile', profileId: 'claude', title: 'P' });
    expect(
      (await send('GET', '/api/memory?scope=profile&profileId=claude')).json().entries,
    ).toHaveLength(1);
    expect((await send('GET', '/api/memory?scope=profile&profileId=codex')).json().entries).toEqual(
      [],
    );
    expect(
      (await send('POST', '/api/memory', { scope: 'global', title: 'x'.repeat(200) })).statusCode,
    ).toBe(400);
    expect(
      (await send('POST', '/api/memory', { scope: 'profile', title: 'no profile' })).statusCode,
    ).toBe(400);
  });

  it('import copies the chosen notes and answers with the destination memory', async () => {
    const { send } = await app();
    const note = (
      await send('POST', '/api/memory', {
        scope: 'profile',
        profileId: 'claude',
        title: 'A',
        body: 'a',
      })
    ).json();
    const res = await send('POST', '/api/memory/import', {
      fromProfile: 'claude',
      toProfile: 'codex',
      ids: [note.id],
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().entries[0]).toMatchObject({
      title: 'A',
      source: 'import',
      importedFrom: 'claude',
      profileId: 'codex',
    });
  });
});
