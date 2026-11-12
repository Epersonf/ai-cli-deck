import { useState } from 'react';
import { useT } from '../../shared/i18n/store';
import { ModalTitle } from '../../shared/ui/ModalTitle';
import type { Block } from './blocks';
import { sendChat } from './connection';

type Permission = Extract<Block, { kind: 'permission' }>;

interface Question {
  question: string;
  header?: string | undefined;
  multiSelect?: boolean;
  options: { label: string; description?: string }[];
}

/** The questions of the agent's AskUserQuestion tool, read defensively from its input. */
function questionsOf(input: unknown): Question[] {
  const list = (input as { questions?: unknown } | null)?.questions;
  if (!Array.isArray(list)) return [];
  return list.flatMap((q: Partial<Question> | null) =>
    q && typeof q.question === 'string' && Array.isArray(q.options)
      ? [
          {
            question: q.question,
            header: q.header,
            multiSelect: q.multiSelect === true,
            options: q.options.filter((o) => typeof o?.label === 'string'),
          },
        ]
      : [],
  );
}

/** The agent asks the person to choose: the picks go back as the tool's answers. */
export function QuestionCard({ block, sessionId }: { block: Permission; sessionId: string }) {
  const t = useT();
  const questions = questionsOf(block.input);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [other, setOther] = useState<Record<string, string>>({});
  const pending = block.state === 'pending';
  const [open, setOpen] = useState(true);

  const toggle = (q: Question, label: string): void =>
    setPicked((old) => {
      const cur = old[q.question] ?? [];
      const next = q.multiSelect
        ? cur.includes(label)
          ? cur.filter((l) => l !== label)
          : [...cur, label]
        : [label];
      return { ...old, [q.question]: next };
    });

  const answerOf = (q: Question): string => {
    const text = other[q.question]?.trim();
    return [...(picked[q.question] ?? []), ...(text ? [text] : [])].join(', ');
  };
  const ready = questions.length > 0 && questions.every((q) => answerOf(q) !== '');
  const submit = (): void =>
    sendChat(sessionId, {
      type: 'permission',
      id: block.id,
      allow: true,
      answers: Object.fromEntries(questions.map((q) => [q.question, answerOf(q)])),
    });
  const skip = (): void => sendChat(sessionId, { type: 'permission', id: block.id, allow: false });

  const body = (
    <>
      {questions.map((q) => (
        <div key={q.question}>
          {q.header && <p className="hint">{q.header}</p>}
          <strong>{q.question}</strong>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {q.options.map((o) => (
              <button
                key={o.label}
                type="button"
                disabled={!pending}
                className={picked[q.question]?.includes(o.label) ? 'primary' : undefined}
                title={o.description}
                onClick={() => toggle(q, o.label)}
              >
                {o.label}
              </button>
            ))}
          </div>
          {pending && (
            <input
              type="text"
              value={other[q.question] ?? ''}
              placeholder="…"
              onChange={(e) => setOther((old) => ({ ...old, [q.question]: e.target.value }))}
            />
          )}
        </div>
      ))}
      {pending ? (
        <div className="row">
          <button type="button" className="primary" disabled={!ready} onClick={submit}>
            {t('chat.send')}
          </button>
          <button type="button" className="danger" onClick={skip}>
            {t('chat.permission.deny')}
          </button>
        </div>
      ) : (
        <p className="permission-result">
          {block.state === 'allowed' ? t('chat.permission.allowed') : t('chat.permission.denied')}
        </p>
      )}
    </>
  );

  if (pending && open)
    return (
      <div className="modal-backdrop" onClick={() => setOpen(false)}>
        <div className="modal" onClick={(event) => event.stopPropagation()}>
          <ModalTitle
            title={questions[0]?.header ?? t('chat.permission')}
            onClose={() => setOpen(false)}
          />
          {body}
        </div>
      </div>
    );
  return (
    <div className={`permission-card ${block.state}`} role="group">
      {body}
    </div>
  );
}
