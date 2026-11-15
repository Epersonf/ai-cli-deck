import { describe, expect, it } from 'vitest';
import { agentGuide } from './agentGuide.js';
import { codexGuide } from './codexGuide.js';

describe('compact Codex briefing', () => {
  it('reduces the deck briefing while retaining command discovery and permissions', () => {
    const options = { phone: true, devices: ['PC'] };
    const guide = codexGuide(options);
    expect(guide.length).toBeLessThan(agentGuide(options).length * 0.65);
    for (const command of [
      'clideck help',
      'clideck title',
      'clideck phone help',
      'clideck worktree',
      'clideck memory list',
      'clideck copy',
    ])
      expect(guide).toContain(command);
    expect(guide).toContain('never create one yourself');
    expect(guide).toContain('retrieve the missing ranges');
    expect(guide).toContain('PC');
  });
  it('does not advertise disabled phone access or paired devices', () => {
    const guide = codexGuide({ phone: false, devices: [] });
    expect(guide).not.toContain('Phone access');
    expect(guide).not.toContain('Paired devices');
  });
});
