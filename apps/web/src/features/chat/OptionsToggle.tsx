import { useT } from '../../shared/i18n/store';
import { SlidersIcon } from '../../shared/ui/Icons';
import { useChat } from './chatStore';
import { RISKY } from './risky';
import { useBarOpen } from './useBarOpen';

/** The one small button in the composer row that folds the mode / model / effort bar; its tooltip is the summary. */
export function OptionsToggle({ sessionId }: { sessionId: string }) {
  const t = useT();
  const config = useChat(sessionId).config;
  const [open, setOpen] = useBarOpen();
  if (!config) return null;
  const model = config.effectiveModel ?? config.model;
  const modelLabel = config.modelChoices.find((c) => c.id === model)?.label ?? model;
  const effort =
    config.effort === null ? t('chat.effortDefault') : t(`chat.effort.${config.effort}`);
  const summary = [
    t(`chat.mode.${config.mode}`),
    modelLabel ?? t('chat.modelDefault'),
    effort,
  ].join(' · ');
  const label = open ? t('chat.options.hide') : summary;
  return (
    <button
      type="button"
      className={`tool options-toggle${open ? ' on' : ''}`}
      aria-label={label}
      aria-expanded={open}
      title={label}
      onClick={() => setOpen(!open)}
    >
      <SlidersIcon size={20} />
      {!open && RISKY.includes(config.mode) && <i className="risk-dot" aria-hidden="true" />}
    </button>
  );
}
