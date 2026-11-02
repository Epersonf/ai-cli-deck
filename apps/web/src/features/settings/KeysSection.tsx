import type { KeysMode } from '../terminal/keysPreference';

interface Props {
  mode: KeysMode;
  touchScreen: boolean;
  onChange(mode: KeysMode): void;
}

const OPTIONS: ReadonlyArray<{ mode: KeysMode; label: string; help: string }> = [
  {
    mode: 'auto',
    label: 'Automatic',
    help: 'Show on touch screens, hide on a computer with a keyboard.',
  },
  { mode: 'on', label: 'Always show', help: 'Show the keys bar on every device.' },
  { mode: 'off', label: 'Never show', help: 'Hide it everywhere and use the real keyboard.' },
];

/** Explains the on-screen keys bar (Esc, Tab, Ctrl, arrows...) and lets the user force it. */
export function KeysSection({ mode, touchScreen, onChange }: Props) {
  return (
    <fieldset className="setting">
      <legend>On-screen terminal keys</legend>
      <p className="hint">
        The row of Esc, Tab, Ctrl, Alt, Home/End and arrow keys under the terminal. This device
        looks like {touchScreen ? 'a touch screen' : 'a computer with a keyboard'}.
      </p>
      {OPTIONS.map((option) => (
        <label className="choice" key={option.mode}>
          <input
            type="radio"
            name="keys-mode"
            checked={mode === option.mode}
            onChange={() => onChange(option.mode)}
          />
          <span>
            <strong>{option.label}</strong>
            <small>{option.help}</small>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
