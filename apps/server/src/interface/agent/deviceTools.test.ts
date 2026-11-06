import { Readable } from 'node:stream';
import type { PeerInfo } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import type { TunnelRequest } from '../../infrastructure/peers/tunnelClient.js';
import { parseSpot } from './deviceActions.js';
import { createDeviceTools, type DeviceDeps } from './deviceTools.js';

const peer = (id: string, name: string): PeerInfo => ({
  id,
  name,
  addresses: [],
  pairedAt: '2026-01-01T00:00:00.000Z',
  lastSeen: null,
  online: true,
});

const text = async (body: Readable | null): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of body ?? []) chunks.push(Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks).toString();
};

/** Devices that record what they are asked and answer from `reply`. */
function setup(
  reply: (device: string, request: TunnelRequest, body: string) => unknown = () => ({}),
) {
  const calls: [string, string, string, string][] = [];
  const deps = {
    network: {
      status: () => ({ id: 'me', name: 'Celular' }),
      peers: () => [peer('p1', 'Meu PC'), peer('p2', 'Notebook Trabalho')],
    },
    device: (id: string | null) => async (request: TunnelRequest) => {
      const device = id ?? 'here';
      const body = await text(request.body);
      calls.push([device, request.method, request.path, body]);
      const answer = reply(device, request, body);
      if (answer instanceof Readable)
        return {
          status: 200,
          headers: { 'x-deck-kind': 'file', 'x-deck-name': 'out.png' },
          body: answer,
        };
      return {
        status: 200,
        headers: {},
        body: Readable.from([Buffer.from(JSON.stringify(answer))]),
      };
    },
  } as unknown as DeviceDeps;
  return { tools: createDeviceTools(deps), calls };
}

describe('devices for agents', () => {
  it('finds a device by name, a word of it or its start, and "here" is this deck', async () => {
    const { tools, calls } = setup();
    await tools.run('meu pc', 'dir');
    await tools.run('pc', 'dir');
    await tools.run('note', 'ls');
    await tools.run('here', 'ls');
    await tools.run('celular', 'ls');
    expect(calls.map((c) => c[0])).toEqual(['p1', 'p1', 'p2', 'here', 'here']);
  });

  it('names the devices when the one asked for is unknown', () => {
    const { tools } = setup();
    expect(() => tools.run('tablet', 'ls')).toThrow('paired: Meu PC, Notebook Trabalho');
  });

  it('types into, reads and restarts a terminal there', async () => {
    const { tools, calls } = setup();
    await tools.send('PC', 'abc', 'hello');
    await tools.read('Meu PC', 'abc', 20);
    await tools.restart('PC', 'abc', true);
    expect(calls).toEqual([
      ['p1', 'POST', '/api/sessions/abc/input', '{"text":"hello","enter":true}'],
      ['p1', 'GET', '/api/sessions/abc/screen?lines=20', ''],
      ['p1', 'POST', '/api/sessions/abc/restart', '{"mode":"new"}'],
    ]);
  });

  it('streams a file from one device straight into another', async () => {
    const { tools, calls } = setup((_device, request) =>
      request.method === 'GET'
        ? Readable.from([Buffer.from('PNG bytes')])
        : { path: 'C:\\in\\out.png' },
    );
    const result = await tools.copy(
      { device: 'PC', path: '~/out.png' },
      { device: 'here', path: '/sdcard' },
    );
    expect(calls).toEqual([
      ['p1', 'GET', '/api/files?path=~%2Fout.png', ''],
      ['here', 'PUT', '/api/files?path=%2Fsdcard&kind=file&name=out.png', 'PNG bytes'],
    ]);
    expect(result).toEqual({
      kind: 'file',
      from: 'Meu PC:~/out.png',
      to: 'Celular:C:\\in\\out.png',
    });
  });

  it('sends a profile, found by its label, with its files', async () => {
    const bundle = {
      profile: { id: 'work', label: 'Work' },
      template: null,
      files: [{ path: 'a', data: '' }],
    };
    const { tools, calls } = setup((_device, request) => {
      if (request.path === '/api/providers') return [{ id: 'work', label: 'Work', profile: true }];
      if (request.path.includes('/bundle')) return bundle;
      return bundle.profile;
    });
    expect(await tools.sendProfile('work', 'pc')).toEqual({
      profile: 'work',
      label: 'Work',
      files: 1,
      on: 'Meu PC',
    });
    expect(calls.map((c) => `${c[0]} ${c[1]} ${c[2]}`)).toEqual([
      'here GET /api/providers',
      'here GET /api/profiles/work/bundle?chats=0',
      'p1 POST /api/profiles/import',
    ]);
  });
});

describe('device:path', () => {
  it('splits a device from its path, keeping Windows drives and taking relative paths from the agent', () => {
    expect(parseSpot('PC:C:\\out\\a.png', '/root')).toEqual({
      device: 'PC',
      path: 'C:\\out\\a.png',
    });
    expect(parseSpot('Meu PC:~/x', '/root')).toEqual({ device: 'Meu PC', path: '~/x' });
    expect(parseSpot('~/x', '/root')).toEqual({ device: 'here', path: '~/x' });
    expect(parseSpot('C:\\x', '/root').device).toBe('here');
    expect(parseSpot('out/a.png', '/work').path).toMatch(/work[\\/]out[\\/]a\.png$/);
  });
});
