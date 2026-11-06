import { useT } from '../../../i18n/useT';
import { useAppStore } from '../../../stores/appStore';

/**
 * 多選時的可見刪除入口（票 026c 追加，SRS FR-14）。放在日曆上方的工具列裡（行內項目，不用絕對定位）：
 * 不遮住週日標題、活動與工具；工具列本來就會換行，空間不足時本列跟著換行。多選（2 個以上）才顯示。
 * 按下立即刪除全部選中的區塊，不問確認，整批算一個可復原步驟；與 Delete／Backspace 走同一個 action。
 */
export function SelectionBar() {
  const t = useT();
  const count = useAppStore((state) => state.selectedEventIds.length);
  const deleteSelected = useAppStore((state) => state.deleteSelected);
  if (count < 2) return null;
  return (
    <section
      data-testid="selection-bar"
      aria-live="polite"
      className="card-pop flex items-center gap-2 rounded-full border border-line bg-surface py-0.5 pr-1 pl-3.5"
    >
      <span className="text-sm text-muted tabular-nums">{t('selection.count', { count })}</span>
      <button
        data-testid="selection-delete"
        aria-label={t('selection.deleteAria', { count })}
        className="rounded-full px-3 py-1 text-sm font-medium text-danger hover:bg-line"
        onClick={() => deleteSelected()}
      >
        {t('action.delete')}
      </button>
    </section>
  );
}
