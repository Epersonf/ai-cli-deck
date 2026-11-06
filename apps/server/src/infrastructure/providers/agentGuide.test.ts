import { describe, expect, it } from 'vitest';
import { agentGuide } from './agentGuide.js';

describe('agent briefing', () => {
  it('names the clideck commands agents should know, including background tasks', () => {
    const guide = agentGuide({ phone: false });
    for (const word of [
      'clideck title',
      'clideck preview',
      'clideck task run',
      'clideck sessions',
    ]) {
      expect(guide).toContain(word);
    }
  });

  it('tells agents about the phone only when the user turned phone access on', () => {
    expect(agentGuide({ phone: false })).not.toMatch(/PHONE|clideck phone/);
    const on = agentGuide({ phone: true });
    expect(on).toContain('clideck phone help');
    expect(on).toMatch(/Do not say you cannot reach the phone/);
  });

  it('tells agents about paired devices only when there are some', () => {
    expect(agentGuide({ phone: false })).not.toContain('paired with this deck');
    expect(agentGuide({ phone: false })).toContain('clideck device here');
    const guide = agentGuide({ phone: false, devices: ['Meu PC'] });
    expect(guide).toContain('paired with this deck: Meu PC');
    expect(guide).toContain('clideck device <name> run');
    expect(guide).toContain('clideck copy');
  });
});
