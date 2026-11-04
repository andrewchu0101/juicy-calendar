import { format } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { zhTW } from 'date-fns/locale/zh-TW';
import type { Language } from './detectLanguage';

/** FR-09、SRS R-7：星期與月份用 date-fns 內建的語系，不新增套件。 */
const dateLocales: Record<Language, typeof enUS> = { en: enUS, 'zh-TW': zhTW };

/** `date-fns` 的 `format`，名稱依 `language` 輸出；數字與標點不受語言影響。 */
export function formatDate(date: Date, pattern: string, language: Language): string {
  return format(date, pattern, { locale: dateLocales[language] });
}
