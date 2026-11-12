import { describe, expect, it } from 'vitest';
import type { AgentSpec } from '../../domain/agent.js';
import { codexArgs } from './codexArgs.js';

describe('Codex exec arguments', () => {
  const spec: AgentSpec = {
    kind: 'codex',
    cwd: '/w',
    env: {},
    model: 'gpt-5',
    mode: 'plan',
    effort: 'high',
    resumeId: null,
    fork: false,
    resumeAt: null,
    dropsTurn: null,
    mcpUrl: 'http://127.0.0.1:1/mcp/s',
    guide: 'say "hi"\nplease',
  };

  it('starts a thread read-only in plan mode, with the deck MCP server and briefing', () => {
    const args = codexArgs(spec, null);
    expect(args.slice(0, 3)).toEqual(['exec', '--json', '--skip-git-repo-check']);
    expect(args).toContain('sandbox_mode="read-only"');
    expect(args).toContain('approval_policy="never"');
    expect(args).toContain('mcp_servers.deck.url="http://127.0.0.1:1/mcp/s"');
    expect(args).toContain('developer_instructions="say \\"hi\\"\\nplease"');
    expect(args).toContain('model_reasoning_effort="high"');
    expect(args.slice(args.indexOf('-m'), args.indexOf('-m') + 2)).toEqual(['-m', 'gpt-5']);
  });

  it('resumes a thread, and maps the other modes to sandboxes', () => {
    expect(codexArgs({ ...spec, mode: 'default' }, 'th-1').slice(0, 3)).toEqual([
      'exec',
      'resume',
      'th-1',
    ]);
    expect(codexArgs({ ...spec, mode: 'acceptEdits' }, null)).toContain(
      'sandbox_mode="workspace-write"',
    );
    expect(codexArgs({ ...spec, mode: 'bypassPermissions' }, null)).toContain(
      'sandbox_mode="danger-full-access"',
    );
  });
});
