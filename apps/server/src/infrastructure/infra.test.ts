import { describe, expect, it } from 'vitest';
import { providerCtx } from '../testing/providerContext.js';
import { assertSecureBind } from './config/bind.js';
import { mergeConfig } from './config/loadConfig.js';
import { parseGitStatus } from './git/GitCli.js';
import { createClaudeLike } from './providers/claudeLike.js';
import { claudeDeepseek } from './providers/claudeDeepseek.js';
import { codex } from './providers/codex.js';
import { custom } from './providers/custom.js';
import { createProviderRegistry } from './providers/registry.js';
import { buildTmuxArgs } from './tmux/TmuxMultiplexer.js';

const ctx = providerCtx;

describe('providers', () => {
  it('claude injects the MCP endpoint via --mcp-config', () => {
    const claude = createClaudeLike('claude', 'Claude');
    const mcp = claude.buildMcpConfig(ctx);
    expect(mcp.args[0]).toBe('--mcp-config');
    expect(JSON.parse(mcp.args[1] ?? '{}')).toEqual({
      mcpServers: { deck: { type: 'http', url: ctx.mcpUrl } },
    });
  });

  it('claude tells the agent it runs inside the deck and how to use clideck', () => {
    const args = createClaudeLike('claude', 'Claude').buildMcpConfig(ctx).args;
    expect(args[2]).toBe('--append-system-prompt');
    expect(args[3]).toContain('clideck help');
  });

  it('claude-deepseek points Claude Code at DeepSeek and holds no key', () => {
    const env = claudeDeepseek.buildCommand(ctx).env;
    expect(env['ANTHROPIC_BASE_URL']).toBe('https://api.deepseek.com/anthropic');
    expect(JSON.stringify(env)).not.toMatch(/KEY|TOKEN/);
  });

  it('codex overrides mcp_servers and custom requires a command', () => {
    const args = codex.buildMcpConfig(ctx).args;
    expect(args.slice(0, 2)).toEqual(['-c', `mcp_servers.deck.url="${ctx.mcpUrl}"`]);
    expect(args[3]).toContain('developer_instructions=');
    expect(() => custom.buildCommand(ctx)).toThrow('command');
    expect(custom.buildCommand({ ...ctx, command: 'bash', args: ['-l'] }).args).toEqual(['-l']);
  });

  it('registry exposes the built-in providers', () => {
    const ids = createProviderRegistry()
      .list()
      .map((p) => p.id);
    expect(ids).toEqual(['shell', 'claude', 'codex', 'claude-deepseek', 'custom']);
  });
});

describe('tmux and git helpers', () => {
  it('builds a create-or-attach command on a private socket with the status bar off', () => {
    const args = buildTmuxArgs('deck-s1', {
      command: 'claude',
      args: ['-x'],
      env: { A: '1', TMUX: 'x' },
      cwd: '/w',
    });
    expect(args.slice(0, 3)).toEqual(['-u', '-L', 'deck']);
    const at = args.indexOf('new-session');
    expect(args.slice(at, at + 6)).toEqual(['new-session', '-A', '-s', 'deck-s1', '-c', '/w']);
    expect(args).toContain('A=1');
    expect(args).not.toContain('TMUX=x');
    expect(args.slice(args.indexOf('claude'), args.indexOf('claude') + 2)).toEqual([
      'claude',
      '-x',
    ]);
    expect(args.indexOf('status')).toBeLessThan(at);
  });

  it('parses porcelain status', () => {
    const out = '## main...origin/main\n M src/a.ts\n?? new.txt\n';
    expect(parseGitStatus(out)).toEqual({
      isRepo: true,
      branch: 'main',
      changes: [
        { code: 'M', path: 'src/a.ts' },
        { code: '??', path: 'new.txt' },
      ],
    });
  });
});

describe('config and bind safety', () => {
  it('merges env over the config file with defaults', () => {
    expect(mergeConfig({ port: 9000 }, {}).port).toBe(9000);
    expect(mergeConfig({ port: 9000 }, { DECK_PORT: 9100 }).port).toBe(9100);
    expect(mergeConfig(null, {})).toMatchObject({ host: '127.0.0.1' });
  });

  it('refuses to listen beyond loopback without a password', () => {
    expect(() => assertSecureBind('0.0.0.0', false)).toThrow('without a password');
    expect(() => assertSecureBind('0.0.0.0', true)).not.toThrow();
    expect(() => assertSecureBind('127.0.0.1', false)).not.toThrow();
  });
});
