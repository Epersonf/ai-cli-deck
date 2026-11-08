import { describe, expect, it } from 'vitest';
import { createLatencyMeter } from './latencyMeter';

describe('createLatencyMeter', () => {
  it('measures ping round trip and key-to-output echo separately', () => {
    let now = 0;
    const meter = createLatencyMeter(() => now);
    meter.ping();
    now = 20;
    meter.pong();
    meter.key();
    now = 80;
    meter.output();
    expect(meter.get()).toMatchObject({ net: 20, echo: 60 });
  });

  it('ignores output that was not caused by a key and stale echoes', () => {
    let now = 0;
    const meter = createLatencyMeter(() => now);
    meter.output();
    meter.key();
    now = 5000;
    meter.output();
    expect(meter.get()).toMatchObject({ net: null, echo: null });
  });
});

describe('createLatencyMeter load', () => {
  it('keeps the server loop lag and the page timer drift', () => {
    const meter = createLatencyMeter(() => 0);
    meter.pong(45);
    meter.drift(80);
    expect(meter.get()).toMatchObject({ server: 45, ui: 80 });
  });
});
