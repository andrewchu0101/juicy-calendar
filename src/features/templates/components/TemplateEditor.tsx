import { useState, type FormEvent } from 'react';
import { ColorPicker } from '../../../components/ColorPicker';
import { useT } from '../../../i18n/useT';
import { useAppStore } from '../../../stores/appStore';
import type { Template } from '../../../types';
import { PALETTE } from '../../../utils/color';
import { validateTitle } from '../../calendar/engine';

export function TemplateEditor({ template, onClose }: { template?: Template; onClose: () => void }) {
  const t = useT();
  const saveTemplate = useAppStore((state) => state.saveTemplate);
  const deleteTemplate = useAppStore((state) => state.deleteTemplate);
  const [name, setName] = useState(template?.name ?? '');
  const [color, setColor] = useState<string>(template?.color ?? PALETTE[3]);
  const [duration, setDuration] = useState(String(template?.defaultDuration ?? 60));
  const [confirming, setConfirming] = useState(false);

  const parsedDuration = Number(duration);
  const valid = validateTitle(name) !== null && parsedDuration > 0;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    if (saveTemplate({ id: template?.id, name, color, defaultDuration: parsedDuration })) onClose();
  };

  return (
    <form
      data-testid="template-editor"
      className="card-pop absolute top-3 left-full z-50 ml-1 flex w-[17rem] flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-xl"
      onSubmit={submit}
      onKeyDown={(key) => {
        key.stopPropagation();
        if (key.key === 'Escape') onClose();
      }}
    >
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t('field.name')}
        <input
          autoFocus
          aria-label={t('template.nameAria')}
          className="rounded-lg border border-line px-2 py-1.5 text-sm text-ink select-text"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t('template.durationLabel')}
        <input
          type="number"
          min={1}
          aria-label={t('template.durationAria')}
          className="rounded-lg border border-line px-2 py-1.5 text-sm text-ink select-text"
          value={duration}
          onChange={(event) => setDuration(event.target.value)}
        />
        <span className="text-[11px] leading-snug">{t('template.durationHint')}</span>
      </label>
      <div className="flex flex-col gap-1.5 text-xs text-muted">
        {t('color.label')}
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={!valid}
          className="rounded-full bg-ink px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {t('action.save')}
        </button>
        <button type="button" className="rounded-full px-2 py-1.5 text-sm text-muted hover:text-ink" onClick={onClose}>
          {t('action.cancel')}
        </button>
        {template && (
          <button
            type="button"
            className="ml-auto rounded-full px-2 py-1.5 text-sm text-danger"
            onClick={() => {
              if (!confirming) {
                setConfirming(true);
                return;
              }
              deleteTemplate(template.id);
              onClose();
            }}
          >
            {confirming ? t('action.confirm') : t('action.delete')}
          </button>
        )}
      </div>
    </form>
  );
}
