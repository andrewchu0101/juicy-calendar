import { create } from 'zustand';
import { backend as defaultBackend, type WorkspaceBackend } from '../services/persistence/backend';
import { detectLanguage, type Language } from './detectLanguage';
import { dictionaries, type Dictionary, type TranslationKey } from './dictionary';

/** `saveError` is a code, never a sentence or a diagnostic: the screen translates it (AGENTS.md rule 11). */
export type LanguageSaveError = 'LANGUAGE_SAVE_FAILED';
type I18nState = {
  language: Language;
  ready: boolean;
  saveError: LanguageSaveError | null;
  /** Windows' 12/24-hour setting (API-06); null until read or when it cannot be read (FR-10). */
  systemHour12: boolean | null;
};

export const useI18nStore = create<I18nState>(() => ({ language: 'en', ready: false, saveError: null, systemHour12: null }));

type LanguageBackend = Pick<WorkspaceBackend, 'readAppSettings' | 'writeAppSettings' | 'systemInfo'>;

const browserLanguages = (): readonly string[] => (typeof navigator === 'undefined' ? [] : (navigator.languages ?? []));

/**
 * Picks the language at startup: the saved one, otherwise what the system reports (FR-09, R-7).
 * Reading never writes, so a damaged settings file stays as it is until the user switches language.
 */
export async function initLanguage(
  backend: LanguageBackend = defaultBackend,
  navigatorLanguages: readonly string[] = browserLanguages(),
) {
  // An unreadable setting counts as "not set": the app must still start.
  const saved = await backend.readAppSettings().then(
    (settings) => settings.language,
    () => null,
  );
  // System info is read every time (FR-10 needs `hour12` even when a language is saved); it never blocks start-up.
  const info = await backend.systemInfo().catch(() => ({ locale: null, hour12: null }));
  const language = saved ?? detectLanguage(info.locale, navigatorLanguages);
  useI18nStore.setState({ language, ready: true, systemHour12: info.hour12 });
}

/**
 * Switches right away, then saves. A failed save never throws: the screen keeps the new language and
 * `saveError` carries a code only (no diagnostic, no path). The next successful save clears it.
 */
export async function setLanguage(language: Language, backend: LanguageBackend = defaultBackend) {
  useI18nStore.setState({ language });
  try {
    await backend.writeAppSettings({ language });
    useI18nStore.setState({ saveError: null });
  } catch {
    useI18nStore.setState({ saveError: 'LANGUAGE_SAVE_FAILED' });
  }
}

export type MissingKeyHandler = (language: Language, key: string) => void;
let onMissingKey: MissingKeyHandler = (language, key) => console.error(`Missing translation: ${language} ${key}`);
export function setMissingKeyHandler(handler: MissingKeyHandler) {
  onMissingKey = handler;
}

/** Looks a key up in `language`. A missing key shows the English text and is reported. */
export function translate(
  language: Language,
  key: TranslationKey,
  params?: Record<string, string | number>,
  source: Record<Language, Dictionary> = dictionaries,
): string {
  let text: string | undefined = source[language][key];
  if (text === undefined) {
    onMissingKey(language, key);
    text = source.en[key] ?? key;
  }
  return params ? text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole)) : text;
}
