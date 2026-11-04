import { describe, expect, it } from 'vitest';
import { setupAgents as setup } from '../../testing/agentKit.js';
import { createAgentTools } from './agentTools.js';

describe('agent tools: the phone', () => {
  it('keeps the phone out of reach unless the Android app enabled it', async () => {
    const { tools } = await setup();
    expect(tools.phoneEnabled).toBe(false);
    expect(() => tools.phoneBattery()).toThrow(/Phone access is off/);
    expect(() => tools.phoneNotify('hi')).toThrow(/Phone access is off/);
  });

  it('reads the battery and shows notifications through the phone bridge when enabled', async () => {
    const { deps, a } = await setup();
    const calls: unknown[][] = [];
    const phone = {
      request: (method: string, path: string, body?: unknown) => {
        calls.push([method, path, body]);
        return Promise.resolve({ ok: true });
      },
    };
    const tools = createAgentTools({ ...deps, phone: phone as never }, a.id);
    expect(tools.phoneEnabled).toBe(true);
    await tools.phoneBattery();
    await tools.phoneNotify('battery low', 'Phone');
    expect(calls).toEqual([
      ['GET', '/battery', undefined],
      ['POST', '/notify', { title: 'Phone', text: 'battery low' }],
    ]);
  });

  it('Wi-Fi: reading is quick, changing waits long for the person to tap Allow on the phone', async () => {
    const { deps, a } = await setup();
    const calls: unknown[][] = [];
    const phone = {
      request: (method: string, path: string, body?: unknown, timeoutMs?: number) => {
        calls.push([method, path, body, timeoutMs]);
        return Promise.resolve({});
      },
    };
    const tools = createAgentTools({ ...deps, phone: phone as never }, a.id);
    await tools.phoneWifi();
    await tools.phoneWifiConnect('Home', 'secret');
    await tools.phoneWifiEnable(false);
    expect(calls[0]).toEqual(['GET', '/wifi', undefined, undefined]);
    expect(calls[1]).toEqual([
      'POST',
      '/wifi/connect',
      { ssid: 'Home', password: 'secret' },
      45_000,
    ]);
    expect(calls[2]).toEqual(['POST', '/wifi/enable', { on: false }, 45_000]);
  });

  it('forwards any enabled phone capability, but only well-formed paths', async () => {
    const { deps, a } = await setup();
    const calls: unknown[][] = [];
    const phone = {
      request: (method: string, path: string, body?: unknown) => {
        calls.push([method, path, body]);
        return Promise.resolve({});
      },
    };
    const tools = createAgentTools({ ...deps, phone: phone as never }, a.id);
    await tools.phoneCapabilities();
    await tools.phoneCall('/sms/send', { to: '+55', text: 'hi' });
    expect(calls).toEqual([
      ['GET', '/capabilities', undefined],
      ['POST', '/sms/send', { to: '+55', text: 'hi' }],
    ]);
    expect(() => tools.phoneCall('/../etc')).toThrow(/Not a phone request/);
    expect(() => tools.phoneCall('sms')).toThrow(/Not a phone request/);
  });
});
