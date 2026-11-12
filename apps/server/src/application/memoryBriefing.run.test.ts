import { describe, expect, it } from 'vitest';
import { agentBody, createHarness } from '../testing/harness.js';

describe('memory in a new run', () => {
  it('is part of the briefing of the next run, global then own profile, and changes apply without a restart', async () => {
    const h = createHarness();
    await h.memory.notes.create({ scope: 'global', title: 'Tone', body: 'be brief' });
    await h.memory.notes.create({
      scope: 'profile',
      profileId: 'claude',
      title: 'Stack',
      body: 'pnpm',
    });
    await h.memory.notes.create({
      scope: 'profile',
      profileId: 'codex',
      title: 'Other',
      body: 'not for claude',
    });
    const { id } = await h.sessions.create(agentBody());
    await h.sessions.send(id, 'one');
    const guide = h.agent.last.spec.guide;
    expect(guide).toContain('Memory');
    expect(guide).toContain('Tone: be brief');
    expect(guide.indexOf('Tone: be brief')).toBeLessThan(guide.indexOf('Stack: pnpm'));
    expect(guide).not.toContain('not for claude');
    h.agent.last.reply('ok');
    expect(h.agent.runs).toHaveLength(1);
    await h.memory.notes.create({ scope: 'global', title: 'Late', body: 'added later' });
    // The open run keeps its briefing; the run that starts after it ends gets the new notes.
    h.agent.last.sink.ended();
    await h.sessions.send(id, 'two');
    expect(h.agent.last.spec.guide).toContain('Late: added later');
  });
});
