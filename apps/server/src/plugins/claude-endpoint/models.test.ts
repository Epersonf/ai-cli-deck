import { describe, expect, it } from 'vitest';
import { endpointModels, modelsUrl, type Fetcher } from '../claude/endpointModels.js';

describe('endpoint models', () => {
  const env = {
    ANTHROPIC_BASE_URL: 'https://h/anthropic/',
    ANTHROPIC_AUTH_TOKEN: 'k',
    ANTHROPIC_MODEL: 'm1',
  };

  it('are listed by the endpoint with the saved key', async () => {
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    const fetcher: Fetcher = (url, init) => {
      calls.push({ url, headers: init.headers });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 'x' }, { id: 'y', display_name: 'Y' }] }),
      });
    };
    const listing = await endpointModels(env, fetcher);
    expect(listing.choices.map((m) => [m.id, m.label])).toEqual([
      ['x', 'x'],
      ['y', 'Y'],
    ]);
    expect(calls[0]?.url).toBe('https://h/anthropic/v1/models');
    expect(calls[0]?.headers['x-api-key']).toBe('k');
    expect(modelsUrl('https://h/v1')).toBe('https://h/v1/models');
  });

  it('fall back to the profile model, else to nothing, when the endpoint cannot say', async () => {
    const bad: Fetcher = () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    const boom: Fetcher = () => Promise.reject(new Error('down'));
    expect((await endpointModels(env, bad)).choices.map((m) => m.id)).toEqual(['m1']);
    expect((await endpointModels(env, boom)).current).toBe('m1');
    expect(await endpointModels({ ANTHROPIC_BASE_URL: 'https://h' }, boom)).toEqual({
      choices: [],
      current: null,
    });
  });
});
