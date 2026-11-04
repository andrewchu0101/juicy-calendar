import type { Language } from './detectLanguage';
import { translate } from './i18n';

/** 日期欄位 `+N` 徽章的說明（FR-09）。英文 1 個用單數；中文沒有單複數，兩個鍵的句型相同。 */
export function hiddenEventsTitle(language: Language, count: number): string {
  return translate(language, count === 1 ? 'grid.hiddenOne' : 'grid.hiddenMany', { count });
}
