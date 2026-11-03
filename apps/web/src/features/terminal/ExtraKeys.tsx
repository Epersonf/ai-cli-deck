import { useT } from '../../shared/i18n/store';
import { KeyButton } from './KeyButton';
import { sequenceFor } from './keymap';
import type { ModifiersApi } from './useModifiers';

export const DEFAULT_KEYS: readonly string[] = [
  ...['ESC', '/', '-', '|', 'HOME', 'UP', 'END', 'PGUP'],
  ...['TAB', 'CTRL', 'ALT', '~', 'LEFT', 'DOWN', 'RIGHT', 'PGDN'],
];
const ROW_SIZE = 8;
const LABELS: Readonly<Record<string, string>> = {
  UP: '↑',
  DOWN: '↓',
  LEFT: '←',
  RIGHT: '→',
};
const REPEATABLE = new Set(['UP', 'DOWN', 'LEFT', 'RIGHT', 'PGUP', 'PGDN', 'TAB']);

/** Keys for moving around the screen: they shouldn't pop the on-screen keyboard open. */
const NAVIGATION = new Set(['PGUP', 'PGDN', 'HOME', 'END', 'UP', 'DOWN', 'LEFT', 'RIGHT']);
const typing = (): HTMLElement | null => {
  const el = document.activeElement;
  return el instanceof HTMLElement && el.classList.contains('xterm-helper-textarea') ? el : null;
};

interface Props {
  keys: readonly string[] | null;
  mods: ModifiersApi;
  send(data: string): void;
  applicationCursor(): boolean;
}

export function chunkKeys(keys: readonly string[], size: number): string[][] {
  const rows: string[][] = [];
  for (let i = 0; i < keys.length; i += size) rows.push(keys.slice(i, i + size));
  return rows;
}

/** Termux-style extra keys row(s): ESC, TAB, sticky CTRL/ALT, HOME/END, PGUP/PGDN, arrows. */
export function ExtraKeys({ keys, mods, send, applicationCursor }: Props) {
  const t = useT();
  const press = (key: string): void => {
    if (key === 'CTRL') return mods.tap('ctrl');
    if (key === 'ALT') return mods.tap('alt');
    const keyboardWasOpen = typing() !== null;
    send(sequenceFor(key, mods.take(), { applicationCursor: applicationCursor() }));
    if (NAVIGATION.has(key) && !keyboardWasOpen) requestAnimationFrame(() => typing()?.blur());
  };
  const state = (key: string) => (key === 'CTRL' ? mods.ctrl : key === 'ALT' ? mods.alt : null);

  return (
    <div className="extra-keys" role="toolbar" aria-label={t('keys.aria')}>
      {chunkKeys(keys ?? DEFAULT_KEYS, ROW_SIZE).map((row) => (
        <div className="extra-keys-row" key={row.join('')}>
          {row.map((key) => (
            <KeyButton
              key={key}
              label={LABELS[key] ?? key}
              active={state(key)?.mode !== undefined && state(key)?.mode !== 'off'}
              locked={state(key)?.mode === 'locked'}
              repeat={REPEATABLE.has(key)}
              onPress={() => press(key)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
