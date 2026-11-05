import type { QuickPrompt } from '@deck/shared';
import { useEffect } from 'react';
import { useT } from '../../shared/i18n/store';
import { usePrompts } from './promptsStore';

interface Props {
  onPrompt(prompt: QuickPrompt): void;
  onSearch(): void;
}

/** One scrollable row over the terminal's keys: search, then the saved prompts, each sent with a tap. */
export function QuickPrompts({ onPrompt, onSearch }: Props) {
  const t = useT();
  const prompts = usePrompts((s) => s.prompts);
  useEffect(
    () =>
      void usePrompts
        .getState()
        .load()
        .catch(() => undefined),
    [],
  );
  return (
    <div className="quick-prompts">
      <button type="button" className="chip" title={t('search.open')} onClick={onSearch}>
        ⌕
      </button>
      {prompts.map((prompt, i) => (
        <button
          key={`${i}-${prompt.label}`}
          type="button"
          className="chip"
          title={prompt.text}
          // Keep the keyboard where it is: a tap must not move focus off the terminal.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPrompt(prompt)}
        >
          {prompt.label}
        </button>
      ))}
    </div>
  );
}
