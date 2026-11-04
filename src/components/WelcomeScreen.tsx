import type { Language } from '../i18n/detectLanguage';
import { setLanguage, useI18nStore } from '../i18n/i18n';
import { useT } from '../i18n/useT';
import { openErrorText } from '../services/notices/notices';
import { selectWorkspace } from '../services/workspace/workspaceSession';
import { useAppStore } from '../stores/appStore';
import { PALETTE } from '../utils/color';

/** Each language is named in itself, so it can be found whatever the current language is. */
const LANGUAGE_OPTIONS: ReadonlyArray<{ value: Language; label: string }> = [
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en', label: 'English' },
];

function LanguageMenu() {
  const t = useT();
  const language = useI18nStore((state) => state.language);
  const saveError = useI18nStore((state) => state.saveError);
  return (
    <div className="absolute top-4 right-4 flex flex-col items-end gap-2 text-sm">
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

export function WelcomeScreen() {
  const t = useT();
  const openError = useAppStore((state) => state.openError);
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-8 px-6 text-center select-none">
      <LanguageMenu />
      <div className="flex gap-3" aria-hidden>
        {PALETTE.slice(0, 5).map((color) => (
          <span key={color} className="ball size-10" style={{ '--ball-color': color, cursor: 'default' } as React.CSSProperties} />
        ))}
      </div>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Juicy Calendar</h1>
        <p className="mt-2 text-muted">{t('welcome.tagline')}</p>
      </div>
      <div className="flex gap-3">
        <button
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition-transform hover:scale-105 active:scale-95"
          onClick={() => void selectWorkspace('create')}
        >
          {t('welcome.create')}
        </button>
        <button
          className="rounded-full border border-line-strong bg-surface px-5 py-2.5 text-sm font-medium transition-transform hover:scale-105 active:scale-95"
          onClick={() => void selectWorkspace('open')}
        >
          {t('welcome.open')}
        </button>
      </div>
      {openError && (
        <p role="alert" className="max-w-md text-sm text-danger">
          {openErrorText(openError)}
        </p>
      )}
    </div>
  );
}
