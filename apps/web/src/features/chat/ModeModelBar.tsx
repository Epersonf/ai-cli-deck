import {
  AGENT_EFFORTS,
  AGENT_MODES,
  AutoCompactSchema,
  EffortSchema,
  PermissionModeSchema,
  type ChatConfig,
} from '@deck/shared';
import { useT } from '../../shared/i18n/store';
import { Dropdown } from '../../shared/ui/Dropdown';
import { WarnIcon } from '../../shared/ui/GlyphIcons';
import { sendChat } from './connection';
import { autoCompactId, autoCompactOptions } from './autoCompactOptions';
import { ModelDropdown } from './ModelDropdown';
import { RISKY } from './risky';
import { useBarOpen } from './useBarOpen';
import { VoiceToggles } from './VoiceToggles';

/** Mode, model and effort of this chat, in one tidy row; a change applies from the next message. Can be folded. */
export function ModeModelBar({ sessionId, config }: { sessionId: string; config: ChatConfig }) {
  const t = useT();
  const [open] = useBarOpen();

  if (!open) return null;
  return (
    <div className="mode-bar">
      <Dropdown
        caption={t('chat.mode')}
        value={config.mode}
        options={(config.features?.modes ?? AGENT_MODES[config.agent] ?? ['default' as const]).map(
          (m) => ({
            id: m,
            label: t(`chat.mode.${m}`),
            description: t(`chat.modeHint.${m}`),
          }),
        )}
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
          ...(config.features?.efforts ?? AGENT_EFFORTS[config.agent] ?? []).map((e) => ({
            id: e,
            label: t(`chat.effort.${e}`),
          })),
        ]}
        onChange={(id) => {
          const next = EffortSchema.safeParse(id);
          sendChat(sessionId, { type: 'config', effort: next.success ? next.data : null });
        }}
      />
      <Dropdown
        caption={t('chat.autoCompact')}
        value={autoCompactId(config.autoCompact)}
        options={autoCompactOptions(config, t('chat.effortDefault'), t('chat.autoCompact.off'))}
        onChange={(id) => {
          const next = AutoCompactSchema.safeParse(id === 'off' ? id : Number(id));
          sendChat(sessionId, { type: 'config', autoCompact: next.success ? next.data : null });
        }}
      />
      <div className="bar-tools">
        <VoiceToggles />
      </div>
      {RISKY.includes(config.mode) && (
        <p className="risk-strip" role="note">
          <WarnIcon size={14} /> {t(`chat.modeHint.${config.mode}`)}
        </p>
      )}
    </div>
  );
}
