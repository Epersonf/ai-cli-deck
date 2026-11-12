import { useT } from '../../shared/i18n/store';
import { useVoice } from '../voice/voiceStore';
import { canSpeak } from './speech';

/** Read answers aloud, and talk to the agent hands-free (a transcribed message is sent at once). */
export function VoiceToggles() {
  const t = useT();
  const { speak, conversation, status, set } = useVoice();
  const canTalk = status?.supported === true && status.ready;
  if (!canSpeak() && !canTalk) return null;
  return (
    <>
      {canSpeak() && (
        <label className="check">
          <input
            type="checkbox"
            checked={speak}
            onChange={(e) => set({ speak: e.target.checked })}
          />
          {t('voice.readAloud')}
        </label>
      )}
      {canTalk && (
        <label className="check">
          <input
            type="checkbox"
            checked={conversation}
            onChange={(e) => set({ conversation: e.target.checked })}
          />
          {t('voice.conversation')}
        </label>
      )}
    </>
  );
}
