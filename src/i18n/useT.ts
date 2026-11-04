import { useCallback } from 'react';
import { translate, useI18nStore } from './i18n';
import type { TranslationKey } from './dictionary';

/** The translate function for the current language; components re-render when the language changes. */
export function useT() {
  const language = useI18nStore((state) => state.language);
  return useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => translate(language, key, params),
    [language],
  );
}
