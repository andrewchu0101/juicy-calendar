/**
 * 12 小時制嗎？（FR-10、SDS API-06）以 Windows 的設定為準（`system`，Rust 回報）；取不到（null）才看
 * 瀏覽器 Intl 的 `hourCycle`：h11／h12 → 12 小時制，h23／h24 → 24 小時制。都沒有資訊時用 24 小時制。
 */
export function resolveHour12(system: boolean | null, intlHourCycle: string | undefined): boolean {
  if (system !== null) return system;
  return intlHourCycle === 'h11' || intlHourCycle === 'h12';
}

/** 瀏覽器目前語系的 `hourCycle`；取不到時為 undefined。 */
export function browserHourCycle(): string | undefined {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle;
  } catch {
    return undefined;
  }
}
