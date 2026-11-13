import { useT } from '../../shared/i18n/store';
import type { Suggestion } from './useSuggestions';

interface Props {
  items: readonly Suggestion[];
  index: number;
  onPick(item: Suggestion): void;
}

/** The completions above the message box: tap one (or arrows and Enter) to use it. */
export function SuggestList({ items, index, onPick }: Props) {
  const t = useT();
  return (
    <ul className="suggest-list" role="listbox" aria-label={t('cmd.sugg')}>
      {items.map((item, i) => (
        <li
          key={item.key}
          role="option"
          aria-selected={i === index}
          className={i === index ? 'active' : undefined}
          // The box keeps its focus (and its caret) while a suggestion is tapped.
          onMouseDown={(event) => {
            event.preventDefault();
            onPick(item);
          }}
        >
          <span className="suggest-label">{item.label}</span>
          <span className="suggest-detail">{item.detail}</span>
        </li>
      ))}
    </ul>
  );
}
