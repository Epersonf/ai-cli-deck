import { useT } from '../../shared/i18n/store';
import type { Block } from './blocks';
import { sendChat } from './connection';
import { EditView } from './ToolCard';
import { ToolGlyph } from './ToolGlyph';
import { editParts, inputText, summarize } from './toolInfo';

type Permission = Extract<Block, { kind: 'permission' }>;

/** The agent asks before using a tool: what it wants to do, and the person's answer. */
export function PermissionCard({ block, sessionId }: { block: Permission; sessionId: string }) {
  const t = useT();
  const { icon, title } = summarize(block.tool, block.input);
  const answer = (allow: boolean, always = false): void =>
    sendChat(sessionId, { type: 'permission', id: block.id, allow, always });
  const isEdit = editParts(block.tool, block.input).length > 0;
  return (
    <div
      className={`permission-card ${block.state}`}
      role="group"
      aria-label={t('chat.permission')}
    >
      <div className="permission-head">
        <span className="tool-icon" aria-hidden>
          <ToolGlyph kind={icon} />
        </span>
        <strong>{t('chat.permission.ask', { tool: block.tool })}</strong>
      </div>
      {block.reason !== null && <p className="hint">{block.reason}</p>}
      {title !== '' && <code className="permission-title">{title}</code>}
      <details>
        <summary>{t('chat.permission.details')}</summary>
        {isEdit ? (
          <EditView name={block.tool} input={block.input} />
        ) : (
          <pre className="tool-pre">{inputText(block.input)}</pre>
        )}
      </details>
      {block.state === 'pending' ? (
        <div className="row">
          <button type="button" className="primary" onClick={() => answer(true)}>
            {t('chat.permission.allow')}
          </button>
          {block.canAlways && (
            <button type="button" onClick={() => answer(true, true)}>
              {t('chat.permission.always')}
            </button>
          )}
          <button type="button" className="danger" onClick={() => answer(false)}>
            {t('chat.permission.deny')}
          </button>
        </div>
      ) : (
        <p className="permission-result">
          {block.state === 'allowed' ? t('chat.permission.allowed') : t('chat.permission.denied')}
        </p>
      )}
    </div>
  );
}
