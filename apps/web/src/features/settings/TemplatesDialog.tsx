import { useEffect, useState } from 'react';
import { downloadPlugin, pluginApi } from '../../shared/api/pluginApi';
import { ImportPluginDialog } from './ImportPluginDialog';
import { api } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';
import { KebabMenu, type MenuItem } from '../../shared/ui/KebabMenu';
import { ModalTitle } from '../../shared/ui/ModalTitle';
import { useProfiles } from '../sessions/profilesStore';
import { templateName } from '../sessions/templateName';
import { ImportTemplateDialog } from './ImportTemplateDialog';
import { toast } from '../../shared/ui/toast';
import { copyText, downloadText } from './templateFile';

const message = (e: unknown): string => (e instanceof Error ? e.message : 'failed');

/** The profile templates: what exists, with download/copy for each (built-in ones are examples), and import. */
export function TemplatesDialog({ onClose }: { onClose(): void }) {
  const t = useT();
  const templates = useProfiles((s) => s.templates);
  const [importing, setImporting] = useState(false);
  const [pluginImport, setPluginImport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const reload = (): Promise<void> => useProfiles.getState().refreshTemplates();
  useEffect(() => void reload().catch(() => undefined), []);

  const fail = (e: unknown): void => (setNote(null), setError(message(e)));
  const withText = (load: Promise<string>, use: (text: string) => Promise<void> | void): void => {
    setError(null);
    setNote(null);
    load.then(use).catch(fail);
  };
  const actions = (id: string, builtin: boolean, plugin = false, hasTests = false): MenuItem[] =>
    plugin
      ? [
          { label: t('templates.download'), onSelect: () => downloadPlugin(id) },
          ...(hasTests
            ? [
                {
                  label: t('plugins.tests'),
                  onSelect: () =>
                    withText(
                      pluginApi
                        .test(id)
                        .then(
                          (result) => `${result.code === 0 ? 'PASS' : 'FAIL'} ${result.output}`,
                        ),
                      setNote,
                    ),
                },
              ]
            : []),
          ...(builtin
            ? []
            : [
                {
                  label: t('templates.remove'),
                  danger: true,
                  onSelect: () => void pluginApi.remove(id).then(reload).catch(fail),
                },
              ]),
        ]
      : [
          {
            label: t('templates.download'),
            onSelect: () =>
              withText(api.exportTemplate(id), (text) => downloadText(`${id}.jsonc`, text)),
          },
          {
            label: t('templates.copy'),
            onSelect: () =>
              withText(api.exportTemplate(id), (text) =>
                copyText(text).then(() => toast(t('templates.copied'))),
              ),
          },
          ...(builtin
            ? []
            : [
                {
                  label: t('templates.remove'),
                  danger: true,
                  onSelect: () => void api.removeTemplate(id).then(reload).catch(fail),
                },
              ]),
        ];

  if (pluginImport)
    return (
      <ImportPluginDialog
        onClose={() => setPluginImport(false)}
        onImported={(name) => (setPluginImport(false), setNote(t('templates.imported', { name })))}
      />
    );
  if (importing) {
    return (
      <ImportTemplateDialog
        onClose={() => setImporting(false)}
        onImported={(name) => (setImporting(false), setNote(t('templates.imported', { name })))}
      />
    );
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal templates" onClick={(event) => event.stopPropagation()}>
        <ModalTitle title={t('templates.title')} onClose={onClose} />
        <p className="hint">{t('templates.intro')}</p>
        <div className="button-pair">
          <button type="button" className="primary" onClick={() => setPluginImport(true)}>
            {t('plugins.import')}
          </button>
          <button type="button" className="primary" onClick={() => setImporting(true)}>
            {t('templates.importOpen')}
          </button>
          <button
            type="button"
            onClick={() =>
              withText(api.templateSkeleton(), (text) =>
                downloadText('profile-template.jsonc', text),
              )
            }
          >
            {t('templates.example')}
          </button>
        </div>
        {error !== null && <p className="notice error">{error}</p>}
        {note !== null && <pre className="notice signin-output">{note}</pre>}
        <ul className="template-list">
          {templates.map((x) => (
            <li key={x.id}>
              <div className="template-info">
                <strong>{templateName(t, x)}</strong>
                <small>
                  {x.id} · {x.builtin ? t('templates.builtin') : t('templates.importedTag')}
                  {x.plugin ? ` · v${x.plugin.version}` : ''}
                </small>
                {x.description !== '' && <small className="hint">{x.description}</small>}
              </div>
              <KebabMenu
                items={actions(x.id, x.builtin, Boolean(x.plugin), x.plugin?.hasTests ?? false)}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
