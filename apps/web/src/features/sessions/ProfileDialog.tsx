import { fieldProblem } from '@deck/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';
import { useProfiles } from './profilesStore';
import { fieldTexts, templateName } from './templateName';

interface Props {
  /** Called after a profile is created, so the caller can show it. */
  onDone(): void;
  onClose(): void;
}

/** Makes a named, clean terminal from a template. Nothing about logins or keys: that is set up inside it. */
export function ProfileDialog({ onDone, onClose }: Props) {
  const t = useT();
  const templates = useProfiles((s) => s.templates);
  const [label, setLabel] = useState('');
  const [baseId, setBaseId] = useState('claude');
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(
    () =>
      void useProfiles
        .getState()
        .refreshTemplates()
        .catch(() => undefined),
    [],
  );

  const template = templates.find((x) => x.id === baseId) ?? templates[0];
  const invalid = template ? fieldProblem(template, values) !== null : true;

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (busy || !template) return;
    setBusy(true);
    setError(null);
    api
      .createProfile({ label: label.trim(), base: template.id, values })
      .then(() => useProfiles.getState().refresh())
      .then(onDone)
      .catch((e: unknown) => (setError(e instanceof Error ? e.message : 'failed'), setBusy(false)));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('profile.title')}</h2>
        <p className="hint">{t('profile.intro')}</p>
        <form className="profile-form" onSubmit={submit}>
          <label>
            {t('profile.label')}
            <input
              required
              value={label}
              maxLength={60}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label>
            {t('profile.base')}
            <select
              value={template?.id ?? baseId}
              onChange={(e) => (setBaseId(e.target.value), setValues({}))}
            >
              {templates.map((x) => (
                <option key={x.id} value={x.id}>
                  {templateName(t, x)}
                </option>
              ))}
            </select>
            {template && !template.builtin && template.description !== '' && (
              <span className="hint">{template.description}</span>
            )}
          </label>
          {template?.fields.map((field) => {
            const text = fieldTexts(t, template, field);
            return (
              <label key={field.key}>
                {text.label}
                <input
                  required={field.required}
                  type={field.type === 'url' ? 'url' : 'text'}
                  value={values[field.key] ?? ''}
                  placeholder={field.placeholder}
                  spellCheck={false}
                  autoCapitalize="off"
                  inputMode={field.type === 'url' ? 'url' : undefined}
                  onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                />
                {text.hint !== '' && <span className="hint">{text.hint}</span>}
              </label>
            );
          })}
          {error !== null && <p className="notice error">{error}</p>}
          <div className="row">
            <button
              type="submit"
              className="primary"
              disabled={busy || label.trim() === '' || invalid}
            >
              {t('profile.create')}
            </button>
            <button type="button" onClick={onClose}>
              {t('common.close')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
