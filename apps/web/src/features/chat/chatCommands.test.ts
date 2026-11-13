import type { ChatConfig } from '@deck/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  COMMANDS,
  commandOf,
  matchCommands,
  parseCommand,
  type CommandContext,
} from './chatCommands';

const config = {
  agent: 'claude',
  model: null,
  effectiveModel: null,
  defaultModel: null,
  mode: 'default',
  effort: null,
  modelChoices: [{ id: 'fast-1', label: 'Fast', description: null }],
  chatId: null,
} as ChatConfig;

function context(over: Partial<CommandContext> = {}): CommandContext {
  return {
    config,
    lastAnswer: () => 'last',
    transcript: () => 'all',
    say: vi.fn(),
    interrupt: vi.fn(),
    setConfig: vi.fn(),
    show: vi.fn(),
    copy: vi.fn(),
    openFork: vi.fn(),
    toast: vi.fn(),
    ...over,
  };
}
const run = (text: string, ctx: CommandContext): boolean => {
  const found = commandOf(text);
  found?.command.run(ctx, found.arg);
  return found !== null;
};

describe('reading a command', () => {
  it('splits the name and the rest', () => {
    expect(parseCommand('/model fast')).toEqual({ name: 'model', arg: 'fast' });
    expect(parseCommand('  /Copy   all ')).toEqual({ name: 'copy', arg: 'all' });
    expect(parseCommand('/stop')).toEqual({ name: 'stop', arg: '' });
    expect(parseCommand('hello /x')).toBeNull();
    expect(parseCommand('/')).toBeNull();
  });

  it('leaves unknown commands for the agent', () => {
    expect(commandOf('/compact')).toBeNull();
    expect(commandOf('/review the diff')).toBeNull();
    expect(commandOf('/stop')?.command.name).toBe('stop');
  });

  it('has unique names with a description', () => {
    const names = COMMANDS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    expect(COMMANDS.every((c) => c.desc.startsWith('cmd.'))).toBe(true);
  });
});

describe('the menu', () => {
  it('lists prefix matches before the others', () => {
    expect(matchCommands('').length).toBe(COMMANDS.length);
    expect(
      matchCommands('c')
        .map((c) => c.name)
        .slice(0, 2),
    ).toEqual(['changes', 'copy']);
    expect(matchCommands('mo').map((c) => c.name)).toEqual(['model', 'mode']);
    expect(matchCommands('zzz')).toEqual([]);
  });
});

describe('running commands', () => {
  it('stops, shows views and forks', () => {
    const ctx = context();
    run('/stop', ctx);
    run('/files', ctx);
    run('/preview', ctx);
    run('/fork', ctx);
    expect(ctx.interrupt).toHaveBeenCalled();
    expect(ctx.show).toHaveBeenNthCalledWith(1, 'files');
    expect(ctx.show).toHaveBeenNthCalledWith(2, 'preview');
    expect(ctx.openFork).toHaveBeenCalled();
  });

  it('sets the model by id or label, and back to default', () => {
    const ctx = context();
    run('/model Fast', ctx);
    run('/model other-id', ctx);
    run('/model default', ctx);
    expect(ctx.setConfig).toHaveBeenNthCalledWith(1, { model: 'fast-1' });
    expect(ctx.setConfig).toHaveBeenNthCalledWith(2, { model: 'other-id' });
    expect(ctx.setConfig).toHaveBeenNthCalledWith(3, { model: null });
  });

  it('only accepts the modes and efforts this agent offers', () => {
    const ctx = context();
    run('/mode plan', ctx);
    run('/mode nonsense', ctx);
    run('/effort high', ctx);
    run('/effort', ctx);
    expect(ctx.setConfig).toHaveBeenCalledTimes(2);
    expect(ctx.setConfig).toHaveBeenNthCalledWith(1, { mode: 'plan' });
    expect(ctx.setConfig).toHaveBeenNthCalledWith(2, { effort: 'high' });
    expect(ctx.toast).toHaveBeenCalled();
  });

  it('copies the last answer or everything, and asks for a summary', () => {
    const ctx = context();
    run('/copy', ctx);
    run('/copy all', ctx);
    run('/summarize', ctx);
    expect(ctx.copy).toHaveBeenNthCalledWith(1, 'last');
    expect(ctx.copy).toHaveBeenNthCalledWith(2, 'all');
    expect(ctx.say).toHaveBeenCalledWith(expect.stringContaining('Summarize our conversation'));
  });
});
