export type Language = 'zh-TW' | 'en';

const isChinese = (locale: string) => locale.toLowerCase().startsWith('zh');

/**
 * FR-09、SRS R-7：以 `zh` 開頭的語系（zh-TW、zh-HK、zh-CN、zh）→ 繁體中文，其餘 → 英文。
 * 系統語系有值就只看它；取不到才看 `navigator.languages` 的第一項；都沒有 → 英文。
 */
export function detectLanguage(systemLocale: string | null, navigatorLanguages: readonly string[]): Language {
  const locale = systemLocale?.trim() ? systemLocale : navigatorLanguages[0];
  return locale && isChinese(locale) ? 'zh-TW' : 'en';
}
