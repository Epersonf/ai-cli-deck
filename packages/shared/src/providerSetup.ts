/**
 * How to download a built-in CLI. Signing in is NEVER handled here: every CLI runs its own
 * login the first time it starts, in the terminal, and we only display it.
 */
export interface SetupSpec {
  id: string;
  label: string;
  /** Executable that must be in PATH for sessions of this provider to start. */
  binary: string;
  install: readonly string[] | null;
}

const CLAUDE_INSTALL = ['npm', 'install', '-g', '@anthropic-ai/claude-code'] as const;

export const SETUP_SPECS: readonly SetupSpec[] = [
  { id: 'claude', label: 'Claude Code', binary: 'claude', install: CLAUDE_INSTALL },
  {
    id: 'codex',
    label: 'Codex',
    binary: 'codex',
    install: ['npm', 'install', '-g', '@openai/codex'],
  },
  {
    id: 'claude-deepseek',
    label: 'Claude Code (DeepSeek)',
    binary: 'claude',
    install: CLAUDE_INSTALL,
  },
];

export const setupSpecFor = (id: string): SetupSpec | undefined =>
  SETUP_SPECS.find((spec) => spec.id === id);
