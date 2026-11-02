export type ApiKeyName = 'anthropic' | 'openai' | 'deepseek';

/** How to install and sign in to a built-in CLI; drives both the status check and `clideck setup`. */
export interface SetupSpec {
  id: string;
  label: string;
  binary: string;
  install: readonly string[] | null;
  /** Command that starts an account login (interactive, runs in the terminal). */
  accountLogin: readonly string[] | null;
  apiKey: { name: ApiKeyName; envVar: string } | null;
  /** Files (relative to the home directory) that exist once the CLI is signed in. */
  credentialFiles: readonly string[];
  note: string | null;
}

const CLAUDE_INSTALL = ['npm', 'install', '-g', '@anthropic-ai/claude-code'] as const;

export const SETUP_SPECS: readonly SetupSpec[] = [
  {
    id: 'claude',
    label: 'Claude Code',
    binary: 'claude',
    install: CLAUDE_INSTALL,
    accountLogin: ['claude'],
    apiKey: { name: 'anthropic', envVar: 'ANTHROPIC_API_KEY' },
    credentialFiles: ['.claude/.credentials.json'],
    note: 'Claude will open: type /login there, finish the sign-in, then /exit.',
  },
  {
    id: 'codex',
    label: 'Codex',
    binary: 'codex',
    install: ['npm', 'install', '-g', '@openai/codex'],
    accountLogin: ['codex', 'login'],
    apiKey: { name: 'openai', envVar: 'OPENAI_API_KEY' },
    credentialFiles: ['.codex/auth.json'],
    note: null,
  },
  {
    id: 'claude-deepseek',
    label: 'Claude Code (DeepSeek)',
    binary: 'claude',
    install: CLAUDE_INSTALL,
    accountLogin: null,
    apiKey: { name: 'deepseek', envVar: 'DEEPSEEK_API_KEY' },
    credentialFiles: [],
    note: 'Runs the Claude Code CLI against the DeepSeek API, so it needs a DeepSeek key.',
  },
];

export const setupSpecFor = (id: string): SetupSpec | undefined =>
  SETUP_SPECS.find((spec) => spec.id === id);
