import type { Language } from './detectLanguage';
import { formatDate } from './dateFormat';

/**
 * 日曆標題的日期範圍（FR-09、SRS R-7）。英文維持原本的寫法；中文寫法已由專案擁有者確認（2026-11-04）：
 * 單日 `2026年11月9日 星期一`、同月 `2026年11月9日 – 15日`、跨月 `2026年11月30日 – 12月6日`；
 * 跨年沿用英文的原則（只在結束日標年份）：`12月28日 – 2027年1月3日`。
 */
export function rangeLabel(days: Date[], language: Language): string {
  const first = days[0];
  const last = days.at(-1);
  if (!first || !last) return '';
  const f = (date: Date, pattern: string) => formatDate(date, pattern, language);
  const sameMonth = first.getMonth() === last.getMonth();
  const sameYear = first.getFullYear() === last.getFullYear();

  if (language === 'zh-TW') {
    if (days.length === 1) return f(first, 'yyyy年M月d日 EEEE');
    if (sameMonth && sameYear) return `${f(first, 'yyyy年M月d日')} – ${f(last, 'd日')}`;
    if (sameYear) return `${f(first, 'yyyy年M月d日')} – ${f(last, 'M月d日')}`;
    return `${f(first, 'M月d日')} – ${f(last, 'yyyy年M月d日')}`;
  }

  if (days.length === 1) return f(first, 'EEEE, MMMM d, yyyy');
  return `${f(first, 'MMM d')} – ${f(last, sameMonth ? 'd, yyyy' : 'MMM d, yyyy')}`;
}
