import {
  EffortSchema,
  PermissionModeSchema,
  type ChatConfig,
  type PermissionMode,
} from '@deck/shared';
import { useT } from '../../shared/i18n/store';
import { Dropdown } from '../../shared/ui/Dropdown';
import { WarnIcon } from '../../shared/ui/GlyphIcons';
import { ChevronIcon } from '../../shared/ui/ShapeIcons';
import { sendChat } from './connection';
import { ModelDropdown } from './ModelDropdown';
import { useBarOpen } from './useBarOpen';
import { VoiceToggles } from './VoiceToggles';

const RISKY: readonly PermissionMode[] = ['bypassPermissions', 'dontAsk'];

/** Mode, model and effort of this chat, in one tidy row; a change applies from the next message. Can be folded. */
export function ModeModelBar({ sessionId, config }: { sessionId: string; config: ChatConfig }) {
  const t = useT();
  const [open, setOpen] = useBarOpen();
  const mode = t(`chat.mode.${config.mode}`);
  const effort =
    config.effort === null ? t('chat.effortDefault') : t(`chat.effort.${config.effort}`);

  if (!open) {
    const model = config.effectiveModel ?? config.model;
    const label = config.modelChoices.find((c) => c.id === model)?.label ?? model;
    return (
      <div className="mode-bar collapsed">
        <button
          type="button"
          className="plate chip"
          title={t('chat.options.show')}
          onClick={() => setOpen(true)}
        >
          <span className="plate-text">
            <span>{[mode, label ?? t('chat.modelDefault'), effort].join(' · ')}</span>
          </span>
          <ChevronIcon size={14} open />
        </button>
      </div>
    );
  }
  return (
    <div className="mode-bar">
      <Dropdown
        caption={t('chat.mode')}
        value={config.mode}
        options={PermissionModeSchema.options.map((m) => ({
          id: m,
          label: t(`chat.mode.${m}`),
          description: t(`chat.modeHint.${m}`),
        }))}
        onChange={(id) => {
          const next = PermissionModeSchema.safeParse(id);
          if (next.success) sendChat(sessionId, { type: 'config', mode: next.data });
        }}
      />
      <ModelDropdown sessionId={sessionId} config={config} />
      <Dropdown
        caption={t('chat.effort')}
        value={config.effort ?? ''}
        options={[
          { id: '', label: t('chat.effortDefault') },
          ...EffortSchema.options.map((e) => ({ id: e, label: t(`chat.effort.${e}`) })),
        ]}
        onChange={(id) => {
          const next = EffortSchema.safeParse(id);
          sendChat(sessionId, { type: 'config', effort: next.success ? next.data : null });
        }}
      />
      <div className="bar-tools">
        <VoiceToggles />
        <button
          type="button"
          className="icon-toggle quiet"
          title={t('chat.options.hide')}
          aria-label={t('chat.options.hide')}
          onClick={() => setOpen(false)}
        >
          <ChevronIcon size={16} open />
        </button>
      </div>
      {RISKY.includes(config.mode) && (
        <p className="risk-strip" role="note">
          <WarnIcon size={14} /> {t(`chat.modeHint.${config.mode}`)}
        </p>
      )}
    </div>
  );
}
