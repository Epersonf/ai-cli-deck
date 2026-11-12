import type { ChatConfig } from '@deck/shared';
import { useT } from '../../shared/i18n/store';
import { Dropdown } from '../../shared/ui/Dropdown';
import type { DropOption } from '../../shared/ui/DropList';
import { useProfiles } from '../sessions/profilesStore';
import { useSessions } from '../sessions/sessionsStore';
import { sendChat } from './connection';
import { ModelFooter } from './ModelFooter';

const AGENT_DEFAULT = '__agent-default';

/** The model of this chat: what is answering now on the plate, the agent's list in the popover. */
export function ModelDropdown({ sessionId, config }: { sessionId: string; config: ChatConfig }) {
  const t = useT();
  const provider = useSessions((s) => s.sessions.find((x) => x.id === sessionId)?.provider ?? '');
  const profile = useProfiles((s) => s.providers.find((p) => p.id === provider)?.label ?? '');
  const labelOf = (id: string): string => config.modelChoices.find((c) => c.id === id)?.label ?? id;
  const inUse = config.effectiveModel ?? config.model;
  const tag = t('chat.model.isDefault');

  const options: DropOption[] = [
    {
      id: AGENT_DEFAULT,
      label: t('chat.modelDefault'),
      description: config.effectiveModel === null ? null : labelOf(config.effectiveModel),
      ...(config.defaultModel === null ? { tag } : {}),
    },
    ...(config.model !== null && !config.modelChoices.some((c) => c.id === config.model)
      ? [{ id: config.model, label: config.model }]
      : []),
    ...config.modelChoices.map((c) => ({
      id: c.id,
      label: c.label,
      description: c.description,
      ...(c.id === config.defaultModel ? { tag } : {}),
    })),
  ];
  const choose = (id: string): void =>
    sendChat(sessionId, { type: 'config', model: id === AGENT_DEFAULT ? null : id });

  return (
    <Dropdown
      caption={t('chat.model')}
      value={config.model ?? AGENT_DEFAULT}
      valueText={inUse === null ? t('chat.modelDefault') : labelOf(inUse)}
      options={options}
      onChange={choose}
      footer={(close) => (
        <ModelFooter
          config={config}
          provider={provider}
          profile={profile}
          onUse={(id) => (choose(id), close())}
        />
      )}
    />
  );
}
