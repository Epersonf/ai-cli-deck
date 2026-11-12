import type { ChatConfig } from '@deck/shared';
import { useState } from 'react';
import { useT } from '../../shared/i18n/store';
import { useProfiles } from '../sessions/profilesStore';
import { useSessions } from '../sessions/sessionsStore';
import { sendChat } from './connection';
import { ModelSheet } from './ModelSheet';

/** The model answering now (as the agent reported it); the list and the default live in a sheet. */
export function ModelPicker({ sessionId, config }: { sessionId: string; config: ChatConfig }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const provider = useSessions((s) => s.sessions.find((x) => x.id === sessionId)?.provider ?? '');
  const profileLabel = useProfiles((s) => s.providers.find((p) => p.id === provider)?.label ?? '');
  const labelOf = (id: string): string => config.modelChoices.find((c) => c.id === id)?.label ?? id;
  const inUse = config.effectiveModel ?? config.model;
  const choose = (model: string | null): void => {
    sendChat(sessionId, { type: 'config', model });
    setOpen(false);
  };
  return (
    <>
      <button
        type="button"
        className="model-btn"
        title={t('chat.model')}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {inUse === null ? t('chat.modelDefault') : labelOf(inUse)}
      </button>
      {open && (
        <ModelSheet
          config={config}
          provider={provider}
          profileLabel={profileLabel}
          labelOf={labelOf}
          onChoose={choose}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
