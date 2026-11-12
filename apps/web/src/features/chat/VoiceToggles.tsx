import { useT } from '../../shared/i18n/store';
import { MicIcon } from '../../shared/ui/GlyphIcons';
import { SpeakerIcon } from '../../shared/ui/ToolIcons';
import { useVoice } from '../voice/voiceStore';
import { canSpeak } from './speech';

/** Read answers aloud, and talk to the agent hands-free: two icon toggles with a pressed state. */
export function VoiceToggles() {
  const t = useT();
  const { speak, conversation, status, set } = useVoice();
  const canTalk = status?.supported === true && status.ready;
  return (
    <>
      {canSpeak() && (
        <button
          type="button"
          className="icon-toggle"
          aria-pressed={speak}
          title={t('voice.readAloud')}
          aria-label={t('voice.readAloud')}
          onClick={() => set({ speak: !speak })}
        >
          <SpeakerIcon size={18} />
        </button>
      )}
      {canTalk && (
        <button
          type="button"
          className="icon-toggle"
          aria-pressed={conversation}
          title={t('voice.conversation')}
          aria-label={t('voice.conversation')}
          onClick={() => set({ conversation: !conversation })}
        >
          <MicIcon size={18} />
        </button>
      )}
    </>
  );
}
