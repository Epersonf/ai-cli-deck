import { EffortSchema, PermissionModeSchema, type ChatConfig } from '@deck/shared';
import { useT } from '../../shared/i18n/store';
import { ChevronIcon } from '../../shared/ui/ShapeIcons';
import { sendChat } from './connection';
import { ModelPicker } from './ModelPicker';
import { useBarOpen } from './useBarOpen';
import { VoiceToggles } from './VoiceToggles';

const MODES = PermissionModeSchema.options;
const EFFORTS = EffortSchema.options;

/** Model, permission mode and effort of this chat; a change applies from the next message. Can be folded away. */
export function ModeModelBar({ sessionId, config }: { sessionId: string; config: ChatConfig }) {
  const t = useT();
  const [open, setOpen] = useBarOpen();
  if (!open) {
    const model = config.effectiveModel ?? config.model;
    const summary = [
      t(`chat.mode.${config.mode}`),
      model === null
        ? t('chat.modelDefault')
        : (config.modelChoices.find((c) => c.id === model)?.label ?? model),
      config.effort === null ? t('chat.effortDefault') : t(`chat.effort.${config.effort}`),
    ].join(' · ');
    return (
      <button
        type="button"
        className="mode-chip"
        title={t('chat.options.show')}
        onClick={() => setOpen(true)}
      >
        <ChevronIcon size={14} /> {summary}
      </button>
    );
  }
  return (
    <div className="mode-bar">
      <button
        type="button"
        className="mode-hide"
        title={t('chat.options.hide')}
        aria-label={t('chat.options.hide')}
        onClick={() => setOpen(false)}
      >
        <ChevronIcon size={14} open />
      </button>
      <label title={t(`chat.modeHint.${config.mode}`)}>
        <span>{t('chat.mode')}</span>
        <select
          value={config.mode}
          onChange={(e) => {
            const mode = PermissionModeSchema.safeParse(e.target.value);
            if (mode.success) sendChat(sessionId, { type: 'config', mode: mode.data });
          }}
        >
          {MODES.map((mode) => (
            <option key={mode} value={mode} title={t(`chat.modeHint.${mode}`)}>
              {t(`chat.mode.${mode}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{t('chat.model')}</span>
        <ModelPicker sessionId={sessionId} config={config} />
      </label>
      <VoiceToggles />
      <label>
        <span>{t('chat.effort')}</span>
        <select
          value={config.effort ?? ''}
          onChange={(e) => {
            const effort = EffortSchema.safeParse(e.target.value);
            sendChat(sessionId, { type: 'config', effort: effort.success ? effort.data : null });
          }}
        >
          <option value="">{t('chat.effortDefault')}</option>
          {EFFORTS.map((effort) => (
            <option key={effort} value={effort}>
              {t(`chat.effort.${effort}`)}
            </option>
          ))}
        </select>
      </label>
      <p className="hint mode-hint">{t(`chat.modeHint.${config.mode}`)}</p>
    </div>
  );
}
