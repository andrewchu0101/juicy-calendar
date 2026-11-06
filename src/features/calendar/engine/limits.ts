/** 可調常數的唯一來源（SDS 資料模型「可調常數」）。其他程式一律引用，不得另寫數字。 */
export const NAME_MAX_CHARS = 30;
export const EVENT_MIN_MINUTES = 1;
export const EVENT_MAX_MINUTES = 10080; // 7 天
export const NEW_EVENT_MINUTES = 120;
export const RADIAL_LONG_PRESS_MS = 250; // 長按空白處叫出 radial 選單（PRD AC-01.4、SRS FR-04，票 025）
export const RADIAL_MOVE_TOLERANCE_PX = 6; // 長按期間移動超過此距離即取消
export const RADIAL_ENTER_MS = 120; // 選單球向外滑出的進場動畫（DESIGN.md）

// 日曆版面（票 027）：面板固定佔版面時，日曆區必須放得下完整的日曆欄，否則面板收合成圓點。
export const GUTTER_WIDTH_PX = 56; // 時間軸欄
export const MIN_COLUMN_WIDTH_PX = 84; // 每個日期欄的最小寬度，再窄日曆就改成內部橫向捲動
export const INSPECTOR_WIDTH_PX = 272; // 右側編輯面板寬度（17rem）
export const INSPECTOR_GAP_PX = 16; // 面板與日曆之間的間隔

