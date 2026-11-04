import { formatTime, type TimeFormatOptions } from './formatTime';

/**
 * 區塊上的時間範圍（FR-10、SRS R-7）：兩端各自用 `formatTime`，以 `–` 相接。
 * 12 小時制的範圍寫法規格未定，這是專案擁有者 2026-11-04 同意的暫定寫法：
 * 英文 `10:30 AM–12:30 PM`、繁體 `上午 10:30–下午 12:30`；24 小時制 `10:30–12:30`。
 */
export function formatTimeRange(event: { startAt: string; endAt: string }, options: TimeFormatOptions): string {
  return `${formatTime(new Date(event.startAt), options)}–${formatTime(new Date(event.endAt), options)}`;
}
