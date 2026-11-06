import { describe, expect, it } from 'vitest';
import { PairingRequests } from './PairingRequests.js';

function setup() {
  let now = 0;
  let n = 0;
  const requests = new PairingRequests(
    () => now,
    () => '123456',
    () => `r${n++}`,
  );
  return { requests, advance: (ms: number) => (now += ms) };
}

describe('pairing requests', () => {
  it('lists the code shown until the request ends', () => {
    const { requests } = setup();
    const shown = requests.show({ name: 'Phone' });
    expect(requests.list()).toEqual([expect.objectContaining({ name: 'Phone', code: '123456' })]);
    shown.done('paired');
    expect(requests.list()).toEqual([]);
  });

  it('waits longer after each wrong code, and not after a request given up', () => {
    const { requests, advance } = setup();
    requests.show({ name: 'x' }).done('abandoned');
    requests.show({ name: 'x' }).done('wrong');
    expect(() => requests.show({ name: 'x' })).toThrow('paused');
    advance(10_000);
    requests.show({ name: 'x' }).done('wrong');
    advance(10_000);
    expect(() => requests.show({ name: 'x' })).toThrow('paused');
    advance(10_000);
    expect(() => requests.show({ name: 'x' })).not.toThrow();
  });

  it('tells the asking side when the user refuses', () => {
    const { requests } = setup();
    let refused = false;
    const shown = requests.show({ name: 'x' });
    shown.onCancel(() => (refused = true));
    requests.refuse(requests.list()[0]?.id ?? '');
    expect(refused).toBe(true);
  });

  it('drops requests nobody answered in time', () => {
    const { requests, advance } = setup();
    requests.show({ name: 'x' });
    advance(3 * 60_000);
    expect(requests.list()).toEqual([]);
  });
});
