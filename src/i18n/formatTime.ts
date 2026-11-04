import type { Language } from './detectLanguage';

export type TimeFormatOptions = { language: Language; hour12: boolean };

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * 時間的顯示格式（FR-10、SRS R-7、SDS `formatTime`）：12 或 24 小時只跟 Windows 設定走（`hour12`），
 * 與介面語言無關；12 小時制的寫法才依語言：英文 `1:05 PM`，繁體 `下午 1:05`。
 * 繁體的午夜是 `上午 12:00`、正午是 `下午 12:00`（規格暫定）。24 小時制補零：`09:07`。
 */
export function formatTime(date: Date, { language, hour12 }: TimeFormatOptions): string {
  const hours = date.getHours();
  const minutes = pad(date.getMinutes());
  if (!hour12) return `${pad(hours)}:${minutes}`;
  const clock = `${hours % 12 === 0 ? 12 : hours % 12}:${minutes}`;
  const pm = hours >= 12;
  return language === 'zh-TW' ? `${pm ? '下午' : '上午'} ${clock}` : `${clock} ${pm ? 'PM' : 'AM'}`;
}
