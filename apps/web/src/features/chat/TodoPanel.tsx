import { useState } from 'react';
import { useT } from '../../shared/i18n/store';
import { ChevronIcon } from '../../shared/ui/ShapeIcons';
import type { Block } from './blocks';
import { doneCount, todosOf } from './todos';

/** The agent's checklist, pinned above the conversation and collapsible; folded by itself once everything is done. */
export function TodoPanel({ blocks }: { blocks: readonly Block[] }) {
  const t = useT();
  const todos = todosOf(blocks);
  // `null`: follow the default (open while something is left); a tap overrides it.
  const [chosen, setChosen] = useState<boolean | null>(null);
  if (todos.length === 0) return null;
  const done = doneCount(todos);
  const open = chosen ?? done < todos.length;
  return (
    <section className="todo-panel" aria-label={t('chat.todos')}>
      <button
        type="button"
        className="todo-head"
        aria-expanded={open}
        onClick={() => setChosen(!open)}
      >
        <span className="todo-caret" aria-hidden>
          <ChevronIcon size={14} open={open} />
        </span>
        <strong>{t('chat.todos')}</strong>
        <span className="todo-count">
          {t('chat.todos.progress', { done, total: todos.length })}
        </span>
      </button>
      {open && (
        <ul className="todo-list">
          {todos.map((todo, i) => (
            <li key={`${i}-${todo.text}`} className={`todo ${todo.state}`}>
              <span className="todo-mark" aria-hidden />
              <span>{todo.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
