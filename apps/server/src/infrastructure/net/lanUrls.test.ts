import { describe, expect, it } from 'vitest';
import { lanUrls } from './lanUrls.js';

const iface = (address: string, internal: boolean, family = 'IPv4') =>
  ({ address, internal, family }) as never;

describe('lanUrls', () => {
  const interfaces = {
    lo: [iface('127.0.0.1', true)],
    wlan0: [iface('192.168.0.7', false), iface('fe80::1', false, 'IPv6')],
  };

  it('lists non-internal IPv4 addresses for an all-interfaces bind', () => {
    expect(lanUrls('0.0.0.0', 7842, interfaces)).toEqual(['http://192.168.0.7:7842/']);
  });

  it('echoes the host for a specific bind', () => {
    expect(lanUrls('127.0.0.1', 7842, interfaces)).toEqual(['http://127.0.0.1:7842/']);
  });
});
