import type { PeerInfo } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import { createDeviceTools, type DeviceDeps } from './deviceTools.js';

const peer = (id: string, name: string): PeerInfo => ({
  id,
  name,
  addresses: [],
  pairedAt: '2026-01-01T00:00:00.000Z',
  lastSeen: null,
  online: true,
});

function setup() {
  const calls: unknown[][] = [];
  const deps = {
    network: { peers: () => [peer('p1', 'Meu PC'), peer('p2', 'Notebook Trabalho')] },
    peerCall: (...args: unknown[]) => {
      calls.push(args);
      return Promise.resolve({ exitCode: 0, output: 'ok' });
    },
  } as unknown as DeviceDeps;
  return { tools: createDeviceTools(deps), calls };
}

describe('devices for agents', () => {
  it('finds a device by name in any case, or by the start of its name', async () => {
    const { tools, calls } = setup();
    await tools.run('meu pc', 'dir');
    await tools.run('note', 'ls', '~/x', 30);
    expect(calls).toEqual([
      ['p1', 'POST', '/api/exec', { command: 'dir', cwd: undefined, timeoutSec: undefined }],
      ['p2', 'POST', '/api/exec', { command: 'ls', cwd: '~/x', timeoutSec: 30 }],
    ]);
  });

  it('names the paired devices when the one asked for is unknown', () => {
    const { tools } = setup();
    expect(() => tools.run('tablet', 'ls')).toThrow('paired: Meu PC, Notebook Trabalho');
  });

  it('types into and reads a terminal there', async () => {
    const { tools, calls } = setup();
    await tools.send('PC', 'abc', 'hello');
    await tools.read('Meu PC', 'abc', 20);
    expect(calls).toEqual([
      ['p1', 'POST', '/api/sessions/abc/input', { text: 'hello', enter: true }],
      ['p1', 'GET', '/api/sessions/abc/screen?lines=20', undefined],
    ]);
  });
});
