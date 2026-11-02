interface Values {
  command: string;
  args: string;
  useWorktree: boolean;
}

interface Props {
  provider: string;
  values: Values;
  onChange(values: Values): void;
}

const NEEDS_COMMAND = new Set(['custom']);

/** Optional launch settings: custom command, extra arguments and worktree permission. */
export function SessionOptions({ provider, values, onChange }: Props) {
  const set = (patch: Partial<Values>): void => onChange({ ...values, ...patch });
  return (
    <>
      {(NEEDS_COMMAND.has(provider) || provider === 'shell') && (
        <label>
          Command {provider === 'shell' ? '(optional, default shell)' : ''}
          <input
            value={values.command}
            onChange={(e) => set({ command: e.target.value })}
            placeholder="aider"
            required={NEEDS_COMMAND.has(provider)}
            autoCapitalize="off"
            spellCheck={false}
          />
        </label>
      )}
      <label>
        Extra arguments (optional)
        <input
          value={values.args}
          onChange={(e) => set({ args: e.target.value })}
          placeholder="--model fast"
          autoCapitalize="off"
          spellCheck={false}
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={values.useWorktree}
          onChange={(e) => set({ useWorktree: e.target.checked })}
        />
        Allow the agent to request a git worktree
      </label>
    </>
  );
}
