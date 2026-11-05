import type { Language } from '../i18n/detectLanguage';
import { setLanguage, useI18nStore } from '../i18n/i18n';
import { useT } from '../i18n/useT';

/** Each language is named in itself, so it can be found whatever the current language is. */
const LANGUAGE_OPTIONS: ReadonlyArray<{ value: Language; label: string }> = [
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en', label: 'English' },
];

/** The one language menu, shared by the welcome screen and the calendar toolbar (SDS UI-03). */
export function LanguageMenu({ className = '' }: { className?: string }) {
  const t = useT();
  const language = useI18nStore((state) => state.language);
  const saveError = useI18nStore((state) => state.saveError);
  return (
    <div className={`flex flex-col items-end gap-2 text-sm ${className}`}>
      <label className="flex items-center gap-2">
        <span className="text-muted">{t('language.label')}</span>
        <select
          className="rounded-full border border-line-strong bg-surface px-3 py-1.5"
          value={language}
          onChange={(event) => void setLanguage(event.target.value as Language)}
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {saveError && (
        <p role="alert" className="rounded-xl bg-danger px-3 py-2 text-white">
          {t('language.saveFailed')}
        </p>
      )}
    </div>
  );
}
