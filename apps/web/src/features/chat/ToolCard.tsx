import { useState } from 'react';
import { useT } from '../../shared/i18n/store';
import type { Block } from './blocks';
import { ToolGlyph } from './ToolGlyph';
import { editParts, inputText, summarize } from './toolInfo';

type Tool = Extract<Block, { kind: 'tool' }>;

/** Output longer than this is cut in the card (the whole text is only a click away in the agent's files). */
const MAX_OUTPUT = 6000;

export function EditView({ name, input }: { name: string; input: unknown }) {
  const parts = editParts(name, input);
  if (parts.length === 0) return <pre className="tool-pre">{inputText(input)}</pre>;
  return (
    <div className="tool-diff">
      {parts.map((part, i) => (
        <div key={i} className="tool-diff-part">
          {part.before !== '' && <pre className="del">{part.before}</pre>}
          {part.after !== '' && <pre className="add">{part.after}</pre>}
        </div>
      ))}
    </div>
  );
}

/** One tool call: a line saying what it is doing, opened for its input and output. */
export function ToolCard({ block }: { block: Tool }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const { icon, title } = summarize(block.name, block.input);
  const missingWebDetails = block.name === 'web_search' && title === '';
  const shownTitle = missingWebDetails ? t('chat.tool.webUnknown') : title;
  const state = block.result === null ? 'running' : block.result.isError ? 'error' : 'done';
  const output = block.result?.output ?? '';
  const isEdit = editParts(block.name, block.input).length > 0;
  return (
    <div className={`tool-card ${state}`}>
      <button
        type="button"
        className="tool-head"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="tool-icon" aria-hidden>
          <ToolGlyph kind={icon} />
        </span>
        <strong>{block.name}</strong>
        <span className="tool-title">{shownTitle}</span>
        <span className="tool-state">{t(`chat.tool.${state}`)}</span>
      </button>
      {open && (
        <div className="tool-body">
          {isEdit ? (
            <EditView name={block.name} input={block.input} />
          ) : (
            <pre className="tool-pre">
              {missingWebDetails ? t('chat.tool.webUnknown') : inputText(block.input)}
            </pre>
          )}
          {output !== '' && (
            <pre className={`tool-pre out${state === 'error' ? ' err' : ''}`}>
              {output.length > MAX_OUTPUT ? `${output.slice(0, MAX_OUTPUT)}\n…` : output}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
