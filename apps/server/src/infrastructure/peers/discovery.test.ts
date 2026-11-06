import { describe, expect, it } from 'vitest';
import { answerQueries, broadcastTargets, discover } from './discovery.js';

describe('finding decks on the network', () => {
  it('lists the decks that answer, with the address to reach them', async () => {
    const answering = await answerQueries(() => ({ id: 'pc1', name: 'PC', port: 7850 }), 0);
    const found = await discover({ targets: ['127.0.0.1'], port: answering.port, waitMs: 300 });
    answering.close();
    expect(found).toEqual([{ id: 'pc1', name: 'PC', port: 7850, address: '127.0.0.1:7850' }]);
  });

  it("asks each interface's broadcast address", () => {
    const targets = broadcastTargets({
      wlan0: [
        {
          address: '192.168.1.23',
          netmask: '255.255.255.0',
          family: 'IPv4',
          mac: '',
          internal: false,
          cidr: null,
        },
      ],
    });
    expect(targets).toEqual(['255.255.255.255', '192.168.1.255']);
  });
});
