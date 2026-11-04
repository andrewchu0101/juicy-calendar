import { useMemo } from 'react';
import { browserHourCycle, resolveHour12 } from './hour12';
import { useI18nStore } from './i18n';
import type { TimeFormatOptions } from './formatTime';

/** Language plus the 12/24-hour setting, ready to pass to `formatTime` (FR-10); updates when either changes. */
export function useTimeFormat(): TimeFormatOptions {
  const language = useI18nStore((state) => state.language);
  const systemHour12 = useI18nStore((state) => state.systemHour12);
  return useMemo(() => ({ language, hour12: resolveHour12(systemHour12, browserHourCycle()) }), [language, systemHour12]);
}
